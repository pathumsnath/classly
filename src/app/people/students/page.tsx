import { listStudents } from "@/lib/people/queries";
import { setStudentStatus } from "@/lib/people/actions";
import { PageShell } from "@/components/page-shell";
import { AddStudentForm } from "./add-student-form";

export default async function StudentsPage() {
  const students = await listStudents();

  return (
    <PageShell title="Students">
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {students.length === 0 && <li className="p-4 text-sm text-gray-500">No students yet.</li>}
        {students.map((student) => (
          <li key={student.id} className="flex items-center justify-between gap-4 p-4">
            <div>
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
          </li>
        ))}
      </ul>
      <AddStudentForm />
    </PageShell>
  );
}
