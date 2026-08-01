import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, ClipboardCheck } from "lucide-react";
import { getPerson } from "@/lib/people/queries";
import { getClass } from "@/lib/classes/queries";
import { listFeesForStudentInClass } from "@/lib/fees/queries";
import { listAttendanceForStudentInClass } from "@/lib/attendance/queries";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";

type Tab = "payments" | "attendance";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function paymentStatusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

const ATTENDANCE_STYLES: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-yellow-100 text-yellow-700",
};

function TabLink({ basePath, tab, active, children }: { basePath: string; tab: Tab; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={`${basePath}?tab=${tab}`}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string; classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { studentId, classId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "attendance" ? "attendance" : "payments";

  const [student, cls] = await Promise.all([getPerson(studentId), getClass(classId)]);
  if (!student || !cls) notFound();

  const basePath = `/people/students/${studentId}/${classId}`;

  return (
    <PageShell title={cls.subject} backHref={`/people/students/${studentId}`}>
      <p className="-mt-3 text-sm text-gray-500">
        {student.name} · {cls.tutorName}
      </p>

      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <TabLink basePath={basePath} tab="payments" active={tab === "payments"}>
          Payments
        </TabLink>
        <TabLink basePath={basePath} tab="attendance" active={tab === "attendance"}>
          Attendance
        </TabLink>
      </div>

      {tab === "payments" ? (
        <PaymentsTab studentId={studentId} classId={classId} />
      ) : (
        <AttendanceTab studentId={studentId} classId={classId} />
      )}
    </PageShell>
  );
}

async function PaymentsTab({ studentId, classId }: { studentId: string; classId: string }) {
  const fees = (await listFeesForStudentInClass(studentId, classId)).sort((a, b) =>
    b.month.localeCompare(a.month),
  );

  if (fees.length === 0) {
    return <EmptyState icon={Receipt} message="No payment history for this class yet." />;
  }

  return (
    <Card className="divide-y divide-gray-100">
      {fees.map((fee) => (
        <div key={fee.id} className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium text-gray-900">{formatMonth(fee.month)}</p>
            <p className="text-sm text-gray-500">
              Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
            </p>
            {fee.paidDate && <p className="text-sm text-gray-400">Paid on {formatDate(fee.paidDate)}</p>}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusBadgeClass(fee.isOverdue, fee.status)}`}
          >
            {fee.isOverdue ? "Overdue" : fee.status}
          </span>
        </div>
      ))}
    </Card>
  );
}

async function AttendanceTab({ studentId, classId }: { studentId: string; classId: string }) {
  const records = await listAttendanceForStudentInClass(studentId, classId);

  if (records.length === 0) {
    return <EmptyState icon={ClipboardCheck} message="No attendance history for this class yet." />;
  }

  return (
    <Card className="divide-y divide-gray-100">
      {records.map((record) => (
        <div key={record.id} className="flex items-center justify-between gap-4 p-4">
          <p className="font-medium text-gray-900">{formatDate(record.date)}</p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ATTENDANCE_STYLES[record.status]}`}
          >
            {record.status}
          </span>
        </div>
      ))}
    </Card>
  );
}
