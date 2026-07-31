import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function MonthSwitcher({
  basePath,
  month,
  currentMonth,
}: {
  basePath: string;
  month: string;
  currentMonth: string;
}) {
  return (
    <div className="flex w-fit items-center gap-3 rounded-full border border-gray-100 bg-white px-2 py-1.5 text-sm shadow-sm">
      <Link
        href={`${basePath}?month=${prevMonth(month)}`}
        aria-label="Previous month"
        className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="font-medium text-gray-900">{month.slice(0, 7)}</span>
      {month !== currentMonth && (
        <Link href={`${basePath}?month=${currentMonth}`} className="text-xs font-medium text-indigo-600">
          This month
        </Link>
      )}
    </div>
  );
}
