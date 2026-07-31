import Link from "next/link";
import { BookOpen } from "lucide-react";
import { listClasses } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { CreateClassForm } from "./create-class-form";

export default async function ClassesPage() {
  const [classes, tutors] = await Promise.all([listClasses(), listTutors()]);
  const activeTutors = tutors.filter((t) => t.status === "active");

  return (
    <PageShell title="Classes">
      {classes.length === 0 ? (
        <EmptyState icon={BookOpen} message="No classes yet — create your first one below." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/classes/${cls.id}`}
              className="block p-4 transition hover:bg-gray-50"
            >
              <p className="font-medium text-gray-900">{cls.subject}</p>
              <p className="text-sm text-gray-500">
                {cls.tutorName} · {cls.scheduleDays.join(", ") || "no schedule set"}
                {cls.scheduleTime ? ` · ${cls.scheduleTime}` : ""}
              </p>
            </Link>
          ))}
        </Card>
      )}

      {activeTutors.length === 0 ? (
        <EmptyState message="Add a tutor first — a class needs one assigned." />
      ) : (
        <CreateClassForm tutors={activeTutors} />
      )}
    </PageShell>
  );
}
