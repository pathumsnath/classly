import { notFound } from "next/navigation";
import { listFeesForStudent } from "@/lib/fees/queries";
import { getPerson } from "@/lib/people/queries";
import { waiveFee } from "@/lib/fees/actions";
import { PageShell } from "@/components/page-shell";
import { RecordPaymentForm } from "./record-payment-form";

export default async function StudentFeesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const student = await getPerson(studentId);
  if (!student) notFound();

  const fees = await listFeesForStudent(studentId);

  return (
    <PageShell title={student.name} backHref="/fees">
      <p className="text-sm text-gray-500">{student.phone}</p>

      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {fees.length === 0 && <li className="p-4 text-sm text-gray-500">No fees yet.</li>}
        {fees.map((fee) => (
          <li key={fee.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-gray-900">
                {fee.subject} — {fee.month.slice(0, 7)}
              </p>
              <p className="text-sm text-gray-500">
                Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{fee.isOverdue ? "Overdue" : fee.status}</span>
              {fee.status !== "paid" && fee.status !== "waived" && (
                <form action={waiveFee.bind(null, fee.id)}>
                  <button type="submit" className="text-sm font-medium text-gray-500">
                    Waive
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      <RecordPaymentForm fees={fees} />
    </PageShell>
  );
}
