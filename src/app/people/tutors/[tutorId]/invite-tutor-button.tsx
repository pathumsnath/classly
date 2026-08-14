"use client";

import { useState } from "react";
import { inviteTutor } from "@/lib/auth/actions";

export function InviteTutorButton({ tutorId }: { tutorId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleClick() {
    setPending(true);
    const res = await inviteTutor(tutorId);
    setResult(res);
    setPending(false);
  }

  if (result?.success) {
    return <p className="text-sm text-green-700">Invite sent — they&apos;ll get an SMS to set their password.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-fit rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Invite to log in"}
      </button>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
    </div>
  );
}
