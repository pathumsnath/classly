"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Search, X } from "lucide-react";
import { recordPayment } from "@/lib/fees/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";
import type { FeeRow } from "@/lib/fees/queries";

// A plain <select> doesn't scale to an institute with hundreds of
// students — type-to-filter instead, same search-then-pick pattern
// already used on the Fees page's student search.
function StudentPicker({
  students,
  studentId,
  onSelect,
}: {
  students: { id: string; name: string }[];
  studentId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = students.find((s) => s.id === studentId);

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
        Student
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <span className="text-base text-gray-900">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setQuery("");
            }}
            aria-label="Change student"
            className="rounded-full p-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const matches =
    query.trim().length > 0
      ? students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
      : [];

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
      Student
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      {query.trim() && (
        <div className="overflow-hidden rounded-lg border border-gray-100 shadow-sm">
          {matches.length === 0 ? (
            <p className="bg-white px-3 py-2 text-sm text-gray-500">No students match &ldquo;{query}&rdquo;.</p>
          ) : (
            matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setQuery("");
                }}
                className="block w-full border-b border-gray-100 bg-white px-3 py-3 text-left text-sm text-gray-900 last:border-b-0 hover:bg-gray-50"
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function RecordFeePaymentForm({
  students,
  fees,
  walletBalances,
}: {
  students: { id: string; name: string }[];
  fees: FeeRow[];
  walletBalances: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, {});
  const [studentId, setStudentId] = useState("");

  const payable = fees.filter((f) => f.studentId === studentId && f.status !== "paid" && f.status !== "waived");
  const walletBalance = walletBalances[studentId] ?? 0;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Record a fee payment</h2>

      <input type="hidden" name="studentId" value={studentId} />
      <StudentPicker students={students} studentId={studentId} onSelect={setStudentId} />

      {studentId && (
        <>
          {payable.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing outstanding for this student.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {payable.map((fee) => (
                <label key={fee.id} className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="paymentId"
                    value={fee.id}
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex-1">
                    {fee.subject} — {fee.month.slice(0, 7)}
                    {fee.isOverdue && <span className="ml-1.5 text-xs font-medium text-red-600">Overdue</span>}
                  </span>
                  <input
                    type="number"
                    name={`amount_${fee.id}`}
                    defaultValue={fee.balance}
                    min={0}
                    step="0.01"
                    className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              ))}
            </div>
          )}

          <Select label="Method" name="method" required defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
            <option value="wallet_credit" disabled={walletBalance <= 0}>
              Wallet credit (LKR {walletBalance.toLocaleString()} available)
            </option>
          </Select>
          <Field label="Reference (optional)" name="reference" />
          <Field
            label="Date received"
            name="paidDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          <div className="flex flex-col gap-1">
            <Field label="Add to wallet (optional)" name="walletCredit" type="number" min={0} step="0.01" />
            <p className="text-xs text-gray-500">
              For an overpayment, or a pre-payment with nothing due yet — parked as credit for a future fee.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="sendReceipt"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Send SMS receipt to parent
          </label>
        </>
      )}

      <FormError message={state.error} />
      {state.success && <p className="text-sm text-green-700">Payment recorded.</p>}
      <SubmitButton disabled={pending || !studentId}>{pending ? "Recording…" : "Record payment"}</SubmitButton>
    </form>
  );
}
