"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import { GRADE_OPTIONS, MEDIUM_OPTIONS } from "@/lib/classes/labels";
import type { FeeType, TutorPaymentModel, GradeLevel, ClassMedium } from "@/lib/supabase/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
  classId?: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;

const PAYMENT_MODELS: TutorPaymentModel[] = ["revenue_share", "fixed", "per_student", "per_session"];
const GRADES = GRADE_OPTIONS.map((g) => g.value);
const MEDIUMS = MEDIUM_OPTIONS.map((m) => m.value);

// The main /classes form sends an existing subjectId (picked from a
// dropdown). The onboarding wizard's class step sends newSubjectName
// instead — there's no dedicated "add subjects" step before it, so a
// fresh institute would otherwise always hit an empty subjects list here.
// Both paths funnel through this one action.
async function resolveSubjectId(
  admin: AdminClient,
  instituteId: string,
  formData: FormData,
): Promise<string | { error: string }> {
  const subjectId = String(formData.get("subjectId") || "");
  if (subjectId) return subjectId;

  const newSubjectName = String(formData.get("newSubjectName") || "").trim();
  if (!newSubjectName) return { error: "Select or enter a subject." };

  const { data: existing } = await admin
    .from("subjects")
    .select("id")
    .eq("institute_id", instituteId)
    .eq("name", newSubjectName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("subjects")
    .insert({ institute_id: instituteId, name: newSubjectName })
    .select("id")
    .single();

  if (error || !created) return { error: `Could not create subject: ${error?.message}` };
  return created.id;
}

interface ParsedClassInput {
  grade: GradeLevel;
  medium: ClassMedium;
  tutorId: string;
  scheduleDays: string[];
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  room: string | null;
  maxStudents: number | null;
  feeAmount: number;
  feeType: FeeType;
  tutorPaymentModel: TutorPaymentModel;
  tutorPaymentValue: number;
  groupName: string | null;
  // Null = the default calendar-month cron billing. A number opts this
  // class into session-cycle billing instead (see submitAttendance).
  billingCycleSessions: number | null;
  // Only meaningful alongside billingCycleSessions — sessions are counted
  // from this date onward, so it can be backdated to cover sessions that
  // already happened before session-cycle billing was turned on.
  cycleStartDate: string | null;
}

function parseClassInput(formData: FormData): ParsedClassInput | { error: string } {
  const grade = String(formData.get("grade") || "") as GradeLevel;
  const medium = String(formData.get("medium") || "") as ClassMedium;
  const tutorId = String(formData.get("tutorId") || "");
  const scheduleDays = formData.getAll("scheduleDays").map(String);
  const scheduleStartTime = String(formData.get("scheduleStartTime") || "") || null;
  const scheduleEndTime = String(formData.get("scheduleEndTime") || "") || null;
  const room = String(formData.get("room") || "").trim() || null;
  const groupName = String(formData.get("groupName") || "").trim() || null;
  const maxStudentsRaw = String(formData.get("maxStudents") || "").trim();
  const feeAmountRaw = String(formData.get("feeAmount") || "").trim();
  const tutorPaymentModel = String(formData.get("tutorPaymentModel") || "") as TutorPaymentModel;
  const tutorPaymentValueRaw = String(formData.get("tutorPaymentValue") || "").trim();

  if (!tutorId) return { error: "Tutor is required." };
  if (!GRADES.includes(grade)) return { error: "Select a grade." };
  if (!MEDIUMS.includes(medium)) return { error: "Select a medium." };
  if (scheduleDays.length === 0) return { error: "Select at least one day." };
  if (!scheduleStartTime || !scheduleEndTime) return { error: "Start and end time are required." };
  if (scheduleEndTime <= scheduleStartTime) return { error: "End time must be after start time." };

  const feeAmount = Number(feeAmountRaw);
  if (!feeAmountRaw || Number.isNaN(feeAmount) || feeAmount < 0) {
    return { error: "A valid fee amount is required." };
  }
  if (!PAYMENT_MODELS.includes(tutorPaymentModel)) return { error: "Select a tutor payment model." };

  const tutorPaymentValue = Number(tutorPaymentValueRaw);
  if (!tutorPaymentValueRaw || Number.isNaN(tutorPaymentValue) || tutorPaymentValue < 0) {
    return { error: "A valid tutor payment value is required." };
  }

  const maxStudents = maxStudentsRaw ? Number(maxStudentsRaw) : null;
  if (maxStudentsRaw && (Number.isNaN(maxStudents) || (maxStudents ?? 0) < 1)) {
    return { error: "Max students must be a positive number." };
  }

  const billingCycleSessionsRaw = String(formData.get("billingCycleSessions") || "").trim();
  const billingCycleSessions = billingCycleSessionsRaw ? Number(billingCycleSessionsRaw) : null;
  if (billingCycleSessionsRaw && (Number.isNaN(billingCycleSessions) || (billingCycleSessions ?? 0) < 1)) {
    return { error: "Sessions per billing cycle must be a positive number." };
  }

  const cycleStartDate = String(formData.get("cycleStartDate") || "").trim() || null;
  if (billingCycleSessions !== null && !cycleStartDate) {
    return { error: "Cycle start date is required when billing by session count." };
  }

  return {
    grade,
    medium,
    tutorId,
    scheduleDays,
    scheduleStartTime,
    scheduleEndTime,
    room,
    maxStudents,
    feeAmount,
    // Per-session proration was never built — every class bills the flat
    // fee amount monthly regardless, so this is no longer a real choice.
    feeType: "monthly_flat",
    tutorPaymentModel,
    tutorPaymentValue,
    groupName,
    billingCycleSessions,
    cycleStartDate,
  };
}

export async function createClass(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const admin = createAdminClient();

  const subjectId = await resolveSubjectId(admin, session.instituteId, formData);
  if (typeof subjectId !== "string") return subjectId;

  const parsed = parseClassInput(formData);
  if ("error" in parsed) return parsed;

  const { data, error } = await admin
    .from("classes")
    .insert({
      institute_id: session.instituteId,
      tutor_id: parsed.tutorId,
      subject_id: subjectId,
      grade: parsed.grade,
      medium: parsed.medium,
      schedule_days: parsed.scheduleDays,
      schedule_start_time: parsed.scheduleStartTime,
      schedule_end_time: parsed.scheduleEndTime,
      room: parsed.room,
      max_students: parsed.maxStudents,
      fee_amount: parsed.feeAmount,
      fee_type: parsed.feeType,
      tutor_payment_model: parsed.tutorPaymentModel,
      tutor_payment_value: parsed.tutorPaymentValue,
      group_name: parsed.groupName,
      billing_cycle_sessions: parsed.billingCycleSessions,
      cycle_started_at: parsed.cycleStartDate,
    })
    .select("id")
    .single();

  if (error || !data) return { error: `Could not create class: ${error?.message}` };

  revalidatePath("/classes");
  return { success: true, classId: data.id };
}

export async function updateClass(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const classId = String(formData.get("classId") || "");
  if (!classId) return { error: "Missing class." };

  const admin = createAdminClient();

  const subjectId = await resolveSubjectId(admin, session.instituteId, formData);
  if (typeof subjectId !== "string") return subjectId;

  const parsed = parseClassInput(formData);
  if ("error" in parsed) return parsed;

  const { error } = await admin
    .from("classes")
    .update({
      tutor_id: parsed.tutorId,
      subject_id: subjectId,
      grade: parsed.grade,
      medium: parsed.medium,
      schedule_days: parsed.scheduleDays,
      schedule_start_time: parsed.scheduleStartTime,
      schedule_end_time: parsed.scheduleEndTime,
      room: parsed.room,
      max_students: parsed.maxStudents,
      fee_amount: parsed.feeAmount,
      fee_type: parsed.feeType,
      tutor_payment_model: parsed.tutorPaymentModel,
      tutor_payment_value: parsed.tutorPaymentValue,
      group_name: parsed.groupName,
      billing_cycle_sessions: parsed.billingCycleSessions,
      cycle_started_at: parsed.cycleStartDate,
    })
    .eq("id", classId)
    .eq("institute_id", session.instituteId);

  if (error) return { error: `Could not update class: ${error.message}` };

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}
