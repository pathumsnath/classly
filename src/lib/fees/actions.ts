"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";
import { sendSms } from "@/lib/sms";
import { getWalletBalancesByStudent } from "@/lib/wallet/queries";
import type { PaymentMethod } from "@/lib/supabase/types";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const METHODS: PaymentMethod[] = ["cash", "bank_transfer", "other", "wallet_credit"];

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
  const sendReceipt = formData.get("sendReceipt") === "on";

  const admin = createAdminClient();

  const { data: payments, error: fetchError } = await admin
    .from("payments")
    .select("id, student_id, month, amount_due, amount_paid")
    .eq("institute_id", session.instituteId)
    .in("id", paymentIds);

  if (fetchError || !payments || payments.length === 0) {
    return { error: "Could not load the selected fees." };
  }

  // Validate every row before writing any of them — a bad amount on one
  // row shouldn't leave earlier rows in this same submission half-applied.
  const toApply: { id: string; amount: number; newAmountPaid: number; status: "paid" | "partial" | "pending" }[] = [];

  for (const payment of payments) {
    const amountRaw = String(formData.get(`amount_${payment.id}`) || "").trim();
    const balance = payment.amount_due - payment.amount_paid;
    const amount = amountRaw ? Number(amountRaw) : balance;

    if (Number.isNaN(amount) || amount < 0) {
      return { error: "Enter a valid amount for each selected fee." };
    }

    // Overpaying a single month isn't allowed — if there's more to pay
    // than one month covers, apply the rest to another outstanding month
    // by checking its box too (each has its own editable amount).
    if (amount > balance) {
      return {
        error: `LKR ${amount.toFixed(2)} is more than the LKR ${balance.toFixed(2)} due for ${payment.month.slice(0, 7)} — check another outstanding month to apply the rest.`,
      };
    }

    const newAmountPaid = payment.amount_paid + amount;
    const newBalance = payment.amount_due - newAmountPaid;
    const status = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "pending";

    toApply.push({ id: payment.id, amount, newAmountPaid, status });
  }

  const studentId = payments[0].student_id;

  // Paying with existing wallet credit isn't new cash — check there's
  // actually enough parked before applying it to these fees.
  const totalRequested = toApply.reduce((sum, t) => sum + t.amount, 0);
  if (method === "wallet_credit") {
    const balances = await getWalletBalancesByStudent(admin, session.instituteId, [studentId]);
    const available = balances.get(studentId) ?? 0;
    if (totalRequested > available) {
      return {
        error: `Only LKR ${available.toFixed(2)} available in wallet credit — reduce the amount or select fewer fees.`,
      };
    }
  }

  // Extra received now, beyond what's due — parked as credit for a future
  // fee (possibly for a different class) rather than sitting unapplied.
  const walletCreditRaw = String(formData.get("walletCredit") || "").trim();
  const walletCreditAmount = walletCreditRaw ? Number(walletCreditRaw) : 0;
  if (Number.isNaN(walletCreditAmount) || walletCreditAmount < 0) {
    return { error: "Enter a valid amount to add to the wallet." };
  }

  let totalRecorded = 0;

  for (const { id, amount, newAmountPaid, status } of toApply) {
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
      .eq("id", id);

    if (error) return { error: `Could not record payment: ${error.message}` };

    totalRecorded += amount;
  }

  if (method === "wallet_credit" && totalRecorded > 0) {
    const { error } = await admin.from("wallet_transactions").insert({
      institute_id: session.instituteId,
      student_id: studentId,
      amount: totalRecorded,
      type: "debit",
      payment_id: toApply[0].id,
      note: `Applied to ${toApply.length} fee(s)`,
      recorded_by: session.userId,
    });
    if (error) return { error: `Could not apply wallet credit: ${error.message}` };
  }

  if (walletCreditAmount > 0) {
    const { error } = await admin.from("wallet_transactions").insert({
      institute_id: session.instituteId,
      student_id: studentId,
      amount: walletCreditAmount,
      type: "credit",
      note: "Overpayment parked as credit",
      recorded_by: session.userId,
    });
    if (error) return { error: `Could not add to wallet: ${error.message}` };
  }

  revalidatePath("/fees");

  // FR-6.8 — explicit opt-in only (FR-9.3: never silent bulk). A failed
  // SMS send never undoes an already-recorded payment — it's logged and
  // swallowed, not surfaced as an action error.
  if (sendReceipt && totalRecorded > 0) {
    const { data: student } = await admin
      .from("users")
      .select("name, phone, parent_phone")
      .eq("id", studentId)
      .maybeSingle();

    if (student) {
      const to = student.parent_phone || student.phone;
      const message = `Payment received: LKR ${totalRecorded.toFixed(2)} for ${student.name} at ${session.instituteName}. Thank you.`;

      try {
        await sendSms({ to, message });
        await admin.from("notifications").insert({
          user_id: studentId,
          institute_id: session.instituteId,
          type: "receipt",
          message,
        });
      } catch (err) {
        console.error("Failed to send fee receipt SMS:", err);
      }
    }
  }

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
