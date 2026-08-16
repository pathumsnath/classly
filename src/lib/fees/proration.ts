import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Attendance-based fee tiers, confirmed with the institute owner: miss
// every session in the period and the fee is waived entirely; attend
// up to half (rounded down) and it's half price; attend more than half
// and it's the full fee. Only 4-session cycles exist today (0=0%,
// 1-2=50%, 3-4=100%) but this generalizes proportionally to any
// sessionsTotal rather than hardcoding 4.
export function attendanceFeeMultiplier(sessionsAttended: number, sessionsTotal: number): number {
  if (sessionsTotal <= 0 || sessionsAttended <= 0) return 0;
  if (sessionsAttended <= Math.floor(sessionsTotal / 2)) return 0.5;
  return 1;
}

// Prepay bills the full fee before a period's sessions are known; once
// they're all recorded (a cycle closes, or a calendar month ends), this
// corrects that fee down to match actual attendance — never up. A
// student who already paid more than the corrected amount keeps the
// difference as wallet credit rather than being left with a negative
// balance or refunded in cash.
export async function trueUpFee(
  admin: ReturnType<typeof createAdminClient>,
  payment: { id: string; amountPaid: number; instituteId: string; studentId: string },
  fullFeeAmount: number,
  sessionsAttended: number,
  sessionsTotal: number,
  recordedBy: string,
): Promise<void> {
  const multiplier = attendanceFeeMultiplier(sessionsAttended, sessionsTotal);
  const newAmountDue = Math.round(fullFeeAmount * multiplier * 100) / 100;

  const overpaid = payment.amountPaid > newAmountDue ? payment.amountPaid - newAmountDue : 0;
  const newAmountPaid = overpaid > 0 ? newAmountDue : payment.amountPaid;
  const status = newAmountDue === 0 || newAmountPaid >= newAmountDue ? "paid" : newAmountPaid > 0 ? "partial" : "pending";

  // No-op if attendance already fully justified the original fee — most
  // rows (the common case, full attendance) skip a write entirely.
  if (newAmountDue === fullFeeAmount && newAmountPaid === payment.amountPaid) return;

  await admin
    .from("payments")
    .update({ amount_due: newAmountDue, amount_paid: newAmountPaid, status })
    .eq("id", payment.id);

  if (overpaid > 0) {
    await admin.from("wallet_transactions").insert({
      institute_id: payment.instituteId,
      student_id: payment.studentId,
      amount: overpaid,
      type: "credit",
      payment_id: payment.id,
      note: "Fee reduced after attendance true-up — overpayment parked as credit",
      recorded_by: recordedBy,
    });
  }
}

// Attended = present or late; only absent doesn't count. Shared by both
// the cycle-billing and calendar-billing true-up paths.
export function countAttendedByStudent(
  attendanceRows: { enrollment_id: string; status: string }[],
  studentByEnrollment: Map<string, string>,
): Map<string, number> {
  const attended = new Map<string, number>();
  for (const a of attendanceRows) {
    if (a.status !== "present" && a.status !== "late") continue;
    const studentId = studentByEnrollment.get(a.enrollment_id);
    if (!studentId) continue;
    attended.set(studentId, (attended.get(studentId) ?? 0) + 1);
  }
  return attended;
}
