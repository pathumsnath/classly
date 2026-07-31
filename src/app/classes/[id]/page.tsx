import Link from "next/link";
import { notFound } from "next/navigation";
import { getClass, listEnrolledStudents } from "@/lib/classes/queries";
import { listStudents } from "@/lib/people/queries";
import { unenrollStudent } from "@/lib/enrollments/actions";
import { PageShell } from "@/components/page-shell";
import { EnrollForm } from "./enroll-form";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = await getClass(id);
  if (!cls) notFound();

  const [enrolled, allStudents] = await Promise.all([listEnrolledStudents(id), listStudents()]);

  const activeEnrolledIds = new Set(enrolled.filter((e) => e.status === "active").map((e) => e.id));
  const availableStudents = allStudents.filter((s) => s.status === "active" && !activeEnrolledIds.has(s.id));

  return (
    <PageShell title={cls.subject} backHref="/classes">
      <div className="max-w-sm rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
        <p>Tutor: {cls.tutorName}</p>
        <p>Schedule: {cls.scheduleDays.join(", ") || "not set"}{cls.scheduleTime ? ` at ${cls.scheduleTime}` : ""}</p>
        {cls.room && <p>Room: {cls.room}</p>}
        <p>Fee: LKR {cls.feeAmount} ({cls.feeType === "monthly_flat" ? "monthly flat" : "per session"})</p>
        <p>
          Tutor payment: {cls.tutorPaymentValue} ({cls.tutorPaymentModel.replace("_", " ")})
        </p>
      </div>

      <Link href={`/attendance/${cls.id}`} className="w-fit text-sm font-medium text-indigo-600">
        Take attendance
      </Link>

      <div>
        <h2 className="mb-2 font-semibold text-gray-900">Enrolled students</h2>
        <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
          {enrolled.filter((e) => e.status === "active").length === 0 && (
            <li className="p-4 text-sm text-gray-500">No students enrolled yet.</li>
          )}
          {enrolled
            .filter((e) => e.status === "active")
            .map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">{student.phone}</p>
                </div>
                <form action={unenrollStudent.bind(null, cls.id, student.id)}>
                  <button type="submit" className="text-sm font-medium text-indigo-600">
                    Unenrol
                  </button>
                </form>
              </li>
            ))}
        </ul>
      </div>

      <EnrollForm classId={cls.id} students={availableStudents} />
    </PageShell>
  );
}
