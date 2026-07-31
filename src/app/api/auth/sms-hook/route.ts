import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendSms } from "@/lib/sms";

// Supabase Auth "Send SMS Hook" — routes OTP delivery through Notify.lk
// instead of Supabase's default SMS provider (Section 6 tech-stack note).
// Configure in Supabase Dashboard -> Authentication -> Hooks -> Send SMS
// hook, pointing at this route's URL, and copy the generated secret into
// SUPABASE_AUTH_HOOK_SECRET.
interface SendSmsHookPayload {
  user: { phone?: string };
  sms: { otp: string };
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { http_code: 500, message: "Hook secret not configured" } },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let verified: SendSmsHookPayload;
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ""));
    verified = wh.verify(payload, headers) as SendSmsHookPayload;
  } catch {
    return NextResponse.json(
      { error: { http_code: 401, message: "Invalid signature" } },
      { status: 401 },
    );
  }

  const phone = verified.user?.phone;
  const otp = verified.sms?.otp;
  if (!phone || !otp) {
    return NextResponse.json(
      { error: { http_code: 400, message: "Missing phone or otp in payload" } },
      { status: 400 },
    );
  }

  try {
    await sendSms({ to: phone, message: `Your Classly verification code is ${otp}` });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          http_code: 500,
          message: err instanceof Error ? err.message : "SMS send failed",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({});
}
