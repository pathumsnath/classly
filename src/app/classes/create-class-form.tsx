"use client";

import { useActionState } from "react";
import { createClass } from "@/lib/classes/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CreateClassForm({ tutors }: { tutors: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createClass, {});

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900">Create a class</h2>
      <Field label="Subject" name="subject" required />

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

      <fieldset className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Days
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label key={day} className="flex items-center gap-1 font-normal text-gray-700">
              <input type="checkbox" name="scheduleDays" value={day} />
              {day}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Time" name="scheduleTime" type="time" />
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
