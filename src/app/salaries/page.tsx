import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { MonthSwitcher } from "@/components/month-switcher";
import { SalaryList } from "./salary-list";

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  // Page-level gate is defense in depth for UX — real enforcement is
  // requireOwner() inside getTutorSalaries/markSalaryPaid (NFR-2), plus
  // salary_payments' own RLS as a third layer.
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") redirect("/");

  const { month: monthParam } = await searchParams;
  const currentMonth = currentMonthInColombo();
  const month = monthParam || currentMonth;
  const salaries = await getTutorSalaries(month);

  const totalPaid = salaries.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.netTotal, 0);
  const totalUnpaid = salaries.filter((s) => s.status !== "paid").reduce((sum, s) => sum + s.netTotal, 0);

  return (
    <PageShell title="Tutor Salaries">
      <MonthSwitcher basePath="/salaries" month={month} currentMonth={currentMonth} />

      {salaries.length > 0 && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Card className="flex flex-col gap-1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Paid</p>
            <p className="text-2xl font-bold text-green-700">LKR {totalPaid.toLocaleString()}</p>
          </Card>
          <Card className="flex flex-col gap-1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Still to pay</p>
            <p className="text-2xl font-bold text-gray-900">LKR {totalUnpaid.toLocaleString()}</p>
          </Card>
        </div>
      )}

      {salaries.length === 0 ? (
        <EmptyState
          icon={Wallet}
          message="No salary figures yet — these appear once fee and attendance data exists for your tutors' classes."
        />
      ) : (
        <SalaryList salaries={salaries} month={month} />
      )}
    </PageShell>
  );
}
