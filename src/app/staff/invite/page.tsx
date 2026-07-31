import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { InviteAdminStaffForm } from "./invite-form";

// Page-level gate is defense in depth for UX — the real enforcement is
// requireOwner() inside the inviteAdminStaff Server Action (NFR-2).
export default async function InviteAdminStaffPage() {
  const session = await getSessionInfo();
  if (!session || session.role !== "owner") {
    redirect("/");
  }

  return <InviteAdminStaffForm />;
}
