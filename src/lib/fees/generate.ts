import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GenerateFeesResult {
  created: number;
}

// FR-6.1 — one payments row per active enrollment per month, amount_due =
// class.fee_amount flat (see plan: per-session proration deliberately
// deferred past v1). Idempotent: relies on payments' existing
// unique(student_id, class_id, month) constraint via ignoreDuplicates, so
// calling this twice for the same institute+month is harmless.
//
// Skips classes on session-cycle billing (billing_cycle_sessions set) —
// those get their fee from generateFeesForClass instead, triggered when
// their Nth session's attendance is recorded rather than on the 1st, so
// generating one here too would double-bill them.
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
      amount_due: feeByClassId.get(e.class_id) ?? 0,
      status: "pending" as const,
    }));

  if (rows.length === 0) return { created: 0 };

  const { data: inserted, error } = await admin
    .from("payments")
    .upsert(rows, { onConflict: "student_id,class_id,month", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not generate fees: ${error.message}`);

  return { created: inserted?.length ?? 0 };
}

// The session-cycle counterpart to generateMonthlyFees — one class at a
// time, triggered from submitAttendance the moment its Nth session lands,
// not on a schedule. `month` is the calendar month the completing session
// fell in (see monthOfDate), which is what buckets it for the salary
// sheet and money reports downstream.
export async function generateFeesForClass(classId: string, month: string): Promise<GenerateFeesResult> {
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
    amount_due: cls.fee_amount,
    status: "pending" as const,
  }));

  const { data: inserted, error } = await admin
    .from("payments")
    .upsert(rows, { onConflict: "student_id,class_id,month", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not generate fees: ${error.message}`);

  return { created: inserted?.length ?? 0 };
}
