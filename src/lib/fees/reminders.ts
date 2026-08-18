import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledDatesInMonth } from "@/lib/attendance/session-dates";
import { sendSms } from "@/lib/sms";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { currentMonthInColombo } from "@/lib/time";

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

export interface FeeReminderResult {
  sent: number;
}

// Runs daily (see /api/cron/fee-reminders). For every active class whose
// 3rd scheduled session of the current billing period falls tomorrow,
// texts the institute owner a ready-to-forward fee-settlement reminder —
// one message per class, timed a day ahead so there's still a chance to
// collect before that session. Idempotent per (class, period) via
// fee_reminder_sends, so a cron re-run on the same day is harmless.
export async function sendDueFeeReminders(todayColombo: string): Promise<FeeReminderResult> {
  const admin = createAdminClient();
  const tomorrow = addDays(todayColombo, 1);

  const { data: institutes } = await admin.from("institutes").select("id, name");
  let sent = 0;

  for (const institute of institutes ?? []) {
    const { data: ownerRole } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("institute_id", institute.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!ownerRole) continue;

    const { data: owner } = await admin.from("users").select("phone").eq("id", ownerRole.user_id).maybeSingle();
    if (!owner?.phone) continue;

    const { data: classes } = await admin
      .from("classes")
      .select("id, subject_id, grade, medium, group_name, schedule_days, billing_cycle_sessions, cycle_started_at")
      .eq("institute_id", institute.id);

    for (const cls of classes ?? []) {
      const third = await thirdSessionOfPeriod(admin, cls);
      if (!third || third.date !== tomorrow) continue;

      const { data: existing } = await admin
        .from("fee_reminder_sends")
        .select("id")
        .eq("class_id", cls.id)
        .eq("period_key", third.periodKey)
        .maybeSingle();
      if (existing) continue;

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

      const message =
        `Reminder: ${className}${groupSuffix} has its next class on ${third.date}. ` +
        `${unpaidRows.length} student(s) still owe LKR ${unpaidTotal.toLocaleString()} for this ` +
        `${cls.billing_cycle_sessions === null ? "month" : "cycle"} — forward to the class group?`;

      await sendSms({ to: owner.phone, message });

      await admin.from("fee_reminder_sends").insert({
        institute_id: institute.id,
        class_id: cls.id,
        period_key: third.periodKey,
      });
      sent++;
    }
  }

  return { sent };
}
