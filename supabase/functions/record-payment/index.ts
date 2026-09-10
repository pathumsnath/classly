import { resolveSession } from "../_shared/session.ts";
import { createAdminClient } from "../_shared/adminClient.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendSms } from "../_shared/sms.ts";

const METHODS = ["cash", "bank_transfer", "other", "wallet_credit"];

interface RequestBody {
  paymentIds?: string[];
  amounts?: Record<string, number>;
  method?: string;
  reference?: string;
  paidDate?: string;
  walletTopUp?: number;
  studentId?: string;
  sendReceipt?: boolean;
}

// Ported from src/lib/wallet/queries.ts's sumBalance/getWalletBalancesByStudent.
// deno-lint-ignore no-explicit-any
async function walletBalance(admin: any, instituteId: string, studentId: string): Promise<number> {
  const { data } = await admin
    .from("wallet_transactions")
    .select("amount, type")
    .eq("institute_id", instituteId)
    .eq("student_id", studentId);
  return (data ?? []).reduce(
    (sum: number, r: { amount: number; type: string }) => sum + (r.type === "credit" ? r.amount : -r.amount),
    0,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const resolved = await resolveSession(req);
  if (!resolved) return jsonResponse({ error: "Not signed in." }, 401);
  const { session } = resolved;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const paymentIds = body.paymentIds ?? [];
  const amounts = body.amounts ?? {};
  const walletTopUp = body.walletTopUp ?? 0;
  if (!Number.isFinite(walletTopUp) || walletTopUp < 0) {
    return jsonResponse({ error: "Enter a valid amount to add to the wallet." }, 400);
  }

  const admin = createAdminClient();

  // A tutor may only record payments for students in classes they teach —
  // tighter than the web app's current unscoped behavior (Finding A in
  // the Flutter plan), a deliberate improvement, not a reproduced gap.
  let tutorClassIds: string[] | null = null;
  if (session.role === "tutor") {
    const { data: tutorClasses } = await admin.from("classes").select("id").eq("tutor_id", session.userId);
    tutorClassIds = (tutorClasses ?? []).map((c: { id: string }) => c.id);
  } else if (session.role !== "owner" && session.role !== "admin_staff") {
    return jsonResponse({ error: "Not authorized." }, 403);
  }

  // No fee selected — only valid as a standalone wallet top-up.
  if (paymentIds.length === 0) {
    if (!body.studentId) return jsonResponse({ error: "Select at least one fee to record." }, 400);
    if (walletTopUp <= 0) {
      return jsonResponse({ error: "Select at least one fee, or enter an amount to add to the wallet." }, 400);
    }

    const { error } = await admin.from("wallet_transactions").insert({
      institute_id: session.instituteId,
      student_id: body.studentId,
      amount: walletTopUp,
      type: "credit",
      note: "Advance payment parked as credit",
      recorded_by: session.userId,
    });
    if (error) return jsonResponse({ error: `Could not add to wallet: ${error.message}` }, 500);
    return jsonResponse({ success: true });
  }

  const method = body.method ?? "";
  if (!METHODS.includes(method)) return jsonResponse({ error: "Select a payment method." }, 400);

  const reference = body.reference?.trim() || null;
  const paidDate = body.paidDate || new Date().toISOString().slice(0, 10);
  const sendReceipt = body.sendReceipt === true;

  let paymentsQuery = admin
    .from("payments")
    .select("id, student_id, class_id, month, amount_due, amount_paid")
    .eq("institute_id", session.instituteId)
    .in("id", paymentIds);
  if (tutorClassIds !== null) {
    paymentsQuery = paymentsQuery.in("class_id", tutorClassIds);
  }
  const { data: payments, error: fetchError } = await paymentsQuery;

  if (fetchError || !payments || payments.length === 0) {
    return jsonResponse({ error: "Could not load the selected fees." }, 400);
  }
  if (payments.length !== paymentIds.length) {
    // Some requested IDs weren't visible under the tutor's class scope —
    // reject the whole batch rather than silently applying a partial one.
    return jsonResponse({ error: "One or more selected fees aren't for a class you teach." }, 403);
  }

  // Validate every row before writing any of them — a bad amount on one
  // row shouldn't leave earlier rows in this same submission half-applied.
  const toApply: { id: string; amount: number; newAmountPaid: number; status: string }[] = [];

  for (const payment of payments) {
    const balance = payment.amount_due - payment.amount_paid;
    const amountRaw = amounts[payment.id];
    const amount = amountRaw != null ? Number(amountRaw) : balance;

    if (!Number.isFinite(amount) || amount < 0) {
      return jsonResponse({ error: "Enter a valid amount for each selected fee." }, 400);
    }

    if (amount > balance) {
      return jsonResponse({
        error: `LKR ${amount.toFixed(2)} is more than the LKR ${balance.toFixed(2)} due for ${payment.month.slice(0, 7)} — enter ${balance.toFixed(2)} here, then either check another outstanding month for the rest, or park the rest as wallet credit.`,
      }, 400);
    }

    const newAmountPaid = payment.amount_paid + amount;
    const newBalance = payment.amount_due - newAmountPaid;
    const status = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "pending";

    toApply.push({ id: payment.id, amount, newAmountPaid, status });
  }

  const studentId = payments[0].student_id;

  const totalRequested = toApply.reduce((sum, t) => sum + t.amount, 0);
  if (method === "wallet_credit") {
    const available = await walletBalance(admin, session.instituteId, studentId);
    if (totalRequested > available) {
      return jsonResponse({
        error: `Only LKR ${available.toFixed(2)} available in wallet credit — reduce the amount or select fewer fees.`,
      }, 400);
    }
  }

  let totalRecorded = 0;
  for (const { id, newAmountPaid, status, amount } of toApply) {
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

    if (error) return jsonResponse({ error: `Could not record payment: ${error.message}` }, 500);
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
    if (error) return jsonResponse({ error: `Could not apply wallet credit: ${error.message}` }, 500);
  }

  if (walletTopUp > 0) {
    const { error } = await admin.from("wallet_transactions").insert({
      institute_id: session.instituteId,
      student_id: studentId,
      amount: walletTopUp,
      type: "credit",
      note: "Overpayment parked as credit",
      recorded_by: session.userId,
    });
    if (error) return jsonResponse({ error: `Could not add to wallet: ${error.message}` }, 500);
  }

  // Explicit opt-in only. A failed SMS send never undoes an already-
  // recorded payment — it's logged and swallowed, not surfaced as an error.
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

  return jsonResponse({ success: true });
});
