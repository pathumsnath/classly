import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { colomboNow, todayInColombo, currentMonthInColombo } from "@/lib/time";
import { subjectNamesById } from "@/lib/subjects/queries";
import { getWalletBalancesByStudent } from "@/lib/wallet/queries";
import { isOverdue } from "@/lib/fees/status";
import type { AttendanceStatus, GradeLevel } from "@/lib/supabase/types";

export { todayInColombo };

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface TodayClassRow {
  id: string;
  subject: string;
  groupName: string | null;
  grade: GradeLevel | null;
  // Redundant on the tutor's own dashboard (always themselves) but
  // needed institute-wide, where "today's classes" spans every tutor —
  // one component renders both, so this is always populated.
  tutorName: string;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  bucket: "now" | "upcoming" | "done";
}

// FR-5.1 — today's classes, color-coded now/upcoming/done. "Done" also
// covers classes already submitted or cancelled for today, regardless of
// what time it is. `tutorId` scopes this to one tutor's own classes (the
// tutor dashboard); omitted, it's institute-wide (owner/admin_staff).
export async function getTodaysClasses(tutorId?: string): Promise<TodayClassRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const now = colomboNow();
  const weekday = WEEKDAY_NAMES[now.getDay()];
  const date = todayInColombo();

  let classesQuery = supabase
    .from("classes")
    .select("id, subject_id, tutor_id, grade, schedule_start_time, schedule_end_time, schedule_days, group_name")
    .eq("institute_id", session.instituteId);
  if (tutorId) classesQuery = classesQuery.eq("tutor_id", tutorId);

  const { data: classes } = await classesQuery;

  const todays = (classes ?? []).filter((c) => c.schedule_days.includes(weekday));
  if (todays.length === 0) return [];

  const classIds = todays.map((c) => c.id);
  const tutorIds = [...new Set(todays.map((c) => c.tutor_id))];

  const [{ data: cancellations }, { data: attendanceRows }, subjectNames, { data: tutors }] = await Promise.all([
    supabase.from("class_cancellations").select("class_id").eq("date", date).in("class_id", classIds),
    supabase.from("attendance").select("class_id").eq("date", date).in("class_id", classIds),
    subjectNamesById(
      supabase,
      todays.map((c) => c.subject_id),
    ),
    supabase.from("users").select("id, name").in("id", tutorIds),
  ]);

  const tutorNameById = new Map((tutors ?? []).map((t) => [t.id, t.name]));

  const doneSet = new Set([
    ...(cancellations ?? []).map((c) => c.class_id),
    ...(attendanceRows ?? []).map((a) => a.class_id),
  ]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return todays
    .map((c) => {
      let bucket: TodayClassRow["bucket"] = "upcoming";
      if (doneSet.has(c.id)) {
        bucket = "done";
      } else if (c.schedule_start_time) {
        const [h, m] = c.schedule_start_time.split(":").map(Number);
        bucket = nowMinutes >= h * 60 + m ? "now" : "upcoming";
      }
      return {
        id: c.id,
        subject: subjectNames.get(c.subject_id) ?? "Unknown",
        groupName: c.group_name,
        grade: c.grade,
        tutorName: tutorNameById.get(c.tutor_id) ?? "Unknown",
        scheduleStartTime: c.schedule_start_time,
        scheduleEndTime: c.schedule_end_time,
        bucket,
      };
    })
    .sort((a, b) => (a.scheduleStartTime ?? "").localeCompare(b.scheduleStartTime ?? ""));
}

export interface OutstandingPayment {
  id: string;
  month: string;
  balance: number;
  // What to show the person recording a payment. For a calendar-billed
  // class this is just the month ("2026-08"). For a session-cycle billed
  // class, month alone can't tell two cycles apart (see migration
  // 0011/0012 — different cycles can share a month bucket), so this is
  // the cycle's own start date instead ("Cycle from Jul 21").
  label: string;
}

function formatCycleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface AttendanceStudentRow {
  enrollmentId: string;
  studentId: string;
  name: string;
  // Shown alongside the name everywhere a student list appears — two
  // students can share a name, phone is the disambiguator.
  phone: string;
  status: AttendanceStatus | null;
  // Scoped to *this* class only, summed across every month they owe for
  // it — not other classes the student may also be enrolled in.
  hasFeeRecords: boolean;
  feeBalance: number;
  feeIsOverdue: boolean;
  outstandingPayments: OutstandingPayment[];
  // Spare credit at this institute, from past overpayment — usable toward
  // any of the student's classes here, not just this one.
  walletBalance: number;
}

