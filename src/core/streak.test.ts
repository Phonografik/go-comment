import { describe, expect, it } from 'vitest';
import { addDays, weekDays } from './calendar';
import { foldStreak } from './streak';
import type { Counts, DateKey } from './types';
import { zeroCounts } from './types';

const c = (p: Partial<Counts>): Counts => ({ ...zeroCounts(), ...p });
const ONE = c({ c: 1 });
/** 2 posts + 3 DMs = 28 points — over the level-1 target in a single day */
const HIT = c({ p: 2, m: 3 });
const days = (entries: Array<[DateKey, Counts]>) => new Map(entries);
const weekdaysOf = (monday: DateKey) => weekDays(monday).slice(0, 5);

// Calendar for these tests: Mon 2026-08-31 … Sun 2026-09-06, then Mon 2026-09-07.
const MON = '2026-08-31', TUE = '2026-09-01', WED = '2026-09-02', THU = '2026-09-03', FRI = '2026-09-04';
const SAT = '2026-09-05', MON2 = '2026-09-07', TUE2 = '2026-09-08';

describe('the daily streak', () => {
  it('counts consecutive weekdays, including today once something happened', () => {
    const r = foldStreak({ dayCounts: days([[MON, ONE], [TUE, ONE], [WED, ONE], [THU, ONE]]), today: THU, target: 25 });
    expect(r.streak).toBe(4);
    expect(r.longestStreak).toBe(4);
    expect(r.shownUpToday).toBe(true);
    expect(r.atRisk).toBe(false);
  });

  it('is neutral about today until it ends — an empty weekday is at risk, not broken', () => {
    const r = foldStreak({ dayCounts: days([[MON, ONE], [TUE, ONE], [WED, ONE]]), today: THU, target: 25 });
    expect(r.streak).toBe(3);
    expect(r.shownUpToday).toBe(false);
    expect(r.atRisk).toBe(true);
  });

  it('is never at risk on a weekend, or with nothing to lose', () => {
    expect(foldStreak({ dayCounts: days([[THU, ONE], [FRI, ONE]]), today: SAT, target: 25 }).atRisk).toBe(false);
    expect(foldStreak({ dayCounts: days([]), today: THU, target: 25 }).atRisk).toBe(false);
  });

  it('weekends neither break nor extend it, but weekend points count toward the week', () => {
    const quiet = foldStreak({ dayCounts: days([[THU, ONE], [FRI, ONE], [MON2, ONE]]), today: MON2, target: 25 });
    expect(quiet.streak).toBe(3);
    const busy = foldStreak({ dayCounts: days([[THU, ONE], [FRI, ONE], [SAT, c({ p: 1 })], [MON2, ONE]]), today: MON2, target: 25 });
    expect(busy.streak).toBe(3);
    expect(busy.weeks.get(MON)!.points).toBe(2 + 8);
  });

  it('resets on an unfrozen missed weekday and remembers the longest run', () => {
    const r = foldStreak({ dayCounts: days([[MON, ONE], [TUE, ONE], [WED, ONE], [FRI, ONE]]), today: FRI, target: 25 });
    expect(r.streak).toBe(1);
    expect(r.longestStreak).toBe(3);
    expect(r.weeks.get(MON)!.missedDays).toBe(1);
  });

  it('starts with nothing', () => {
    const r = foldStreak({ dayCounts: days([]), today: THU, target: 25 });
    expect(r).toMatchObject({ streak: 0, longestStreak: 0, freezes: 0, activeDays: 0, backFromTheDead: false });
    expect(r.weeks.size).toBe(0);
  });
});

