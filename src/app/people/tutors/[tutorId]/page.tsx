import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Wallet } from "lucide-react";
import { getPerson } from "@/lib/people/queries";
import { listClassesForTutor } from "@/lib/classes/queries";
import { listSalaryPaymentsForTutor } from "@/lib/salaries/queries";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default async function TutorDetailPage({
  params,
}: {
  params: Promise<{ tutorId: string }>;
}) {
  const { tutorId } = await params;

  const tutor = await getPerson(tutorId);
  if (!tutor) notFound();

  const session = await getSessionInfo();
  const [classes, salaryHistory] = await Promise.all([
    listClassesForTutor(tutorId),
    session?.role === "owner" ? listSalaryPaymentsForTutor(tutorId) : Promise.resolve(null),
  ]);

  return (
    <PageShell title={tutor.name} backHref="/people/tutors">
      <p className="-mt-3 text-sm text-gray-500">{tutor.phone}</p>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Classes</h2>
        {classes.length === 0 ? (
          <EmptyState icon={BookOpen} message="Not teaching any classes yet." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/classes/${cls.id}`}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{cls.subject}</p>
                  <p className="text-sm text-gray-500">
                    {formatGrade(cls.grade)} · {formatMedium(cls.medium)}
                  </p>
                  <p className="text-sm text-gray-400">
                    {cls.scheduleDays.join(", ")}
                    {cls.scheduleStartTime ? ` · ${cls.scheduleStartTime}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-gray-500">LKR {cls.feeAmount}</span>
              </Link>
            ))}
          </Card>
        )}
      </div>

      {salaryHistory !== null && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Salary history</h2>
          {salaryHistory.length === 0 ? (
            <EmptyState icon={Wallet} message="No salary payments recorded yet." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salaryHistory.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-900">{formatMonth(s.month)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-900">LKR {s.amount.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </PageShell>
  );
}
