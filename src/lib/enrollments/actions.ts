"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import { findOrCreateStudent } from "@/lib/people/actions";
import { generateMonthlyFees } from "@/lib/fees/generate";
import { currentMonthInColombo } from "@/lib/time";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Accepts either an existing studentId (the dropdown path) or
// name/phone/parentPhone (the inline "+ New student" path) — mirrors how
// createClass branches on subjectId vs newSubjectName.
export async function enrollStudent(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const classId = String(formData.get("classId") || "");
  if (!classId) return { error: "Missing class." };

  const admin = createAdminClient();

  let studentId = String(formData.get("studentId") || "");
  if (!studentId) {
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const parentPhone = String(formData.get("parentPhone") || "").trim();

    if (!name || !phone) return { error: "Select a student, or enter a name and phone." };

    const resolved = await findOrCreateStudent(admin, session.instituteId, {
      name,
      phone,
      parentPhone: parentPhone || null,
    });
    if ("error" in resolved) return { error: resolved.error };
    studentId = resolved.id;
  }

  // enrollments has a unique(student_id, class_id) constraint — a student
  // unenrolled earlier (FR-4.3, status set to inactive, never deleted)
  // re-enrolls by flipping that same row back to active, not a new insert.
  const { data: existing } = await admin
    .from("enrollments")
    .select("id, status")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing?.status === "active") {
    return { error: "This student is already enrolled in this class." };
  }

  if (existing) {
    const { error } = await admin.from("enrollments").update({ status: "active" }).eq("id", existing.id);
    if (error) return { error: `Could not re-enrol: ${error.message}` };
  } else {
    const { error } = await admin.from("enrollments").insert({
      institute_id: session.instituteId,
      class_id: classId,
      student_id: studentId,
      status: "active",
    });
    if (error) return { error: `Could not enrol: ${error.message}` };
  }

  // The monthly cron only runs on the 1st, so a student enrolled mid-month
  // would otherwise show "no fee" until next month — backfill this
  // month's fee now instead. Idempotent (upsert + ignoreDuplicates), so
  // this is safe even if the cron already ran for this institute+month.
  await generateMonthlyFees(session.instituteId, currentMonthInColombo());

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

export async function unenrollStudent(classId: string, studentId: string): Promise<void> {
  await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("enrollments")
    .update({ status: "inactive" })
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) throw new Error(`Could not unenrol: ${error.message}`);

  revalidatePath(`/classes/${classId}`);
}
