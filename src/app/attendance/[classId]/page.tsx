import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Users, CalendarOff } from "lucide-react";
import { getClassAttendanceState, getClassAttendanceForMonth, todayInColombo } from "@/lib/attendance/queries";
import { weekOfMonth, currentMonthInColombo } from "@/lib/time";
import { undoCancelClass } from "@/lib/attendance/actions";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/card";
import { AttendanceForm } from "./attendance-form";
import { MonthlyAttendanceGrid } from "./monthly-attendance-grid";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const { classId } = await params;
  const session = await getSessionInfo();
  const readOnly = session?.role === "tutor";

  // Tutors get a whole month of attendance at once (reviewing history),
  // not a day at a time (which is for marking it live).
  if (readOnly) {
    const { month: monthParam } = await searchParams;
    const month = monthParam || currentMonthInColombo();

    const monthly = await getClassAttendanceForMonth(classId, month);
    if (!monthly) notFound();

    return (
      <PageShell title={monthly.subject} backHref="/">
        <div className="flex w-fit items-center gap-3 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
          <Link
            href={`/attendance/${classId}?month=${addMonths(month, -1)}`}
            aria-label="Previous month"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="font-medium text-gray-900">
            {new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <Link
            href={`/attendance/${classId}?month=${addMonths(month, 1)}`}
            aria-label="Next month"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {monthly.students.length === 0 ? (
          <EmptyState icon={Users} message="No students enrolled in this class yet." />
        ) : (
          <MonthlyAttendanceGrid sessionDates={monthly.sessionDates} students={monthly.students} />
        )}
      </PageShell>
    );
  }

  const { date: dateParam } = await searchParams;
  const date = dateParam || todayInColombo();

  const state = await getClassAttendanceState(classId, date);
  if (!state) notFound();

  return (
    <PageShell title={state.subject} backHref="/classes">
      <div className="flex w-fit items-center gap-3 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
        <Link
          href={`/attendance/${classId}?date=${addDays(date, -1)}`}
          aria-label="Previous day"
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="font-medium text-gray-900">{date}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          Week {weekOfMonth(date)}
        </span>
        <Link
          href={`/attendance/${classId}?date=${addDays(date, 1)}`}
          aria-label="Next day"
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {state.isCancelled ? (
        <EmptyState
          icon={CalendarOff}
          message={`This class was cancelled on ${date}.`}
          action={
            <form action={undoCancelClass.bind(null, classId, date)}>
              <button type="submit" className="text-sm font-medium text-indigo-600">
                Undo cancellation
              </button>
            </form>
          }
        />
      ) : state.students.length === 0 ? (
        <EmptyState icon={Users} message="No students enrolled in this class yet." />
      ) : (
        <AttendanceForm classId={classId} date={date} students={state.students} />
      )}
    </PageShell>
  );
}
