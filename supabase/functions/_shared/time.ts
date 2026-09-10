// Ported verbatim from src/lib/time.ts (Asia/Colombo date helpers) — keep
// both copies in sync if the logic ever changes; see src/lib/fees/proration.ts's
// own note on the same duplication tradeoff for why this isn't centralized.

export function monthOfDate(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
