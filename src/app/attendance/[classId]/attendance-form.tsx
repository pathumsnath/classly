"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle, Clock, CheckCheck, MessageSquare, Search } from "lucide-react";
import { submitAttendance, sendAbsenceAlerts, markClassCancelled } from "@/lib/attendance/actions";
import { FormError, SubmitButton } from "@/components/form";
import { Card, Avatar } from "@/components/card";
import type { AttendanceStatus } from "@/lib/supabase/types";
import type { AttendanceStudentRow, OutstandingPayment } from "@/lib/attendance/queries";
import { PaymentSheet } from "./payment-sheet";

const CYCLE: Record<AttendanceStatus, AttendanceStatus> = {
  present: "absent",
  absent: "late",
  late: "present",
};

const STATUS_ICONS = { present: CheckCircle2, absent: XCircle, late: Clock } as const;

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-50 text-green-700 border-green-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  late: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const ATTENDANCE_FORM_ID = "attendance-submit-form";

// Fee badge reflects only this class's own outstanding balance, summed
// across every month owed for it — not other classes the student is in.
function feeBadgeClass(student: AttendanceStudentRow) {
  if (!student.hasFeeRecords || student.feeBalance <= 0) {
    return student.hasFeeRecords ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500";
  }
  return student.feeIsOverdue ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700";
}

function feeBadgeLabel(student: AttendanceStudentRow) {
  if (!student.hasFeeRecords) return "No fee";
  if (student.feeBalance <= 0) return "Paid";
  const amount = `LKR ${student.feeBalance.toLocaleString()}`;
  return student.feeIsOverdue ? `${amount} overdue` : `${amount} due`;
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
      className="flex w-fit items-center gap-2 text-sm font-medium text-indigo-600 disabled:opacity-50"
    >
      <MessageSquare className="h-4 w-4" />
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
  const [openPayment, setOpenPayment] = useState<{
    studentName: string;
    payments: OutstandingPayment[];
    walletBalance: number;
  } | null>(null);
  const [query, setQuery] = useState("");

  // Sorted so scanning the roster (or a search result) is predictable —
  // a tutor taking roll call by ear needs to find a called-out name fast.
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const visibleStudents = sortedStudents.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

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
      <Card className="flex flex-col gap-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <CheckCheck className="h-4 w-4 text-green-600" />
          Submitted: {counts.present} present, {counts.absent} absent, {counts.late} late.
        </p>
        <AbsenceAlertPanel classId={classId} date={date} absentCount={counts.absent} />
      </Card>
    );
  }

  return (
    <div className="pb-24">
      <form id={ATTENDANCE_FORM_ID} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="date" value={date} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllPresent}
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all present
          </button>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a student…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Hidden inputs stay for every student regardless of the search
            filter above — attendance for a filtered-out student still
            needs to submit with the rest of the roster. */}
        {sortedStudents.map((student) => (
          <div key={student.enrollmentId}>
            <input type="hidden" name="enrollmentId" value={student.enrollmentId} readOnly />
            <input type="hidden" name={`status_${student.enrollmentId}`} value={statuses[student.enrollmentId]} readOnly />
          </div>
        ))}

        {visibleStudents.length === 0 ? (
          <p className="px-1 text-sm text-gray-500">No students match &ldquo;{query}&rdquo;.</p>
        ) : (
          <Card className="divide-y divide-gray-100">
            {visibleStudents.map((student) => {
              const status = statuses[student.enrollmentId];
              const StatusIcon = STATUS_ICONS[status];
              return (
                <div key={student.enrollmentId} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={student.name} />
                    <p className="flex-1 font-medium text-gray-900">{student.name}</p>
                  </div>

                  <div className="flex items-center gap-2 pl-12">
                    <button
                      type="button"
                      onClick={() => toggle(student.enrollmentId)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${STATUS_STYLES[status]}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status}
                    </button>

                    <button
                      type="button"
                      disabled={student.outstandingPayments.length === 0}
                      onClick={() =>
                        student.outstandingPayments.length > 0 &&
                        setOpenPayment({
                          studentName: student.name,
                          payments: student.outstandingPayments,
                          walletBalance: student.walletBalance,
                        })
                      }
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${feeBadgeClass(student)}`}
                    >
                      {feeBadgeLabel(student)}
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        <FormError message={state.error} />
      </form>

      <form action={markClassCancelled.bind(null, classId, date)} className="mt-4">
        <button type="submit" className="text-sm font-medium text-red-600">
          Mark class as cancelled
        </button>
      </form>

      {/* FR-5.7 — sticky submit, stays reachable while scrolling a long roster.
          Lives outside the form element (form="..." associates it by id)
          since a cancel-class form also needs to sit on this page and
          <form> elements can't nest. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <SubmitButton form={ATTENDANCE_FORM_ID} disabled={pending}>
            {pending ? "Submitting…" : "Submit attendance"}
          </SubmitButton>
        </div>
      </div>

      {openPayment && (
        <PaymentSheet
          studentName={openPayment.studentName}
          payments={openPayment.payments}
          walletBalance={openPayment.walletBalance}
          onClose={() => setOpenPayment(null)}
        />
      )}
    </div>
  );
}
