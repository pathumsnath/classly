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
  revalidatePath(`/salaries/${tutorId}`);
}

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Records money a tutor already drew mid-month (advance against their
// upcoming salary) so it can be deducted from that month's payable total
// instead of being paid out twice. `tutorId` comes from formData (not a
// bound param) so the same action serves both a fixed-tutor form (a
// hidden input, on that tutor's own salary page) and a form where the
// owner picks the tutor from a dropdown (the dashboard quick-add).
export async function recordTutorAdvance(month: string, _prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireOwner();
  const supabase = await createClient();

  const tutorId = String(formData.get("tutorId") || "");
  if (!tutorId) return { error: "Select a tutor." };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const reason = String(formData.get("reason") || "").trim();
  if (!reason) {
    return { error: "Enter a reason for the advance." };
  }

  const { error } = await supabase.from("tutor_advances").insert({
    institute_id: session.instituteId,
    tutor_id: tutorId,
    month,
    amount,
    reason,
    recorded_by: session.userId,
  });

  if (error) return { error: `Could not record advance: ${error.message}` };

  revalidatePath("/salaries");
  revalidatePath(`/salaries/${tutorId}`);
  revalidatePath("/");

  return { success: true };
}

export async function deleteTutorAdvance(advanceId: string, tutorId: string): Promise<void> {
  const session = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tutor_advances")
    .delete()
    .eq("id", advanceId)
    .eq("institute_id", session.instituteId);

  if (error) throw new Error(`Could not remove advance: ${error.message}`);

  revalidatePath("/salaries");
  revalidatePath(`/salaries/${tutorId}`);
}
