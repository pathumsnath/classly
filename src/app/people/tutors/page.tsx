import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { listTutors } from "@/lib/people/queries";
import { PageShell } from "@/components/page-shell";
import { AddTutorForm } from "./add-tutor-form";
import { TutorList } from "./tutor-list";

export default async function TutorsPage() {
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const tutors = await listTutors();

  return (
    <PageShell title="Tutors">
      <AddTutorForm />
      <TutorList tutors={tutors} />
    </PageShell>
  );
}
