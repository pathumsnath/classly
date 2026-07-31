import { Users } from "lucide-react";
import { listStudents } from "@/lib/people/queries";
import { setStudentStatus } from "@/lib/people/actions";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState, Avatar } from "@/components/card";
import { AddStudentForm } from "./add-student-form";

export default async function StudentsPage() {
  const students = await listStudents();

  return (
    <PageShell title="Students">
      {students.length === 0 ? (
        <EmptyState icon={Users} message="No students yet — add your first one below." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {students.map((student) => (
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
      <AddStudentForm />
    </PageShell>
  );
}
