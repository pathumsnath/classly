"use client";

import { useActionState, useEffect, useState } from "react";
import { todayInColombo } from "@/lib/time";
import { useRouter } from "next/navigation";
import { updateClass } from "@/lib/classes/actions";
import { GRADE_OPTIONS, MEDIUM_OPTIONS } from "@/lib/classes/labels";
import { Field, FormError, Select, SubmitButton } from "@/components/form";
import type { ClassDetail } from "@/lib/classes/queries";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EditClassForm({
  cls,
  tutors,
  subjects,
}: {
  cls: ClassDetail;
  tutors: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateClass, {});
  const [sessionBilling, setSessionBilling] = useState(cls.billingCycleSessions !== null);

  useEffect(() => {
    if (state.success) router.push(`/classes/${cls.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Edit class</h2>

      <input type="hidden" name="classId" value={cls.id} />
      {/* Preserved as-is — editing pay terms isn't part of this form. */}
      <input type="hidden" name="tutorPaymentModel" value={cls.tutorPaymentModel} />
      <input type="hidden" name="tutorPaymentValue" value={cls.tutorPaymentValue} />

      <Select label="Subject" name="subjectId" required defaultValue={cls.subjectId}>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </Select>

      <Select label="Grade" name="grade" required defaultValue={cls.grade ?? ""}>
        <option value="" disabled>
          Select a grade
        </option>
        {GRADE_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </Select>

      <Select label="Medium" name="medium" required defaultValue={cls.medium ?? ""}>
        <option value="" disabled>
          Select a medium
        </option>
        {MEDIUM_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>

      <Select label="Tutor" name="tutorId" required defaultValue={cls.tutorId}>
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
              <input
                type="checkbox"
                name="scheduleDays"
                value={day}
                defaultChecked={cls.scheduleDays.includes(day)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white">
                {day}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Start time"
          name="scheduleStartTime"
          type="time"
          defaultValue={cls.scheduleStartTime?.slice(0, 5) ?? ""}
          required
        />
        <Field
          label="End time"
          name="scheduleEndTime"
          type="time"
          defaultValue={cls.scheduleEndTime?.slice(0, 5) ?? ""}
          required
        />
      </div>
      <Field label="Room / hall (optional)" name="room" defaultValue={cls.room ?? ""} />
      <Field
        label="Group / batch name (optional)"
        name="groupName"
        defaultValue={cls.groupName ?? ""}
        placeholder="e.g. Group 1 — for two classes with the same subject and grade"
      />
      <Field label="Max students (optional)" name="maxStudents" type="number" min={1} defaultValue={cls.maxStudents ?? ""} />
      <Field
        label="Fee amount (LKR)"
        name="feeAmount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={cls.feeAmount}
        required
      />

      <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={sessionBilling}
            onChange={(e) => setSessionBilling(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Bill by session count, not calendar month
        </label>
        {sessionBilling ? (
          <>
            <Field
              label="Sessions per billing cycle"
              name="billingCycleSessions"
              type="number"
              min={1}
              defaultValue={cls.billingCycleSessions ?? 4}
              required
            />
            <Field
              label="Cycle start date"
              name="cycleStartDate"
              type="date"
              defaultValue={cls.cycleStartedAt ?? todayInColombo()}
              required
            />
            <p className="text-xs text-gray-500">
              Sessions are counted from this date onward. If this class already had sessions before you turned this
              on, backdate it to the first of those — otherwise leave it as today.
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-500">
            For a tutor who treats &ldquo;a month&rdquo; as any 4 (or however many) sessions they actually hold —
            the fee generates once that many sessions have attendance recorded, not on a fixed date.
          </p>
        )}
      </div>

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Saving…" : "Save changes"}</SubmitButton>
    </form>
  );
}
