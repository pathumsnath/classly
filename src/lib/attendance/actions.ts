"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import { sendSms } from "@/lib/sms";
import type { AttendanceStatus } from "@/lib/supabase/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const STATUSES: AttendanceStatus[] = ["present", "absent", "late"];

// FR-5.3/5.4/5.9 — bulk upsert one status per enrollment for this
// class+date. attendance has unique(enrollment_id, date), so re-submitting
// an already-marked date (editing) overwrites in place rather than erroring.
export async function submitAttendance(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const classId = String(formData.get("classId") || "");
  const date = String(formData.get("date") || "");
  const enrollmentIds = formData.getAll("enrollmentId").map(String);

  if (!classId || !date || enrollmentIds.length === 0) {
    return { error: "Nothing to submit." };
  }

  const rows = enrollmentIds.map((enrollmentId) => {
    const rawStatus = String(formData.get(`status_${enrollmentId}`) || "present");
    const status = (STATUSES as string[]).includes(rawStatus) ? (rawStatus as AttendanceStatus) : "present";
    return {
      institute_id: session.instituteId,
      enrollment_id: enrollmentId,
      class_id: classId,
      date,
      status,
      recorded_by: session.userId,
      recorded_at: new Date().toISOString(),
    };
  });

  const admin = createAdminClient();

  // Submitting attendance for a date un-cancels it, if it had been cancelled.
  await admin.from("class_cancellations").delete().eq("class_id", classId).eq("date", date);

  const { error } = await admin.from("attendance").upsert(rows, { onConflict: "enrollment_id,date" });
  if (error) return { error: `Could not submit attendance: ${error.message}` };

  revalidatePath(`/attendance/${classId}`);
  return { success: true };
}

// FR-5.8 — cancelling a date clears any attendance already recorded for
// it: "no attendance recorded, nobody marked absent."
export async function markClassCancelled(classId: string, date: string): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  await admin.from("attendance").delete().eq("class_id", classId).eq("date", date);

  const { error } = await admin
    .from("class_cancellations")
    .upsert(
      { institute_id: session.instituteId, class_id: classId, date, recorded_by: session.userId },
      { onConflict: "class_id,date" },
    );

  if (error) throw new Error(`Could not cancel class: ${error.message}`);

  revalidatePath(`/attendance/${classId}`);
}

export async function undoCancelClass(classId: string, date: string): Promise<void> {
  await requireSession();

  const admin = createAdminClient();
  const { error } = await admin.from("class_cancellations").delete().eq("class_id", classId).eq("date", date);
  if (error) throw new Error(`Could not undo cancellation: ${error.message}`);

  revalidatePath(`/attendance/${classId}`);
}

// FR-5.7 — explicit, opt-in only (FR-9.3: never silent bulk). Only
// students actually marked absent this date get texted, never the whole
// class. A per-student send failure is logged and skipped, not fatal to
// the rest of the batch.
export async function sendAbsenceAlerts(classId: string, date: string): Promise<{ sent: number }> {
  const session = await requireSession();
  const admin = createAdminClient();

  const { data: absentRows } = await admin
    .from("attendance")
    .select("enrollment_id")
    .eq("class_id", classId)
    .eq("date", date)
    .eq("status", "absent");

  if (!absentRows || absentRows.length === 0) return { sent: 0 };

  const enrollmentIds = absentRows.map((a) => a.enrollment_id);
  const { data: enrollments } = await admin.from("enrollments").select("student_id").in("id", enrollmentIds);
  const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];

  const [{ data: students }, { data: cls }] = await Promise.all([
    admin.from("users").select("id, name, phone, parent_phone").in("id", studentIds),
    admin.from("classes").select("subject").eq("id", classId).maybeSingle(),
  ]);

  let sent = 0;
  for (const student of students ?? []) {
    const to = student.parent_phone || student.phone;
    const message = `${student.name} was marked absent in ${cls?.subject ?? "class"} on ${date}. - ${session.instituteName}`;

    try {
      await sendSms({ to, message });
      await admin.from("notifications").insert({
        user_id: student.id,
        institute_id: session.instituteId,
        type: "attendance_alert",
        message,
      });
      sent++;
    } catch (err) {
      console.error("Failed to send absence alert:", err);
    }
  }

  return { sent };
}
