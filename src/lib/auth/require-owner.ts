import "server-only";
import { getSessionInfo, type SessionInfo } from "./session";

// Thrown by requireSession/requireOwner. UI hiding is not sufficient per
// NFR-2 — every financial/salary Server Action and query must call one of
// these, not just rely on the client not rendering the button.
export class ForbiddenError extends Error {}

export async function requireSession(): Promise<SessionInfo> {
  const session = await getSessionInfo();
  if (!session) throw new ForbiddenError("Not signed in.");
  return session;
}

export async function requireOwner(): Promise<SessionInfo> {
  const session = await requireSession();
  if (session.role !== "owner") {
    throw new ForbiddenError("This action is restricted to the institute owner.");
  }
  return session;
}
