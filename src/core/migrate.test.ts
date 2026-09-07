import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/v1-storage.json';
import { derive } from './derive';
import { isV1Storage, migrateV1, V1_ACHIEVEMENTS, V1_DROPPED_KEYS, V1_KEYS, V1_LEVELS } from './migrate';
import type { Counts } from './types';
import { zeroCounts } from './types';

// Monday 7 Sep 2026, 15:30 BST — the kind of moment the store update lands.
const NOW = new Date(2026, 8, 7, 15, 30);
const NOON = new Date(2026, 8, 7, 12).getTime();
const c = (p: Partial<Counts>): Counts => ({ ...zeroCounts(), ...p });
const raw = () => JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;

/** v1's `initializeStorage()` defaults — a user who installed and never picked a level. */
const V1_DEFAULTS: Record<string, unknown> = {
  selectedLevel: null,
  weeklyTarget: 0,
  todayStats: { comments: 0, connections: 0, posts: 0 },
  totalStats: { comments: 0, connections: 0, posts: 0 },
  currentWeekPoints: 0,
  weekStartDate: '2026-09-06',
  weeklyStats: { comments: 0, connections: 0, posts: 0 },
  currentStreak: 0,
  longestStreak: 0,
  bestWeek: 0,
  memberSince: null,
  lastWeekGoalMet: false,
  totalWeeksCompleted: 0,
  lastActiveWeek: '2026-09-06',
  achievements: [],
  weeklyHistory: [],
};

describe('the v1 key list', () => {
  it('names all sixteen keys v1 initialised, and every dropped key is one of them', () => {
    expect(V1_KEYS).toHaveLength(16);
    expect(new Set(V1_KEYS).size).toBe(16);
    expect(Object.keys(V1_DEFAULTS).sort()).toEqual([...V1_KEYS].sort());
    for (const k of V1_DROPPED_KEYS) expect(V1_KEYS).toContain(k);
  });

  it('maps the six v1 level slugs onto 0–5 in ladder order', () => {
    expect(V1_LEVELS).toEqual({
      'no-comment': 0,
      'go-comment': 1,
      'go-go-go': 2,
      'this-dial-goes-to-11': 3,
      'leader-of-thoughts': 4,
      'linkedin-lunatic': 5,
    });
  });
});

