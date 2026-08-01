"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { setStudentStatus } from "@/lib/people/actions";
import { Card, EmptyState, Avatar } from "@/components/card";
import type { StudentRow } from "@/lib/people/queries";

export function StudentList({ students }: { students: StudentRow[] }) {
  const [query, setQuery] = useState("");

  if (students.length === 0) {
    return <EmptyState icon={Users} message="No students yet — add your first one above." />;
  }

  const visibleStudents = students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {visibleStudents.length === 0 ? (
        <p className="px-1 text-sm text-gray-500">No students match &ldquo;{query}&rdquo;.</p>
      ) : (
        <Card className="divide-y divide-gray-100">
          {visibleStudents.map((student) => (
            <div key={student.id} className="flex items-center gap-3 p-4">
              <Avatar name={student.name} />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{student.name}</p>
                <p className="text-sm text-gray-500">
                  {student.phone}
                  {student.parentPhone ? ` · parent: ${student.parentPhone}` : ""}
                </p>
              </div>
              <form
                action={setStudentStatus.bind(
                  null,
                  student.id,
                  student.status === "active" ? "inactive" : "active",
                )}
              >
                <button type="submit" className="text-sm font-medium text-indigo-600">
                  {student.status === "active" ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
