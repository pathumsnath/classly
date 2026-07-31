import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import type { TutorStatus } from "@/lib/supabase/types";

export interface TutorRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: TutorStatus;
}

export interface StudentRow {
  id: string;
  name: string;
  phone: string;
  parentPhone: string | null;
  status: TutorStatus;
}

export async function getPerson(userId: string): Promise<{ id: string; name: string; phone: string } | null> {
  await requireSession();
  const supabase = await createClient();

  // RLS (users_select) already scopes this to people visible within the
  // caller's institute — no separate institute_id check needed here.
  const { data } = await supabase.from("users").select("id, name, phone").eq("id", userId).maybeSingle();
  return data;
}

export async function listTutors(): Promise<TutorRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("institute_tutors")
    .select("tutor_id, status")
    .eq("institute_id", session.instituteId)
    .order("created_at", { ascending: true });

  if (!links || links.length === 0) return [];

  const { data: people } = await supabase
    .from("users")
    .select("id, name, phone, email")
    .in(
      "id",
      links.map((l) => l.tutor_id),
    );

  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  return links.flatMap((link) => {
    const person = byId.get(link.tutor_id);
    if (!person) return [];
    return [{ id: person.id, name: person.name, phone: person.phone, email: person.email, status: link.status }];
  });
}

export async function listStudents(): Promise<StudentRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("institute_students")
    .select("student_id, status")
    .eq("institute_id", session.instituteId)
    .order("created_at", { ascending: true });

  if (!links || links.length === 0) return [];

  const { data: people } = await supabase
    .from("users")
    .select("id, name, phone, parent_phone")
    .in(
      "id",
      links.map((l) => l.student_id),
    );

  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  return links.flatMap((link) => {
    const person = byId.get(link.student_id);
    if (!person) return [];
    return [
      {
        id: person.id,
        name: person.name,
        phone: person.phone,
        parentPhone: person.parent_phone,
        status: link.status,
      },
    ];
  });
}
