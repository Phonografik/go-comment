// Points, caps, and the event-log ↔ day-rollup bookkeeping.
//
// Points ≈ effort × pipeline value, for a solo consultant whose number-one
// priority is pipeline. Daily caps sit just above what a real 2-hour block
// produces, so grinding any one action is pointless and "fake engagement"
// is never rewarded. Capped events are still RECORDED (lifetime totals and
// the streak see them) — they just score 0.
import type { ActivityEvent, Counts, DateKey, DayRollup, EventType } from './types';
import { EVENT_TYPES, zeroCounts } from './types';

export const POINTS: Record<EventType, number> = { p: 8, m: 4, q: 3, n: 2, c: 1, r: 1 };
export const DAILY_CAPS: Record<EventType, number> = { p: 2, m: 5, q: 1, n: 10, c: 15, r: 10 };

/** The most a single day can score with every cap hit. */
export const DAILY_CEILING = EVENT_TYPES.reduce((sum, t) => sum + POINTS[t] * DAILY_CAPS[t], 0);

export function dayPoints(counts: Counts): number {
  return EVENT_TYPES.reduce((sum, t) => sum + POINTS[t] * Math.min(counts[t], DAILY_CAPS[t]), 0);
}

export function cappedTypes(counts: Counts): EventType[] {
  return EVENT_TYPES.filter((t) => counts[t] >= DAILY_CAPS[t]);
}

export function totalOf(counts: Counts): number {
  return EVENT_TYPES.reduce((sum, t) => sum + counts[t], 0);
}

export function addCounts(a: Counts, b: Partial<Counts>): Counts {
  const out = { ...a };
  for (const t of EVENT_TYPES) out[t] += b[t] ?? 0;
  return out;
}

/** Per-day counts from the rollup plus the live event log. Only days with activity appear. */
export function mergeDayCounts(days: DayRollup, events: ActivityEvent[]): Map<DateKey, Counts> {
  const out = new Map<DateKey, Counts>();
  for (const [d, counts] of Object.entries(days)) out.set(d, addCounts(zeroCounts(), counts));
  for (const e of events) {
    const counts = out.get(e.d) ?? zeroCounts();
    counts[e.t] += 1;
    out.set(e.d, counts);
  }
  return out;
}

/**
 * Keep the event log under `cap` by folding the OLDEST whole days into the
 * rollup. Pure: returns new objects, never mutates its inputs. Because a day
 * is always folded in full, derive() can simply add rollup + events.
 */
export function compact(
  events: ActivityEvent[],
  days: DayRollup,
  cap = 10_000,
): { events: ActivityEvent[]; days: DayRollup } {
  if (events.length <= cap) return { events, days };
  const byDay = new Map<DateKey, ActivityEvent[]>();
  for (const e of events) byDay.set(e.d, [...(byDay.get(e.d) ?? []), e]);
  const oldestFirst = [...byDay.keys()].sort();
  const newDays: DayRollup = { ...days };
  let remaining = events.length;
  const folded = new Set<DateKey>();
  for (const d of oldestFirst) {
    if (remaining <= cap) break;
    const dayEvents = byDay.get(d)!;
    const counts = addCounts(newDays[d] ?? zeroCounts(), {});
    for (const e of dayEvents) counts[e.t] += 1;
    newDays[d] = counts;
    folded.add(d);
    remaining -= dayEvents.length;
  }
  return { events: events.filter((e) => !folded.has(e.d)), days: newDays };
}
