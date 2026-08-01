import { Card } from "@/components/card";
import type { AttendanceStatus } from "@/lib/supabase/types";
import type { MonthlyAttendanceStudentRow } from "@/lib/attendance/queries";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-yellow-100 text-yellow-700",
};

const STATUS_LETTER: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  late: "L",
};

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).getDate();
}

function feeBadge(student: MonthlyAttendanceStudentRow) {
  if (!student.hasFeeRecords) return { label: "No fee", className: "bg-gray-100 text-gray-500" };
  if (student.feeBalance <= 0) return { label: "Paid", className: "bg-green-100 text-green-700" };
  const amount = `LKR ${student.feeBalance.toLocaleString()}`;
  return student.feeIsOverdue
    ? { label: `${amount} overdue`, className: "bg-red-100 text-red-700" }
    : { label: `${amount} due`, className: "bg-yellow-100 text-yellow-700" };
}

// Tutor read-only view — every enrolled student's attendance across every
// session date this class had in the month, at a glance instead of paging
// through one day at a time.
export function MonthlyAttendanceGrid({
  sessionDates,
  students,
}: {
  sessionDates: string[];
  students: MonthlyAttendanceStudentRow[];
}) {
  if (sessionDates.length === 0) {
    return <p className="text-sm text-gray-500">This class had no scheduled sessions this month.</p>;
  }

  return (
    <Card className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold">Student</th>
            {sessionDates.map((date) => (
              <th key={date} className="px-2 py-3 text-center font-semibold">
                {dayLabel(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.map((student) => {
            const fee = feeBadge(student);
            return (
              <tr key={student.studentId}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${fee.className}`}>
                    {fee.label}
                  </span>
                </td>
                {sessionDates.map((date) => {
                  const status = student.statusByDate[date];
                  return (
                    <td key={date} className="px-2 py-3 text-center">
                      {status ? (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}
                        >
                          {STATUS_LETTER[status]}
                        </span>
                      ) : (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
