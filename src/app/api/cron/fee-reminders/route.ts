import { NextRequest, NextResponse } from "next/server";
import { sendDueFeeReminders } from "@/lib/fees/reminders";
import { todayInColombo } from "@/lib/time";

// Runs daily (see vercel.json) — unlike generate-fees, every day is a
// candidate (a class's "3rd session" can fall on any weekday depending on
// its own schedule), so there's no day-of-month gate here.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueFeeReminders(todayInColombo());
  return NextResponse.json(result);
}
