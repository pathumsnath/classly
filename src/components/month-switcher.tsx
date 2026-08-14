import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatMonthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
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
    <div className="flex w-fit items-center gap-2 rounded-full border border-gray-100 bg-white px-2 py-2 text-sm shadow-sm">
      <Link
        href={`${basePath}?month=${prevMonth(month)}`}
        aria-label="Previous month"
        className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <span className="font-medium text-gray-900">{formatMonthLabel(month)}</span>
      {month === currentMonth ? (
        <span className="p-2.5 text-gray-200">
          <ChevronRight className="h-5 w-5" />
        </span>
      ) : (
        <Link
          href={`${basePath}?month=${nextMonth(month)}`}
          aria-label="Next month"
          className="rounded-full p-2.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
      {month !== currentMonth && (
        <Link
          href={`${basePath}?month=${currentMonth}`}
          className="rounded-full px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
        >
          Back to {formatMonthName(currentMonth)}
        </Link>
      )}
    </div>
  );
}
