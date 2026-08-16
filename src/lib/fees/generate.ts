import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledDatesInMonth } from "@/lib/attendance/session-dates";
import { trueUpFee, countAttendedByStudent } from "@/lib/fees/proration";
import { nextMonth } from "@/lib/time";

export interface GenerateFeesResult {
  created: number;
}

// FR-6.1 — one payments row per active enrollment per month, amount_due =
// class.fee_amount flat, billed in full before that month's attendance
// is known (see trueUpMonthlyFees for the attendance-based correction
// once it is). Idempotent: relies on payments' unique(student_id,
// class_id, cycle_started_at) constraint via ignoreDuplicates, so calling
// this twice for the same institute+month is harmless. cycle_started_at
// is set equal to month here — this is a calendar-billed fee, not an
// actual cycle, but the column doubles as a single non-null dedupe key
// shared with session-cycle billing (see generateFeesForClass, migration
// 0012) so both models can rely on one plain unique constraint.
//
// Skips classes on session-cycle billing (billing_cycle_sessions set) —
// those get their fee from generateFeesForClass instead, billed the
// moment their cycle starts (at setup, and again each time a cycle
// closes and the next one begins) rather than on the 1st, so generating
// one here too would double-bill them.
export async function generateMonthlyFees(instituteId: string, month: string): Promise<GenerateFeesResult> {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("student_id, class_id")
    .eq("institute_id", instituteId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return { created: 0 };

  const classIds = [...new Set(enrollments.map((e) => e.class_id))];
  const { data: classes } = await admin
    .from("classes")
    .select("id, fee_amount, billing_cycle_sessions")
    .in("id", classIds);
  const calendarBilledClasses = (classes ?? []).filter((c) => c.billing_cycle_sessions === null);
  const feeByClassId = new Map(calendarBilledClasses.map((c) => [c.id, c.fee_amount]));

  const rows = enrollments
    .filter((e) => feeByClassId.has(e.class_id))
    .map((e) => ({
      institute_id: instituteId,
      student_id: e.student_id,
      class_id: e.class_id,
      month,
      cycle_started_at: month,
      amount_due: feeByClassId.get(e.class_id) ?? 0,
      status: "pending" as const,
    }));

  if (rows.length === 0) return { created: 0 };

  const { data: inserted, error } = await admin
    .from("payments")
    .upsert(rows, { onConflict: "student_id,class_id,cycle_started_at", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not generate fees: ${error.message}`);

  return { created: inserted?.length ?? 0 };
}

// The session-cycle counterpart to generateMonthlyFees — one class at a
// time, called both when a class is first set up for cycle billing and
// every time a cycle closes and the next one begins (see
// maybeCloseBillingCycle in attendance/actions.ts). Bills the upcoming
// cycle in advance, same prepay principle as calendar billing's
// 1st-of-the-month generation, rather than after it's delivered. `month`
// is the calendar month the cycle *starts* in (see monthOfDate), used
// for the salary sheet and money reports downstream; `cycleStartDate` is
// its exact start date, used instead of month to dedupe/identify this
// specific cycle's fee (see migration 0011 — two cycles for the same
// class can land in the same calendar month, since a cycle isn't a fixed
// number of weeks).
export async function generateFeesForClass(
  classId: string,
  month: string,
  cycleStartDate: string,
): Promise<GenerateFeesResult> {
  const admin = createAdminClient();

  const [{ data: enrollments }, { data: cls }] = await Promise.all([
    admin.from("enrollments").select("student_id").eq("class_id", classId).eq("status", "active"),
    admin.from("classes").select("institute_id, fee_amount").eq("id", classId).maybeSingle(),
  ]);

  if (!enrollments || enrollments.length === 0 || !cls) return { created: 0 };

  const rows = enrollments.map((e) => ({
    institute_id: cls.institute_id,
    student_id: e.student_id,
    class_id: classId,
    month,
    cycle_started_at: cycleStartDate,
    amount_due: cls.fee_amount,
    status: "pending" as const,
  }));

  const { data: inserted, error } = await admin
    .from("payments")
    .upsert(rows, { onConflict: "student_id,class_id,cycle_started_at", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not generate fees: ${error.message}`);

  return { created: inserted?.length ?? 0 };
}

// The calendar-billing counterpart to trueUpClosingCycle (see
// attendance/actions.ts) — corrects a just-ended month's fee down to
// match how many of its scheduled sessions each student actually
// attended. Called by the cron route right before generating fees for
// the new month, once the previous month's attendance is fully known.
// Skips session-cycle billed classes — they're trued up when their own
// cycle closes instead, not on a calendar boundary.
export async function trueUpMonthlyFees(instituteId: string, month: string): Promise<{ adjusted: number }> {
  const admin = createAdminClient();

  const { data: payments } = await admin
    .from("payments")
    .select("id, class_id, student_id, amount_paid")
    .eq("institute_id", instituteId)
    .eq("month", month);

  if (!payments || payments.length === 0) return { adjusted: 0 };

  const classIds = [...new Set(payments.map((p) => p.class_id))];
  const { data: classes } = await admin
    .from("classes")
    .select("id, fee_amount, schedule_days, billing_cycle_sessions")
    .in("id", classIds);
  const calendarClasses = (classes ?? []).filter((c) => c.billing_cycle_sessions === null);
  if (calendarClasses.length === 0) return { adjusted: 0 };

  const { data: ownerRole } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("institute_id", instituteId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  // No owner to attribute a wallet credit to (shouldn't happen in
  // practice) — skip the true-up rather than fail the whole cron run.
  if (!ownerRole) return { adjusted: 0 };

  let adjusted = 0;
  for (const cls of calendarClasses) {
    const classPayments = payments.filter((p) => p.class_id === cls.id);
    if (classPayments.length === 0) continue;

    const { data: cancellations } = await admin
      .from("class_cancellations")
      .select("date")
      .eq("class_id", cls.id)
      .gte("date", month)
      .lt("date", nextMonth(month));
    const cancelledDates = new Set((cancellations ?? []).map((c) => c.date));
    const sessionDates = scheduledDatesInMonth(cls.schedule_days, month, cancelledDates);

    const { data: enrollments } = await admin.from("enrollments").select("id, student_id").eq("class_id", cls.id);
    const studentByEnrollment = new Map((enrollments ?? []).map((e) => [e.id, e.student_id]));

    const { data: attendanceRows } = await admin
      .from("attendance")
      .select("enrollment_id, status")
      .eq("class_id", cls.id)
      .in("date", sessionDates);
    const attendedByStudent = countAttendedByStudent(attendanceRows ?? [], studentByEnrollment);

    for (const payment of classPayments) {
      const attended = attendedByStudent.get(payment.student_id) ?? 0;
      await trueUpFee(
        admin,
        { id: payment.id, amountPaid: payment.amount_paid, instituteId, studentId: payment.student_id },
        cls.fee_amount,
        attended,
        sessionDates.length,
        ownerRole.user_id,
      );
      adjusted++;
    }
  }

  return { adjusted };
}
