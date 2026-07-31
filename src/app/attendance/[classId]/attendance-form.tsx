"use client";

import { useActionState, useState } from "react";
import { submitAttendance, sendAbsenceAlerts } from "@/lib/attendance/actions";
import { FormError, SubmitButton } from "@/components/form";
import type { AttendanceStatus } from "@/lib/supabase/types";
import type { AttendanceStudentRow } from "@/lib/attendance/queries";
import { PaymentSheet } from "./payment-sheet";

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

function AbsenceAlertPanel({ classId, date, absentCount }: { classId: string; date: string; absentCount: number }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  if (absentCount === 0) return null;

  async function handleSend() {
    setSending(true);
    const result = await sendAbsenceAlerts(classId, date);
    setSent(result.sent);
    setSending(false);
  }

  if (sent !== null) {
    return <p className="text-sm text-gray-600">Sent {sent} absence SMS.</p>;
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className="w-fit text-sm font-medium text-indigo-600 disabled:opacity-50"
    >
      {sending ? "Sending…" : "Send absence SMS to parents"}
    </button>
  );
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
  const [openPayment, setOpenPayment] = useState<{ paymentId: string; balance: number } | null>(null);

  function markAllPresent() {
    setStatuses(Object.fromEntries(students.map((s) => [s.enrollmentId, "present"])));
  }

  function toggle(enrollmentId: string) {
    setStatuses((prev) => ({ ...prev, [enrollmentId]: CYCLE[prev[enrollmentId]] }));
  }

  if (state.success) {
    const counts = { present: 0, absent: 0, late: 0 };
    for (const status of Object.values(statuses)) counts[status]++;

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-700">
          Submitted: {counts.present} present, {counts.absent} absent, {counts.late} late.
        </p>
        <AbsenceAlertPanel classId={classId} date={date} absentCount={counts.absent} />
      </div>
    );
  }

  return (
    <>
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
              <button
                type="button"
                disabled={!student.feePaymentId}
                onClick={() =>
                  student.feePaymentId &&
                  setOpenPayment({ paymentId: student.feePaymentId, balance: student.feeBalance ?? 0 })
                }
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${feeBadgeClass(student.feeStatus)}`}
              >
                {student.feeStatus ?? "no fee"}
              </button>
            </li>
          ))}
        </ul>

        <FormError message={state.error} />
        <SubmitButton disabled={pending}>{pending ? "Submitting…" : "Submit attendance"}</SubmitButton>
      </form>

      {openPayment && (
        <PaymentSheet
          paymentId={openPayment.paymentId}
          balance={openPayment.balance}
          onClose={() => setOpenPayment(null)}
        />
      )}
    </>
  );
}
