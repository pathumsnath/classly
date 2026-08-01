"use client";

import { useActionState } from "react";
import { recordTutorAdvance } from "@/lib/salaries/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function RecordAdvanceForm({ tutorId, month }: { tutorId: string; month: string }) {
  const [state, formAction, pending] = useActionState(recordTutorAdvance.bind(null, tutorId, month), {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Record an advance</h2>
      <Field label="Amount (LKR)" name="amount" type="number" step="0.01" min="0.01" required />
      <Field label="Reason" name="reason" placeholder="e.g. Emergency medical expense" required />
      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Recording…" : "Record advance"}</SubmitButton>
    </form>
  );
}
