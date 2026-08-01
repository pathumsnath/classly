import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { listClasses } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { listSubjects } from "@/lib/subjects/queries";
import { PageShell } from "@/components/page-shell";
import { ClassesTabs } from "./classes-tabs";

export default async function ClassesPage() {
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const [classes, tutors, subjects] = await Promise.all([listClasses(), listTutors(), listSubjects()]);
  const activeTutors = tutors.filter((t) => t.status === "active");
  const activeSubjects = subjects.filter((s) => s.status === "active");

  return (
    <PageShell title="Classes">
      <ClassesTabs classes={classes} activeTutors={activeTutors} activeSubjects={activeSubjects} />
    </PageShell>
  );
}
