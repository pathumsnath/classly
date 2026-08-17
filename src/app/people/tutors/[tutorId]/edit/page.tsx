import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { getTutorForEdit } from "@/lib/people/queries";
import { getRevenueShareCommissionPercent } from "@/lib/institute/queries";
import { PageShell } from "@/components/page-shell";
import { EditTutorForm } from "./edit-tutor-form";

export default async function EditTutorPage({ params }: { params: Promise<{ tutorId: string }> }) {
  const { tutorId } = await params;
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const [tutor, defaultCommissionPercent] = await Promise.all([
    getTutorForEdit(tutorId),
    getRevenueShareCommissionPercent(),
  ]);
  if (!tutor) notFound();

  return (
    <PageShell title={`Edit ${tutor.name}`} backHref={`/people/tutors/${tutorId}`}>
      <EditTutorForm tutor={tutor} defaultCommissionPercent={defaultCommissionPercent} />
    </PageShell>
  );
}
