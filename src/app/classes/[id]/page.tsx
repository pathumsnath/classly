import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, DoorOpen, Wallet, Users, ClipboardCheck, GraduationCap } from "lucide-react";
import { getClass, listEnrolledStudents } from "@/lib/classes/queries";
import { listStudents } from "@/lib/people/queries";
import { getRevenueShareCommissionPercent } from "@/lib/institute/queries";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { unenrollStudent } from "@/lib/enrollments/actions";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState, Avatar } from "@/components/card";
import { EnrollForm } from "./enroll-form";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = await getClass(id);
  if (!cls) notFound();

  const [enrolled, allStudents, commissionPercent] = await Promise.all([
    listEnrolledStudents(id),
    listStudents(),
    cls.tutorPaymentModel === "revenue_share" ? getRevenueShareCommissionPercent() : Promise.resolve(null),
  ]);

  // For revenue_share, the institute-wide commission rate overrides this
  // class's own stored tutor_payment_value (see calculateClassSalary) —
  // show the effective share, not the stale per-class number.
  const tutorPaymentValue = commissionPercent !== null ? 100 - commissionPercent : cls.tutorPaymentValue;

  const activeEnrolled = enrolled.filter((e) => e.status === "active");
  const activeEnrolledIds = new Set(activeEnrolled.map((e) => e.id));
  const availableStudents = allStudents.filter((s) => s.status === "active" && !activeEnrolledIds.has(s.id));

  return (
    <PageShell title={cls.subject} backHref="/classes">
      <Card className="flex flex-col gap-3 p-5 text-sm text-gray-700">
        <p className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 shrink-0 text-gray-400" />
          {formatGrade(cls.grade)} · {formatMedium(cls.medium)}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
          {cls.tutorName} · {cls.scheduleDays.join(", ") || "no schedule"}
          {cls.scheduleStartTime
            ? ` at ${cls.scheduleStartTime}${cls.scheduleEndTime ? `–${cls.scheduleEndTime}` : ""}`
            : ""}
        </p>
        {cls.room && (
          <p className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 shrink-0 text-gray-400" />
            {cls.room}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Wallet className="h-4 w-4 shrink-0 text-gray-400" />
          LKR {cls.feeAmount} ({cls.feeType === "monthly_flat" ? "monthly flat" : "per session"}) · tutor:{" "}
          {tutorPaymentValue} ({cls.tutorPaymentModel.replace("_", " ")})
        </p>
      </Card>

      <Link
        href={`/attendance/${cls.id}`}
        className="flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 hover:shadow"
      >
        <ClipboardCheck className="h-4 w-4" />
        Take attendance
      </Link>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Enrolled students</h2>
        {activeEnrolled.length === 0 ? (
          <EmptyState icon={Users} message="No students enrolled yet." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {activeEnrolled.map((student) => (
              <div key={student.id} className="flex items-center gap-3 p-4">
                <Avatar name={student.name} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">{student.phone}</p>
                </div>
                <form action={unenrollStudent.bind(null, cls.id, student.id)}>
                  <button type="submit" className="text-sm font-medium text-indigo-600">
                    Unenrol
                  </button>
                </form>
              </div>
            ))}
          </Card>
        )}
      </div>

      <EnrollForm classId={cls.id} students={availableStudents} />
    </PageShell>
  );
}
