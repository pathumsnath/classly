// Asia/Colombo (NFR-8) date helpers shared across attendance, fees, and
// money views — trusts the server's UTC clock offset by timezone
// conversion rather than assuming the server itself runs in Colombo time.
export function colomboNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
}

export function todayInColombo(): string {
  const now = colomboNow();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function currentMonthInColombo(): string {
  return `${todayInColombo().slice(0, 7)}-01`;
}

// The calendar month containing an arbitrary "YYYY-MM-DD" date — used to
// bucket a session-cycle fee into whichever month the cycle actually
// completed in, same shape as currentMonthInColombo's "YYYY-MM-01".
export function monthOfDate(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

// Calendar-week bucket within the month (1-7 -> 1, 8-14 -> 2, ...), not a
// count of "which Nth Monday" — so a class meeting twice a week shows the
// same week number for both sessions in the same calendar week.
export function weekOfMonth(date: string): number {
  const day = Number(date.slice(8, 10));
  return Math.ceil(day / 7);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
