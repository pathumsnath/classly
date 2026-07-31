"use client";

import { useActionState, useState } from "react";
import { enrollStudent } from "@/lib/enrollments/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

export function EnrollForm({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudent, {});
  const [mode, setMode] = useState<"existing" | "new">(students.length > 0 ? "existing" : "new");

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="classId" value={classId} />

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`rounded-full px-3 py-1.5 font-medium transition ${
            mode === "existing" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Existing student
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`rounded-full px-3 py-1.5 font-medium transition ${
            mode === "new" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          + New student
        </button>
      </div>

      {mode === "existing" ? (
        students.length === 0 ? (
          <p className="text-sm text-gray-500">All students are already enrolled, or none exist yet.</p>
        ) : (
          <Select label="Enrol a student" name="studentId" required defaultValue="">
            <option value="" disabled>
              Select a student
            </option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </Select>
        )
      ) : (
        <>
          <Field label="Name" name="name" required />
          <Field label="Phone" name="phone" type="tel" required />
          <Field label="Parent phone (optional)" name="parentPhone" type="tel" />
        </>
      )}

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Enrolling…" : "Enrol"}</SubmitButton>
    </form>
  );
}
