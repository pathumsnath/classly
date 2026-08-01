import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/card";
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

  return (
    <PageShell title="Tutor Salaries">
      <MonthSwitcher basePath="/salaries" month={month} currentMonth={currentMonth} />

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
