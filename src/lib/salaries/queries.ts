import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, requireSession, ForbiddenError } from "@/lib/auth/require-owner";
import { calculateClassSalary, type ClassSalaryBreakdown } from "./calculate";
import { subjectNamesById } from "@/lib/subjects/queries";
import type { PaymentMethod, SalaryStatus } from "@/lib/supabase/types";

export interface TutorAdvanceRow {
  id: string;
  amount: number;
  reason: string;
  recordedAt: string;
}

export interface TutorSalary {
  tutorId: string;
  tutorName: string;
  classes: ClassSalaryBreakdown[];
  total: number;
  advances: TutorAdvanceRow[];
  advancesTotal: number;
  // What's actually payable this month — total minus advances already
  // taken, never below zero (an advance can't turn into money owed back).
  netTotal: number;
  status: SalaryStatus;
  paidAmount: number | null;
}

// FR-7.3/7.6 — owner-only, with one carve-out: a tutor may request their
// own salary alone (filterTutorIds === [their own id]), for the tutor
// dashboard's self-view. Anything broader than that stays owner-only.
// salary_payments' own RLS enforces the same carve-out as a second layer.
// `filterTutorIds` also lets the single-tutor detail page reuse this
// without computing every other tutor's breakdown just to discard it.
export async function getTutorSalaries(month: string, filterTutorIds?: string[]): Promise<TutorSalary[]> {
  const session = await requireSession();
  const isSelfOnly = filterTutorIds?.length === 1 && filterTutorIds[0] === session.userId;
  if (session.role !== "owner" && !(session.role === "tutor" && isSelfOnly)) {
    throw new ForbiddenError("This action is restricted to the institute owner.");
  }
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

  const [{ data: tutors }, { data: classes }, { data: salaryPayments }, { data: advances }, { data: institute }] =
    await Promise.all([
      supabase.from("users").select("id, name").in("id", tutorIds),
      supabase
        .from("classes")
        .select("id, subject_id, tutor_id, tutor_payment_model, tutor_payment_value, group_name")
        .eq("institute_id", session.instituteId)
        .in("tutor_id", tutorIds),
      supabase
        .from("salary_payments")
        .select("tutor_id, amount, status")
        .eq("institute_id", session.instituteId)
        .eq("month", month),
      supabase
        .from("tutor_advances")
        .select("id, tutor_id, amount, reason, recorded_at")
        .eq("institute_id", session.instituteId)
        .eq("month", month)
        .in("tutor_id", tutorIds),
      supabase.from("institutes").select("revenue_share_commission_percent").eq("id", session.instituteId).single(),
    ]);

  const revenueShareCommissionPercent = institute?.revenue_share_commission_percent ?? 25;

  const subjectNames = await subjectNamesById(
    supabase,
    (classes ?? []).map((c) => c.subject_id),
  );

  const nameById = new Map((tutors ?? []).map((t) => [t.id, t.name]));
  const salaryByTutor = new Map((salaryPayments ?? []).map((s) => [s.tutor_id, s]));

  const advancesByTutor = new Map<string, TutorAdvanceRow[]>();
  for (const a of advances ?? []) {
    const list = advancesByTutor.get(a.tutor_id) ?? [];
    list.push({ id: a.id, amount: a.amount, reason: a.reason, recordedAt: a.recorded_at });
    advancesByTutor.set(a.tutor_id, list);
  }

  // Tutors are independent of each other — compute all of them
  // concurrently instead of one at a time.
  const results = await Promise.all(
    tutorIds.map(async (tutorId) => {
      const tutorClasses = (classes ?? []).filter((c) => c.tutor_id === tutorId);
      const breakdown = await Promise.all(
        tutorClasses.map((c) =>
          calculateClassSalary(
            supabase,
            { ...c, subject: subjectNames.get(c.subject_id) ?? "Unknown", groupName: c.group_name },
            month,
            revenueShareCommissionPercent,
          ),
        ),
      );
      const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
      const salary = salaryByTutor.get(tutorId);
      const tutorAdvances = advancesByTutor.get(tutorId) ?? [];
      const advancesTotal = tutorAdvances.reduce((sum, a) => sum + a.amount, 0);

      return {
        tutorId,
        tutorName: nameById.get(tutorId) ?? "Unknown",
        classes: breakdown,
        total,
        advances: tutorAdvances,
        advancesTotal,
        netTotal: Math.max(0, total - advancesTotal),
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

export interface TutorIncomePoint {
  month: string;
  netTotal: number;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// Trailing `months` (including endMonth), oldest first — the tutor
// dashboard's income trend chart. Reuses getTutorSalary's own self-view
// carve-out, so no separate authorization check is needed here.
export async function getTutorIncomeTrend(tutorId: string, months: number, endMonth: string): Promise<TutorIncomePoint[]> {
  const monthList = Array.from({ length: months }, (_, i) => shiftMonth(endMonth, i - (months - 1)));
  const salaries = await Promise.all(monthList.map((month) => getTutorSalary(tutorId, month)));
  return monthList.map((month, i) => ({ month, netTotal: salaries[i]?.netTotal ?? 0 }));
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
