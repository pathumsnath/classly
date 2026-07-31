"use client";

import { useActionState } from "react";
import { recordPayment } from "@/lib/fees/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";
import type { FeeRow } from "@/lib/fees/queries";

export function RecordPaymentForm({ fees }: { fees: FeeRow[] }) {
  const [state, formAction, pending] = useActionState(recordPayment, {});
  const payable = fees.filter((f) => f.status !== "paid" && f.status !== "waived");

  if (payable.length === 0) {
    return <p className="text-sm text-gray-500">Nothing outstanding for this student.</p>;
  }

  return (
    <form
      action={formAction}
      className="flex max-w-md flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Record a payment</h2>
      <div className="flex flex-col gap-3">
        {payable.map((fee) => (
          <label key={fee.id} className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              name="paymentId"
              value={fee.id}
              defaultChecked
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex-1">
              {fee.subject} — {fee.month.slice(0, 7)}
            </span>
            <input
              type="number"
              name={`amount_${fee.id}`}
              defaultValue={fee.balance}
              min={0}
              step="0.01"
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        ))}
      </div>

      <Select label="Method" name="method" required defaultValue="cash">
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="other">Other</option>
      </Select>
      <Field label="Reference (optional)" name="reference" />
      <Field
        label="Date received"
        name="paidDate"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="sendReceipt"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Send SMS receipt to parent
      </label>

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Recording…" : "Record payment"}</SubmitButton>
    </form>
  );
}
