"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import type { FeeType, TutorPaymentModel } from "@/lib/supabase/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const FEE_TYPES: FeeType[] = ["monthly_flat", "per_session"];
const PAYMENT_MODELS: TutorPaymentModel[] = ["revenue_share", "fixed", "per_student", "per_session"];

interface ParsedClassInput {
  subject: string;
  tutorId: string;
  scheduleDays: string[];
  scheduleTime: string | null;
  room: string | null;
  maxStudents: number | null;
  feeAmount: number;
  feeType: FeeType;
  tutorPaymentModel: TutorPaymentModel;
  tutorPaymentValue: number;
}

function parseClassInput(formData: FormData): ParsedClassInput | { error: string } {
  const subject = String(formData.get("subject") || "").trim();
  const tutorId = String(formData.get("tutorId") || "");
  const scheduleDays = formData.getAll("scheduleDays").map(String);
  const scheduleTime = String(formData.get("scheduleTime") || "") || null;
  const room = String(formData.get("room") || "").trim() || null;
  const maxStudentsRaw = String(formData.get("maxStudents") || "").trim();
  const feeAmountRaw = String(formData.get("feeAmount") || "").trim();
  const feeType = String(formData.get("feeType") || "") as FeeType;
  const tutorPaymentModel = String(formData.get("tutorPaymentModel") || "") as TutorPaymentModel;
  const tutorPaymentValueRaw = String(formData.get("tutorPaymentValue") || "").trim();

  if (!subject || !tutorId) return { error: "Subject and tutor are required." };

  const feeAmount = Number(feeAmountRaw);
  if (!feeAmountRaw || Number.isNaN(feeAmount) || feeAmount < 0) {
    return { error: "A valid fee amount is required." };
  }
  if (!FEE_TYPES.includes(feeType)) return { error: "Select a fee type." };
  if (!PAYMENT_MODELS.includes(tutorPaymentModel)) return { error: "Select a tutor payment model." };

  const tutorPaymentValue = Number(tutorPaymentValueRaw);
  if (!tutorPaymentValueRaw || Number.isNaN(tutorPaymentValue) || tutorPaymentValue < 0) {
    return { error: "A valid tutor payment value is required." };
  }

  const maxStudents = maxStudentsRaw ? Number(maxStudentsRaw) : null;
  if (maxStudentsRaw && (Number.isNaN(maxStudents) || (maxStudents ?? 0) < 1)) {
    return { error: "Max students must be a positive number." };
  }

  return {
    subject,
    tutorId,
    scheduleDays,
    scheduleTime,
    room,
    maxStudents,
    feeAmount,
    feeType,
    tutorPaymentModel,
    tutorPaymentValue,
  };
}

export async function createClass(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = parseClassInput(formData);
  if ("error" in parsed) return parsed;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("classes")
    .insert({
      institute_id: session.instituteId,
      tutor_id: parsed.tutorId,
      subject: parsed.subject,
      schedule_days: parsed.scheduleDays,
      schedule_time: parsed.scheduleTime,
      room: parsed.room,
      max_students: parsed.maxStudents,
      fee_amount: parsed.feeAmount,
      fee_type: parsed.feeType,
      tutor_payment_model: parsed.tutorPaymentModel,
      tutor_payment_value: parsed.tutorPaymentValue,
    })
    .select("id")
    .single();

  if (error || !data) return { error: `Could not create class: ${error?.message}` };

  revalidatePath("/classes");
  redirect(`/classes/${data.id}`);
}

export async function updateClass(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const classId = String(formData.get("classId") || "");
  if (!classId) return { error: "Missing class." };

  const parsed = parseClassInput(formData);
  if ("error" in parsed) return parsed;

  const admin = createAdminClient();
  const { error } = await admin
    .from("classes")
    .update({
      tutor_id: parsed.tutorId,
      subject: parsed.subject,
      schedule_days: parsed.scheduleDays,
      schedule_time: parsed.scheduleTime,
      room: parsed.room,
      max_students: parsed.maxStudents,
      fee_amount: parsed.feeAmount,
      fee_type: parsed.feeType,
      tutor_payment_model: parsed.tutorPaymentModel,
      tutor_payment_value: parsed.tutorPaymentValue,
    })
    .eq("id", classId)
    .eq("institute_id", session.instituteId);

  if (error) return { error: `Could not update class: ${error.message}` };

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}
