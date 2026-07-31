import "server-only";
import { sendViaNotifyLk } from "./notifylk";
import { sendViaStub } from "./stub";
import type { SendSmsInput } from "./types";

export type { SendSmsInput };

// Notify.lk if configured, otherwise a console-log stub so the OTP/invite
// flow works locally without a real SMS account (Section 6 tech-stack note).
export async function sendSms(input: SendSmsInput): Promise<void> {
  if (process.env.NOTIFY_LK_API_KEY) {
    await sendViaNotifyLk(input);
  } else {
    await sendViaStub(input);
  }
}
