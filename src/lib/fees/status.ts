import type { PaymentStatus } from "@/lib/supabase/types";

// A payment is "overdue" for display/aggregation purposes if it's still
// pending/partial from a strictly earlier month than the given reference
// month. v1 never writes 'overdue' into the stored status column itself
// (no scheduled job flips it) — this is computed at read time wherever
// it's needed (fees list, money view), so it stays in one place.
export function isOverdue(status: PaymentStatus, month: string, referenceMonth: string): boolean {
  return (status === "pending" || status === "partial") && month.slice(0, 7) < referenceMonth.slice(0, 7);
}
