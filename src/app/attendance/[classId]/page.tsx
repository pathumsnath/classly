import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Users, CalendarOff } from "lucide-react";
import { getClassAttendanceState, todayInColombo } from "@/lib/attendance/queries";
import { weekOfMonth } from "@/lib/time";
import { undoCancelClass } from "@/lib/attendance/actions";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/card";
import { AttendanceForm } from "./attendance-form";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { classId } = await params;
  const { date: dateParam } = await searchParams;
  const date = dateParam || todayInColombo();

  const state = await getClassAttendanceState(classId, date);
  if (!state) notFound();

  const session = await getSessionInfo();
  const readOnly = session?.role === "tutor";

  return (
    <PageShell title={state.subject} backHref={readOnly ? "/" : "/classes"}>
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
            readOnly ? undefined : (
              <form action={undoCancelClass.bind(null, classId, date)}>
                <button type="submit" className="text-sm font-medium text-indigo-600">
                  Undo cancellation
                </button>
              </form>
            )
          }
        />
      ) : state.students.length === 0 ? (
        <EmptyState icon={Users} message="No students enrolled in this class yet." />
      ) : (
        <AttendanceForm classId={classId} date={date} students={state.students} readOnly={readOnly} />
      )}
    </PageShell>
  );
}
