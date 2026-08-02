import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { subjectNamesById } from "@/lib/subjects/queries";
import { currentMonthInColombo } from "@/lib/time";
import type { FeeType, TutorPaymentModel, GradeLevel, ClassMedium } from "@/lib/supabase/types";

export interface ClassRow {
  id: string;
  subject: string;
  grade: GradeLevel | null;
  medium: ClassMedium | null;
  tutorName: string;
  scheduleDays: string[];
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  feeAmount: number;
  feeType: FeeType;
}

export interface ClassListRow extends ClassRow {
  studentCount: number;
}

export interface TutorClassRow extends ClassListRow {
  // Fees collected from this class's students so far this month —
  // gross income, not the tutor's own cut (that's the salary card).
  collectedThisMonth: number;
}

export interface ClassDetail extends ClassRow {
  tutorId: string;
  subjectId: string;
  room: string | null;
  maxStudents: number | null;
  tutorPaymentModel: TutorPaymentModel;
  tutorPaymentValue: number;
}

export interface EnrolledStudentRow {
  id: string;
  name: string;
  phone: string;
  status: "active" | "inactive";
}

export interface EnrolledClassRow extends ClassRow {
  enrollmentStatus: "active" | "inactive";
  enrolledAt: string;
}

async function tutorNamesById(supabase: Awaited<ReturnType<typeof createClient>>, tutorIds: string[]) {
  if (tutorIds.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("users").select("id, name").in("id", tutorIds);
  return new Map((data ?? []).map((t) => [t.id, t.name]));
}

async function studentCountsByClassId(supabase: Awaited<ReturnType<typeof createClient>>, classIds: string[]) {
  if (classIds.length === 0) return new Map<string, number>();
  const { data } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("status", "active")
    .in("class_id", classIds);

  const counts = new Map<string, number>();
  for (const e of data ?? []) {
    counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1);
  }
  return counts;
}

async function collectedByClassId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classIds: string[],
  month: string,
) {
  if (classIds.length === 0) return new Map<string, number>();
  const { data } = await supabase
    .from("payments")
    .select("class_id, amount_paid")
    .eq("month", month)
    .in("class_id", classIds);

  const collected = new Map<string, number>();
  for (const p of data ?? []) {
    collected.set(p.class_id, (collected.get(p.class_id) ?? 0) + p.amount_paid);
  }
  return collected;
}

export async function listClasses(): Promise<ClassListRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, subject_id, grade, medium, tutor_id, schedule_days, schedule_start_time, schedule_end_time, fee_amount, fee_type",
    )
    .eq("institute_id", session.instituteId)
    .order("created_at", { ascending: true });

  if (!classes || classes.length === 0) return [];

  const [tutorNames, subjectNames, studentCounts] = await Promise.all([
    tutorNamesById(
      supabase,
      classes.map((c) => c.tutor_id),
    ),
    subjectNamesById(
      supabase,
      classes.map((c) => c.subject_id),
    ),
    studentCountsByClassId(
      supabase,
      classes.map((c) => c.id),
    ),
  ]);

  return classes.map((c) => ({
    id: c.id,
    subject: subjectNames.get(c.subject_id) ?? "Unknown",
    grade: c.grade,
    medium: c.medium,
    tutorName: tutorNames.get(c.tutor_id) ?? "Unknown",
    scheduleDays: c.schedule_days,
    scheduleStartTime: c.schedule_start_time,
    scheduleEndTime: c.schedule_end_time,
    feeAmount: c.fee_amount,
    feeType: c.fee_type,
    studentCount: studentCounts.get(c.id) ?? 0,
  }));
}

