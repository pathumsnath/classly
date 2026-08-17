"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTutor } from "@/lib/people/actions";
import { Field, FormError, SubmitButton } from "@/components/form";
import type { TutorRow } from "@/lib/people/queries";

export function EditTutorForm({
  tutor,
  defaultCommissionPercent,
}: {
  tutor: TutorRow;
  defaultCommissionPercent: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateTutor, {});
  const [overrideEnabled, setOverrideEnabled] = useState(tutor.commissionOverridePercent !== null);
  const [commissionPercent, setCommissionPercent] = useState(
    tutor.commissionOverridePercent ?? defaultCommissionPercent,
  );

  useEffect(() => {
    if (state.success) router.push(`/people/tutors/${tutor.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Edit tutor</h2>

      <input type="hidden" name="tutorId" value={tutor.id} />

      <Field label="Name" name="name" defaultValue={tutor.name} required />
      <Field label="Phone" name="phone" defaultValue={tutor.phone} required />
      <Field label="Email (optional)" name="email" type="email" defaultValue={tutor.email ?? ""} />

      <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="commissionOverrideEnabled"
            checked={overrideEnabled}
            onChange={(e) => setOverrideEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Override the institute commission rate for this tutor
        </label>
        {overrideEnabled ? (
          <>
            <Field
              label="Institute commission for this tutor (%)"
              name="commissionOverridePercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(Number(e.target.value))}
              required
            />
            <p className="text-xs text-gray-500">
              This tutor keeps {(100 - commissionPercent).toFixed(2)}% of collected fees on their revenue-share
              classes (institute keeps {commissionPercent}%) — instead of the institute-wide{" "}
              {defaultCommissionPercent}% rate.
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-500">
            Uses the institute-wide rate ({defaultCommissionPercent}% commission, {100 - defaultCommissionPercent}%
            to the tutor) — changeable from the dashboard.
          </p>
        )}
      </div>

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Saving…" : "Save changes"}</SubmitButton>
    </form>
  );
}
