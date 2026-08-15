import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/lib/onboarding/queries";
import { listTutors } from "@/lib/people/queries";
import { getRevenueShareCommissionPercent } from "@/lib/institute/queries";
import { PageShell } from "@/components/page-shell";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  if (await isOnboardingComplete()) {
    redirect("/");
  }

  const [tutors, commissionPercent] = await Promise.all([listTutors(), getRevenueShareCommissionPercent()]);
  const activeTutors = tutors.filter((t) => t.status === "active").map((t) => ({ id: t.id, name: t.name }));

  return (
    <PageShell title="Welcome to Classly" backHref="/">
      <OnboardingWizard initialTutors={activeTutors} commissionPercent={commissionPercent} />
    </PageShell>
  );
}
