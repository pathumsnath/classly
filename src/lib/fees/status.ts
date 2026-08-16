import type { PaymentStatus } from "@/lib/supabase/types";

// A payment is "overdue" for display/aggregation purposes if it's still
// pending/partial from a strictly earlier month than the given reference
// month. v1 never writes 'overdue' into the stored status column itself
// (no scheduled job flips it) — this is computed at read time wherever
// it's needed (fees list, money view), so it stays in one place.
//
// A session-cycle class's fee only ever comes into existence once its
// cycle has already closed (see generateFeesForClass) — there's no
// "not due yet" grace period the way a calendar month has one, so any
// unpaid balance for it is overdue immediately, not on some later
// calendar boundary.
export function isOverdue(status: PaymentStatus, month: string, referenceMonth: string, isCycleBilled = false): boolean {
  if (status !== "pending" && status !== "partial") return false;
  if (isCycleBilled) return true;
  return month.slice(0, 7) < referenceMonth.slice(0, 7);
}
