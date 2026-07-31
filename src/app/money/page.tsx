import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getMoneyOverview } from "@/lib/money/queries";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  // Page-level gate is defense in depth — real enforcement is
  // requireOwner() inside getMoneyOverview (NFR-2/FR-8.6).
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") redirect("/");

  const { month: monthParam } = await searchParams;
  const month = monthParam || currentMonthInColombo();
  const overview = await getMoneyOverview(month);

  return (
    <PageShell title="Money">
      <div className="flex items-center gap-4 text-sm">
        <Link href={`/money?month=${prevMonth(month)}`} className="font-medium text-indigo-600">
          &larr; Prev month
        </Link>
        <span className="font-medium text-gray-900">{month.slice(0, 7)}</span>
        <Link href={`/money?month=${currentMonthInColombo()}`} className="font-medium text-indigo-600">
          This month
        </Link>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Collected</p>
          <p className="text-lg font-semibold text-gray-900">LKR {overview.collected.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-lg font-semibold text-gray-900">LKR {overview.pending.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-lg font-semibold text-red-600">LKR {overview.overdue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Collection rate</p>
          <p className="text-lg font-semibold text-gray-900">{overview.collectionRate.toFixed(0)}%</p>
        </div>
      </div>

      <div className="max-w-md rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Net (collected − tutor salaries owed)</p>
        <p className="text-lg font-semibold text-gray-900">LKR {overview.netFigure.toFixed(2)}</p>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-gray-900">Per class</h2>
        <ul className="flex max-w-md flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {overview.perClass.length === 0 && (
            <li className="p-4 text-sm text-gray-500">No fee records this month.</li>
          )}
          {overview.perClass.map((c) => (
            <li key={c.classId} className="flex items-center justify-between gap-4 p-4">
              <Link href={`/classes/${c.classId}`} className="font-medium text-indigo-600">
                {c.subject}
              </Link>
              <span className="text-sm text-gray-600">
                {c.studentCount} students · LKR {c.collected.toFixed(2)} · {c.collectionRate.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
