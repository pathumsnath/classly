import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalary } from "@/lib/salaries/queries";
import { markSalaryPaid } from "@/lib/salaries/actions";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/card";

export default async function TutorSalaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tutorId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") redirect("/");

  const { tutorId } = await params;
  const { month: monthParam } = await searchParams;
  const month = monthParam || currentMonthInColombo();

  const salary = await getTutorSalary(tutorId, month);
  if (!salary) notFound();

  return (
    <PageShell title={salary.tutorName} backHref={`/salaries?month=${month}`}>
      <p className="-mt-3 text-sm text-gray-500">
        {new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </p>

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

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="font-medium text-gray-900">Total: LKR {salary.total.toFixed(2)}</p>
          {salary.status !== "paid" && (
            <form action={markSalaryPaid.bind(null, salary.tutorId, month, salary.total)}>
              <button type="submit" className="text-sm font-medium text-indigo-600">
                Mark as paid
              </button>
            </form>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
