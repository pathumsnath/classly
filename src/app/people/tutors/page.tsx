import { GraduationCap } from "lucide-react";
import { listTutors } from "@/lib/people/queries";
import { setTutorStatus } from "@/lib/people/actions";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState, Avatar } from "@/components/card";
import { AddTutorForm } from "./add-tutor-form";

export default async function TutorsPage() {
  const tutors = await listTutors();

  return (
    <PageShell title="Tutors">
      {tutors.length === 0 ? (
        <EmptyState icon={GraduationCap} message="No tutors yet — add your first one below." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="flex items-center gap-3 p-4">
              <Avatar name={tutor.name} />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{tutor.name}</p>
                <p className="text-sm text-gray-500">{tutor.phone}</p>
              </div>
              <form action={setTutorStatus.bind(null, tutor.id, tutor.status === "active" ? "inactive" : "active")}>
                <button type="submit" className="text-sm font-medium text-indigo-600">
                  {tutor.status === "active" ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
      <AddTutorForm />
    </PageShell>
  );
}
