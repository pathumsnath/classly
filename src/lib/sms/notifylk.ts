import type { SendSmsInput } from "./types";

// https://developer.notify.lk/api-endpoints/
const NOTIFY_LK_ENDPOINT = "https://app.notify.lk/api/v1/send";

export async function sendViaNotifyLk({ to, message }: SendSmsInput): Promise<void> {
  const body = new URLSearchParams({
    user_id: process.env.NOTIFY_LK_USER_ID!,
    api_key: process.env.NOTIFY_LK_API_KEY!,
    sender_id: process.env.NOTIFY_LK_SENDER_ID || "NotifyDemo",
    to,
    message,
  });

  const res = await fetch(NOTIFY_LK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as { status?: string; data?: string };

  if (!res.ok || data.status !== "success") {
    throw new Error(`Notify.lk SMS send failed: ${JSON.stringify(data)}`);
  }
}
