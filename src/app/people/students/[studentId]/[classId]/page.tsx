import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { getPerson } from "@/lib/people/queries";
import { getClass } from "@/lib/classes/queries";
import { listFeesForStudentInClass } from "@/lib/fees/queries";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatPaidDate(paidDate: string) {
  return new Date(`${paidDate}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function statusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

export default async function StudentClassPaymentsPage({
  params,
}: {
  params: Promise<{ studentId: string; classId: string }>;
}) {
  const { studentId, classId } = await params;

  const [student, cls] = await Promise.all([getPerson(studentId), getClass(classId)]);
  if (!student || !cls) notFound();

  const fees = (await listFeesForStudentInClass(studentId, classId)).sort((a, b) =>
    b.month.localeCompare(a.month),
  );

  return (
    <PageShell title={cls.subject} backHref={`/people/students/${studentId}`}>
      <p className="-mt-3 text-sm text-gray-500">
        {student.name} · {cls.tutorName}
      </p>

      {fees.length === 0 ? (
        <EmptyState icon={Receipt} message="No payment history for this class yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {fees.map((fee) => (
            <div key={fee.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-900">{formatMonth(fee.month)}</p>
                <p className="text-sm text-gray-500">
                  Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
                </p>
                {fee.paidDate && (
                  <p className="text-sm text-gray-400">Paid on {formatPaidDate(fee.paidDate)}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(fee.isOverdue, fee.status)}`}
              >
                {fee.isOverdue ? "Overdue" : fee.status}
              </span>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
