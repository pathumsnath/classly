"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function addSubject(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Subject name is required." };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("subjects")
    .select("id")
    .eq("institute_id", session.instituteId)
    .eq("name", name)
    .maybeSingle();

  if (existing) return { error: "This subject already exists." };

  const { error } = await admin.from("subjects").insert({ institute_id: session.instituteId, name });
  if (error) return { error: `Could not add subject: ${error.message}` };

  revalidatePath("/subjects");
  return { success: true };
}

export async function setSubjectStatus(subjectId: string, status: "active" | "inactive"): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("subjects")
    .update({ status })
    .eq("id", subjectId)
    .eq("institute_id", session.instituteId);

  if (error) throw new Error(`Could not update subject status: ${error.message}`);

  revalidatePath("/subjects");
}
