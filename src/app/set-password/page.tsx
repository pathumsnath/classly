"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { setPasswordFromInvite } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(setPasswordFromInvite, {});

  return (
    <AuthCard title="Set your password">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Password" name="password" type="password" minLength={8} required />
        <FormError message={state.error} />
        <SubmitButton disabled={pending}>{pending ? "Saving…" : "Set password"}</SubmitButton>
      </form>
    </AuthCard>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
