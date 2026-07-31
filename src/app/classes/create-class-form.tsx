"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClass } from "@/lib/classes/actions";
import { GRADE_OPTIONS, MEDIUM_OPTIONS } from "@/lib/classes/labels";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CreateClassForm({
  tutors,
  subjects,
  onCreated,
}: {
  tutors: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  // Defaults to navigating to the new class's detail page. The onboarding
  // wizard overrides this to advance to the next step instead.
  onCreated?: (classId: string) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createClass, {});

  useEffect(() => {
    if (state.success && state.classId) {
      if (onCreated) onCreated(state.classId);
      else router.push(`/classes/${state.classId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Create a class</h2>

      <Select label="Subject" name="subjectId" required defaultValue="">
        <option value="" disabled>
          Select a subject
        </option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </Select>

      <Select label="Grade" name="grade" required defaultValue="">
        <option value="" disabled>
          Select a grade
        </option>
        {GRADE_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </Select>

      <Select label="Medium" name="medium" required defaultValue="">
        <option value="" disabled>
          Select a medium
        </option>
        {MEDIUM_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>

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

      <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        Days
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label key={day} className="cursor-pointer">
              <input type="checkbox" name="scheduleDays" value={day} className="peer sr-only" />
              <span className="inline-block rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white">
                {day}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" name="scheduleStartTime" type="time" required />
        <Field label="End time" name="scheduleEndTime" type="time" required />
      </div>
      <Field label="Room (optional)" name="room" />
      <Field label="Max students (optional)" name="maxStudents" type="number" min={1} />
      <Field label="Fee amount (LKR)" name="feeAmount" type="number" min={0} step="0.01" required />

      <Select label="Fee type" name="feeType" required defaultValue="monthly_flat">
        <option value="monthly_flat">Monthly flat</option>
        <option value="per_session">Per session</option>
      </Select>

      <Select label="Tutor payment model" name="tutorPaymentModel" required defaultValue="fixed">
        <option value="revenue_share">Revenue share (%)</option>
        <option value="fixed">Fixed salary (LKR)</option>
        <option value="per_student">Per paid student (LKR)</option>
        <option value="per_session">Per session held (LKR)</option>
      </Select>

      <Field label="Tutor payment value" name="tutorPaymentValue" type="number" min={0} step="0.01" required />

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Creating…" : "Create class"}</SubmitButton>
    </form>
  );
}
