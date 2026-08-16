import type { PaymentStatus } from "@/lib/supabase/types";

// A payment is "overdue" if it's still pending/partial and belongs to a
// billing period strictly before the current one. v1 never writes
// 'overdue' into the stored status column itself (no scheduled job flips
// it) — this is computed at read time wherever it's needed (fees list,
// money view), so it stays in one place.
//
// Calendar-billed classes compare calendar months: a fee for the month
// in progress is due, not overdue, until the month rolls over.
//
// Session-cycle billed classes compare exact cycle start dates instead —
// a cycle isn't a fixed number of weeks, so two different cycles for the
// same class can land in the same calendar month, and month alone can't
// tell them apart (see migration 0011/0012). A cycle-billed fee is
// tagged with its own cycle's start date when generated; it's overdue
// once the class has moved on to a newer cycle than the one it belongs
// to.
export function isOverdue(
  status: PaymentStatus,
  payment: { month: string; cycle_started_at: string },
  cls: { billing_cycle_sessions: number | null; cycle_started_at: string | null },
  currentMonth: string,
): boolean {
  if (status !== "pending" && status !== "partial") return false;

  if (cls.billing_cycle_sessions !== null && cls.cycle_started_at) {
    return payment.cycle_started_at < cls.cycle_started_at;
  }
  return payment.month.slice(0, 7) < currentMonth.slice(0, 7);
}
