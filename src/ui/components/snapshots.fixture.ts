// StateSnapshot fixtures for the popup tests, built with the real derive() so
// streaks, freezes, week cells and the mascot stage are exactly what the
// engine would produce. Dates are local (tests run in Europe/London).
//
// Calendar: 2026-09-07 is a Monday. 17/24/31 Aug are the Mondays before it.
import { derive, EVENT_TYPES, toDateKey, type ActivityEvent, type Badges, type Counts, type Legacy, type Level, type Settings } from '@/src/core';
import type { Health, StateSnapshot } from '@/src/messaging/protocol';

export type Onboarded = Extract<StateSnapshot, { onboarded: true }>;

export const SELECTORS_VERSION = '2026-09-07.1';

/** Local date-time. `m` is 1-based. */
export function at(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

/** Events on one day, a minute apart, stamped with that day's local key. */
export function on(day: Date, counts: Partial<Counts>): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  let i = 0;
  for (const t of EVENT_TYPES) {
    for (let n = 0; n < (counts[t] ?? 0); n++) out.push({ t, ts: day.getTime() + i++ * 60_000, d: toDateKey(day) });
  }
  return out;
}

const weekdays = (monday: Date) => [0, 1, 2, 3, 4].map((i) => at(monday.getFullYear(), monday.getMonth() + 1, monday.getDate() + i));

/** A 24-point day: 1 post, 2 DMs, 3 connections, 2 comments. */
const DAY_24: Partial<Counts> = { p: 1, m: 2, n: 3, c: 2 };

/** Mon–Fri at 24 = 120 (hits Turn Dial to 11). */
export const week120 = (monday: Date) => weekdays(monday).flatMap((d) => on(d, DAY_24));
/** Mon–Thu at 24, Fri 22 = 118 — the mock's "held by last week's 118". */
export const week118 = (monday: Date) => weekdays(monday).flatMap((d, i) => on(d, i === 4 ? { p: 1, m: 2, n: 3 } : DAY_24));
/** Mon–Thu at 24, Fri 2 = 98 — just under 111, the moult week. */
export const week98 = (monday: Date) => weekdays(monday).flatMap((d, i) => on(d, i === 4 ? { c: 2 } : DAY_24));

export function health(now: Date, patch: Partial<Health> = {}): Health {
  return {
    lastPageLoad: now.getTime(),
    unconfirmed: {},
    lastDetected: { c: now.getTime() - 3_600_000 },
    selectorsVersion: SELECTORS_VERSION,
    ...patch,
  };
}

interface Build {
  now: Date;
  level: Level;
  events: ActivityEvent[];
  badges?: Badges;
  legacy?: Legacy;
  health?: Partial<Health>;
}

export function build({ now, level, events, badges = {}, legacy, health: healthPatch }: Build): Onboarded {
  const settings: Settings = { level, memberSince: at(2025, 8, 12).getTime() };
  const derived = derive({ days: {}, events, legacy, settings, badges, now });
  return { onboarded: true, derived, settings, badges, legacy, health: health(now, healthPatch) };
}

export const ONBOARDING: StateSnapshot = { onboarded: false };

/** Wednesday 9 Sep, 10:30. Go Go Go! (50). Mon 20 + Tue 20 + Wed 14 = 54 → target hit today, one freeze, 3-day streak. */
export const MIDWEEK_NOW = at(2026, 9, 9, 10, 30);
export const MIDWEEK = build({
  now: MIDWEEK_NOW,
  level: 2,
  events: [
    ...on(at(2026, 9, 7), { p: 1, m: 2, c: 4 }),
    ...on(at(2026, 9, 8), { p: 1, m: 2, c: 4 }),
    ...on(at(2026, 9, 9, 10), { m: 2, n: 3 }),
  ],
  legacy: { c: 1234, n: 56, p: 7, bestWeek: 88, weeklyStreak: 2, longestWeeklyStreak: 4, weekCarry: 0, importedAt: at(2026, 9, 5).getTime() },
});

/**
 * Thursday 10 Sep, 14:00 — the mock's main state. Turn Dial to 11 (111). Three
 * 111+ weeks behind it (bank full at 2), Wednesday missed and frozen, 79 this
 * week, 15 comments today → the comment cap. Stage 4 Show-off, held by last week's 118.
 */
export const THURSDAY_NOW = at(2026, 9, 10, 14, 0);
export const THURSDAY = build({
  now: THURSDAY_NOW,
  level: 3,
  events: [
    ...week120(at(2026, 8, 17)),
    ...week120(at(2026, 8, 24)),
    ...week118(at(2026, 8, 31)),
    ...on(at(2026, 9, 7), { p: 1, m: 2, c: 2 }),
    ...on(at(2026, 9, 8), { p: 1, m: 2, n: 3 }),
    ...on(at(2026, 9, 10, 9), { p: 1, m: 2, n: 3, c: 15, r: 2 }),
  ],
});

/** Wednesday 9 Sep, 18:35, nothing today. Turn Dial to 11. One freeze banked from last week's 118. */
export const AT_RISK_NOW = at(2026, 9, 9, 18, 35);
export const AT_RISK = build({
  now: AT_RISK_NOW,
  level: 3,
  events: [...week118(at(2026, 8, 31)), ...on(at(2026, 9, 7), { p: 1, m: 2, c: 2 }), ...on(at(2026, 9, 8), { p: 1, m: 2, n: 3 })],
});

/** Monday 14 Sep, 09:00. 118 two weeks ago, 98 last week → the Show-off week fell out; stage 3 Parrot now. */
export const MOULT_NOW = at(2026, 9, 14, 9, 0);
export const MOULT = build({
  now: MOULT_NOW,
  level: 3,
  events: [...week118(at(2026, 8, 31)), ...week98(at(2026, 9, 7))],
});
/** What the popup remembered from last week: the Show-off it showed. */
export const MOULT_SEEN = { stage: 4, week: '2026-09-07' };

/** Six of twelve badges unlocked, on the Thursday state. */
export const BADGES_HALF: Badges = {
  'first-word': at(2026, 8, 17).getTime(),
  'five-alive': at(2026, 8, 21).getTime(),
  'fortnight': at(2026, 8, 28).getTime(),
  'full-house': at(2026, 8, 21).getTime(),
  'overachiever': at(2026, 8, 28).getTime(),
  'back-from-the-dead': at(2026, 8, 17).getTime(),
};
export const WITH_BADGES: Onboarded = { ...THURSDAY, badges: BADGES_HALF };

/** Thursday, but the content script has mounted for three days since the last confirmed comment, and four comment hints went unconfirmed. */
export const HEALTH_YELLOW = build({
  now: THURSDAY_NOW,
  level: 3,
  events: THURSDAY.derived.weekDays.length ? [...week118(at(2026, 8, 31)), ...on(at(2026, 9, 7), { c: 2 })] : [],
  health: { lastDetected: { c: at(2026, 9, 7, 14).getTime() }, unconfirmed: { c: 4, n: 1 } },
});

/** A brand-new user on Go Comment (25): nothing counted yet, egg. */
export const FRESH = build({ now: MIDWEEK_NOW, level: 1, events: [] });
