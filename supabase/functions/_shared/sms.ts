// Ported from src/lib/sms/notifylk.ts + index.ts. Falls back to a
// console.log stub if NOTIFY_LK_API_KEY isn't set (e.g. local `supabase
// functions serve` without secrets configured), same as the web app does.
const NOTIFY_LK_ENDPOINT = "https://app.notify.lk/api/v1/send";

export async function sendSms({ to, message }: { to: string; message: string }): Promise<void> {
  const apiKey = Deno.env.get("NOTIFY_LK_API_KEY");
  if (!apiKey) {
    console.log(`[sms stub] to=${to} message=${message}`);
    return;
  }

  const body = new URLSearchParams({
    user_id: Deno.env.get("NOTIFY_LK_USER_ID") ?? "",
    api_key: apiKey,
    sender_id: Deno.env.get("NOTIFY_LK_SENDER_ID") || "NotifyDemo",
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
