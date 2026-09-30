/** Timezone-aware helpers without external libs (Intl only). All stored timestamps are UTC. */

function offsetMinutes(utc: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(utc).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - utc.getTime()) / 60000);
}

/** "2026-06-15" + minutes-from-midnight in `tz` -> the real UTC instant (handles DST). */
export function zonedToUtc(dateStr: string, minutes: number, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minutes));
  const off1 = offsetMinutes(guess, tz);
  const first = new Date(guess.getTime() - off1 * 60000);
  const off2 = offsetMinutes(first, tz);
  return off2 === off1 ? first : new Date(guess.getTime() - off2 * 60000);
}

/** 0 = Sunday ... 6 = Saturday for a calendar date (timezone independent). */
export const weekdayOf = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

export interface Interval { start: Date; end: Date }
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export interface SlotInput {
  date: string;                       // YYYY-MM-DD in the business timezone
  tz: string;
  hours: { openMin: number; closeMin: number } | null; // null = closed that day
  durationMin: number;
  busy: Interval[];                   // existing non-cancelled appointments for the resource
  blocked: boolean;                   // day blocked (holiday etc.)
  now?: Date;
  stepMin?: number;
  minNoticeMin?: number;
}

/** Start times (UTC ISO) at which a `durationMin` appointment fits inside opening hours without overlaps. */
export function computeSlots(i: SlotInput): string[] {
  if (!i.hours || i.blocked || i.durationMin <= 0) return [];
  const now = i.now ?? new Date();
  const earliest = now.getTime() + (i.minNoticeMin ?? 60) * 60000;
  const out: string[] = [];
  for (let m = i.hours.openMin; m + i.durationMin <= i.hours.closeMin; m += i.stepMin ?? 15) {
    const start = zonedToUtc(i.date, m, i.tz);
    const end = new Date(start.getTime() + i.durationMin * 60000);
    if (start.getTime() < earliest) continue;
    if (i.busy.some((b) => overlaps({ start, end }, b))) continue;
    out.push(start.toISOString());
  }
  return out;
}

export { overlaps };
