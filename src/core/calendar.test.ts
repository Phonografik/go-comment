import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, dayOfWeek, fromDateKey, isValidDateKey, isWeekday, toDateKey, weekDays, weekStart } from './calendar';

describe('test clock', () => {
  it('runs in Europe/London so DST is real', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0); // GMT
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60); // BST
  });
});

describe('toDateKey', () => {
  it('uses local getters, never ISO/UTC (the v1 week-key bug)', () => {
    const localMidnight = new Date(2026, 6, 15); // 15 July, BST
    expect(toDateKey(localMidnight)).toBe('2026-07-15');
    // This is exactly what v1 did, and why its week started a day early all summer:
    expect(localMidnight.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  it('keeps an event just after midnight on the day the clocks change', () => {
    expect(toDateKey(new Date(2026, 2, 30, 0, 30))).toBe('2026-03-30');
    expect(toDateKey(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
  });

  it('round-trips through fromDateKey', () => {
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('addDays', () => {
  it('crosses the spring DST change as whole days', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-03-30', -1)).toBe('2026-03-29');
  });
  it('crosses the autumn DST change as whole days', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -2)).toBe('2026-10-24');
  });
  it('rolls months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('weeks', () => {
  it('start on Monday', () => {
    expect(weekStart('2026-09-03')).toBe('2026-08-31'); // Thursday
    expect(weekStart('2026-09-06')).toBe('2026-08-31'); // Sunday belongs to the week before
    expect(weekStart('2026-09-07')).toBe('2026-09-07'); // Monday is its own start
  });
  it('list Monday..Sunday', () => {
    expect(weekDays('2026-08-31')).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
    ]);
  });
  it('know weekdays from weekends', () => {
    expect(dayOfWeek('2026-09-06')).toBe(0);
    expect(isWeekday('2026-09-04')).toBe(true); // Fri
    expect(isWeekday('2026-09-05')).toBe(false); // Sat
    expect(isWeekday('2026-09-06')).toBe(false); // Sun
    expect(isWeekday('2026-09-07')).toBe(true); // Mon
  });
});

describe('daysBetween', () => {
  it('counts whole days across DST changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-09-03', '2026-09-01')).toBe(-2);
    expect(daysBetween('2026-09-03', '2026-09-03')).toBe(0);
  });
});

describe('isValidDateKey', () => {
  it('accepts real dates only', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('26-1-1')).toBe(false);
    expect(isValidDateKey(20260101)).toBe(false);
  });
});
