"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/require-owner";

// FR-2.1 — called when the 3-step wizard finishes or is skipped in full.
// institutes.onboarding_completed_at is the single flag the dashboard
// checks to decide "send them to /onboarding" vs "show the real thing" —
// see 0002_phase_b.sql for why this isn't inferred from record counts.
export async function completeOnboarding(): Promise<void> {
  const session = await requireSession();

  const admin = createAdminClient();
  const { error } = await admin
    .from("institutes")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", session.instituteId);

  if (error) throw new Error(`Could not complete onboarding: ${error.message}`);
}
