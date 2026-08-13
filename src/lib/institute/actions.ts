"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-owner";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Changing this immediately changes every revenue_share tutor's salary
// calculation going forward — see calculateClassSalary. RLS's
// institutes_update policy already restricts this to the institute's
// owner, so the regular client (not admin) is fine here.
export async function setRevenueShareCommissionPercent(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireOwner();

  const raw = String(formData.get("commissionPercent") || "").trim();
  const value = Number(raw);
  if (raw === "" || Number.isNaN(value) || value < 0 || value > 100) {
    return { error: "Enter a commission percentage between 0 and 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("institutes")
    .update({ revenue_share_commission_percent: value })
    .eq("id", session.instituteId);

  if (error) return { error: `Could not update commission rate: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/salaries");
  revalidatePath("/money");

  return { success: true };
}
