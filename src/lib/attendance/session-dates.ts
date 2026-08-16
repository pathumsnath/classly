import "server-only";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Every scheduled (non-cancelled) date for a class within one calendar
// month — the calendar-billing equivalent of a session-cycle's own
// walkCycleSessionDates, used both to render the monthly grid and, for
// fee true-up purposes, to know how many sessions a month actually had.
export function scheduledDatesInMonth(scheduleDays: string[], month: string, cancelledDates: Set<string>): string[] {
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, mon - 1, day));
    const dateStr = d.toISOString().slice(0, 10);
    if (scheduleDays.includes(WEEKDAY_NAMES[d.getUTCDay()]) && !cancelledDates.has(dateStr)) {
      dates.push(dateStr);
    }
  }
  return dates;
}
