"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inviteAdminStaff } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

export function InviteAdminStaffForm() {
  const [state, formAction, pending] = useActionState(inviteAdminStaff, {});

  return (
    <AuthCard title="Add admin staff">
      <form action={formAction} className="space-y-4">
        <Field label="Name" name="name" required />
        <Field label="Phone" name="phone" type="tel" required />
        <Field label="Email (optional)" name="email" type="email" />
        <FormError message={state.error} />
        <SubmitButton disabled={pending}>{pending ? "Sending invite…" : "Send invite"}</SubmitButton>
      </form>
      {state.success && <p className="text-sm text-green-700">Invite sent.</p>}
      <Link href="/" className="text-sm font-medium text-indigo-600">
        Back to dashboard
      </Link>
    </AuthCard>
  );
}
