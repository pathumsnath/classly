"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupOwner } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupOwner, {});

  return (
    <AuthCard title="Set up your institute">
      <form action={formAction} className="space-y-4">
        <Field label="Institute name" name="instituteName" required />
        <Field label="Your name" name="ownerName" required />
        <Field label="Phone (e.g. +9471XXXXXXX)" name="phone" type="tel" required />
        <Field label="Email (optional)" name="email" type="email" />
        <Field label="Password" name="password" type="password" minLength={8} required />
        <FormError message={state.error} />
        <SubmitButton disabled={pending}>{pending ? "Creating…" : "Create institute"}</SubmitButton>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
