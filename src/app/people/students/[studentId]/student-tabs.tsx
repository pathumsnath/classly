"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Receipt, Wallet } from "lucide-react";
import { Card, EmptyState } from "@/components/card";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import type { EnrolledClassRow } from "@/lib/classes/queries";
import type { FeeRow } from "@/lib/fees/queries";

type Tab = "enrollments" | "payments";

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// paidDate is a plain `date` column (a calendar date, not an instant) —
// pin the render to UTC so the day doesn't shift in a negative-UTC-offset
// server environment, same as formatMonth below.
function formatPaidDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function paymentStatusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

// A payment counts as a "carried forward" overdue settlement when it was
// actually paid in a later calendar month than the fee was originally
// due for — matches the cash-basis attribution used in salary calc.
function isCarriedForward(fee: FeeRow): boolean {
  return fee.paidDate !== null && fee.paidDate.slice(0, 7) > fee.month.slice(0, 7);
}

export function StudentTabs({
  studentId,
  classes,
  walletBalance,
  payments,
}: {
  studentId: string;
  classes: EnrolledClassRow[];
  walletBalance: number;
  payments: FeeRow[];
}) {
  const [tab, setTab] = useState<Tab>("enrollments");

  const sortedPayments = [...payments].sort((a, b) => {
    const aKey = a.paidDate ?? a.month;
    const bKey = b.paidDate ?? b.month;
    return bKey.localeCompare(aKey);
  });

  return (
    <>
      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("enrollments")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "enrollments" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Enrollments
        </button>
        <button
          type="button"
          onClick={() => setTab("payments")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "payments" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Payments
        </button>
      </div>

      {tab === "enrollments" ? (
        classes.length === 0 ? (
          <EmptyState icon={GraduationCap} message="Not enrolled in any classes yet." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/people/students/${studentId}/${cls.id}`}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">{cls.subject}</p>
                  <p className="text-sm text-gray-500">
                    {formatGrade(cls.grade)} · {formatMedium(cls.medium)} · {cls.tutorName}
                  </p>
                  <p className="text-sm text-gray-400">Enrolled {formatDate(cls.enrolledAt)}</p>
                </div>
                {cls.enrollmentStatus === "inactive" && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    Inactive
                  </span>
                )}
              </Link>
            ))}
          </Card>
        )
      ) : (
        <>
          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Wallet balance</p>
              <p className="font-semibold text-gray-900">LKR {walletBalance.toLocaleString()}</p>
            </div>
          </Card>

          {sortedPayments.length === 0 ? (
            <EmptyState icon={Receipt} message="No payment history yet." />
          ) : (
            <Card className="divide-y divide-gray-100">
              {sortedPayments.map((fee) => (
                <div key={fee.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {fee.subject} — {formatMonth(fee.month)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
                    </p>
                    {fee.paidDate && (
                      <p className="text-sm text-gray-400">
                        Paid on {formatPaidDate(fee.paidDate)}
                        {isCarriedForward(fee) && " · overdue settlement"}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusBadgeClass(fee.isOverdue, fee.status)}`}
                  >
                    {fee.isOverdue ? "Overdue" : fee.status}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}
