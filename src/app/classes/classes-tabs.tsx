"use client";

import { useState } from "react";
import { EmptyState } from "@/components/card";
import { ClassList } from "./class-list";
import { CreateClassForm } from "./create-class-form";
import type { ClassListRow } from "@/lib/classes/queries";
import type { TutorRow } from "@/lib/people/queries";
import type { SubjectRow } from "@/lib/subjects/queries";

type Tab = "classes" | "add";

export function ClassesTabs({
  classes,
  activeTutors,
  activeSubjects,
  commissionPercent,
}: {
  classes: ClassListRow[];
  activeTutors: TutorRow[];
  activeSubjects: SubjectRow[];
  commissionPercent: number;
}) {
  const [tab, setTab] = useState<Tab>("classes");

  return (
    <>
      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("classes")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "classes" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Classes
        </button>
        <button
          type="button"
          onClick={() => setTab("add")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "add" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Add class
        </button>
      </div>

      {tab === "classes" ? (
        <ClassList classes={classes} />
      ) : activeTutors.length === 0 ? (
        <EmptyState message="Add a tutor first — a class needs one assigned." />
      ) : activeSubjects.length === 0 ? (
        <EmptyState message="Add a subject first — a class needs one assigned." />
      ) : (
        <CreateClassForm tutors={activeTutors} subjects={activeSubjects} commissionPercent={commissionPercent} />
      )}
    </>
  );
}
