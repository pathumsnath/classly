import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/require-owner";

// The single institute-wide rate that overrides every revenue_share
// class's own tutor_payment_value (see calculateClassSalary). Reading it
// is open to anyone at the institute (matches the institutes_select RLS
// policy) — changing it is the owner-only part, enforced separately by
// setRevenueShareCommissionPercent.
export async function getRevenueShareCommissionPercent(): Promise<number> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("institutes")
    .select("revenue_share_commission_percent")
    .eq("id", session.instituteId)
    .single();

  return data?.revenue_share_commission_percent ?? 25;
}
