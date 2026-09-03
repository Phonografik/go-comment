// Local-date arithmetic. Every function here works on `YYYY-MM-DD` keys built
// from LOCAL getters. v1 computed its week key via `toISOString()` on a local
// midnight, which in BST is the previous UTC day — the week rolled a day early
// all summer. Nothing in this file touches UTC except `daysBetween`, which
// uses Date.UTC precisely so a 23- or 25-hour DST day still counts as one day.
import type { DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function isValidDateKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateKey(fromDateKey(s)) === s;
}

/** Calendar-day arithmetic via the Date constructor, which normalises overflow and ignores DST. */
export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return toDateKey(new Date(y, m - 1, d + n));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(key: DateKey): number {
  return fromDateKey(key).getDay();
}

export function isWeekday(key: DateKey): boolean {
  const dow = dayOfWeek(key);
  return dow >= 1 && dow <= 5;
}

/** Monday of the week containing `key`. Weeks run Monday 00:00 → Sunday. */
export function weekStart(key: DateKey): DateKey {
  return addDays(key, -((dayOfWeek(key) + 6) % 7));
}

/** The seven keys Monday..Sunday for the week starting `start`. */
export function weekDays(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole days from a to b (positive when b is later). DST-proof. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
