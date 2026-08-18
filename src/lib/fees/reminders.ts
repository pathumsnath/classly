import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledDatesInMonth } from "@/lib/attendance/session-dates";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { currentMonthInColombo, todayInColombo } from "@/lib/time";

type AdminClient = ReturnType<typeof createAdminClient>;

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Walks forward day by day from `from`, collecting scheduled
// (non-cancelled) dates until `count` are found — a session-cycle's dates
// don't align to a calendar month, so there's no closed-form range scan.
// Mirrors attendance/queries.ts's private walkCycleSessionDates.
async function walkScheduledDates(
  admin: AdminClient,
  classId: string,
  scheduleDays: string[],
  from: string,
  count: number,
): Promise<string[]> {
  const dates: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; dates.length < count && i < 1000; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if (scheduleDays.includes(WEEKDAY_NAMES[d.getUTCDay()])) {
      const { data: cancellation } = await admin
        .from("class_cancellations")
        .select("id")
        .eq("class_id", classId)
        .eq("date", dateStr)
        .maybeSingle();
      if (!cancellation) dates.push(dateStr);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// The date of a class's 3rd scheduled session in its current billing
// period, plus the period_key that session's fee is filed under — null if
// the period doesn't even have a 3rd session (e.g. a 2-session cycle, or a
// schedule with too few days left in the month).
async function thirdSessionOfPeriod(
  admin: AdminClient,
  cls: { id: string; schedule_days: string[]; billing_cycle_sessions: number | null; cycle_started_at: string | null },
): Promise<{ date: string; periodKey: string } | null> {
  if (cls.billing_cycle_sessions === null) {
    const month = currentMonthInColombo();
    const { data: cancellations } = await admin
      .from("class_cancellations")
      .select("date")
      .eq("class_id", cls.id)
      .gte("date", month)
      .lt("date", addDays(month, 31));
    const cancelledDates = new Set((cancellations ?? []).map((c) => c.date));
    const dates = scheduledDatesInMonth(cls.schedule_days, month, cancelledDates);
    if (dates.length < 3) return null;
    return { date: dates[2], periodKey: month };
  }

  if (!cls.cycle_started_at) return null;
  const dates = await walkScheduledDates(admin, cls.id, cls.schedule_days, cls.cycle_started_at, 3);
  if (dates.length < 3) return null;
  return { date: dates[2], periodKey: cls.cycle_started_at };
}

export interface DueFeeReminder {
  classId: string;
  className: string;
  sessionDate: string;
  unpaidCount: number;
  unpaidTotal: number;
  message: string;
}

// Classes whose 3rd scheduled session of the current billing period (a
// month, or a session-cycle) falls tomorrow, with at least one student
// still owing money for it — shown on the owner's dashboard the day
// before, so there's still a chance to collect before that session. A
// class naturally drops off this list once the day passes or its balance
// is fully paid, so there's no separate "dismiss"/"sent" state to track.
export async function getDueFeeReminders(instituteId: string): Promise<DueFeeReminder[]> {
  const admin = createAdminClient();
  const tomorrow = addDays(todayInColombo(), 1);

  const { data: classes } = await admin
    .from("classes")
    .select("id, subject_id, grade, medium, group_name, schedule_days, billing_cycle_sessions, cycle_started_at")
    .eq("institute_id", instituteId);

  const reminders: DueFeeReminder[] = [];

  for (const cls of classes ?? []) {
    const third = await thirdSessionOfPeriod(admin, cls);
    if (!third || third.date !== tomorrow) continue;

    const { data: outstandingPayments } = await admin
      .from("payments")
      .select("balance")
      .eq("class_id", cls.id)
      .eq(cls.billing_cycle_sessions === null ? "month" : "cycle_started_at", third.periodKey)
      .in("status", ["pending", "partial"]);
    const unpaidRows = outstandingPayments ?? [];
    if (unpaidRows.length === 0) continue;
    const unpaidTotal = unpaidRows.reduce((sum, p) => sum + p.balance, 0);

    const { data: subject } = await admin.from("subjects").select("name").eq("id", cls.subject_id).maybeSingle();
    const className = [subject?.name ?? "Class", formatGrade(cls.grade), formatMedium(cls.medium)]
      .filter(Boolean)
      .join(" · ");
    const groupSuffix = cls.group_name ? ` (${cls.group_name})` : "";

    // Sinhala, meant to be forwarded straight into a parents' WhatsApp
    // group — the closing call-to-action line was supplied directly.
    const periodLabel = cls.billing_cycle_sessions === null ? "මාසය" : "චක්‍රය";
    const message =
      `${className}${groupSuffix}\n` +
      `ශිෂ්‍යයින් ${unpaidRows.length} දෙනෙකු මෙම ${periodLabel} සඳහා LKR ${unpaidTotal.toLocaleString()} ක් ගෙවිය යුතුව ඇත.\n` +
      `හෙට දින සියලු දරුවන් පන්ති ගාස්තු ගෙවා අවසන් කරන්න.`;

    reminders.push({
      classId: cls.id,
      className: `${className}${groupSuffix}`,
      sessionDate: third.date,
      unpaidCount: unpaidRows.length,
      unpaidTotal,
      message,
    });
  }

  return reminders;
}
