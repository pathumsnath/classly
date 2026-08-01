import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, Wallet } from "lucide-react";
import { getPerson } from "@/lib/people/queries";
import { listClassesForStudent } from "@/lib/classes/queries";
import { getWalletBalance } from "@/lib/wallet/queries";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/card";

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const student = await getPerson(studentId);
  if (!student) notFound();

  const [classes, walletBalance] = await Promise.all([
    listClassesForStudent(studentId),
    getWalletBalance(studentId),
  ]);

  return (
    <PageShell title={student.name} backHref="/people/students">
      <p className="-mt-3 text-sm text-gray-500">{student.phone}</p>

      <Card className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Wallet className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Wallet balance</p>
          <p className="font-semibold text-gray-900">LKR {walletBalance.toLocaleString()}</p>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Classes</h2>
        {classes.length === 0 ? (
          <EmptyState icon={GraduationCap} message="Not enrolled in any classes yet." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/people/students/${studentId}/${cls.id}`}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{cls.subject}</p>
                  <p className="text-sm text-gray-500">
                    {formatGrade(cls.grade)} · {formatMedium(cls.medium)} · {cls.tutorName}
                  </p>
                  <p className="text-sm text-gray-400">Enrolled {formatDate(cls.enrolledAt)}</p>
                </div>
                {cls.enrollmentStatus === "inactive" && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    Inactive
                  </span>
                )}
              </Link>
            ))}
          </Card>
        )}
      </div>
    </PageShell>
  );
}
