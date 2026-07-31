import "server-only";
import crypto from "node:crypto";

// Stateless, signed set-password link for admin-staff invites (FR-1.4).
// No dedicated invite-token table needed: the token itself carries the
// user id + expiry, HMAC-signed so it can't be forged or altered.
const TTL_MS = 24 * 60 * 60 * 1000;

interface InviteTokenPayload {
  userId: string;
  exp: number;
}

function secret(): string {
  const value = process.env.INVITE_TOKEN_SECRET;
  if (!value) throw new Error("INVITE_TOKEN_SECRET is not configured.");
  return value;
}

export function createInviteToken(userId: string): string {
  const payload: InviteTokenPayload = { userId, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyInviteToken(token: string): { userId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: InviteTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }

  if (Date.now() > payload.exp) return null;
  return { userId: payload.userId };
}
