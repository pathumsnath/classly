import { notFound, redirect } from "next/navigation";
import { getPerson } from "@/lib/people/queries";
import { listClassesForStudent } from "@/lib/classes/queries";
import { getWalletBalance } from "@/lib/wallet/queries";
import { listFeesForStudent } from "@/lib/fees/queries";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { StudentTabs } from "./student-tabs";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const student = await getPerson(studentId);
  if (!student) notFound();

  const [classes, walletBalance, payments] = await Promise.all([
    listClassesForStudent(studentId),
    getWalletBalance(studentId),
    listFeesForStudent(studentId),
  ]);

  return (
    <PageShell title={student.name} backHref="/people/students">
      <p className="-mt-3 text-sm text-gray-500">{student.phone}</p>

      <StudentTabs studentId={studentId} classes={classes} walletBalance={walletBalance} payments={payments} />
    </PageShell>
  );
}
