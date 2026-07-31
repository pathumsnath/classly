import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import type { Database, TutorStatus } from "@/lib/supabase/types";

export interface SubjectRow {
  id: string;
  name: string;
  status: TutorStatus;
}

export async function listSubjects(): Promise<SubjectRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("subjects")
    .select("id, name, status")
    .eq("institute_id", session.instituteId)
    .order("name", { ascending: true });

  return data ?? [];
}

// Shared by attendance/fees/money/salaries queries, which all need to
// display a class's subject name but only store subject_id. Typed against
// the generic client so both the RLS-respecting server client and the
// admin (service-role) client satisfy it.
export async function subjectNamesById(
  supabase: SupabaseClient<Database>,
  subjectIds: string[],
): Promise<Map<string, string>> {
  if (subjectIds.length === 0) return new Map();
  const { data } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}
