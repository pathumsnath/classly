import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { colomboNow, todayInColombo } from "@/lib/time";
import type { AttendanceStatus, PaymentStatus } from "@/lib/supabase/types";

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
// what time it is.
export async function getTodaysClasses(): Promise<TodayClassRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const now = colomboNow();
  const weekday = WEEKDAY_NAMES[now.getDay()];
  const date = todayInColombo();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, subject, schedule_start_time, schedule_end_time, schedule_days")
    .eq("institute_id", session.instituteId);

  const todays = (classes ?? []).filter((c) => c.schedule_days.includes(weekday));
  if (todays.length === 0) return [];

  const classIds = todays.map((c) => c.id);

  const [{ data: cancellations }, { data: attendanceRows }] = await Promise.all([
    supabase.from("class_cancellations").select("class_id").eq("date", date).in("class_id", classIds),
    supabase.from("attendance").select("class_id").eq("date", date).in("class_id", classIds),
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
        subject: c.subject,
        scheduleStartTime: c.schedule_start_time,
        scheduleEndTime: c.schedule_end_time,
        bucket,
      };
    })
    .sort((a, b) => (a.scheduleStartTime ?? "").localeCompare(b.scheduleStartTime ?? ""));
}

export interface AttendanceStudentRow {
  enrollmentId: string;
  studentId: string;
  name: string;
  status: AttendanceStatus | null;
  feeStatus: PaymentStatus | null;
  feeBalance: number | null;
  feePaymentId: string | null;
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
    .select("id, subject")
    .eq("id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!cls) return null;

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
    return { classId, subject: cls.subject, date, isCancelled: !!cancellation, students: [] };
  }

  const studentIds = enrollments.map((e) => e.student_id);
  const enrollmentIds = enrollments.map((e) => e.id);
  const month = `${date.slice(0, 7)}-01`;

  const [{ data: students }, { data: existingAttendance }, { data: payments }] = await Promise.all([
    supabase.from("users").select("id, name").in("id", studentIds),
    supabase.from("attendance").select("enrollment_id, status").eq("date", date).in("enrollment_id", enrollmentIds),
    supabase
      .from("payments")
      .select("id, student_id, status, balance")
      .eq("class_id", classId)
      .eq("month", month)
      .in("student_id", studentIds),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.name]));
  const attendanceByEnrollment = new Map((existingAttendance ?? []).map((a) => [a.enrollment_id, a.status]));
  const feeByStudent = new Map((payments ?? []).map((p) => [p.student_id, p]));

  const rows: AttendanceStudentRow[] = enrollments.map((e) => {
    const fee = feeByStudent.get(e.student_id);
    return {
      enrollmentId: e.id,
      studentId: e.student_id,
      name: nameById.get(e.student_id) ?? "Unknown",
      status: attendanceByEnrollment.get(e.id) ?? null,
      feeStatus: fee?.status ?? null,
      feeBalance: fee?.balance ?? null,
      feePaymentId: fee?.id ?? null,
    };
  });

  return { classId, subject: cls.subject, date, isCancelled: !!cancellation, students: rows };
}
