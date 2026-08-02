import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";
import { isOverdue } from "@/lib/fees/status";
import { currentMonthInColombo } from "@/lib/time";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { subjectNamesById } from "@/lib/subjects/queries";

export interface ClassMoneySummary {
  classId: string;
  subject: string;
  studentCount: number;
  collected: number;
  collectionRate: number;
}

export interface MoneyOverview {
  month: string;
  collected: number;
  pending: number;
  overdue: number;
  collectionRate: number;
  netFigure: number;
  perClass: ClassMoneySummary[];
}

// FR-8.1/8.2/8.3 — owner-only (requireOwner, same defense-in-depth
// reasoning as the salary engine).
export async function getMoneyOverview(month: string): Promise<MoneyOverview> {
  const session = await requireOwner();
  const supabase = await createClient();

  const currentMonth = currentMonthInColombo();

  const [{ data: payments }, { data: unpaid }] = await Promise.all([
    supabase
      .from("payments")
      .select("class_id, student_id, amount_due, amount_paid, balance, status, month")
      .eq("institute_id", session.instituteId)
      .eq("month", month),
    // Overdue is a snapshot of what's currently late across every month,
    // not scoped to whichever month the switcher happens to be showing —
    // being late isn't a property of the month you're browsing, it's a
    // property of today's date vs. when the fee was due.
    supabase
      .from("payments")
      .select("balance, status, month")
      .eq("institute_id", session.instituteId)
      .in("status", ["pending", "partial"]),
  ]);

  const rows = payments ?? [];

  let collected = 0;
  let pending = 0;
  let totalDue = 0;

  const byClass = new Map<string, { due: number; paid: number; students: Set<string> }>();

  for (const p of rows) {
    collected += p.amount_paid;
    totalDue += p.amount_due;

    if (!isOverdue(p.status, p.month, currentMonth) && (p.status === "pending" || p.status === "partial")) {
      pending += p.balance;
    }

    const entry = byClass.get(p.class_id) ?? { due: 0, paid: 0, students: new Set<string>() };
    entry.due += p.amount_due;
    entry.paid += p.amount_paid;
    entry.students.add(p.student_id);
    byClass.set(p.class_id, entry);
  }

  const overdueTotal = (unpaid ?? [])
    .filter((p) => isOverdue(p.status, p.month, currentMonth))
    .reduce((sum, p) => sum + p.balance, 0);

  const classIds = [...byClass.keys()];
  const { data: classes } = classIds.length
    ? await supabase.from("classes").select("id, subject_id").in("id", classIds)
    : { data: [] };
  const subjectNames = await subjectNamesById(
    supabase,
    (classes ?? []).map((c) => c.subject_id),
  );
  const subjectById = new Map((classes ?? []).map((c) => [c.id, subjectNames.get(c.subject_id) ?? "Unknown"]));

  const perClass: ClassMoneySummary[] = classIds.map((classId) => {
    const entry = byClass.get(classId)!;
    return {
      classId,
      subject: subjectById.get(classId) ?? "Unknown",
      studentCount: entry.students.size,
      collected: entry.paid,
      collectionRate: entry.due > 0 ? (entry.paid / entry.due) * 100 : 0,
    };
  });

  const tutorSalaries = await getTutorSalaries(month);
  const netFigure = collected - tutorSalaries.reduce((sum, s) => sum + s.total, 0);

  return {
    month,
    collected,
    pending,
    overdue: overdueTotal,
    collectionRate: totalDue > 0 ? (collected / totalDue) * 100 : 0,
    netFigure,
    perClass,
  };
}
