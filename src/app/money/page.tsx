import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet, Clock, AlertCircle, TrendingUp, Scale } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { getMoneyOverview, getInstituteIncomeTrend } from "@/lib/money/queries";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { MonthSwitcher } from "@/components/month-switcher";
import { IncomeTrendChart } from "../income-trend-chart";

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass = "text-gray-900",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="flex items-center gap-1.5 text-sm text-gray-500">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <p className={`text-lg font-semibold ${valueClass}`}>{value}</p>
    </Card>
  );
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  // Page-level gate is defense in depth — real enforcement is
  // requireOwner() inside getMoneyOverview (NFR-2/FR-8.6).
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") redirect("/");

  const { month: monthParam } = await searchParams;
  const currentMonth = currentMonthInColombo();
  const month = monthParam || currentMonth;
  const [overview, incomeTrend] = await Promise.all([
    getMoneyOverview(month),
    getInstituteIncomeTrend(6, currentMonth),
  ]);

  return (
    <PageShell title="Money">
      <IncomeTrendChart
        data={incomeTrend.map((d) => ({ month: d.month, value: d.net }))}
        title="Income progress"
      />

      <MonthSwitcher basePath="/money" month={month} currentMonth={currentMonth} />

      <div className="grid max-w-md grid-cols-2 gap-3">
        <StatCard icon={Wallet} label="Collected" value={`LKR ${overview.collected.toFixed(2)}`} />
        <StatCard icon={Clock} label="Pending" value={`LKR ${overview.pending.toFixed(2)}`} />
        <StatCard
          icon={AlertCircle}
          label="Overdue (all-time)"
          value={`LKR ${overview.overdue.toFixed(2)}`}
          valueClass="text-red-600"
        />
        <StatCard icon={TrendingUp} label="Collection rate" value={`${overview.collectionRate.toFixed(0)}%`} />
      </div>

      <Card className="flex max-w-md items-center gap-3 border-indigo-100 bg-indigo-50 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Scale className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-indigo-700">Net (collected − tutor salaries owed)</p>
          <p className="text-lg font-semibold text-indigo-900">LKR {overview.netFigure.toFixed(2)}</p>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Per class</h2>
        {overview.perClass.length === 0 ? (
          <EmptyState message="No fee records this month." />
        ) : (
          <Card className="max-w-md divide-y divide-gray-100">
            {overview.perClass.map((c) => (
              <Link
                key={c.classId}
                href={`/classes/${c.classId}`}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{c.subject}</span>
                <span className="text-sm text-gray-600">
                  {c.studentCount} students · LKR {c.collected.toFixed(2)} · {c.collectionRate.toFixed(0)}%
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </PageShell>
  );
}
