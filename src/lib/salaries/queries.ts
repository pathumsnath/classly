import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { calculateClassSalary, type ClassSalaryBreakdown } from "./calculate";
import { subjectNamesById } from "@/lib/subjects/queries";
import type { SalaryStatus } from "@/lib/supabase/types";

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
// real fee/attendance data exists.
export async function getTutorSalaries(month: string): Promise<TutorSalary[]> {
  const session = await requireOwner();
  const supabase = await createClient();

  const { data: tutorLinks } = await supabase
    .from("institute_tutors")
    .select("tutor_id")
    .eq("institute_id", session.instituteId)
    .eq("status", "active");

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

  const results: TutorSalary[] = [];
  for (const tutorId of tutorIds) {
    const tutorClasses = (classes ?? []).filter((c) => c.tutor_id === tutorId);
    const breakdown = await Promise.all(
      tutorClasses.map((c) =>
        calculateClassSalary(supabase, { ...c, subject: subjectNames.get(c.subject_id) ?? "Unknown" }, month),
      ),
    );
    const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
    const salary = salaryByTutor.get(tutorId);

    results.push({
      tutorId,
      tutorName: nameById.get(tutorId) ?? "Unknown",
      classes: breakdown,
      total,
      status: salary?.status ?? "pending",
      paidAmount: salary?.amount ?? null,
    });
  }

  return results;
}
