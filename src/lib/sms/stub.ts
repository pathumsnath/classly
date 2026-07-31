import type { SendSmsInput } from "./types";

export async function sendViaStub({ to, message }: SendSmsInput): Promise<void> {
  console.log(`[sms-stub] to=${to} message="${message}"`);
}
