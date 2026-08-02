import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import type { Database, WalletTransactionType } from "@/lib/supabase/types";

interface WalletRow {
  student_id: string;
  amount: number;
  type: WalletTransactionType;
}

function sumBalance(rows: WalletRow[]): number {
  return rows.reduce((sum, r) => sum + (r.type === "credit" ? r.amount : -r.amount), 0);
}

// A student's spare credit at this institute (from past overpayment) —
// usable toward any of their classes here, not just the one it came from.
export async function getWalletBalance(studentId: string): Promise<number> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("wallet_transactions")
    .select("student_id, amount, type")
    .eq("institute_id", session.instituteId)
    .eq("student_id", studentId);

  return sumBalance((data ?? []) as WalletRow[]);
}

// Batch form for attendance rosters and for recordPayment's spend check.
// Generic client (like subjectNamesById) so both the RLS server client and
// the admin client satisfy it — institute_id is filtered explicitly since
// the admin client bypasses RLS.
export async function getWalletBalancesByStudent(
  supabase: SupabaseClient<Database>,
  instituteId: string,
  studentIds: string[],
): Promise<Map<string, number>> {
  if (studentIds.length === 0) return new Map();

  const { data } = await supabase
    .from("wallet_transactions")
    .select("student_id, amount, type")
    .eq("institute_id", instituteId)
    .in("student_id", studentIds);

  const byStudent = new Map<string, WalletRow[]>();
  for (const row of (data ?? []) as WalletRow[]) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  }

  return new Map(studentIds.map((id) => [id, sumBalance(byStudent.get(id) ?? [])]));
}

// Convenience wrapper for pages that already have a plain student list and
// just want everyone's balance in one round trip (e.g. a dashboard picker
// that needs to show "(LKR X available)" for whichever student gets
// selected, without a query per student).
export async function getWalletBalancesForStudents(studentIds: string[]): Promise<Map<string, number>> {
  const session = await requireSession();
  const supabase = await createClient();
  return getWalletBalancesByStudent(supabase, session.instituteId, studentIds);
}
