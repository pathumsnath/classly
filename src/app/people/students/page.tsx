import { listStudents } from "@/lib/people/queries";
import { PageShell } from "@/components/page-shell";
import { AddStudentForm } from "./add-student-form";
import { StudentList } from "./student-list";

export default async function StudentsPage() {
  const students = await listStudents();

  return (
    <PageShell title="Students">
      <AddStudentForm />
      <StudentList students={students} />
    </PageShell>
  );
}
