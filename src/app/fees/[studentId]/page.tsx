import { notFound, redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { listFeesForStudent } from "@/lib/fees/queries";
import { getPerson } from "@/lib/people/queries";
import { waiveFee } from "@/lib/fees/actions";
import { getWalletBalance } from "@/lib/wallet/queries";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { RecordPaymentForm } from "./record-payment-form";

function statusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

export default async function StudentFeesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const student = await getPerson(studentId);
  if (!student) notFound();

  const [fees, walletBalance] = await Promise.all([listFeesForStudent(studentId), getWalletBalance(studentId)]);

  return (
    <PageShell title={student.name} backHref="/fees">
      <div className="-mt-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{student.phone}</p>
        {walletBalance > 0 && (
          <p className="text-sm font-medium text-indigo-600">Wallet: LKR {walletBalance.toLocaleString()}</p>
        )}
      </div>

      {fees.length === 0 ? (
        <EmptyState icon={Receipt} message="No fees yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {fees.map((fee) => (
            <div key={fee.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-900">
                  {fee.subject}
                  {fee.groupName && ` (${fee.groupName})`} — {fee.month.slice(0, 7)}
                </p>
                <p className="text-sm text-gray-500">
                  Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(fee.isOverdue, fee.status)}`}
                >
                  {fee.isOverdue ? "Overdue" : fee.status}
                </span>
                {fee.status !== "paid" && fee.status !== "waived" && (
                  <form action={waiveFee.bind(null, fee.id)}>
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                    >
                      Waive
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <RecordPaymentForm fees={fees} walletBalance={walletBalance} />
    </PageShell>
  );
}
