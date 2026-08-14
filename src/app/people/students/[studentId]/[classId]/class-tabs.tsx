"use client";

import { useState } from "react";
import { Receipt, ClipboardCheck } from "lucide-react";
import { Card, EmptyState } from "@/components/card";
import type { FeeRow } from "@/lib/fees/queries";
import type { AttendanceRecordRow } from "@/lib/attendance/queries";

type Tab = "payments" | "attendance";

function formatMonth(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function paymentStatusBadgeClass(isOverdue: boolean, status: string) {
  if (isOverdue) return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

const ATTENDANCE_STYLES: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-yellow-100 text-yellow-700",
};

export function ClassTabs({ fees, attendance }: { fees: FeeRow[]; attendance: AttendanceRecordRow[] }) {
  const [tab, setTab] = useState<Tab>("payments");

  return (
    <>
      <div className="flex w-fit gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("payments")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "payments" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
            tab === "attendance" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Attendance
        </button>
      </div>

      {tab === "payments" ? (
        fees.length === 0 ? (
          <EmptyState icon={Receipt} message="No payment history for this class yet." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {fees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-gray-900">{formatMonth(fee.month)}</p>
                  <p className="text-sm text-gray-500">
                    Due LKR {fee.amountDue} · Paid LKR {fee.amountPaid} · Balance LKR {fee.balance}
                  </p>
                  {fee.paidDate && <p className="text-sm text-gray-400">Paid on {formatDate(fee.paidDate)}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusBadgeClass(fee.isOverdue, fee.status)}`}
                >
                  {fee.isOverdue ? "Overdue" : fee.status}
                </span>
              </div>
            ))}
          </Card>
        )
      ) : attendance.length === 0 ? (
        <EmptyState icon={ClipboardCheck} message="No attendance history for this class yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {attendance.map((record) => (
            <div key={record.id} className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium text-gray-900">{formatDate(record.date)}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${ATTENDANCE_STYLES[record.status]}`}
              >
                {record.status}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
