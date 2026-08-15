import Link from "next/link";
import { Card, EmptyState } from "@/components/card";
import { CalendarDays } from "lucide-react";
import type { ScheduleEntry } from "@/lib/classes/queries";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPEN = "08:00:00";
const CLOSE = "20:00:00";
const NO_ROOM = "No room assigned";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

type Slot = { type: "booked"; entry: ScheduleEntry } | { type: "free"; start: string; end: string };

// Gaps between OPEN/CLOSE and this room's sorted bookings for one day —
// what's actually free to book a new class into. The cursor only ever
// moves forward, so overlapping bookings (shouldn't normally happen, but
// the schema doesn't prevent it) can't produce a negative-length gap.
function computeSlots(bookings: ScheduleEntry[]): Slot[] {
  const slots: Slot[] = [];
  let cursor = OPEN;

  for (const booking of bookings) {
    const start = booking.startTime ?? OPEN;
    const end = booking.endTime ?? start;
    if (start > cursor) slots.push({ type: "free", start: cursor, end: start });
    slots.push({ type: "booked", entry: booking });
    if (end > cursor) cursor = end;
  }

  if (cursor < CLOSE) slots.push({ type: "free", start: cursor, end: CLOSE });

  return slots;
}

export function Timetable({ entries }: { entries: ScheduleEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={CalendarDays} message="No classes scheduled yet." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Free slots shown within {formatTime(OPEN)}–{formatTime(CLOSE)}, per room.
      </p>
      {DAYS.map((day) => {
        const dayEntries = entries.filter((e) => e.day === day && e.startTime && e.endTime);

        if (dayEntries.length === 0) {
          return (
            <div key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{day}</h3>
              <Card className="p-4 text-sm text-gray-500">Nothing scheduled — free all day.</Card>
            </div>
          );
        }

        const byRoom = new Map<string, ScheduleEntry[]>();
        for (const e of dayEntries) {
          const key = e.room ?? NO_ROOM;
          const list = byRoom.get(key) ?? [];
          list.push(e);
          byRoom.set(key, list);
        }
        for (const list of byRoom.values()) {
          list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
        }
        const rooms = [...byRoom.keys()].sort((a, b) => (a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b)));

        return (
          <div key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{day}</h3>
            <div className="flex flex-col gap-3">
              {rooms.map((room) => (
                <Card key={room} className="p-3">
                  <p className="mb-2 px-1 text-xs font-semibold text-gray-500">{room}</p>
                  <div className="flex flex-col gap-1.5">
                    {computeSlots(byRoom.get(room)!).map((slot, i) =>
                      slot.type === "booked" ? (
                        <Link
                          key={i}
                          href={`/classes/${slot.entry.classId}`}
                          className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm transition hover:bg-indigo-100"
                        >
                          <span className="font-medium text-indigo-900">
                            {slot.entry.subject}
                            {slot.entry.groupName && ` (${slot.entry.groupName})`}
                          </span>
                          <span className="text-xs text-indigo-600">
                            {formatTime(slot.entry.startTime!)}–{formatTime(slot.entry.endTime!)} ·{" "}
                            {slot.entry.tutorName}
                          </span>
                        </Link>
                      ) : (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400"
                        >
                          <span>Free</span>
                          <span className="text-xs">
                            {formatTime(slot.start)}–{formatTime(slot.end)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
