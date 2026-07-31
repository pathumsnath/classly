"use client";

import { useActionState } from "react";
import { addSubject } from "@/lib/subjects/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function AddSubjectForm() {
  const [state, formAction, pending] = useActionState(addSubject, {});

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Add a subject</h2>
      <Field label="Name" name="name" required />
      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Adding…" : "Add subject"}</SubmitButton>
    </form>
  );
}
