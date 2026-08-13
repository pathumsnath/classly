import { notFound, redirect } from "next/navigation";
import { getPerson } from "@/lib/people/queries";
import { listClassesForTutor } from "@/lib/classes/queries";
import { listSalaryPaymentsForTutor } from "@/lib/salaries/queries";
import { getSessionInfo } from "@/lib/auth/session";
import { PageShell } from "@/components/page-shell";
import { InviteTutorButton } from "./invite-tutor-button";
import { TutorTabs } from "./tutor-tabs";

export default async function TutorDetailPage({
  params,
}: {
  params: Promise<{ tutorId: string }>;
}) {
  const { tutorId } = await params;

  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const tutor = await getPerson(tutorId);
  if (!tutor) notFound();

  const [classes, salaryHistory] = await Promise.all([
    listClassesForTutor(tutorId),
    session?.role === "owner" ? listSalaryPaymentsForTutor(tutorId) : Promise.resolve(null),
  ]);

  return (
    <PageShell title={tutor.name} backHref="/people/tutors">
      <p className="-mt-3 text-sm text-gray-500">{tutor.phone}</p>

      {session?.role === "owner" &&
        (tutor.hasLogin ? (
          <p className="-mt-3 text-sm text-gray-500">Has login access.</p>
        ) : (
          <InviteTutorButton tutorId={tutorId} />
        ))}

      <TutorTabs classes={classes} salaryHistory={salaryHistory} />
    </PageShell>
  );
}
