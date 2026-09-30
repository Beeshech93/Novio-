import { computeSlots, weekdayOf, zonedToUtc } from './time';

describe('time helpers', () => {
  it('converts Mexico City local time to UTC (UTC-6, no DST)', () => {
    expect(zonedToUtc('2026-06-15', 9 * 60, 'America/Mexico_City').toISOString()).toBe('2026-06-15T15:00:00.000Z');
  });
  it('handles DST in New York (summer UTC-4, winter UTC-5)', () => {
    expect(zonedToUtc('2026-07-01', 9 * 60, 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(zonedToUtc('2026-01-15', 9 * 60, 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });
  it('weekday of a date', () => expect(weekdayOf('2026-06-15')).toBe(1)); // Monday
});

describe('computeSlots', () => {
  const base = { date: '2026-06-15', tz: 'America/Mexico_City', hours: { openMin: 9 * 60, closeMin: 11 * 60 }, durationMin: 60, busy: [], blocked: false, now: new Date('2026-06-01T00:00:00Z'), stepMin: 30 };

  it('lists slots that fit inside opening hours', () => {
    expect(computeSlots(base).map((s) => new Date(s).getUTCHours() + ':' + new Date(s).getUTCMinutes())).toEqual(['15:0', '15:30', '16:0']);
  });
  it('excludes overlapping appointments', () => {
    const busy = [{ start: new Date('2026-06-15T15:30:00Z'), end: new Date('2026-06-15T16:30:00Z') }];
    expect(computeSlots({ ...base, busy })).toEqual([]); // 9:00 ends 10:00 overlaps 9:30-10:30; 9:30, 10:00 overlap too
  });
  it('touching intervals do not conflict', () => {
    const busy = [{ start: new Date('2026-06-15T15:00:00Z'), end: new Date('2026-06-15T16:00:00Z') }];
    expect(computeSlots(base).length).toBe(3);
    expect(computeSlots({ ...base, busy })).toEqual(['2026-06-15T16:00:00.000Z']);
  });
  it('closed / blocked days and past times yield nothing', () => {
    expect(computeSlots({ ...base, hours: null })).toEqual([]);
    expect(computeSlots({ ...base, blocked: true })).toEqual([]);
    expect(computeSlots({ ...base, now: new Date('2026-06-15T14:50:00Z') })).toEqual(['2026-06-15T16:00:00.000Z']); // 1h notice
  });
});
