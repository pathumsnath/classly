import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { MonthSwitcher } from "@/components/month-switcher";

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
        <Card className="max-w-md divide-y divide-gray-100">
          {salaries.map((s) => (
            <Link
              key={s.tutorId}
              href={`/salaries/${s.tutorId}?month=${month}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{s.tutorName}</p>
                <p className="text-sm text-gray-500">{s.classes.length} class(es)</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="font-medium text-gray-900">LKR {s.total.toFixed(2)}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    s.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s.status === "paid" ? "Paid" : "Unpaid"}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
