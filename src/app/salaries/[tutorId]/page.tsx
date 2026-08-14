import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalary } from "@/lib/salaries/queries";
import { markSalaryPaid, deleteTutorAdvance } from "@/lib/salaries/actions";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/card";
import { MonthSwitcher } from "@/components/month-switcher";
import { RecordAdvanceForm } from "./record-advance-form";

export default async function TutorSalaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tutorId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSessionInfo();
  const { tutorId } = await params;
  const isSelf = session?.role === "tutor" && session.userId === tutorId;
  if (!session || (session.role !== "owner" && !isSelf)) redirect("/");

  const { month: monthParam } = await searchParams;
  const currentMonth = currentMonthInColombo();
  const month = monthParam || currentMonth;

  const salary = await getTutorSalary(tutorId, month);
  if (!salary) notFound();

  return (
    <PageShell title={salary.tutorName} backHref={isSelf ? "/" : `/salaries?month=${month}`}>
      <MonthSwitcher basePath={`/salaries/${tutorId}`} month={month} currentMonth={currentMonth} />

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Income breakdown</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              salary.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {salary.status === "paid" ? "Paid" : "Unpaid"}
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-3 text-sm text-gray-600">
          {salary.classes.length === 0 && <li>No classes assigned.</li>}
          {salary.classes.map((c) =>
            c.model === "revenue_share" && c.collectedFees !== null ? (
              <li key={c.classId} className="flex flex-col gap-1">
                <p className="font-medium text-gray-900">
                  {c.subject} ({c.value}% share)
                </p>
                <div className="flex justify-between pl-3">
                  <span>Total income</span>
                  <span>LKR {c.collectedFees.toFixed(2)}</span>
                </div>
                {c.overdueReceived !== null && c.overdueReceived > 0 && (
                  <div className="flex justify-between pl-6 text-gray-500">
                    <span>— incl. carried forward from a past overdue month</span>
                    <span>LKR {c.overdueReceived.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pl-3">
                  <span>Institute commission ({100 - c.value}%)</span>
                  <span>LKR {(c.collectedFees - c.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-3">
                  <span>Monthly salary</span>
                  <span>LKR {c.amount.toFixed(2)}</span>
                </div>
                {c.outstandingFees !== null && c.outstandingFees > 0 && (
                  <div className="flex justify-between pl-3 text-amber-700">
                    <span>Outstanding (unpaid) — your cut if collected</span>
                    <span>
                      LKR {c.outstandingFees.toFixed(2)} → LKR {((c.outstandingFees * c.value) / 100).toFixed(2)}
                    </span>
                  </div>
                )}
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

        {salary.advances.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Advances taken</p>
            {salary.advances.map((advance) => (
              <div key={advance.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="text-gray-900">{advance.reason}</p>
                  <p className="text-gray-500">
                    {new Date(advance.recordedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-red-700">− LKR {advance.amount.toFixed(2)}</span>
                  {session.role === "owner" && (
                    <form action={deleteTutorAdvance.bind(null, advance.id, salary.tutorId)}>
                      <button
                        type="submit"
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3">
          {salary.advancesTotal > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Gross total</span>
              <span>LKR {salary.total.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">
              {salary.advancesTotal > 0 ? "Payable (after advances)" : "Total"}: LKR {salary.netTotal.toFixed(2)}
            </p>
            {salary.status !== "paid" && session.role === "owner" && (
              <form action={markSalaryPaid.bind(null, salary.tutorId, month, salary.netTotal)}>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                >
                  Mark as paid
                </button>
              </form>
            )}
          </div>
        </div>
      </Card>

      {session.role === "owner" && <RecordAdvanceForm tutorId={salary.tutorId} month={month} />}
    </PageShell>
  );
}
