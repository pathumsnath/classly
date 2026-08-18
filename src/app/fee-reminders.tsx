"use client";

import { useState } from "react";
import { Copy, Check, MessageCircleWarning } from "lucide-react";
import { Card } from "@/components/card";
import type { DueFeeReminder } from "@/lib/fees/reminders";

function ReminderCard({ reminder }: { reminder: DueFeeReminder }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(reminder.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{reminder.className}</p>
          <p className="text-sm text-gray-500">
            {reminder.unpaidCount} student(s) owe LKR {reminder.unpaidTotal.toLocaleString()} — class is tomorrow
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
            copied ? "bg-green-100 text-green-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{reminder.message}</p>
    </div>
  );
}

export function FeeReminders({ reminders }: { reminders: DueFeeReminder[] }) {
  if (reminders.length === 0) return null;

  return (
    <section className="px-4 sm:px-6">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <MessageCircleWarning className="h-3.5 w-3.5" />
        Fee reminders — forward to the class group
      </h2>
      <Card className="divide-y divide-gray-100">
        {reminders.map((reminder) => (
          <ReminderCard key={reminder.classId} reminder={reminder} />
        ))}
      </Card>
    </section>
  );
}
