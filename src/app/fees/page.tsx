import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Receipt } from "lucide-react";
import { listFees } from "@/lib/fees/queries";
import { listStudents } from "@/lib/people/queries";
import { getWalletBalancesForStudents } from "@/lib/wallet/queries";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { RecordFeePaymentForm } from "../record-fee-payment-form";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function statusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const { q } = await searchParams;
  const [fees, allStudents] = await Promise.all([listFees(), listStudents()]);

  const studentOptions = allStudents
    .filter((s) => s.status === "active")
    .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  const walletBalances = Object.fromEntries(await getWalletBalancesForStudents(studentOptions.map((s) => s.id)));

  let searchResults: { id: string; name: string; phone: string }[] = [];
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    searchResults = allStudents
      .filter((s) => s.name.toLowerCase().includes(needle) || s.phone.includes(needle))
      .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }

  return (
    <PageShell title="Fees">
      {studentOptions.length > 0 && (
        <RecordFeePaymentForm students={studentOptions} fees={fees} walletBalances={walletBalances} />
      )}

      <form className="flex max-w-sm gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search student by name or phone"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Search
        </button>
      </form>

      {q &&
        (searchResults.length === 0 ? (
          <EmptyState message="No matching students." />
        ) : (
          <Card className="max-w-sm divide-y divide-gray-100">
            {searchResults.map((s) => (
              <Link key={s.id} href={`/fees/${s.id}`} className="block p-4 transition hover:bg-gray-50">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500">{s.phone}</p>
              </Link>
            ))}
          </Card>
        ))}

      {fees.length === 0 ? (
        <EmptyState icon={Receipt} message="No fee records yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {fees.map((fee) => (
            <Link
              key={fee.id}
              href={`/fees/${fee.studentId}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{fee.studentName}</p>
                <p className="text-sm text-gray-500">
                  {fee.subject} · {formatMonth(fee.month)} · LKR {fee.balance} due
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(fee.isOverdue, fee.status)}`}
              >
                {fee.isOverdue ? "Overdue" : fee.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