describe('freezes', () => {
  it('hitting the weekly target earns one; it is auto-applied to the next missed weekday', () => {
    const r = foldStreak({ dayCounts: days([[MON, HIT], [WED, ONE], [THU, ONE]]), today: THU, target: 25 });
    expect(r.weeks.get(MON)!.targetHit).toBe(true);
    expect(r.frozenDays).toEqual(new Set([TUE]));
    expect(r.freezes).toBe(0);
    // Mon 1, Tue frozen (preserved, not extended), Wed 2, Thu 3
    expect(r.streak).toBe(3);
  });

  it('a frozen day preserves the streak but does not extend it', () => {
    const withFreeze = foldStreak({ dayCounts: days([[MON, HIT], [WED, ONE], [THU, ONE]]), today: THU, target: 25 }).streak;
    const noGap = foldStreak({ dayCounts: days([[MON, HIT], [TUE, ONE], [WED, ONE], [THU, ONE]]), today: THU, target: 25 }).streak;
    expect(withFreeze).toBe(3);
    expect(noGap).toBe(4);
  });

  it('earns at most one per week, however far over the target', () => {
    const r = foldStreak({ dayCounts: days([[MON, c({ p: 2, m: 5, n: 10 })], [THU, ONE]]), today: THU, target: 25 });
    expect(r.frozenDays).toEqual(new Set([TUE]));
    expect(r.streak).toBe(1); // Wed reset it
  });

  it('banks at most two', () => {
    // Three target-hitting weeks (Jul 13, Jul 20, Jul 27), then three misses.
    const entries: Array<[DateKey, Counts]> = [];
    for (const monday of ['2026-07-13', '2026-07-20', '2026-07-27']) {
      for (const d of weekdaysOf(monday)) entries.push([d, d === monday ? HIT : ONE]);
    }
    entries.push(['2026-08-06', ONE], ['2026-08-07', ONE]); // Thu, Fri after three empty weekdays
    const r = foldStreak({ dayCounts: days(entries), today: '2026-08-07', target: 25 });
    expect(r.frozenDays).toEqual(new Set(['2026-08-03', '2026-08-04']));
    expect(r.streak).toBe(2); // Wed 5 Aug broke it
    expect(r.longestStreak).toBe(15);
    expect(r.freezes).toBe(0);
  });

  it('carries across the weekend to protect Monday', () => {
    const r = foldStreak({
      dayCounts: days([[MON, ONE], [TUE, ONE], [WED, ONE], [THU, ONE], [FRI, HIT], [TUE2, ONE]]),
      today: TUE2,
      target: 25,
    });
    expect(r.frozenDays).toEqual(new Set([MON2]));
    expect(r.streak).toBe(6);
  });

  it('are never earned at level 0 — streak and level are independent', () => {
    const r = foldStreak({ dayCounts: days([[MON, HIT], [WED, ONE], [THU, ONE]]), today: THU, target: 0 });
    expect(r.frozenDays.size).toBe(0);
    expect(r.freezes).toBe(0);
    expect(r.streak).toBe(2);
    expect(r.weeks.get(MON)!.targetHit).toBe(false);
  });

  it('are reported as a bank when unused', () => {
    const r = foldStreak({ dayCounts: days([[MON, HIT], [TUE, ONE]]), today: TUE, target: 25 });
    expect(r.freezes).toBe(1);
  });
});

describe('the v1 carry', () => {
  it('credits one week only, and can earn that week its freeze', () => {
    const r = foldStreak({
      dayCounts: days([[MON, c({ c: 5 })], [THU, ONE]]),
      today: THU,
      target: 25,
      carry: { week: MON, points: 20 },
    });
    expect(r.weeks.get(MON)!.points).toBe(26); // 5 (Mon) + 20 (carry) + 1 (Thu)
    expect(r.frozenDays).toEqual(new Set([TUE])); // Monday alone reached 25 with the carry
    expect(r.weeks.get(MON2)).toBeUndefined();
  });

  it('shows up even when the migration week has no v2 activity yet', () => {
    const r = foldStreak({ dayCounts: days([]), today: THU, target: 25, carry: { week: MON, points: 20 } });
    expect(r.weeks.get(MON)!.points).toBe(20);
    expect(r.streak).toBe(0);
  });
});

describe('back from the dead', () => {
  it('flags the first active day after 14+ silent days', () => {
    const gap13 = foldStreak({ dayCounts: days([['2026-07-13', ONE], ['2026-07-27', ONE]]), today: '2026-07-27', target: 0 });
    const gap14 = foldStreak({ dayCounts: days([['2026-07-13', ONE], ['2026-07-28', ONE]]), today: '2026-07-28', target: 0 });
    expect(gap13.backFromTheDead).toBe(false);
    expect(gap14.backFromTheDead).toBe(true);
  });
});

describe('week summaries', () => {
  it('count shown-up, frozen and missed weekdays', () => {
    const r = foldStreak({ dayCounts: days([[MON, HIT], [WED, ONE], [FRI, ONE]]), today: addDays(FRI, 3), target: 25 });
    expect(r.weeks.get(MON)).toEqual({ start: MON, points: 30, targetHit: true, shownUpDays: 3, frozenDays: 1, missedDays: 1 });
  });
});
