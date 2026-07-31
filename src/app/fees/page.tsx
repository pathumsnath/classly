import Link from "next/link";
import { listFees } from "@/lib/fees/queries";
import { listStudents } from "@/lib/people/queries";
import { PageShell } from "@/components/page-shell";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function statusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const fees = await listFees();

  let searchResults: { id: string; name: string; phone: string }[] = [];
  if (q?.trim()) {
    const students = await listStudents();
    const needle = q.trim().toLowerCase();
    searchResults = students
      .filter((s) => s.name.toLowerCase().includes(needle) || s.phone.includes(needle))
      .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }

  return (
    <PageShell title="Fees">
      <form className="flex max-w-sm gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search student by name or phone"
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
        >
          Search
        </button>
      </form>

      {q && (
        <ul className="flex max-w-sm flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {searchResults.length === 0 && <li className="p-4 text-sm text-gray-500">No matching students.</li>}
          {searchResults.map((s) => (
            <li key={s.id} className="p-4">
              <Link href={`/fees/${s.id}`} className="font-medium text-indigo-600">
                {s.name}
              </Link>
              <p className="text-sm text-gray-500">{s.phone}</p>
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {fees.length === 0 && <li className="p-4 text-sm text-gray-500">No fee records yet.</li>}
        {fees.map((fee) => (
          <li key={fee.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link href={`/fees/${fee.studentId}`} className="font-medium text-indigo-600">
                {fee.studentName}
              </Link>
              <p className="text-sm text-gray-500">
                {fee.subject} · {formatMonth(fee.month)} · LKR {fee.balance} due
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(fee.isOverdue, fee.status)}`}>
              {fee.isOverdue ? "Overdue" : fee.status}
            </span>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