describe('isV1Storage', () => {
  it('is false for an empty store', () => {
    expect(isV1Storage({})).toBe(false);
  });

  it('is false once a schemaVersion exists, even with a stray v1 key beside it', () => {
    expect(isV1Storage({ schemaVersion: 2, events: [] })).toBe(false);
    expect(isV1Storage({ schemaVersion: 2, totalStats: { comments: 1 } })).toBe(false);
  });

  it('is true for the fixture, for v1 defaults, and for a single v1 key', () => {
    expect(isV1Storage(raw())).toBe(true);
    expect(isV1Storage(V1_DEFAULTS)).toBe(true);
    expect(isV1Storage({ selectedLevel: null })).toBe(true);
  });

  it('is false for things that are not objects', () => {
    expect(isV1Storage(null as unknown as Record<string, unknown>)).toBe(false);
    expect(isV1Storage([] as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('migrateV1 against the fixture', () => {
  it('maps every field', () => {
    const out = migrateV1(raw(), NOW)!;
    expect(out).toEqual({
      settings: { level: 2, memberSince: Date.parse('2025-05-19T08:03:27.412Z') },
      events: [
        ...Array.from({ length: 4 }, () => ({ t: 'c', ts: NOON, d: '2026-09-07' })),
        ...Array.from({ length: 2 }, () => ({ t: 'n', ts: NOON, d: '2026-09-07' })),
        { t: 'p', ts: NOON, d: '2026-09-07' },
      ],
      legacy: {
        // totals minus today, because today became events
        c: 308,
        n: 45,
        p: 18,
        bestWeek: 92,
        weeklyStreak: 3,
        longestWeeklyStreak: 4,
        // 37 this week minus today's 4×1 + 2×2 + 1×8 = 16 at v1 weights
        weekCarry: 21,
        importedAt: NOW.getTime(),
      },
      badges: { 'first-word': NOW.getTime(), overachiever: NOW.getTime() },
      dropped: ['weeklyTarget', 'weeklyStats', 'weekStartDate', 'weeklyHistory', 'lastWeekGoalMet', 'totalWeeksCompleted', 'lastActiveWeek'],
    });
  });

  it('derives to v1 numbers: lifetime equals the v1 totals, today is shown up, the week keeps its points', () => {
    const out = migrateV1(raw(), NOW)!;
    const d = derive({ days: {}, events: out.events, legacy: out.legacy, settings: out.settings, badges: out.badges, now: NOW });
    expect(d.lifetime).toEqual(c({ c: 312, n: 47, p: 19 }));
    expect(d.shownUpToday).toBe(true);
    expect(d.streak).toBe(1);
    expect(d.todayCounts).toEqual(c({ c: 4, n: 2, p: 1 }));
    expect(d.todayPoints).toBe(16);
    // carry 21 + today's 16 = v1's currentWeekPoints, in the week of importedAt
    expect(d.weekStart).toBe('2026-09-07');
    expect(d.weekPoints).toBe(37);
    expect(d.bestWeekPoints).toBe(92);
    expect(d.level).toBe(2);
    expect(d.weekTarget).toBe(50);
    // first-word and overachiever are already held, nothing else is earned yet
    expect(d.newBadges).toEqual([]);
  });

  it('the carry counts toward the migration week only', () => {
    const out = migrateV1(raw(), NOW)!;
    const nextWeek = new Date(2026, 8, 14, 9);
    const d = derive({ days: {}, events: out.events, legacy: out.legacy, settings: out.settings, badges: out.badges, now: nextWeek });
    expect(d.weekPoints).toBe(0);
    expect(d.lastWeekPoints).toBe(37);
    expect(d.lifetime).toEqual(c({ c: 312, n: 47, p: 19 }));
  });

  it('never mutates its input', () => {
    const input = raw();
    const snapshot = JSON.stringify(input);
    migrateV1(input, NOW);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('migrateV1 edge cases', () => {
  it('returns null for an empty store and for v2 data', () => {
    expect(migrateV1({}, NOW)).toBeNull();
    expect(migrateV1({ schemaVersion: 2, events: [] }, NOW)).toBeNull();
  });

  it('v1 defaults (nulls everywhere): level 0, memberSince = now, no events, nothing carried', () => {
    const out = migrateV1(V1_DEFAULTS, NOW)!;
    expect(out.settings).toEqual({ level: 0, memberSince: NOW.getTime() });
    expect(out.events).toEqual([]);
    expect(out.legacy).toEqual({ c: 0, n: 0, p: 0, bestWeek: 0, weeklyStreak: 0, longestWeeklyStreak: 0, weekCarry: 0, importedAt: NOW.getTime() });
    expect(out.badges).toEqual({});
    expect(out.dropped).toEqual([...V1_DROPPED_KEYS]);
    const d = derive({ days: {}, events: out.events, legacy: out.legacy, settings: out.settings, badges: out.badges, now: NOW });
    expect(d.shownUpToday).toBe(false);
    expect(d.lifetime).toEqual(zeroCounts());
    expect(d.weekPoints).toBe(0);
  });

  it('an unknown or non-string level is 0', () => {
    expect(migrateV1({ selectedLevel: 'linkedin-legend' }, NOW)!.settings.level).toBe(0);
    expect(migrateV1({ selectedLevel: 3 }, NOW)!.settings.level).toBe(0);
    expect(migrateV1({ selectedLevel: 'linkedin-lunatic' }, NOW)!.settings.level).toBe(5);
  });

  it('memberSince: ISO string parsed, epoch number kept, garbage → now', () => {
    expect(migrateV1({ memberSince: '2025-08-01T10:00:00.000Z' }, NOW)!.settings.memberSince).toBe(Date.parse('2025-08-01T10:00:00.000Z'));
    expect(migrateV1({ memberSince: 1_700_000_000_000 }, NOW)!.settings.memberSince).toBe(1_700_000_000_000);
    expect(migrateV1({ memberSince: 'yesterday-ish' }, NOW)!.settings.memberSince).toBe(NOW.getTime());
    expect(migrateV1({ memberSince: null }, NOW)!.settings.memberSince).toBe(NOW.getTime());
  });

  it('maps overachiever and first-week, drops the two weekly-streak achievements', () => {
    const all = migrateV1({ achievements: ['first-week', 'streak-master', 'overachiever', 'consistency-king'] }, NOW)!;
    expect(all.badges).toEqual({ 'first-word': NOW.getTime(), overachiever: NOW.getTime() });
    expect(Object.keys(V1_ACHIEVEMENTS).sort()).toEqual(['first-week', 'overachiever']);
    expect(migrateV1({ achievements: ['streak-master', 'consistency-king'] }, NOW)!.badges).toEqual({});
    expect(migrateV1({ achievements: ['overachiever', 42, null, 'nonsense'] }, NOW)!.badges).toEqual({ overachiever: NOW.getTime() });
    expect(migrateV1({ achievements: 'overachiever' }, NOW)!.badges).toEqual({});
  });

  it('`dropped` lists exactly the dropped keys that are present', () => {
    expect(migrateV1({ selectedLevel: 'go-comment', weeklyHistory: [], bestWeek: 10 }, NOW)!.dropped).toEqual(['weeklyHistory']);
    expect(migrateV1({ selectedLevel: 'go-comment' }, NOW)!.dropped).toEqual([]);
    expect(migrateV1({ weekStartDate: undefined, weeklyTarget: 25 }, NOW)!.dropped).toEqual(['weeklyTarget', 'weekStartDate']);
  });

  it('a week carry never goes negative, and today never exceeds the lifetime carry', () => {
    const out = migrateV1(
      { todayStats: { comments: 10, connections: 0, posts: 1 }, totalStats: { comments: 5, connections: 0, posts: 0 }, currentWeekPoints: 3 },
      NOW,
    )!;
    expect(out.legacy.weekCarry).toBe(0);
    expect(out.legacy).toMatchObject({ c: 0, n: 0, p: 0 });
    expect(out.events).toHaveLength(11);
  });

  it('longestWeeklyStreak is at least the current weekly streak', () => {
    expect(migrateV1({ currentStreak: 6, longestStreak: 2 }, NOW)!.legacy).toMatchObject({ weeklyStreak: 6, longestWeeklyStreak: 6 });
  });

  it('survives garbage in every field without throwing', () => {
    const garbage: Record<string, unknown> = {
      selectedLevel: { nope: true },
      todayStats: 'four',
      totalStats: { comments: -3, connections: 'lots', posts: Number.NaN },
      currentWeekPoints: Number.POSITIVE_INFINITY,
      currentStreak: -1,
      longestStreak: '7',
      bestWeek: null,
      memberSince: {},
      achievements: { overachiever: true },
      weeklyHistory: 'none',
    };
    const out = migrateV1(garbage, NOW)!;
    expect(out.settings).toEqual({ level: 0, memberSince: NOW.getTime() });
    expect(out.events).toEqual([]);
    expect(out.legacy).toEqual({ c: 0, n: 0, p: 0, bestWeek: 0, weeklyStreak: 0, longestWeeklyStreak: 0, weekCarry: 0, importedAt: NOW.getTime() });
    expect(out.badges).toEqual({});
    expect(out.dropped).toEqual(['weeklyHistory']);
  });

  it('caps a runaway today counter so the event log cannot explode', () => {
    const out = migrateV1({ todayStats: { comments: 1e9, connections: 0, posts: 0 }, totalStats: { comments: 1e9, connections: 0, posts: 0 } }, NOW)!;
    expect(out.events).toHaveLength(10_000);
    // lifetime is still the v1 total: carry + events
    expect(out.legacy.c + out.events.length).toBe(1e9);
  });

  it('fractional counts are floored', () => {
    const out = migrateV1({ todayStats: { comments: 2.9, connections: 0, posts: 0 }, currentWeekPoints: 7.5 }, NOW)!;
    expect(out.events).toHaveLength(2);
    expect(out.legacy.weekCarry).toBe(5); // 7 − 2
  });
});

describe('the synthetic today is 12:00 LOCAL, stamped with today’s day key', () => {
  it('asserts the test clock is Europe/London so DST is real', () => {
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });

  it('on a BST day noon is 11:00 UTC', () => {
    const now = new Date(2026, 6, 15, 8, 5); // Wed 15 Jul 2026, BST
    const [ev] = migrateV1({ todayStats: { comments: 1, connections: 0, posts: 0 } }, now)!.events;
    expect(ev).toEqual({ t: 'c', ts: new Date(2026, 6, 15, 12).getTime(), d: '2026-07-15' });
    expect(new Date(ev!.ts).getHours()).toBe(12);
    expect(ev!.ts).toBe(Date.UTC(2026, 6, 15, 11));
  });

  it('on a GMT day noon is 12:00 UTC', () => {
    const now = new Date(2026, 0, 15, 23, 59); // Thu 15 Jan 2026, GMT, one minute to midnight
    const [ev] = migrateV1({ todayStats: { comments: 0, connections: 1, posts: 0 } }, now)!.events;
    expect(ev).toEqual({ t: 'n', ts: Date.UTC(2026, 0, 15, 12), d: '2026-01-15' });
  });

  it('on the day the clocks go forward the event still lands on that day at 12:00', () => {
    const now = new Date(2026, 2, 29, 0, 30); // Sun 29 Mar 2026, before the 01:00 → 02:00 jump
    const [ev] = migrateV1({ todayStats: { comments: 0, connections: 0, posts: 1 } }, now)!.events;
    expect(ev!.d).toBe('2026-03-29');
    expect(new Date(ev!.ts).getHours()).toBe(12);
    expect(new Date(ev!.ts).getDate()).toBe(29);
    expect(ev!.ts).toBe(Date.UTC(2026, 2, 29, 11)); // already BST by noon
  });

  it('on the day the clocks go back the event still lands on that day at 12:00', () => {
    const now = new Date(2026, 9, 25, 23, 0); // Sun 25 Oct 2026, after the 02:00 → 01:00 fall-back
    const [ev] = migrateV1({ todayStats: { comments: 1, connections: 0, posts: 0 } }, now)!.events;
    expect(ev!.d).toBe('2026-10-25');
    expect(new Date(ev!.ts).getHours()).toBe(12);
    expect(ev!.ts).toBe(Date.UTC(2026, 9, 25, 12)); // GMT again by noon
  });
});
