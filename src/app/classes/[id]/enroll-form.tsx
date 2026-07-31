"use client";

import { useActionState } from "react";
import { enrollStudent } from "@/lib/enrollments/actions";
import { FormError, Select, SubmitButton } from "@/components/form";

export function EnrollForm({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudent, {});

  if (students.length === 0) {
    return <p className="text-sm text-gray-500">All students are already enrolled, or none exist yet.</p>;
  }

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="classId" value={classId} />
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
      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Enrolling…" : "Enrol"}</SubmitButton>
    </form>
  );
}
