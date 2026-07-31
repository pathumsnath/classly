"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { recordPayment } from "@/lib/fees/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

// FR-5.6 — record a payment inline, without leaving attendance. Reuses
// the same recordPayment action as the full /fees/[studentId] page; this
// is just a scoped, one-payment view of it.
export function PaymentSheet({
  paymentId,
  balance,
  onClose,
}: {
  paymentId: string;
  balance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordPayment, {});

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Record payment</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="paymentId" value={paymentId} />

          <Field
            label="Amount (LKR)"
            name={`amount_${paymentId}`}
            type="number"
            defaultValue={balance}
            min={0}
            step="0.01"
          />
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
      </div>
    </div>
  );
}
