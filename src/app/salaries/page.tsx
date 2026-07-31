import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorSalaries } from "@/lib/salaries/queries";
import { markSalaryPaid } from "@/lib/salaries/actions";
import { currentMonthInColombo } from "@/lib/time";
import { PageShell } from "@/components/page-shell";

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  // Page-level gate is defense in depth for UX — real enforcement is
  // requireOwner() inside getTutorSalaries/markSalaryPaid (NFR-2), plus
  // salary_payments' own RLS as a third layer.
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") redirect("/");

  const { month: monthParam } = await searchParams;
  const month = monthParam || currentMonthInColombo();
  const salaries = await getTutorSalaries(month);

  return (
    <PageShell title="Tutor Salaries">
      <div className="flex items-center gap-4 text-sm">
        <Link href={`/salaries?month=${prevMonth(month)}`} className="font-medium text-indigo-600">
          &larr; Prev month
        </Link>
        <span className="font-medium text-gray-900">{month.slice(0, 7)}</span>
        <Link href={`/salaries?month=${currentMonthInColombo()}`} className="font-medium text-indigo-600">
          This month
        </Link>
      </div>

      {salaries.length === 0 ? (
        <p className="max-w-sm rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          No salary figures yet — these appear once fee and attendance data exists for your tutors&apos; classes.
        </p>
      ) : (
        <ul className="flex max-w-md flex-col gap-4">
          {salaries.map((s) => (
            <li key={s.tutorId} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{s.tutorName}</p>
                <span className="text-sm text-gray-600">{s.status === "paid" ? "Paid" : "Unpaid"}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
                {s.classes.length === 0 && <li>No classes assigned.</li>}
                {s.classes.map((c) => (
                  <li key={c.classId} className="flex justify-between">
                    <span>
                      {c.subject} ({c.model.replace("_", " ")})
                    </span>
                    <span>LKR {c.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <p className="font-medium text-gray-900">Total: LKR {s.total.toFixed(2)}</p>
                {s.status !== "paid" && (
                  <form action={markSalaryPaid.bind(null, s.tutorId, month, s.total)}>
                    <button type="submit" className="text-sm font-medium text-indigo-600">
                      Mark as paid
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
