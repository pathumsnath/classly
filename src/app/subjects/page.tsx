import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { listSubjects } from "@/lib/subjects/queries";
import { setSubjectStatus } from "@/lib/subjects/actions";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";
import { AddSubjectForm } from "./add-subject-form";

export default async function SubjectsPage() {
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const subjects = await listSubjects();

  return (
    <PageShell title="Subjects">
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} message="No subjects yet — add your first one below." />
      ) : (
        <Card className="max-w-sm divide-y divide-gray-100">
          {subjects.map((subject) => (
            <div key={subject.id} className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium text-gray-900">{subject.name}</p>
              <form
                action={setSubjectStatus.bind(
                  null,
                  subject.id,
                  subject.status === "active" ? "inactive" : "active",
                )}
              >
                <button type="submit" className="text-sm font-medium text-indigo-600">
                  {subject.status === "active" ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
      <AddSubjectForm />
    </PageShell>
  );
}
