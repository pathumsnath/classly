import { notFound } from "next/navigation";
import { getPerson } from "@/lib/people/queries";
import { getClass } from "@/lib/classes/queries";
import { listFeesForStudentInClass } from "@/lib/fees/queries";
import { listAttendanceForStudentInClass } from "@/lib/attendance/queries";
import { PageShell } from "@/components/page-shell";
import { ClassTabs } from "./class-tabs";

export default async function StudentClassDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; classId: string }>;
}) {
  const { studentId, classId } = await params;

  const [student, cls] = await Promise.all([getPerson(studentId), getClass(classId)]);
  if (!student || !cls) notFound();

  const [fees, attendance] = await Promise.all([
    listFeesForStudentInClass(studentId, classId),
    listAttendanceForStudentInClass(studentId, classId),
  ]);

  const sortedFees = [...fees].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <PageShell title={cls.subject} backHref={`/people/students/${studentId}`}>
      <p className="-mt-3 text-sm text-gray-500">
        {student.name} · {cls.tutorName}
      </p>

      <ClassTabs fees={sortedFees} attendance={attendance} />
    </PageShell>
  );
}
