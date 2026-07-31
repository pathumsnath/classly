"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

type AdminClient = ReturnType<typeof createAdminClient>;

// Phone-first (FR-3.4): reuse the existing directory row for this phone if
// one exists, otherwise create it. Tutors/students never get an
// auth_user_id — they have no login in v1.
async function findOrCreatePerson(
  admin: AdminClient,
  { name, phone, email, parentPhone }: { name: string; phone: string; email: string | null; parentPhone: string | null },
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await admin.from("users").select("id").eq("phone", phone).maybeSingle();
  if (existing) return { id: existing.id };

  const { data: created, error } = await admin
    .from("users")
    .insert({ name, phone, email, parent_phone: parentPhone })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Could not create person." };
  return { id: created.id };
}

export async function addTutor(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!name || !phone) {
    return { error: "Name and phone are required." };
  }

  const admin = createAdminClient();
  const person = await findOrCreatePerson(admin, { name, phone, email: email || null, parentPhone: null });
  if ("error" in person) return { error: person.error };

  const { data: existingLink } = await admin
    .from("institute_tutors")
    .select("id")
    .eq("institute_id", session.instituteId)
    .eq("tutor_id", person.id)
    .maybeSingle();

  if (existingLink) {
    return { error: "This person is already a tutor at your institute." };
  }

  const { error } = await admin
    .from("institute_tutors")
    .insert({ institute_id: session.instituteId, tutor_id: person.id, status: "active" });

  if (error) return { error: `Could not add tutor: ${error.message}` };

  revalidatePath("/people/tutors");
  return { success: true };
}

export async function updateTutor(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();

  const tutorId = String(formData.get("tutorId") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!tutorId || !name || !phone) {
    return { error: "Name and phone are required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ name, phone, email: email || null })
    .eq("id", tutorId);

  if (error) return { error: `Could not update tutor: ${error.message}` };

  revalidatePath("/people/tutors");
  return { success: true };
}

export async function setTutorStatus(tutorId: string, status: "active" | "inactive"): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("institute_tutors")
    .update({ status })
    .eq("institute_id", session.instituteId)
    .eq("tutor_id", tutorId);

  if (error) throw new Error(`Could not update tutor status: ${error.message}`);

  revalidatePath("/people/tutors");
}

export async function addStudent(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const parentPhone = String(formData.get("parentPhone") || "").trim();

  if (!name || !phone) {
    return { error: "Name and phone are required." };
  }

  const admin = createAdminClient();
  const person = await findOrCreatePerson(admin, {
    name,
    phone,
    email: null,
    parentPhone: parentPhone || null,
  });
  if ("error" in person) return { error: person.error };

  const { data: existingLink } = await admin
    .from("institute_students")
    .select("id")
    .eq("institute_id", session.instituteId)
    .eq("student_id", person.id)
    .maybeSingle();

  if (existingLink) {
    return { error: "This person is already a student at your institute." };
  }

  const { error } = await admin
    .from("institute_students")
    .insert({ institute_id: session.instituteId, student_id: person.id, status: "active" });

  if (error) return { error: `Could not add student: ${error.message}` };

  revalidatePath("/people/students");
  return { success: true };
}

export async function updateStudent(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();

  const studentId = String(formData.get("studentId") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const parentPhone = String(formData.get("parentPhone") || "").trim();

  if (!studentId || !name || !phone) {
    return { error: "Name and phone are required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ name, phone, parent_phone: parentPhone || null })
    .eq("id", studentId);

  if (error) return { error: `Could not update student: ${error.message}` };

  revalidatePath("/people/students");
  return { success: true };
}

export async function setStudentStatus(studentId: string, status: "active" | "inactive"): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("institute_students")
    .update({ status })
    .eq("institute_id", session.instituteId)
    .eq("student_id", studentId);

  if (error) throw new Error(`Could not update student status: ${error.message}`);

  revalidatePath("/people/students");
}
