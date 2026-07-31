import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";

export async function isOnboardingComplete(): Promise<boolean> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("institutes")
    .select("onboarding_completed_at")
    .eq("id", session.instituteId)
    .maybeSingle();

  return data?.onboarding_completed_at != null;
}
