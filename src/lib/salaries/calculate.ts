import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TutorPaymentModel, GradeLevel, ClassMedium } from "@/lib/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function monthDateRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number);
  const start = `${year}-${String(mon).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10); // last day of month
  return { start, end };
}

async function paidStudents(supabase: SupabaseClient, classId: string, month: string): Promise<number> {
  const { data } = await supabase.from("payments").select("amount_paid").eq("class_id", classId).eq("month", month);
  return (data ?? []).filter((p) => p.amount_paid > 0).length;
}

// Cash-basis (FR-7.2: the institute never pays out more than it actually
// took in) — income for a month is whatever was actually collected during
// that calendar month, split into fees that were due this month vs. an
// earlier month's overdue fee finally settled now. A fee due this month
// but not paid until a later month correctly counts toward that later
// month instead, not this one.
//
// Known limitation: a payments row only stores one cumulative amount_paid
// and one paid_date (the most recent update), not a per-installment
// history. If the same fee is paid in parts across two different months,
// the whole cumulative amount lands on the month of the last installment
// rather than being split proportionally. Fine for the common case (a fee
// sits unpaid, then gets settled in one payment) but not exact for that
// split-across-months edge case.
async function revenueShareFigures(
  supabase: SupabaseClient,
  classId: string,
  month: string,
): Promise<{ collectedThisMonth: number; overdueReceived: number; outstanding: number; outstandingCycleCount: number }> {
  const { start, end } = monthDateRange(month);
  const { data } = await supabase
    .from("payments")
    .select("amount_paid, balance, status, month, paid_date, cycle_started_at")
    .eq("class_id", classId);
  const rows = data ?? [];

  const collectedInMonth = rows.filter(
    (p) => p.amount_paid > 0 && p.paid_date !== null && p.paid_date >= start && p.paid_date <= end,
  );
  const collectedThisMonth = collectedInMonth
    .filter((p) => p.month === month)
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const overdueReceived = collectedInMonth
    .filter((p) => p.month !== month)
    .reduce((sum, p) => sum + p.amount_paid, 0);

  const outstandingRows = rows.filter((p) => p.status === "pending" || p.status === "partial");
  const outstanding = outstandingRows.reduce((sum, p) => sum + p.balance, 0);
  // Session-cycle classes can have unpaid balances spanning more than one
  // billing cycle at once (each cycle bills upfront the moment it starts —
  // see maybeCloseBillingCycle) — distinguishing that from a single large
  // unpaid fee is what the UI needs to avoid this looking like a duplicate.
  const outstandingCycleCount = new Set(
    outstandingRows.filter((p) => p.cycle_started_at !== null).map((p) => p.cycle_started_at),
  ).size;

  return { collectedThisMonth, overdueReceived, outstanding, outstandingCycleCount };
}

// A session "happened" if any attendance was recorded for that date,
// regardless of individual present/absent — matches FR-7.1.4's "sessions
// held that month (counted from attendance)."
async function sessionsHeld(supabase: SupabaseClient, classId: string, month: string): Promise<number> {
  const { start, end } = monthDateRange(month);
  const { data } = await supabase
    .from("attendance")
    .select("date")
    .eq("class_id", classId)
    .gte("date", start)
    .lte("date", end);
  return new Set((data ?? []).map((a) => a.date)).size;
}

export interface ClassSalaryBreakdown {
  classId: string;
  subject: string;
  groupName: string | null;
  grade: GradeLevel | null;
  medium: ClassMedium | null;
  model: TutorPaymentModel;
  value: number;
  amount: number;
  // Only meaningful for revenue_share — total cash actually collected
  // during this month (this month's own fees + any past-overdue fee
  // settled now), so the UI can show income / institute commission /
  // salary as a breakdown instead of just the tutor's final cut.
  collectedFees: number | null;
  // Only meaningful for revenue_share — the portion of collectedFees that
  // came from settling a fee originally due in an earlier month, so the
  // UI can call that out separately (e.g. "incl. LKR X carried forward").
  overdueReceived: number | null;
  // Only meaningful for revenue_share — total unpaid balance for this
  // class across every month, so the UI can show the tutor's potential
  // cut once it's eventually collected.
  outstandingFees: number | null;
  // Only meaningful for revenue_share — how many distinct session-cycles
  // (see billingCycleSessions) the outstandingFees total spans. 0 or 1 for
  // an ordinary calendar-billed class or a cycle class with just one
  // unpaid period; >1 means it's genuinely two-or-more separate unpaid
  // bills stacked together, not one number that looks too big.
  outstandingCycleCount: number | null;
}

// FR-7.5 — one class's contribution to its tutor's salary for a month.
// Share/per-student models are collected-money-based (FR-7.2): the
// institute never pays out more than it actually took in.
//
// `revenueShareCommissionPercent` is the institute-wide commission rate
// (Settings, owner-only) — it overrides every revenue_share class's own
// stored tutor_payment_value, so all revenue_share classes share one rate
// instead of each being negotiated individually. Other models (fixed,
// per_student, per_session) are unaffected and still use their own
// tutor_payment_value.
export async function calculateClassSalary(
  supabase: SupabaseClient,
  cls: {
    id: string;
    subject: string;
    groupName: string | null;
    grade: GradeLevel | null;
    medium: ClassMedium | null;
    tutor_payment_model: TutorPaymentModel;
    tutor_payment_value: number;
  },
  month: string,
  revenueShareCommissionPercent: number,
): Promise<ClassSalaryBreakdown> {
  let amount = 0;
  let collected: number | null = null;
  let overdueReceived: number | null = null;
  let outstanding: number | null = null;
  let outstandingCycleCount: number | null = null;
  let value = cls.tutor_payment_value;

  switch (cls.tutor_payment_model) {
    case "revenue_share": {
      value = 100 - revenueShareCommissionPercent;
      const figures = await revenueShareFigures(supabase, cls.id, month);
      collected = figures.collectedThisMonth + figures.overdueReceived;
      overdueReceived = figures.overdueReceived;
      outstanding = figures.outstanding;
      outstandingCycleCount = figures.outstandingCycleCount;
      amount = collected * (value / 100);
      break;
    }
    case "fixed":
      amount = cls.tutor_payment_value;
      break;
    case "per_student":
      amount = (await paidStudents(supabase, cls.id, month)) * cls.tutor_payment_value;
      break;
    case "per_session":
      amount = (await sessionsHeld(supabase, cls.id, month)) * cls.tutor_payment_value;
      break;
  }

  return {
    classId: cls.id,
    subject: cls.subject,
    groupName: cls.groupName,
    grade: cls.grade,
    medium: cls.medium,
    model: cls.tutor_payment_model,
    value,
    amount,
    collectedFees: collected,
    overdueReceived,
    outstandingFees: outstanding,
    outstandingCycleCount,
  };
}
