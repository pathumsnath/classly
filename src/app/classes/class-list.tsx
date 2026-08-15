"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, BookOpen, Users } from "lucide-react";
import { Card, EmptyState } from "@/components/card";
import { formatGrade, formatMedium, GRADE_OPTIONS } from "@/lib/classes/labels";
import type { GradeLevel } from "@/lib/supabase/types";
import type { ClassListRow } from "@/lib/classes/queries";

export function ClassList({ classes }: { classes: ClassListRow[] }) {
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | "">("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const subjectOptions = useMemo(
    () => [...new Set(classes.map((cls) => cls.subject))].sort((a, b) => a.localeCompare(b)),
    [classes],
  );
  const gradeOptions = useMemo(() => {
    const present = new Set(classes.map((cls) => cls.grade).filter((g): g is GradeLevel => g !== null));
    return GRADE_OPTIONS.filter((g) => present.has(g.value));
  }, [classes]);

  if (classes.length === 0) {
    return <EmptyState icon={BookOpen} message="No classes yet — create your first one below." />;
  }

  const needle = query.trim().toLowerCase();
  const visibleClasses = classes.filter((cls) => {
    if (gradeFilter && cls.grade !== gradeFilter) return false;
    if (subjectFilter && cls.subject !== subjectFilter) return false;
    return `${cls.subject} ${formatGrade(cls.grade)} ${formatMedium(cls.medium)} ${cls.tutorName}`
      .toLowerCase()
      .includes(needle);
  });

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

      <div className="flex gap-2">
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value as GradeLevel | "")}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">All grades</option>
          {gradeOptions.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">All subjects</option>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      {visibleClasses.length === 0 ? (
        <p className="px-1 text-sm text-gray-500">
          {query ? `No classes match "${query}".` : "No classes match the selected filters."}
        </p>
      ) : (
        <Card className="divide-y divide-gray-100">
          {visibleClasses.map((cls) => (
            <Link
              key={cls.id}
              href={`/classes/${cls.id}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
            >
              <div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-gray-900">
                  {cls.subject} · {formatGrade(cls.grade)}
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                    {formatMedium(cls.medium)}
                  </span>
                </p>
                <p className="text-sm text-gray-500">
                  {cls.tutorName} · {cls.scheduleDays.join(", ") || "no schedule set"}
                </p>
                {cls.scheduleStartTime && (
                  <p className="text-sm text-gray-500">
                    {cls.scheduleStartTime}
                    {cls.scheduleEndTime ? `–${cls.scheduleEndTime}` : ""}
                  </p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                <Users className="h-3.5 w-3.5" />
                {cls.studentCount}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
