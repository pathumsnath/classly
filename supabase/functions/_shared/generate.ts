import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Ported from src/lib/fees/generate.ts's generateFeesForClass — only this
// one function is needed here (the session-cycle prepay path triggered by
// a cycle closing). generateMonthlyFees/trueUpMonthlyFees are the
// calendar-billing cron's job and stay web-only/untouched, out of scope
// for the Flutter daily-driver flows.
export async function generateFeesForClass(
  admin: SupabaseClient,
  classId: string,
  month: string,
  cycleStartDate: string,
): Promise<{ created: number }> {
  const [{ data: enrollments }, { data: cls }] = await Promise.all([
    admin.from("enrollments").select("student_id").eq("class_id", classId).eq("status", "active"),
    admin.from("classes").select("institute_id, fee_amount").eq("id", classId).maybeSingle(),
  ]);

  if (!enrollments || enrollments.length === 0 || !cls) return { created: 0 };

  const rows = enrollments.map((e: { student_id: string }) => ({
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
