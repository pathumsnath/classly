import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TutorPaymentModel } from "@/lib/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function monthDateRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number);
  const start = `${year}-${String(mon).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10); // last day of month
  return { start, end };
}

async function collectedFees(supabase: SupabaseClient, classId: string, month: string): Promise<number> {
  const { data } = await supabase.from("payments").select("amount_paid").eq("class_id", classId).eq("month", month);
  return (data ?? []).reduce((sum, p) => sum + p.amount_paid, 0);
}

async function paidStudents(supabase: SupabaseClient, classId: string, month: string): Promise<number> {
  const { data } = await supabase.from("payments").select("amount_paid").eq("class_id", classId).eq("month", month);
  return (data ?? []).filter((p) => p.amount_paid > 0).length;
}

// Everything still unpaid for this class, across every month (not just the
// one being viewed) — not yet part of any collectedFees sum, so not yet
// reflected in any month's salary. Once collected it lands on whichever
// month the fee was originally for, not necessarily "next month".
async function outstandingFees(supabase: SupabaseClient, classId: string): Promise<number> {
  const { data } = await supabase
    .from("payments")
    .select("balance")
    .eq("class_id", classId)
    .in("status", ["pending", "partial"]);
  return (data ?? []).reduce((sum, p) => sum + p.balance, 0);
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
  model: TutorPaymentModel;
  value: number;
  amount: number;
  // Only meaningful for revenue_share — the class's total collected fees
  // this month, so the UI can show income / institute commission / salary
  // as a breakdown instead of just the tutor's final cut.
  collectedFees: number | null;
  // Only meaningful for revenue_share — total unpaid balance for this
  // class across every month, so the UI can show the tutor's potential
  // cut once it's eventually collected.
  outstandingFees: number | null;
}

// FR-7.5 — one class's contribution to its tutor's salary for a month.
// Share/per-student models are collected-money-based (FR-7.2): the
// institute never pays out more than it actually took in.
export async function calculateClassSalary(
  supabase: SupabaseClient,
  cls: { id: string; subject: string; tutor_payment_model: TutorPaymentModel; tutor_payment_value: number },
  month: string,
): Promise<ClassSalaryBreakdown> {
  let amount = 0;
  let collected: number | null = null;
  let outstanding: number | null = null;

  switch (cls.tutor_payment_model) {
    case "revenue_share":
      collected = await collectedFees(supabase, cls.id, month);
      amount = collected * (cls.tutor_payment_value / 100);
      outstanding = await outstandingFees(supabase, cls.id);
      break;
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
    model: cls.tutor_payment_model,
    value: cls.tutor_payment_value,
    amount,
    collectedFees: collected,
    outstandingFees: outstanding,
  };
}
