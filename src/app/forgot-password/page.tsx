"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/reset-password?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <AuthCard title="Reset your password">
      <p className="text-sm text-gray-600">
        Enter the phone number on your account and we&apos;ll text you a code.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <FormError message={error} />
        <SubmitButton disabled={pending}>{pending ? "Sending…" : "Send code"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