export async function listClassesForTutor(tutorId: string): Promise<TutorClassRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, subject_id, grade, medium, tutor_id, schedule_days, schedule_start_time, schedule_end_time, fee_amount, fee_type",
    )
    .eq("institute_id", session.instituteId)
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (!classes || classes.length === 0) return [];

  const month = currentMonthInColombo();
  const [subjectNames, tutorNames, studentCounts, collected] = await Promise.all([
    subjectNamesById(
      supabase,
      classes.map((c) => c.subject_id),
    ),
    tutorNamesById(supabase, [tutorId]),
    studentCountsByClassId(
      supabase,
      classes.map((c) => c.id),
    ),
    collectedByClassId(
      supabase,
      classes.map((c) => c.id),
      month,
    ),
  ]);

  return classes.map((c) => ({
    id: c.id,
    subject: subjectNames.get(c.subject_id) ?? "Unknown",
    grade: c.grade,
    medium: c.medium,
    tutorName: tutorNames.get(c.tutor_id) ?? "Unknown",
    scheduleDays: c.schedule_days,
    scheduleStartTime: c.schedule_start_time,
    scheduleEndTime: c.schedule_end_time,
    feeAmount: c.fee_amount,
    feeType: c.fee_type,
    studentCount: studentCounts.get(c.id) ?? 0,
    collectedThisMonth: collected.get(c.id) ?? 0,
  }));
}

export async function getClass(classId: string): Promise<ClassDetail | null> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("institute_id", session.instituteId)
    .maybeSingle();

  if (!cls) return null;

  const [tutorNames, subjectNames] = await Promise.all([
    tutorNamesById(supabase, [cls.tutor_id]),
    subjectNamesById(supabase, [cls.subject_id]),
  ]);

  return {
    id: cls.id,
    subject: subjectNames.get(cls.subject_id) ?? "Unknown",
    subjectId: cls.subject_id,
    grade: cls.grade,
    medium: cls.medium,
    tutorId: cls.tutor_id,
    tutorName: tutorNames.get(cls.tutor_id) ?? "Unknown",
    scheduleDays: cls.schedule_days,
    scheduleStartTime: cls.schedule_start_time,
    scheduleEndTime: cls.schedule_end_time,
    feeAmount: cls.fee_amount,
    feeType: cls.fee_type,
    room: cls.room,
    maxStudents: cls.max_students,
    tutorPaymentModel: cls.tutor_payment_model,
    tutorPaymentValue: cls.tutor_payment_value,
  };
}

export async function listEnrolledStudents(classId: string): Promise<EnrolledStudentRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("institute_id", session.instituteId);

  if (!enrollments || enrollments.length === 0) return [];

  const { data: students } = await supabase
    .from("users")
    .select("id, name, phone")
    .in(
      "id",
      enrollments.map((e) => e.student_id),
    );

  const byId = new Map((students ?? []).map((s) => [s.id, s]));

  return enrollments.flatMap((e) => {
    const s = byId.get(e.student_id);
    if (!s) return [];
    return [{ id: s.id, name: s.name, phone: s.phone, status: e.status }];
  });
}

export async function listClassesForStudent(studentId: string): Promise<EnrolledClassRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id, status, enrolled_at")
    .eq("student_id", studentId)
    .eq("institute_id", session.instituteId);

  if (!enrollments || enrollments.length === 0) return [];

  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, subject_id, grade, medium, tutor_id, schedule_days, schedule_start_time, schedule_end_time, fee_amount, fee_type",
    )
    .in(
      "id",
      enrollments.map((e) => e.class_id),
    );

  if (!classes || classes.length === 0) return [];

  const [tutorNames, subjectNames] = await Promise.all([
    tutorNamesById(
      supabase,
      classes.map((c) => c.tutor_id),
    ),
    subjectNamesById(
      supabase,
      classes.map((c) => c.subject_id),
    ),
  ]);

  const enrollmentByClassId = new Map(enrollments.map((e) => [e.class_id, e]));

  return classes.flatMap((c) => {
    const enrollment = enrollmentByClassId.get(c.id);
    if (!enrollment) return [];
    return [
      {
        id: c.id,
        subject: subjectNames.get(c.subject_id) ?? "Unknown",
        grade: c.grade,
        medium: c.medium,
        tutorName: tutorNames.get(c.tutor_id) ?? "Unknown",
        scheduleDays: c.schedule_days,
        scheduleStartTime: c.schedule_start_time,
        scheduleEndTime: c.schedule_end_time,
        feeAmount: c.fee_amount,
        feeType: c.fee_type,
        enrollmentStatus: enrollment.status,
        enrolledAt: enrollment.enrolled_at,
      },
    ];
  });
}
