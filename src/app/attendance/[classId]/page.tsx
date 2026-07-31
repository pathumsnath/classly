import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassAttendanceState, todayInColombo } from "@/lib/attendance/queries";
import { markClassCancelled, undoCancelClass } from "@/lib/attendance/actions";
import { PageShell } from "@/components/page-shell";
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

  return (
    <PageShell title={state.subject} backHref="/classes">
      <div className="flex items-center gap-4 text-sm">
        <Link href={`/attendance/${classId}?date=${addDays(date, -1)}`} className="font-medium text-indigo-600">
          &larr; Prev day
        </Link>
        <span className="font-medium text-gray-900">{date}</span>
        <Link href={`/attendance/${classId}?date=${addDays(date, 1)}`} className="font-medium text-indigo-600">
          Next day &rarr;
        </Link>
      </div>

      {state.isCancelled ? (
        <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">This class was cancelled on {date}.</p>
          <form action={undoCancelClass.bind(null, classId, date)}>
            <button type="submit" className="text-sm font-medium text-indigo-600">
              Undo cancellation
            </button>
          </form>
        </div>
      ) : state.students.length === 0 ? (
        <p className="text-sm text-gray-500">No students enrolled in this class yet.</p>
      ) : (
        <>
          <AttendanceForm classId={classId} date={date} students={state.students} />
          <form action={markClassCancelled.bind(null, classId, date)}>
            <button type="submit" className="text-sm font-medium text-red-600">
              Mark class as cancelled
            </button>
          </form>
        </>
      )}
    </PageShell>
  );
}
