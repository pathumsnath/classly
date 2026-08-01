import { listClasses } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { listSubjects } from "@/lib/subjects/queries";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/card";
import { CreateClassForm } from "./create-class-form";
import { ClassList } from "./class-list";

export default async function ClassesPage() {
  const [classes, tutors, subjects] = await Promise.all([listClasses(), listTutors(), listSubjects()]);
  const activeTutors = tutors.filter((t) => t.status === "active");
  const activeSubjects = subjects.filter((s) => s.status === "active");

  return (
    <PageShell title="Classes">
      <ClassList classes={classes} />

      {activeTutors.length === 0 ? (
        <EmptyState message="Add a tutor first — a class needs one assigned." />
      ) : activeSubjects.length === 0 ? (
        <EmptyState message="Add a subject first — a class needs one assigned." />
      ) : (
        <CreateClassForm tutors={activeTutors} subjects={activeSubjects} />
      )}
    </PageShell>
  );
}
