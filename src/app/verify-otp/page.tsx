"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <AuthCard title="Verify your phone">
      <p className="text-sm text-gray-600">
        We sent a code to <span className="font-medium">{phone}</span>.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Verification code"
          name="otp"
          inputMode="numeric"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />
        <FormError message={error} />
        <SubmitButton disabled={pending}>{pending ? "Verifying…" : "Verify"}</SubmitButton>
      </form>
    </AuthCard>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
