import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Ported verbatim from src/lib/fees/proration.ts — see that file for the
// full rationale/history. Keep both copies in sync if the tiers change;
// the web app's calendar-billing monthly cron keeps its own copy of this
// same pure math too (deliberately, low-frequency-change, low risk — see
// the Flutter plan's Section 5).
export function attendanceFeeMultiplier(sessionsAttended: number, sessionsTotal: number): number {
  if (sessionsTotal <= 0 || sessionsAttended <= 0) return 0;
  if (sessionsAttended <= Math.floor(sessionsTotal / 2)) return 0.5;
  return 1;
}

export async function trueUpFee(
  admin: SupabaseClient,
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
