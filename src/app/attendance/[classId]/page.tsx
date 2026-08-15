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

function ViewTabs({ classId, active }: { classId: string; active: "day" | "monthly" }) {
  return (
    <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
      <Link
        href={`/attendance/${classId}`}
        className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
          active === "day" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        Mark attendance
      </Link>
      <Link
        href={`/attendance/${classId}?view=monthly`}
        className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
          active === "monthly" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        Monthly view
      </Link>
    </div>
  );
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string; month?: string; view?: string }>;
}) {
  const { classId } = await params;
  const session = await getSessionInfo();
  const isTutor = session?.role === "tutor";
  const { view } = await searchParams;

  // Tutors only ever get the whole-month read-only review (marking is the
  // owner/admin_staff's job) — everyone else can switch between marking a
  // specific day and reviewing the same monthly grid tutors see.
  const showMonthly = isTutor || view === "monthly";

  if (showMonthly) {
    const { month: monthParam } = await searchParams;
    const month = monthParam || currentMonthInColombo();

    const monthly = await getClassAttendanceForMonth(classId, month);
    if (!monthly) notFound();

    return (
      <PageShell
        title={monthly.groupName ? `${monthly.subject} — ${monthly.groupName}` : monthly.subject}
        backHref={isTutor ? "/" : "/classes"}
      >
        {!isTutor && <ViewTabs classId={classId} active="monthly" />}

        <div className="flex w-fit items-center gap-3 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
          <Link
            href={`/attendance/${classId}?view=monthly&month=${addMonths(month, -1)}`}
            aria-label="Previous month"
            className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="font-medium text-gray-900">
            {new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <Link
            href={`/attendance/${classId}?view=monthly&month=${addMonths(month, 1)}`}
            aria-label="Next month"
            className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>

        <span className="w-fit rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
          LKR {monthly.collectedThisMonth.toLocaleString()} collected
        </span>

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
    <PageShell title={state.groupName ? `${state.subject} — ${state.groupName}` : state.subject} backHref="/classes">
      <ViewTabs classId={classId} active="day" />

      <div className="flex w-fit items-center gap-3 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
        <Link
          href={`/attendance/${classId}?date=${addDays(date, -1)}`}
          aria-label="Previous day"
          className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-medium text-gray-900">{date}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          Week {weekOfMonth(date)}
        </span>
        <Link
          href={`/attendance/${classId}?date=${addDays(date, 1)}`}
          aria-label="Next day"
          className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {state.isCancelled ? (
        <EmptyState
          icon={CalendarOff}
          message={`This class was cancelled on ${date}.`}
          action={
            <form action={undoCancelClass.bind(null, classId, date)}>
              <button
                type="submit"
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
              >
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
