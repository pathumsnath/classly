"use client";

import { useActionState } from "react";
import { addTutor } from "@/lib/people/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function AddTutorForm() {
  const [state, formAction, pending] = useActionState(addTutor, {});

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900">Add a tutor</h2>
      <Field label="Name" name="name" required />
      <Field label="Phone" name="phone" type="tel" required />
      <Field label="Email (optional)" name="email" type="email" />
      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Adding…" : "Add tutor"}</SubmitButton>
    </form>
  );
}
