"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/card";
import type { TutorSalary } from "@/lib/salaries/queries";

export function SalaryList({ salaries, month }: { salaries: TutorSalary[]; month: string }) {
  const [query, setQuery] = useState("");

  const visibleSalaries = salaries.filter((s) => s.tutorName.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex max-w-md flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tutors…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {visibleSalaries.length === 0 ? (
        <p className="px-1 text-sm text-gray-500">No tutors match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Card className="divide-y divide-gray-100">
          {visibleSalaries.map((s) => (
            <Link
              key={s.tutorId}
              href={`/salaries/${s.tutorId}?month=${month}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{s.tutorName}</p>
                <p className="text-sm text-gray-500">{s.classes.length} class(es)</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="font-medium text-gray-900">LKR {s.total.toFixed(2)}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    s.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s.status === "paid" ? "Paid" : "Unpaid"}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
