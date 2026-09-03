import { describe, expect, it } from 'vitest';
import { DAILY_CAPS, DAILY_CEILING, POINTS, cappedTypes, compact, dayPoints, mergeDayCounts } from './stats';
import type { ActivityEvent, Counts } from './types';
import { zeroCounts } from './types';

const counts = (p: Partial<Counts>): Counts => ({ ...zeroCounts(), ...p });

describe('the weighting', () => {
  it('is the reasoned table from the spec', () => {
    expect(POINTS).toEqual({ p: 8, m: 4, q: 3, n: 2, c: 1, r: 1 });
    expect(DAILY_CAPS).toEqual({ p: 2, m: 5, q: 1, n: 10, c: 15, r: 10 });
    expect(DAILY_CEILING).toBe(84);
  });

  it('scores a day', () => {
    expect(dayPoints(counts({ p: 1, m: 1, c: 1 }))).toBe(13);
    expect(dayPoints(zeroCounts())).toBe(0);
  });

  it('caps per type — capped events score 0 but are still counted', () => {
    expect(dayPoints(counts({ p: 3 }))).toBe(16);
    expect(dayPoints(counts({ c: 20 }))).toBe(15);
    expect(cappedTypes(counts({ c: 15 }))).toEqual(['c']);
    expect(cappedTypes(counts({ c: 14 }))).toEqual([]);
  });

  it('a maxed day scores exactly the ceiling', () => {
    expect(dayPoints(counts({ p: 9, m: 9, q: 9, n: 99, c: 99, r: 99 }))).toBe(84);
  });
});

describe('mergeDayCounts', () => {
  it('adds the rollup and the live log', () => {
    const merged = mergeDayCounts(
      { '2026-09-01': counts({ c: 2 }) },
      [
        { t: 'c', ts: 1, d: '2026-09-01' },
        { t: 'p', ts: 2, d: '2026-09-02' },
      ],
    );
    expect(merged.get('2026-09-01')).toEqual(counts({ c: 3 }));
    expect(merged.get('2026-09-02')).toEqual(counts({ p: 1 }));
    expect(merged.has('2026-09-03')).toBe(false);
  });
});

describe('compact', () => {
  const ev = (d: string, t: ActivityEvent['t'], n: number): ActivityEvent[] =>
    Array.from({ length: n }, (_, i) => ({ t, ts: i, d }));
  const log = [...ev('2026-09-01', 'c', 5), ...ev('2026-09-02', 'n', 4), ...ev('2026-09-03', 'p', 3)];

  it('returns the same objects when under the cap', () => {
    const days = {};
    const out = compact(log, days, 100);
    expect(out.events).toBe(log);
    expect(out.days).toBe(days);
  });

  it('folds the OLDEST whole days until the log fits', () => {
    const out = compact(log, { '2026-08-31': counts({ m: 1 }) }, 5);
    expect(out.events.map((e) => e.d)).toEqual(['2026-09-03', '2026-09-03', '2026-09-03']);
    expect(out.days).toEqual({
      '2026-08-31': counts({ m: 1 }),
      '2026-09-01': counts({ c: 5 }),
      '2026-09-02': counts({ n: 4 }),
    });
  });

  it('never loses a count and never mutates its inputs', () => {
    const days = { '2026-09-01': counts({ c: 1 }) };
    const snapshot = JSON.stringify({ log, days });
    const before = mergeDayCounts(days, log);
    const out = compact(log, days, 4);
    const after = mergeDayCounts(out.days, out.events);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    expect(JSON.stringify({ log, days })).toBe(snapshot);
  });
});
