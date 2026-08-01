import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { calculateClassSalary, type ClassSalaryBreakdown } from "./calculate";
import { subjectNamesById } from "@/lib/subjects/queries";
import type { PaymentMethod, SalaryStatus } from "@/lib/supabase/types";

export interface TutorSalary {
  tutorId: string;
  tutorName: string;
  classes: ClassSalaryBreakdown[];
  total: number;
  status: SalaryStatus;
  paidAmount: number | null;
}

// FR-7.3/7.6 — owner-only (requireOwner, plus salary_payments' own RLS as
// a second layer — see plan). Empty result is expected and fine before
// real fee/attendance data exists. `filterTutorIds` lets the single-tutor
// detail page reuse this without computing every other tutor's breakdown
// just to discard it.
export async function getTutorSalaries(month: string, filterTutorIds?: string[]): Promise<TutorSalary[]> {
  const session = await requireOwner();
  const supabase = await createClient();

  let tutorLinksQuery = supabase
    .from("institute_tutors")
    .select("tutor_id")
    .eq("institute_id", session.instituteId)
    .eq("status", "active");
  if (filterTutorIds) tutorLinksQuery = tutorLinksQuery.in("tutor_id", filterTutorIds);

  const { data: tutorLinks } = await tutorLinksQuery;

  if (!tutorLinks || tutorLinks.length === 0) return [];

  const tutorIds = tutorLinks.map((t) => t.tutor_id);

  const [{ data: tutors }, { data: classes }, { data: salaryPayments }] = await Promise.all([
    supabase.from("users").select("id, name").in("id", tutorIds),
    supabase
      .from("classes")
      .select("id, subject_id, tutor_id, tutor_payment_model, tutor_payment_value")
      .eq("institute_id", session.instituteId)
      .in("tutor_id", tutorIds),
    supabase
      .from("salary_payments")
      .select("tutor_id, amount, status")
      .eq("institute_id", session.instituteId)
      .eq("month", month),
  ]);

  const subjectNames = await subjectNamesById(
    supabase,
    (classes ?? []).map((c) => c.subject_id),
  );

  const nameById = new Map((tutors ?? []).map((t) => [t.id, t.name]));
  const salaryByTutor = new Map((salaryPayments ?? []).map((s) => [s.tutor_id, s]));

  // Tutors are independent of each other — compute all of them
  // concurrently instead of one at a time.
  const results = await Promise.all(
    tutorIds.map(async (tutorId) => {
      const tutorClasses = (classes ?? []).filter((c) => c.tutor_id === tutorId);
      const breakdown = await Promise.all(
        tutorClasses.map((c) =>
          calculateClassSalary(supabase, { ...c, subject: subjectNames.get(c.subject_id) ?? "Unknown" }, month),
        ),
      );
      const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
      const salary = salaryByTutor.get(tutorId);

      return {
        tutorId,
        tutorName: nameById.get(tutorId) ?? "Unknown",
        classes: breakdown,
        total,
        status: salary?.status ?? "pending",
        paidAmount: salary?.amount ?? null,
      };
    }),
  );

  return results;
}

export async function getTutorSalary(tutorId: string, month: string): Promise<TutorSalary | null> {
  const salaries = await getTutorSalaries(month, [tutorId]);
  return salaries[0] ?? null;
}

export interface SalaryPaymentRow {
  id: string;
  month: string;
  amount: number;
  status: SalaryStatus;
  method: PaymentMethod | null;
  paidDate: string | null;
}

// Every recorded salary payout for this tutor, most recent month first —
// owner-only, same as the rest of this domain (see plan).
export async function listSalaryPaymentsForTutor(tutorId: string): Promise<SalaryPaymentRow[]> {
  const session = await requireOwner();
  const supabase = await createClient();

  const { data } = await supabase
    .from("salary_payments")
    .select("id, month, amount, status, method, paid_date")
    .eq("institute_id", session.instituteId)
    .eq("tutor_id", tutorId)
    .order("month", { ascending: false });

  return (data ?? []).map((s) => ({
    id: s.id,
    month: s.month,
    amount: s.amount,
    status: s.status,
    method: s.method,
    paidDate: s.paid_date,
  }));
}
