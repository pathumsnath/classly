"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, BookOpen } from "lucide-react";
import { Card, EmptyState } from "@/components/card";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import type { ClassRow } from "@/lib/classes/queries";

export function ClassList({ classes }: { classes: ClassRow[] }) {
  const [query, setQuery] = useState("");

  if (classes.length === 0) {
    return <EmptyState icon={BookOpen} message="No classes yet — create your first one below." />;
  }

  const needle = query.trim().toLowerCase();
  const visibleClasses = classes.filter((cls) =>
    `${cls.subject} ${formatGrade(cls.grade)} ${formatMedium(cls.medium)} ${cls.tutorName}`
      .toLowerCase()
      .includes(needle),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by subject, grade, or tutor…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {visibleClasses.length === 0 ? (
        <p className="px-1 text-sm text-gray-500">No classes match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Card className="divide-y divide-gray-100">
          {visibleClasses.map((cls) => (
            <Link key={cls.id} href={`/classes/${cls.id}`} className="block p-4 transition hover:bg-gray-50">
              <p className="font-medium text-gray-900">
                {cls.subject} · {formatGrade(cls.grade)} · {formatMedium(cls.medium)}
              </p>
              <p className="text-sm text-gray-500">
                {cls.tutorName} · {cls.scheduleDays.join(", ") || "no schedule set"}
                {cls.scheduleStartTime
                  ? ` · ${cls.scheduleStartTime}${cls.scheduleEndTime ? `–${cls.scheduleEndTime}` : ""}`
                  : ""}
              </p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
