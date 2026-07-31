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
