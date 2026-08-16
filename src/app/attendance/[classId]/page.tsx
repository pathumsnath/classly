import { notFound } from "next/navigation";
import { getClassAttendanceState, getClassAttendanceForMonth, todayInColombo } from "@/lib/attendance/queries";
import { currentMonthInColombo } from "@/lib/time";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/card";
import { Users } from "lucide-react";
import { MonthlyAttendanceGrid } from "./monthly-attendance-grid";
import { CycleHeader } from "./cycle-header";
import { AttendanceTabs } from "./attendance-tabs";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string; month?: string; view?: string; cycleOffset?: string }>;
}) {
  const { classId } = await params;
  const session = await getSessionInfo();
  const isTutor = session?.role === "tutor";
  const { view, date: dateParam, month: monthParam, cycleOffset: cycleOffsetParam } = await searchParams;
  const month = monthParam || currentMonthInColombo();
  const cycleOffset = Math.max(0, Number(cycleOffsetParam) || 0);

  // Tutors only ever get the whole-month read-only review (marking is the
  // owner/admin_staff's job) — no tabs, so no need to fetch the day view
  // too.
  if (isTutor) {
    const monthly = await getClassAttendanceForMonth(classId, month, cycleOffset);
    if (!monthly) notFound();

    return (
      <PageShell title={monthly.groupName ? `${monthly.subject} — ${monthly.groupName}` : monthly.subject} backHref="/">
        {monthly.cycleProgress ? (
          <CycleHeader
            classId={classId}
            cycleProgress={monthly.cycleProgress}
            cycleOffset={monthly.cycleOffset}
            sessionDates={monthly.sessionDates}
          />
        ) : (
          <>
            <span className="font-medium text-gray-900">
              {new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <span className="w-fit rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
              LKR {monthly.collectedThisMonth.toLocaleString()} collected
            </span>
          </>
        )}

        {monthly.students.length === 0 ? (
          <EmptyState icon={Users} message="No students enrolled in this class yet." />
        ) : (
          <MonthlyAttendanceGrid sessionDates={monthly.sessionDates} students={monthly.students} />
        )}
      </PageShell>
    );
  }

  // Owner/admin_staff: fetch both views up front, in parallel, so
  // AttendanceTabs can switch between them instantly on the client
  // instead of navigating and re-fetching each time.
  const date = dateParam || todayInColombo();
  const [dayState, monthlyState] = await Promise.all([
    getClassAttendanceState(classId, date),
    getClassAttendanceForMonth(classId, month, cycleOffset),
  ]);
  if (!dayState || !monthlyState) notFound();

  return (
    <PageShell
      title={monthlyState.groupName ? `${monthlyState.subject} — ${monthlyState.groupName}` : monthlyState.subject}
      backHref="/classes"
    >
      <AttendanceTabs
        classId={classId}
        initialView={view === "monthly" ? "monthly" : "day"}
        date={date}
        month={month}
        dayState={dayState}
        monthlyState={monthlyState}
      />
    </PageShell>
  );
}
