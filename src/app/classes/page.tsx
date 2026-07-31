import Link from "next/link";
import { listClasses } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { PageShell } from "@/components/page-shell";
import { CreateClassForm } from "./create-class-form";

export default async function ClassesPage() {
  const [classes, tutors] = await Promise.all([listClasses(), listTutors()]);

  return (
    <PageShell title="Classes">
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {classes.length === 0 && <li className="p-4 text-sm text-gray-500">No classes yet.</li>}
        {classes.map((cls) => (
          <li key={cls.id} className="p-4">
            <Link href={`/classes/${cls.id}`} className="font-medium text-indigo-600">
              {cls.subject}
            </Link>
            <p className="text-sm text-gray-500">
              {cls.tutorName} · {cls.scheduleDays.join(", ") || "no schedule set"}
              {cls.scheduleTime ? ` · ${cls.scheduleTime}` : ""}
            </p>
          </li>
        ))}
      </ul>

      {tutors.filter((t) => t.status === "active").length === 0 ? (
        <p className="max-w-sm rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          Add a tutor first — a class needs one assigned.
        </p>
      ) : (
        <CreateClassForm tutors={tutors.filter((t) => t.status === "active")} />
      )}
    </PageShell>
  );
}