export interface BillingCycleProgress {
  sessionsRequired: number;
  // Distinct session dates recorded since the cycle started, as of right
  // now — before whatever date is currently being viewed/submitted.
  sessionsSoFar: number;
}

export interface ClassAttendanceState {
  classId: string;
  subject: string;
  groupName: string | null;
  date: string;
  isCancelled: boolean;
  students: AttendanceStudentRow[];
  cycleProgress: BillingCycleProgress | null;
}

export async function getClassAttendanceState(classId: string, date: string): Promise<ClassAttendanceState | null> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, subject_id, tutor_id, group_name, billing_cycle_sessions, cycle_started_at")
    .eq("id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!cls) return null;
  // A tutor can only view attendance for their own classes — everyone
  // else (owner/admin_staff) is institute-wide, matching the classes_select
  // RLS policy this query already relies on.
  if (session.role === "tutor" && cls.tutor_id !== session.userId) return null;

  const subjectNames = await subjectNamesById(supabase, [cls.subject_id]);
  const subject = subjectNames.get(cls.subject_id) ?? "Unknown";

  const { data: cancellation } = await supabase
    .from("class_cancellations")
    .select("id")
    .eq("class_id", classId)
    .eq("date", date)
    .maybeSingle();

  let cycleProgress: BillingCycleProgress | null = null;
  if (cls.billing_cycle_sessions !== null && cls.cycle_started_at) {
    const { data: sessions } = await supabase
      .from("attendance")
      .select("date")
      .eq("class_id", classId)
      .gte("date", cls.cycle_started_at);
    cycleProgress = {
      sessionsRequired: cls.billing_cycle_sessions,
      sessionsSoFar: new Set((sessions ?? []).map((s) => s.date)).size,
    };
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) {
    return { classId, subject, groupName: cls.group_name, date, isCancelled: !!cancellation, students: [], cycleProgress };
  }

  const studentIds = enrollments.map((e) => e.student_id);
  const enrollmentIds = enrollments.map((e) => e.id);
  const currentMonth = currentMonthInColombo();

  const [{ data: students }, { data: existingAttendance }, { data: payments }, walletBalances] = await Promise.all([
    supabase.from("users").select("id, name, phone").in("id", studentIds),
    supabase.from("attendance").select("enrollment_id, status").eq("date", date).in("enrollment_id", enrollmentIds),
    // Every payment record for this class (any month) — the fee badge
    // shows what's owed for *this class* across all outstanding months,
    // not just the one being viewed, and not other classes.
    supabase
      .from("payments")
      .select("id, student_id, status, balance, month, cycle_started_at")
      .eq("class_id", classId)
      .in("student_id", studentIds),
    getWalletBalancesByStudent(supabase, session.instituteId, studentIds),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const attendanceByEnrollment = new Map((existingAttendance ?? []).map((a) => [a.enrollment_id, a.status]));

  interface PaymentRow {
    id: string;
    student_id: string;
    status: "pending" | "partial" | "paid" | "overdue" | "waived";
    balance: number;
    month: string;
    cycle_started_at: string;
  }

  const paymentsByStudent = new Map<string, PaymentRow[]>();
  for (const p of (payments ?? []) as PaymentRow[]) {
    const list = paymentsByStudent.get(p.student_id) ?? [];
    list.push(p);
    paymentsByStudent.set(p.student_id, list);
  }

  const rows: AttendanceStudentRow[] = enrollments.map((e) => {
    const studentPayments = paymentsByStudent.get(e.student_id) ?? [];
    const outstanding = studentPayments.filter((p) => p.status === "pending" || p.status === "partial");

    return {
      enrollmentId: e.id,
      studentId: e.student_id,
      name: studentById.get(e.student_id)?.name ?? "Unknown",
      phone: studentById.get(e.student_id)?.phone ?? "",
      status: attendanceByEnrollment.get(e.id) ?? null,
      hasFeeRecords: studentPayments.length > 0,
      feeBalance: outstanding.reduce((sum, p) => sum + p.balance, 0),
      feeIsOverdue: outstanding.some((p) => isOverdue(p.status, p, cls, currentMonth)),
      outstandingPayments: outstanding.map((p) => ({
        id: p.id,
        month: p.month,
        balance: p.balance,
        label:
          cls.billing_cycle_sessions !== null
            ? `Cycle from ${formatCycleDate(p.cycle_started_at)}`
            : p.month.slice(0, 7),
      })),
      walletBalance: walletBalances.get(e.student_id) ?? 0,
    };
  });

  return { classId, subject, groupName: cls.group_name, date, isCancelled: !!cancellation, students: rows, cycleProgress };
}

export interface MonthlyAttendanceStudentRow {
  studentId: string;
  name: string;
  phone: string;
  hasFeeRecords: boolean;
  feeBalance: number;
  feeIsOverdue: boolean;
  // Keyed by date (YYYY-MM-DD); missing/null means no record for that
  // session yet (e.g. not marked, or in the future).
  statusByDate: Record<string, AttendanceStatus | null>;
}

export interface ClassMonthlyAttendance {
  classId: string;
  subject: string;
  groupName: string | null;
  month: string;
  // This class's own session dates within the month (from schedule_days),
  // excluding any that were cancelled — the grid's columns. For a
  // session-cycle class this is instead the current cycle's own dates,
  // which can span a month boundary — see cycleProgress.
  sessionDates: string[];
  students: MonthlyAttendanceStudentRow[];
  // Fees collected from this class's students for the viewed month —
  // gross income, same figure the tutor dashboard's class list shows
  // for the current month, but following whichever month is on screen.
  // Not meaningful (always 0) for a session-cycle class's in-progress
  // cycle — its fee doesn't exist until the cycle closes.
  collectedThisMonth: number;
  // Non-null only for a class on session-cycle billing — the calendar
  // grid doesn't apply to it (a cycle can straddle a month boundary), so
  // the page shows this instead of month navigation.
  cycleProgress: BillingCycleProgress | null;
  // How many cycles back from the current (open) one is being viewed —
  // 0 is current, 1 is the one before it, etc. Only meaningful alongside
  // cycleProgress; lets the page disable "forward" past 0 and label a
  // past cycle by its actual dates instead of "current".
  cycleOffset: number;
}

// Walks forward day-by-day from `from`, collecting scheduled (and not
// cancelled) session dates until there are `count` of them — a
// session-cycle's own dates don't align to a calendar month, so this
// can't be a simple date-range scan like the calendar-month branch.
// Capped well past any realistic cycle length as a runaway guard (e.g. a
// class with no schedule_days would otherwise loop forever).
async function walkCycleSessionDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
      const { data: cancellation } = await supabase
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

// The reverse of walkCycleSessionDates — steps backward from just before
// `from` to find the start date of the cycle immediately preceding it
// (i.e. `count` scheduled, non-cancelled sessions earlier). Used to page
// backward through a session-cycle class's closed cycles, since their
// boundaries aren't stored anywhere — only the *current* cycle's start is
// (classes.cycle_started_at), so history has to be re-derived from the
// schedule pattern each time.
async function stepCycleStartBackward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  scheduleDays: string[],
  from: string,
  count: number,
): Promise<string> {
  const dates: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  for (let i = 0; dates.length < count && i < 1000; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if (scheduleDays.includes(WEEKDAY_NAMES[d.getUTCDay()])) {
      const { data: cancellation } = await supabase
        .from("class_cancellations")
        .select("id")
        .eq("class_id", classId)
        .eq("date", dateStr)
        .maybeSingle();
      if (!cancellation) dates.push(dateStr);
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates[dates.length - 1] ?? from;
}

// Tutor read-only view — a whole month's attendance for a class at once
// instead of paging day by day, since a tutor is reviewing history rather
// than marking it live. `month` is ignored for a class on session-cycle
// billing, which shows one of its cycles instead — `cycleOffset` (0 =
// current/open cycle, 1 = the one before it, etc.) picks which.
export async function getClassAttendanceForMonth(
  classId: string,
  month: string,
  cycleOffset = 0,
): Promise<ClassMonthlyAttendance | null> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, subject_id, tutor_id, schedule_days, group_name, billing_cycle_sessions, cycle_started_at")
    .eq("id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!cls) return null;
  if (session.role === "tutor" && cls.tutor_id !== session.userId) return null;

  const subjectNames = await subjectNamesById(supabase, [cls.subject_id]);
  const subject = subjectNames.get(cls.subject_id) ?? "Unknown";

  let sessionDates: string[];
  let cycleProgress: BillingCycleProgress | null = null;

  if (cls.billing_cycle_sessions !== null && cls.cycle_started_at) {
    let cycleStart = cls.cycle_started_at;
    for (let i = 0; i < cycleOffset; i++) {
      cycleStart = await stepCycleStartBackward(supabase, classId, cls.schedule_days, cycleStart, cls.billing_cycle_sessions);
    }

    sessionDates = await walkCycleSessionDates(supabase, classId, cls.schedule_days, cycleStart, cls.billing_cycle_sessions);

    // Bounded to this specific cycle's own dates (not "everything since
    // cycleStart") so a past, fully-closed cycle doesn't pick up a later
    // cycle's sessions too.
    const { data: sessionsSoFarRows } = await supabase
      .from("attendance")
      .select("date")
      .eq("class_id", classId)
      .in("date", sessionDates);
    cycleProgress = {
      sessionsRequired: cls.billing_cycle_sessions,
      sessionsSoFar: new Set((sessionsSoFarRows ?? []).map((s) => s.date)).size,
    };
  } else {
    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const allDatesInMonth: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, mon - 1, day));
      if (cls.schedule_days.includes(WEEKDAY_NAMES[d.getUTCDay()])) {
        allDatesInMonth.push(d.toISOString().slice(0, 10));
      }
    }

    const { data: cancellations } = await supabase
      .from("class_cancellations")
      .select("date")
      .eq("class_id", classId)
      .in("date", allDatesInMonth);
    const cancelledDates = new Set((cancellations ?? []).map((c) => c.date));
    sessionDates = allDatesInMonth.filter((d) => !cancelledDates.has(d));
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) {
    return {
      classId,
      subject,
      groupName: cls.group_name,
      month,
      sessionDates,
      students: [],
      collectedThisMonth: 0,
      cycleProgress,
      cycleOffset,
    };
  }

  const studentIds = enrollments.map((e) => e.student_id);
  const currentMonth = currentMonthInColombo();

  const [{ data: students }, { data: attendanceRows }, { data: payments }] = await Promise.all([
    supabase.from("users").select("id, name, phone").in("id", studentIds),
    supabase
      .from("attendance")
      .select("enrollment_id, date, status")
      .eq("class_id", classId)
      .in("date", sessionDates),
    supabase
      .from("payments")
      .select("student_id, status, balance, month, amount_paid, cycle_started_at")
      .eq("class_id", classId)
      .in("student_id", studentIds),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const studentByEnrollment = new Map(enrollments.map((e) => [e.id, e.student_id]));

  const statusByStudentDate = new Map<string, Record<string, AttendanceStatus>>();
  for (const a of attendanceRows ?? []) {
    const studentId = studentByEnrollment.get(a.enrollment_id);
    if (!studentId) continue;
    const rec = statusByStudentDate.get(studentId) ?? {};
    rec[a.date] = a.status;
    statusByStudentDate.set(studentId, rec);
  }

  interface PaymentRow {
    student_id: string;
    status: "pending" | "partial" | "paid" | "overdue" | "waived";
    balance: number;
    month: string;
    amount_paid: number;
    cycle_started_at: string;
  }
  const paymentsByStudent = new Map<string, PaymentRow[]>();
  for (const p of (payments ?? []) as PaymentRow[]) {
    const list = paymentsByStudent.get(p.student_id) ?? [];
    list.push(p);
    paymentsByStudent.set(p.student_id, list);
  }

  const collectedThisMonth = ((payments ?? []) as PaymentRow[])
    .filter((p) => p.month === month)
    .reduce((sum, p) => sum + p.amount_paid, 0);

  const rows: MonthlyAttendanceStudentRow[] = enrollments.map((e) => {
    const studentPayments = paymentsByStudent.get(e.student_id) ?? [];
    const outstanding = studentPayments.filter((p) => p.status === "pending" || p.status === "partial");
    const byDate = statusByStudentDate.get(e.student_id) ?? {};

    const statusByDate: Record<string, AttendanceStatus | null> = {};
    for (const date of sessionDates) statusByDate[date] = byDate[date] ?? null;

    return {
      studentId: e.student_id,
      name: studentById.get(e.student_id)?.name ?? "Unknown",
      phone: studentById.get(e.student_id)?.phone ?? "",
      hasFeeRecords: studentPayments.length > 0,
      feeBalance: outstanding.reduce((sum, p) => sum + p.balance, 0),
      feeIsOverdue: outstanding.some((p) => isOverdue(p.status, p, cls, currentMonth)),
      statusByDate,
    };
  });

  return {
    classId,
    subject,
    groupName: cls.group_name,
    month,
    sessionDates,
    students: rows,
    collectedThisMonth,
    cycleProgress,
    cycleOffset,
  };
}

export interface AttendanceRecordRow {
  id: string;
  date: string;
  status: AttendanceStatus;
}

export async function listAttendanceForStudentInClass(
  studentId: string,
  classId: string,
): Promise<AttendanceRecordRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!enrollment) return [];

  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, date, status")
    .eq("enrollment_id", enrollment.id)
    .order("date", { ascending: false });

  return attendance ?? [];
}
