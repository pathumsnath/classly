import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";
import { isOverdue as computeIsOverdue } from "@/lib/fees/status";
import { currentMonthInColombo } from "@/lib/time";
import type { PaymentStatus } from "@/lib/supabase/types";

export interface FeeRow {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  classId: string;
  subject: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: PaymentStatus;
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
  }[],
): Promise<FeeRow[]> {
  if (payments.length === 0) return [];

  const studentIds = [...new Set(payments.map((p) => p.student_id))];
  const classIds = [...new Set(payments.map((p) => p.class_id))];

  const [{ data: students }, { data: classes }] = await Promise.all([
    supabase.from("users").select("id, name, phone").in("id", studentIds),
    supabase.from("classes").select("id, subject").in("id", classIds),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const subjectByClassId = new Map((classes ?? []).map((c) => [c.id, c.subject]));

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
      month: p.month,
      amountDue: p.amount_due,
      amountPaid: p.amount_paid,
      balance: p.balance,
      status: p.status,
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
    .select("id, student_id, class_id, month, amount_due, amount_paid, balance, status")
    .eq("institute_id", session.instituteId);

  return toFeeRows(supabase, data ?? []);
}

export async function listFeesForStudent(studentId: string): Promise<FeeRow[]> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, student_id, class_id, month, amount_due, amount_paid, balance, status")
    .eq("institute_id", session.instituteId)
    .eq("student_id", studentId);

  return toFeeRows(supabase, data ?? []);
}
