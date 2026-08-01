import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { markSalaryPaid } from "@/lib/salaries/actions";
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
        <ul className="flex max-w-md flex-col gap-4">
          {salaries.map((s) => (
            <li key={s.tutorId}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{s.tutorName}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-3 text-sm text-gray-600">
                  {s.classes.length === 0 && <li>No classes assigned.</li>}
                  {s.classes.map((c) =>
                    c.model === "revenue_share" && c.collectedFees !== null ? (
                      <li key={c.classId} className="flex flex-col gap-1">
                        <p className="font-medium text-gray-900">
                          {c.subject} ({c.value}% share)
                        </p>
                        <div className="flex justify-between pl-3">
                          <span>Total income</span>
                          <span>LKR {c.collectedFees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pl-3">
                          <span>Institute commission ({100 - c.value}%)</span>
                          <span>LKR {(c.collectedFees - c.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pl-3">
                          <span>Monthly salary</span>
                          <span>LKR {c.amount.toFixed(2)}</span>
                        </div>
                      </li>
                    ) : (
                      <li key={c.classId} className="flex justify-between">
                        <span>
                          {c.subject} ({c.model.replace("_", " ")})
                        </span>
                        <span>LKR {c.amount.toFixed(2)}</span>
                      </li>
                    ),
                  )}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                  <p className="font-medium text-gray-900">Total: LKR {s.total.toFixed(2)}</p>
                  {s.status !== "paid" && (
                    <form action={markSalaryPaid.bind(null, s.tutorId, month, s.total)}>
                      <button type="submit" className="text-sm font-medium text-indigo-600">
                        Mark as paid
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
