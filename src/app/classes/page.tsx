import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { listClasses } from "@/lib/classes/queries";
import { listTutors } from "@/lib/people/queries";
import { listSubjects } from "@/lib/subjects/queries";
import { getRevenueShareCommissionPercent } from "@/lib/institute/queries";
import { PageShell } from "@/components/page-shell";
import { ClassesTabs } from "./classes-tabs";

export default async function ClassesPage() {
  const session = await getSessionInfo();
  if (!session || session.role === "tutor") redirect("/");

  const [classes, tutors, subjects, commissionPercent] = await Promise.all([
    listClasses(),
    listTutors(),
    listSubjects(),
    getRevenueShareCommissionPercent(),
  ]);
  const activeTutors = tutors.filter((t) => t.status === "active");
  const activeSubjects = subjects.filter((s) => s.status === "active");

  return (
    <PageShell title="Classes">
      <ClassesTabs
        classes={classes}
        activeTutors={activeTutors}
        activeSubjects={activeSubjects}
        commissionPercent={commissionPercent}
      />
    </PageShell>
  );
}
