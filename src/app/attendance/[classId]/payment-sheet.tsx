"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="w-full max-w-sm rounded-t-lg bg-white p-4 sm:rounded-lg">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <h3 className="font-semibold text-gray-900">Record payment</h3>

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
            <input type="checkbox" name="sendReceipt" />
            Send SMS receipt to parent
          </label>

          <FormError message={state.error} />
          <div className="flex gap-3">
            <SubmitButton disabled={pending}>{pending ? "Recording…" : "Record payment"}</SubmitButton>
            <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
