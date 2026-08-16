"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, CalendarOff } from "lucide-react";
import { EmptyState } from "@/components/card";
import { undoCancelClass } from "@/lib/attendance/actions";
import { weekOfMonth } from "@/lib/time";
import { AttendanceForm } from "./attendance-form";
import { MonthlyAttendanceGrid } from "./monthly-attendance-grid";
import { CycleHeader } from "./cycle-header";
import type { ClassAttendanceState, ClassMonthlyAttendance } from "@/lib/attendance/queries";

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

// Both the day and monthly views' data are fetched together up front (see
// page.tsx) specifically so switching between them here is an instant
// local state flip, not a fresh navigation/round-trip — that round-trip
// was the "switching tabs feels slow" complaint. Only date/month
// pagination *within* a tab still needs a real navigation, since we can't
// prefetch every date.
export function AttendanceTabs({
  classId,
  initialView,
  date,
  month,
  dayState,
  monthlyState,
}: {
  classId: string;
  initialView: "day" | "monthly";
  date: string;
  month: string;
  dayState: ClassAttendanceState;
  monthlyState: ClassMonthlyAttendance;
}) {
  const [tab, setTab] = useState<"day" | "monthly">(initialView);

  return (
    <>
      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("day")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "day" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Mark attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "monthly" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Monthly view
        </button>
      </div>

      {tab === "day" ? (
        <>
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

          {dayState.isCancelled ? (
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
          ) : dayState.students.length === 0 ? (
            <EmptyState icon={Users} message="No students enrolled in this class yet." />
          ) : (
            <AttendanceForm
              classId={classId}
              date={date}
              students={dayState.students}
              cycleProgress={dayState.cycleProgress}
            />
          )}
        </>
      ) : (
        <>
          {monthlyState.cycleProgress ? (
            <CycleHeader
              classId={classId}
              cycleProgress={monthlyState.cycleProgress}
              cycleOffset={monthlyState.cycleOffset}
              sessionDates={monthlyState.sessionDates}
            />
          ) : (
            <>
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
                LKR {monthlyState.collectedThisMonth.toLocaleString()} collected
              </span>
            </>
          )}

          {monthlyState.students.length === 0 ? (
            <EmptyState icon={Users} message="No students enrolled in this class yet." />
          ) : (
            <MonthlyAttendanceGrid sessionDates={monthlyState.sessionDates} students={monthlyState.students} />
          )}
        </>
      )}
    </>
  );
}
