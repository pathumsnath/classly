import type { LucideIcon } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-100 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm text-gray-500">{message}</p>
      {action}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
      {initials}
    </span>
  );
}
