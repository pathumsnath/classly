import { resolveSession, assertClassAccess } from "../_shared/session.ts";
import { createAdminClient } from "../_shared/adminClient.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { trueUpFee, countAttendedByStudent } from "../_shared/proration.ts";
import { generateFeesForClass } from "../_shared/generate.ts";
import { monthOfDate, nextDay } from "../_shared/time.ts";

const STATUSES = ["present", "absent", "late"];

interface Entry {
  enrollmentId: string;
  status: string;
}

// Ported from src/lib/attendance/actions.ts's trueUpClosingCycle — corrects
// the just-closed cycle's fee down to match actual attendance.
async function trueUpClosingCycle(
  // deno-lint-ignore no-explicit-any
  admin: any,
  classId: string,
  cycleStartedAt: string,
  sessionDates: string[],
  recordedBy: string,
): Promise<void> {
  const { data: cls } = await admin.from("classes").select("institute_id, fee_amount").eq("id", classId).maybeSingle();
  if (!cls) return;

  const { data: payments } = await admin
    .from("payments")
    .select("id, student_id, amount_paid")
    .eq("class_id", classId)
    .eq("cycle_started_at", cycleStartedAt);
  if (!payments || payments.length === 0) return;

  const { data: enrollments } = await admin.from("enrollments").select("id, student_id").eq("class_id", classId);
  const studentByEnrollment = new Map(
    (enrollments ?? []).map((e: { id: string; student_id: string }) => [e.id, e.student_id]),
  );

  const { data: attendanceRows } = await admin
    .from("attendance")
    .select("enrollment_id, status")
    .eq("class_id", classId)
    .in("date", sessionDates);

  const attendedByStudent = countAttendedByStudent(attendanceRows ?? [], studentByEnrollment);

  for (const payment of payments) {
    const attended = attendedByStudent.get(payment.student_id) ?? 0;
    await trueUpFee(
      admin,
      { id: payment.id, amountPaid: payment.amount_paid, instituteId: cls.institute_id, studentId: payment.student_id },
      cls.fee_amount,
      attended,
      sessionDates.length,
      recordedBy,
    );
  }
}

// Ported from src/lib/attendance/actions.ts's maybeCloseBillingCycle.
// deno-lint-ignore no-explicit-any
async function maybeCloseBillingCycle(admin: any, classId: string, recordedBy: string): Promise<boolean> {
  const { data: cls } = await admin
    .from("classes")
    .select("billing_cycle_sessions, cycle_started_at")
    .eq("id", classId)
    .maybeSingle();

  if (!cls || cls.billing_cycle_sessions === null || !cls.cycle_started_at) return false;

  const { data: sessions } = await admin
    .from("attendance")
    .select("date")
    .eq("class_id", classId)
    .gte("date", cls.cycle_started_at);

  const distinctDates = [...new Set((sessions ?? []).map((s: { date: string }) => s.date))].sort() as string[];
  if (distinctDates.length < cls.billing_cycle_sessions) return false;

  const closingCycleStart = cls.cycle_started_at;
  const lastSessionDate = distinctDates[distinctDates.length - 1];
  const nextCycleStart = nextDay(lastSessionDate);

  await trueUpClosingCycle(admin, classId, closingCycleStart, distinctDates, recordedBy);
  await generateFeesForClass(admin, classId, monthOfDate(nextCycleStart), nextCycleStart);
  await admin.from("classes").update({ cycle_started_at: nextCycleStart }).eq("id", classId);

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const resolved = await resolveSession(req);
  if (!resolved) return jsonResponse({ error: "Not signed in." }, 401);
  const { session } = resolved;

  let body: { classId?: string; date?: string; entries?: Entry[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const { classId, date, entries } = body;
  if (!classId || !date || !entries || entries.length === 0) {
    return jsonResponse({ error: "Nothing to submit." }, 400);
  }

  const admin = createAdminClient();

  const access = await assertClassAccess(admin, session, classId);
  if (!access.ok) return jsonResponse({ error: access.message }, 403);

  const rows = entries.map((e) => ({
    institute_id: session.instituteId,
    enrollment_id: e.enrollmentId,
    class_id: classId,
    date,
    status: STATUSES.includes(e.status) ? e.status : "present",
    recorded_by: session.userId,
    recorded_at: new Date().toISOString(),
  }));

  // Submitting attendance for a date un-cancels it, if it had been cancelled.
  await admin.from("class_cancellations").delete().eq("class_id", classId).eq("date", date);

  const { error } = await admin.from("attendance").upsert(rows, { onConflict: "enrollment_id,date" });
  if (error) return jsonResponse({ error: `Could not submit attendance: ${error.message}` }, 500);

  // Attendance is already saved at this point — a billing-cycle hiccup
  // shouldn't surface as "could not submit attendance" when it did.
  let cycleCompleted = false;
  try {
    cycleCompleted = await maybeCloseBillingCycle(admin, classId, session.userId);
  } catch (err) {
    console.error("Could not close billing cycle:", err);
  }

  return jsonResponse({ success: true, cycleCompleted });
});
