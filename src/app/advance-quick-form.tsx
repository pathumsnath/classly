"use client";

import { useActionState } from "react";
import { recordTutorAdvance } from "@/lib/salaries/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

export function AdvanceQuickForm({ tutors, month }: { tutors: { id: string; name: string }[]; month: string }) {
  const [state, formAction, pending] = useActionState(recordTutorAdvance.bind(null, month), {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Record a tutor advance</h2>

      <Select label="Tutor" name="tutorId" required defaultValue="">
        <option value="" disabled>
          Select a tutor
        </option>
        {tutors.map((tutor) => (
          <option key={tutor.id} value={tutor.id}>
            {tutor.name}
          </option>
        ))}
      </Select>

      <Field label="Amount (LKR)" name="amount" type="number" step="0.01" min="0.01" required />
      <Field label="Reason" name="reason" placeholder="e.g. Emergency medical expense" required />
      <FormError message={state.error} />
      {state.success && <p className="text-sm text-green-700">Advance recorded.</p>}
      <SubmitButton disabled={pending}>{pending ? "Recording…" : "Record advance"}</SubmitButton>
    </form>
  );
}
