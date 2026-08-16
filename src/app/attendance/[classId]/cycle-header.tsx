import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BillingCycleProgress } from "@/lib/attendance/queries";

function formatCycleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Shared between the tutor-only branch and AttendanceTabs (owner/admin_staff)
// — a session-cycle class's history isn't stored anywhere as discrete
// cycles, so paging "back" re-derives the previous cycle's dates from the
// schedule each time (see stepCycleStartBackward). No plain function
// component props here need "use client" — it renders fine from both a
// Server Component and inside a Client Component tree.
export function CycleHeader({
  classId,
  cycleProgress,
  cycleOffset,
  sessionDates,
}: {
  classId: string;
  cycleProgress: BillingCycleProgress;
  cycleOffset: number;
  sessionDates: string[];
}) {
  const isCurrent = cycleOffset === 0;
  const isClosed = cycleProgress.sessionsSoFar >= cycleProgress.sessionsRequired;
  const label = isCurrent
    ? "Current billing cycle"
    : sessionDates.length > 0
      ? `${formatCycleDate(sessionDates[0])} – ${formatCycleDate(sessionDates[sessionDates.length - 1])}`
      : "Billing cycle";

  return (
    <>
      <div className="flex w-fit items-center gap-2 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
        <Link
          href={`/attendance/${classId}?view=monthly&cycleOffset=${cycleOffset + 1}`}
          aria-label="Previous cycle"
          className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-medium text-gray-900">{label}</span>
        {isCurrent ? (
          <span className="p-2.5 text-gray-200">
            <ChevronRight className="h-5 w-5" />
          </span>
        ) : (
          <Link
            href={`/attendance/${classId}?view=monthly&cycleOffset=${cycleOffset - 1}`}
            aria-label="Next cycle"
            className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          Session {Math.min(cycleProgress.sessionsSoFar + 1, cycleProgress.sessionsRequired)} of{" "}
          {cycleProgress.sessionsRequired}
        </span>
        <p className="text-sm text-gray-500">
          {isClosed
            ? "This cycle is complete — fees have been generated."
            : `Fee generates once session ${cycleProgress.sessionsRequired} is marked.`}
        </p>
      </div>
    </>
  );
}
