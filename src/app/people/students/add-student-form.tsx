"use client";

import { useActionState } from "react";
import { addStudent } from "@/lib/people/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

export function AddStudentForm() {
  const [state, formAction, pending] = useActionState(addStudent, {});

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900">Add a student</h2>
      <Field label="Name" name="name" required />
      <Field label="Phone" name="phone" type="tel" required />
      <Field label="Parent phone (optional)" name="parentPhone" type="tel" />
      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Adding…" : "Add student"}</SubmitButton>
    </form>
  );
}
