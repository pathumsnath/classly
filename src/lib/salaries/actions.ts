"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";

// Uses the RLS-respecting client on purpose (not admin) — see plan: this
// is the one write path where the RLS layer's owner-only enforcement on
// salary_payments should stay a live second check, not be bypassed.
export async function markSalaryPaid(tutorId: string, month: string, amount: number): Promise<void> {
  const session = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase.from("salary_payments").upsert(
    {
      institute_id: session.instituteId,
      tutor_id: tutorId,
      month,
      amount,
      status: "paid",
      paid_date: new Date().toISOString().slice(0, 10),
      recorded_by: session.userId,
      recorded_at: new Date().toISOString(),
    },
    { onConflict: "tutor_id,month" },
  );

  if (error) throw new Error(`Could not mark salary as paid: ${error.message}`);

  revalidatePath("/salaries");
}
