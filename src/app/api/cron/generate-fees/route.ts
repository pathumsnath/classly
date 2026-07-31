import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMonthlyFees } from "@/lib/fees/generate";

// Runs daily (see vercel.json), not monthly — checking "is it the 1st in
// Asia/Colombo?" here sidesteps fragile UTC-offset month-boundary cron
// math (months have variable lengths, so a naive "run on day N of month"
// UTC cron expression can't reliably land on Colombo's actual midnight).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const colomboNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  if (colomboNow.getDate() !== 1) {
    return NextResponse.json({ skipped: true, reason: "not the 1st in Asia/Colombo" });
  }

  const month = `${colomboNow.getFullYear()}-${String(colomboNow.getMonth() + 1).padStart(2, "0")}-01`;

  const admin = createAdminClient();
  const { data: institutes } = await admin.from("institutes").select("id");

  let created = 0;
  for (const institute of institutes ?? []) {
    const result = await generateMonthlyFees(institute.id, month);
    created += result.created;
  }

  return NextResponse.json({ month, institutes: institutes?.length ?? 0, created });
}
