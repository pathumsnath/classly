"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitAttendance } from "@/lib/attendance/actions";
import { FormError, SubmitButton } from "@/components/form";
import type { AttendanceStatus } from "@/lib/supabase/types";
import type { AttendanceStudentRow } from "@/lib/attendance/queries";

const CYCLE: Record<AttendanceStatus, AttendanceStatus> = {
  present: "absent",
  absent: "late",
  late: "present",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-yellow-100 text-yellow-700",
};

function feeBadgeClass(status: string | null) {
  if (!status || status === "waived") return "bg-gray-100 text-gray-500";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700"; // pending/overdue
}

export function AttendanceForm({
  classId,
  date,
  students,
}: {
  classId: string;
  date: string;
  students: AttendanceStudentRow[];
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(students.map((s) => [s.enrollmentId, s.status ?? "present"])),
  );
  const [state, formAction, pending] = useActionState(submitAttendance, {});

  function markAllPresent() {
    setStatuses(Object.fromEntries(students.map((s) => [s.enrollmentId, "present"])));
  }

  function toggle(enrollmentId: string) {
    setStatuses((prev) => ({ ...prev, [enrollmentId]: CYCLE[prev[enrollmentId]] }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />

      <button
        type="button"
        onClick={markAllPresent}
        className="w-fit rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
      >
        Mark all present
      </button>

      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {students.map((student) => (
          <li key={student.enrollmentId} className="flex items-center gap-3 p-4">
            <input type="hidden" name="enrollmentId" value={student.enrollmentId} readOnly />
            <input
              type="hidden"
              name={`status_${student.enrollmentId}`}
              value={statuses[student.enrollmentId]}
              readOnly
            />
            <button
              type="button"
              onClick={() => toggle(student.enrollmentId)}
              className={`flex-1 rounded-md px-3 py-2 text-left text-sm font-medium ${STATUS_STYLES[statuses[student.enrollmentId]]}`}
            >
              {student.name} — {statuses[student.enrollmentId]}
            </button>
            <Link
              href={`/fees/${student.studentId}`}
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${feeBadgeClass(student.feeStatus)}`}
            >
              {student.feeStatus ?? "no fee"}
            </Link>
          </li>
        ))}
      </ul>

      <FormError message={state.error} />
      <SubmitButton disabled={pending}>{pending ? "Submitting…" : "Submit attendance"}</SubmitButton>
    </form>
  );
}
