"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import type { PaymentMethod } from "@/lib/supabase/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const METHODS: PaymentMethod[] = ["cash", "bank_transfer", "other"];

// FR-6.2/6.4/6.5/6.6 — records one or more selected payment rows at once
// (multi-class / multi-month), each with its own editable amount
// (defaults to remaining balance so a plain submit fully settles it),
// same method/reference/date applied to all selected in this batch.
export async function recordPayment(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const paymentIds = formData.getAll("paymentId").map(String);
  if (paymentIds.length === 0) return { error: "Select at least one fee to record." };

  const method = String(formData.get("method") || "") as PaymentMethod;
  if (!METHODS.includes(method)) return { error: "Select a payment method." };

  const reference = String(formData.get("reference") || "").trim() || null;
  const paidDate = String(formData.get("paidDate") || "") || new Date().toISOString().slice(0, 10);

  const admin = createAdminClient();

  const { data: payments, error: fetchError } = await admin
    .from("payments")
    .select("id, amount_due, amount_paid")
    .eq("institute_id", session.instituteId)
    .in("id", paymentIds);

  if (fetchError || !payments || payments.length === 0) {
    return { error: "Could not load the selected fees." };
  }

  for (const payment of payments) {
    const amountRaw = String(formData.get(`amount_${payment.id}`) || "").trim();
    const amount = amountRaw ? Number(amountRaw) : payment.amount_due - payment.amount_paid;

    if (Number.isNaN(amount) || amount < 0) {
      return { error: "Enter a valid amount for each selected fee." };
    }

    const newAmountPaid = payment.amount_paid + amount;
    const balance = payment.amount_due - newAmountPaid;
    const status = balance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "pending";

    const { error } = await admin
      .from("payments")
      .update({
        amount_paid: newAmountPaid,
        status,
        method,
        reference,
        paid_date: paidDate,
        recorded_by: session.userId,
        recorded_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) return { error: `Could not record payment: ${error.message}` };
  }

  revalidatePath("/fees");
  return { success: true };
}

export async function waiveFee(paymentId: string): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("payments")
    .update({
      status: "waived",
      recorded_by: session.userId,
      recorded_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("institute_id", session.instituteId);

  if (error) throw new Error(`Could not waive fee: ${error.message}`);

  revalidatePath("/fees");
}
