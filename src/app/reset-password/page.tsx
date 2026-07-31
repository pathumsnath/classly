"use client";

import { Suspense, useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updatePassword } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/form";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const [verified, setVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updatePassword, {});

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setOtpError(undefined);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });

    setPending(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    setVerified(true);
  }

  if (!verified) {
    return (
      <AuthCard title="Enter the code">
        <p className="text-sm text-gray-600">
          Code sent to <span className="font-medium">{phone}</span>.
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <Field
            label="Verification code"
            name="otp"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <FormError message={otpError} />
          <SubmitButton disabled={pending}>{pending ? "Verifying…" : "Verify"}</SubmitButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password">
      <form action={updateAction} className="space-y-4">
        <Field label="New password" name="password" type="password" minLength={8} required />
        <FormError message={updateState.error} />
        <SubmitButton disabled={updatePending}>
          {updatePending ? "Saving…" : "Save password"}
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
