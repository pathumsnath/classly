"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <AuthCard title="Log in">
      <form action={formAction} className="space-y-4">
        <Field label="Phone" name="phone" type="tel" required />
        <Field label="Password" name="password" type="password" required />
        <FormError message={state.error} />
        <SubmitButton disabled={pending}>{pending ? "Logging in…" : "Log in"}</SubmitButton>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/signup" className="font-medium text-indigo-600">
          Set up an institute
        </Link>
        <Link href="/forgot-password" className="font-medium text-indigo-600">
          Forgot password?
        </Link>
      </div>
    </AuthCard>
  );
}
