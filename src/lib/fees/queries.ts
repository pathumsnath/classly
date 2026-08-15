import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { isOverdue as computeIsOverdue } from "@/lib/fees/status";
import { currentMonthInColombo } from "@/lib/time";
import { subjectNamesById } from "@/lib/subjects/queries";
import type { PaymentStatus } from "@/lib/supabase/types";

export interface FeeRow {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  classId: string;
  subject: string;
  // A student can be enrolled in more than one class with the same
  // subject name (different tutor, different grade, or two groups of the
  // same grade with the same tutor) — tutorName and groupName disambiguate
  // which class a fee actually belongs to.
  groupName: string | null;
  tutorName: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: PaymentStatus;
  paidDate: string | null;
  // Computed for display/sorting only — v1 never writes 'overdue' into the
  // stored status column (no scheduled job flips it), it just treats a
  // still-unpaid fee from a past month as overdue at read time.
  isOverdue: boolean;
}

async function toFeeRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payments: {
    id: string;
    student_id: string;
    class_id: string;
    month: string;
    amount_due: number;
    amount_paid: number;
    balance: number;
    status: PaymentStatus;
    paid_date: string | null;
  }[],
): Promise<FeeRow[]> {
  if (payments.length === 0) return [];

  const studentIds = [...new Set(payments.map((p) => p.student_id))];
  const classIds = [...new Set(payments.map((p) => p.class_id))];

  const [{ data: students }, { data: classes }] = await Promise.all([
    supabase.from("users").select("id, name, phone").in("id", studentIds),
    supabase.from("classes").select("id, subject_id, tutor_id, group_name").in("id", classIds),
  ]);

  const tutorIds = [...new Set((classes ?? []).map((c) => c.tutor_id))];

  const [subjectNames, { data: tutors }] = await Promise.all([
    subjectNamesById(
      supabase,
      (classes ?? []).map((c) => c.subject_id),
    ),
    supabase.from("users").select("id, name").in("id", tutorIds),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const tutorNameById = new Map((tutors ?? []).map((t) => [t.id, t.name]));
  const subjectByClassId = new Map(
    (classes ?? []).map((c) => [c.id, subjectNames.get(c.subject_id) ?? "Unknown"]),
  );
  const tutorNameByClassId = new Map(
    (classes ?? []).map((c) => [c.id, tutorNameById.get(c.tutor_id) ?? "Unknown"]),
  );
  const groupNameByClassId = new Map((classes ?? []).map((c) => [c.id, c.group_name]));

  const currentMonth = currentMonthInColombo();

  const rows: FeeRow[] = payments.map((p) => {
    const student = studentById.get(p.student_id);
    const isOverdue = computeIsOverdue(p.status, p.month, currentMonth);
    return {
      id: p.id,
      studentId: p.student_id,
      studentName: student?.name ?? "Unknown",
      studentPhone: student?.phone ?? "",
      classId: p.class_id,
      subject: subjectByClassId.get(p.class_id) ?? "Unknown",
      groupName: groupNameByClassId.get(p.class_id) ?? null,
      tutorName: tutorNameByClassId.get(p.class_id) ?? "Unknown",
      month: p.month,
      amountDue: p.amount_due,
      amountPaid: p.amount_paid,
      balance: p.balance,
      status: p.status,
      paidDate: p.paid_date,
      isOverdue,
    };
  });

  const rank = (row: FeeRow) => (row.isOverdue ? 0 : row.status === "partial" ? 1 : row.status === "pending" ? 2 : 3);
  rows.sort((a, b) => rank(a) - rank(b) || b.month.localeCompare(a.month));

  return rows;
}

export async function listFees(): Promise<FeeRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, student_id, class_id, month, amount_due, amount_paid, balance, status, paid_date")
    .eq("institute_id", session.instituteId);

  return toFeeRows(supabase, data ?? []);
}

export async function listFeesForStudent(studentId: string): Promise<FeeRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, student_id, class_id, month, amount_due, amount_paid, balance, status, paid_date")
    .eq("institute_id", session.instituteId)
    .eq("student_id", studentId);

  return toFeeRows(supabase, data ?? []);
}

export async function listFeesForStudentInClass(studentId: string, classId: string): Promise<FeeRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, student_id, class_id, month, amount_due, amount_paid, balance, status, paid_date")
    .eq("institute_id", session.instituteId)
    .eq("student_id", studentId)
    .eq("class_id", classId);

  return toFeeRows(supabase, data ?? []);
}
