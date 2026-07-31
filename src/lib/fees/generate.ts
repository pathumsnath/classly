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
export async function generateMonthlyFees(instituteId: string, month: string): Promise<GenerateFeesResult> {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("student_id, class_id")
    .eq("institute_id", instituteId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return { created: 0 };

  const classIds = [...new Set(enrollments.map((e) => e.class_id))];
  const { data: classes } = await admin.from("classes").select("id, fee_amount").in("id", classIds);
  const feeByClassId = new Map((classes ?? []).map((c) => [c.id, c.fee_amount]));

  const rows = enrollments.map((e) => ({
    institute_id: instituteId,
    student_id: e.student_id,
    class_id: e.class_id,
    month,
    amount_due: feeByClassId.get(e.class_id) ?? 0,
    status: "pending" as const,
  }));

  const { data: inserted, error } = await admin
    .from("payments")
    .upsert(rows, { onConflict: "student_id,class_id,month", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not generate fees: ${error.message}`);

  return { created: inserted?.length ?? 0 };
}
