import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getClass } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { listSubjects } from "@/lib/subjects/queries";
import { PageShell } from "@/components/page-shell";
import { EditClassForm } from "./edit-class-form";

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const [cls, tutors, subjects] = await Promise.all([getClass(id), listTutors(), listSubjects()]);
  if (!cls) notFound();

  const activeTutors = tutors.filter((t) => t.status === "active");
  const activeSubjects = subjects.filter((s) => s.status === "active");

  return (
    <PageShell title={`Edit ${cls.subject}`} backHref={`/classes/${id}`}>
      <EditClassForm cls={cls} tutors={activeTutors} subjects={activeSubjects} />
    </PageShell>
  );
}
