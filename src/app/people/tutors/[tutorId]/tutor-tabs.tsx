"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Wallet } from "lucide-react";
import { Card, EmptyState } from "@/components/card";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import type { ClassRow } from "@/lib/classes/queries";
import type { SalaryPaymentRow } from "@/lib/salaries/queries";

type Tab = "classes" | "salary";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function ClassesList({ classes }: { classes: ClassRow[] }) {
  if (classes.length === 0) {
    return <EmptyState icon={BookOpen} message="Not teaching any classes yet." />;
  }

  return (
    <Card className="divide-y divide-gray-100">
      {classes.map((cls) => (
        <Link
          key={cls.id}
          href={`/classes/${cls.id}`}
          className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
        >
          <div>
            <p className="font-medium text-gray-900">{cls.subject}</p>
            <p className="text-sm text-gray-500">
              {formatGrade(cls.grade)} · {formatMedium(cls.medium)}
            </p>
            <p className="text-sm text-gray-400">
              {cls.scheduleDays.join(", ")}
              {cls.scheduleStartTime ? ` · ${cls.scheduleStartTime}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-sm text-gray-500">LKR {cls.feeAmount}</span>
        </Link>
      ))}
    </Card>
  );
}

function SalaryHistoryTable({ salaryHistory }: { salaryHistory: SalaryPaymentRow[] }) {
  if (salaryHistory.length === 0) {
    return <EmptyState icon={Wallet} message="No salary payments recorded yet." />;
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold">Amount</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {salaryHistory.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap px-4 py-3 text-gray-900">{formatMonth(s.month)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-900">LKR {s.amount.toFixed(2)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    s.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s.status === "paid" ? "Paid" : "Unpaid"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function TutorTabs({
  classes,
  salaryHistory,
}: {
  classes: ClassRow[];
  salaryHistory: SalaryPaymentRow[] | null;
}) {
  const [tab, setTab] = useState<Tab>("classes");

  // Salary history is owner-only (see page.tsx) — admin_staff only ever
  // sees the classes list, so there's nothing to switch between.
  if (salaryHistory === null) {
    return <ClassesList classes={classes} />;
  }

  return (
    <>
      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("classes")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "classes" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Classes
        </button>
        <button
          type="button"
          onClick={() => setTab("salary")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "salary" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Salary history
        </button>
      </div>

      {tab === "classes" ? <ClassesList classes={classes} /> : <SalaryHistoryTable salaryHistory={salaryHistory} />}
    </>
  );
}
