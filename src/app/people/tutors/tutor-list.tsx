"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, GraduationCap } from "lucide-react";
import { setTutorStatus } from "@/lib/people/actions";
import { Card, EmptyState, Avatar } from "@/components/card";
import type { TutorRow } from "@/lib/people/queries";

export function TutorList({ tutors }: { tutors: TutorRow[] }) {
  const [query, setQuery] = useState("");

  if (tutors.length === 0) {
    return <EmptyState icon={GraduationCap} message="No tutors yet — add your first one above." />;
  }

  const visibleTutors = tutors.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
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

      {visibleTutors.length === 0 ? (
        <p className="px-1 text-sm text-gray-500">No tutors match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Card className="divide-y divide-gray-100">
          {visibleTutors.map((tutor) => (
            <div key={tutor.id} className="flex items-center gap-3 p-4">
              <Link href={`/people/tutors/${tutor.id}`} className="flex flex-1 items-center gap-3">
                <Avatar name={tutor.name} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{tutor.name}</p>
                  <p className="text-sm text-gray-500">{tutor.phone}</p>
                </div>
              </Link>
              <form action={setTutorStatus.bind(null, tutor.id, tutor.status === "active" ? "inactive" : "active")}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                >
                  {tutor.status === "active" ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
