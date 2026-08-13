"use client";

import { useActionState } from "react";
import { setRevenueShareCommissionPercent } from "@/lib/institute/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function CommissionRateForm({ currentPercent }: { currentPercent: number }) {
  const [state, formAction, pending] = useActionState(setRevenueShareCommissionPercent, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Institute commission rate</h2>
      <p className="text-sm text-gray-500">
        Applies to every revenue-share class institute-wide — changing this affects salary calculations going
        forward.
      </p>

      <Field
        label="Commission (%)"
        name="commissionPercent"
        type="number"
        min={0}
        max={100}
        step="0.01"
        defaultValue={currentPercent}
        required
      />

      <FormError message={state.error} />
      {state.success && <p className="text-sm text-green-700">Commission rate updated.</p>}
      <SubmitButton disabled={pending}>{pending ? "Saving…" : "Save rate"}</SubmitButton>
    </form>
  );
}
