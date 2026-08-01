import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { colomboNow, todayInColombo, currentMonthInColombo } from "@/lib/time";
import { subjectNamesById } from "@/lib/subjects/queries";
import { getWalletBalancesByStudent } from "@/lib/wallet/queries";
import { isOverdue } from "@/lib/fees/status";
import type { AttendanceStatus } from "@/lib/supabase/types";

export { todayInColombo };

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface TodayClassRow {
  id: string;
  subject: string;
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
    .select("id, subject_id, schedule_start_time, schedule_end_time, schedule_days")
    .eq("institute_id", session.instituteId);
  if (tutorId) classesQuery = classesQuery.eq("tutor_id", tutorId);

  const { data: classes } = await classesQuery;

  const todays = (classes ?? []).filter((c) => c.schedule_days.includes(weekday));
  if (todays.length === 0) return [];

  const classIds = todays.map((c) => c.id);

  const [{ data: cancellations }, { data: attendanceRows }, subjectNames] = await Promise.all([
    supabase.from("class_cancellations").select("class_id").eq("date", date).in("class_id", classIds),
    supabase.from("attendance").select("class_id").eq("date", date).in("class_id", classIds),
    subjectNamesById(
      supabase,
      todays.map((c) => c.subject_id),
    ),
  ]);

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
}

export interface AttendanceStudentRow {
  enrollmentId: string;
  studentId: string;
  name: string;
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

export interface ClassAttendanceState {
  classId: string;
  subject: string;
  date: string;
  isCancelled: boolean;
  students: AttendanceStudentRow[];
}

export async function getClassAttendanceState(classId: string, date: string): Promise<ClassAttendanceState | null> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, subject_id, tutor_id")
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

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) {
    return { classId, subject, date, isCancelled: !!cancellation, students: [] };
  }

  const studentIds = enrollments.map((e) => e.student_id);
  const enrollmentIds = enrollments.map((e) => e.id);
  const currentMonth = currentMonthInColombo();

  const [{ data: students }, { data: existingAttendance }, { data: payments }, walletBalances] = await Promise.all([
    supabase.from("users").select("id, name").in("id", studentIds),
    supabase.from("attendance").select("enrollment_id, status").eq("date", date).in("enrollment_id", enrollmentIds),
    // Every payment record for this class (any month) — the fee badge
    // shows what's owed for *this class* across all outstanding months,
    // not just the one being viewed, and not other classes.
    supabase
      .from("payments")
      .select("id, student_id, status, balance, month")
      .eq("class_id", classId)
      .in("student_id", studentIds),
    getWalletBalancesByStudent(supabase, session.instituteId, studentIds),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.name]));
  const attendanceByEnrollment = new Map((existingAttendance ?? []).map((a) => [a.enrollment_id, a.status]));

  interface PaymentRow {
    id: string;
    student_id: string;
    status: "pending" | "partial" | "paid" | "overdue" | "waived";
    balance: number;
    month: string;
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
      name: nameById.get(e.student_id) ?? "Unknown",
      status: attendanceByEnrollment.get(e.id) ?? null,
      hasFeeRecords: studentPayments.length > 0,
      feeBalance: outstanding.reduce((sum, p) => sum + p.balance, 0),
      feeIsOverdue: outstanding.some((p) => isOverdue(p.status, p.month, currentMonth)),
      outstandingPayments: outstanding.map((p) => ({ id: p.id, month: p.month, balance: p.balance })),
      walletBalance: walletBalances.get(e.student_id) ?? 0,
    };
  });

  return { classId, subject, date, isCancelled: !!cancellation, students: rows };
}

export interface MonthlyAttendanceStudentRow {
  studentId: string;
  name: string;
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
  month: string;
  // This class's own session dates within the month (from schedule_days),
  // excluding any that were cancelled — the grid's columns.
  sessionDates: string[];
  students: MonthlyAttendanceStudentRow[];
}

// Tutor read-only view — a whole month's attendance for a class at once
// instead of paging day by day, since a tutor is reviewing history rather
// than marking it live.
export async function getClassAttendanceForMonth(classId: string, month: string): Promise<ClassMonthlyAttendance | null> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, subject_id, tutor_id, schedule_days")
    .eq("id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!cls) return null;
  if (session.role === "tutor" && cls.tutor_id !== session.userId) return null;

  const subjectNames = await subjectNamesById(supabase, [cls.subject_id]);
  const subject = subjectNames.get(cls.subject_id) ?? "Unknown";

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
  const sessionDates = allDatesInMonth.filter((d) => !cancelledDates.has(d));

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) {
    return { classId, subject, month, sessionDates, students: [] };
  }

  const studentIds = enrollments.map((e) => e.student_id);
  const currentMonth = currentMonthInColombo();

  const [{ data: students }, { data: attendanceRows }, { data: payments }] = await Promise.all([
    supabase.from("users").select("id, name").in("id", studentIds),
    supabase
      .from("attendance")
      .select("enrollment_id, date, status")
      .eq("class_id", classId)
      .in("date", sessionDates),
    supabase
      .from("payments")
      .select("student_id, status, balance, month")
      .eq("class_id", classId)
      .in("student_id", studentIds),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.name]));
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
  }
  const paymentsByStudent = new Map<string, PaymentRow[]>();
  for (const p of (payments ?? []) as PaymentRow[]) {
    const list = paymentsByStudent.get(p.student_id) ?? [];
    list.push(p);
    paymentsByStudent.set(p.student_id, list);
  }

  const rows: MonthlyAttendanceStudentRow[] = enrollments.map((e) => {
    const studentPayments = paymentsByStudent.get(e.student_id) ?? [];
    const outstanding = studentPayments.filter((p) => p.status === "pending" || p.status === "partial");
    const byDate = statusByStudentDate.get(e.student_id) ?? {};

    const statusByDate: Record<string, AttendanceStatus | null> = {};
    for (const date of sessionDates) statusByDate[date] = byDate[date] ?? null;

    return {
      studentId: e.student_id,
      name: nameById.get(e.student_id) ?? "Unknown",
      hasFeeRecords: studentPayments.length > 0,
      feeBalance: outstanding.reduce((sum, p) => sum + p.balance, 0),
      feeIsOverdue: outstanding.some((p) => isOverdue(p.status, p.month, currentMonth)),
      statusByDate,
    };
  });

  return { classId, subject, month, sessionDates, students: rows };
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
