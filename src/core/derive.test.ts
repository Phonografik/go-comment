import { describe, expect, it } from 'vitest';
import { toDateKey } from './calendar';
import { derive } from './derive';
import type { ActivityEvent, Counts, EventType } from './types';
import { zeroCounts } from './types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const ev = (t: EventType, when: Date): ActivityEvent => ({ t, ts: when.getTime(), d: toDateKey(when) });
const many = (t: EventType, when: Date, n: number) => Array.from({ length: n }, () => ev(t, when));
const c = (p: Partial<Counts>): Counts => ({ ...zeroCounts(), ...p });
const settings = { level: 1 as const, memberSince: at(2026, 1, 5).getTime() };

describe('derive', () => {
  it('streaks across the spring clock change', () => {
    const events = [
      ev('c', at(2026, 3, 27)), // Fri, GMT
      ev('c', at(2026, 3, 30, 0)), // Mon 00:30 local, first hours of BST
      ev('c', at(2026, 3, 31)), // Tue
    ];
    events[1]!.ts = new Date(2026, 2, 30, 0, 30).getTime();
    const d = derive({ days: {}, events, settings, badges: {}, now: at(2026, 3, 31) });
    expect(d.streak).toBe(3);
    expect(d.weekStart).toBe('2026-03-30');
    expect(d.weekPoints).toBe(2);
  });

  it('trusts the day key stamped at event time, not the timestamp — travel cannot move an event', () => {
    // Recorded at 00:30 in Athens on 3 Sep, which is 22:30 on 2 Sep in London.
    const abroad: ActivityEvent = { t: 'c', ts: Date.UTC(2026, 8, 2, 21, 30), d: '2026-09-03' };
    const d = derive({ days: {}, events: [abroad], settings, badges: {}, now: at(2026, 9, 3) });
    expect(d.todayCounts.c).toBe(1);
    expect(d.shownUpToday).toBe(true);
  });

  it('lays out the week Monday..Sunday with today and the future marked', () => {
    const d = derive({ days: {}, events: [ev('p', at(2026, 9, 2))], settings, badges: {}, now: at(2026, 9, 3) });
    expect(d.weekDays.map((x) => x.d)).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
    ]);
    expect(d.weekDays.map((x) => x.today)).toEqual([false, false, false, true, false, false, false]);
    expect(d.weekDays.map((x) => x.future)).toEqual([false, false, false, false, true, true, true]);
    expect(d.weekDays.map((x) => x.weekday)).toEqual([true, true, true, true, true, false, false]);
    expect(d.weekDays[2]).toMatchObject({ points: 8, shownUp: true, frozen: false });
    expect(d.weekCounts).toEqual(c({ p: 1 }));
    expect(d.atRisk).toBe(true);
  });

  it('records capped events but scores them 0', () => {
    const d = derive({ days: {}, events: many('c', at(2026, 9, 3), 16), settings, badges: {}, now: at(2026, 9, 3) });
    expect(d.todayCounts.c).toBe(16);
    expect(d.todayPoints).toBe(15);
    expect(d.capped).toEqual(['c']);
    expect(d.lifetime.c).toBe(16);
  });

  it('adds v1 totals to lifetime and the carry to the import week only', () => {
    const legacy = { c: 300, n: 40, p: 12, bestWeek: 90, weeklyStreak: 4, longestWeeklyStreak: 6, weekCarry: 20, importedAt: at(2026, 9, 2, 10).getTime() };
    const events = [ev('c', at(2026, 9, 2)), ev('c', at(2026, 9, 3))];
    const thisWeek = derive({ days: {}, events, legacy, settings, badges: {}, now: at(2026, 9, 3) });
    expect(thisWeek.lifetime).toEqual(c({ c: 302, n: 40, p: 12 }));
    expect(thisWeek.weekPoints).toBe(22);
    expect(thisWeek.bestWeekPoints).toBe(90);
    const nextWeek = derive({ days: {}, events, legacy, settings, badges: {}, now: at(2026, 9, 8) });
    expect(nextWeek.weekPoints).toBe(0);
    expect(nextWeek.lastWeekPoints).toBe(22);
  });

  it('reports only NEW badges', () => {
    const fresh = derive({ days: {}, events: [ev('n', at(2026, 9, 3))], settings, badges: {}, now: at(2026, 9, 3) });
    expect(fresh.newBadges).toEqual(['first-word']);
    const held = derive({ days: {}, events: [ev('n', at(2026, 9, 3))], settings, badges: { 'first-word': 1 }, now: at(2026, 9, 3) });
    expect(held.newBadges).toEqual([]);
  });

  it('merges the rollup with the live log and grows the parrot', () => {
    const d = derive({
      days: { '2026-08-31': c({ p: 2, m: 3 }) }, // Monday of this week, compacted: 28 points
      events: [ev('c', at(2026, 9, 3))],
      settings,
      badges: {},
      now: at(2026, 9, 3),
    });
    expect(d.weekPoints).toBe(29);
    expect(d.mascotStage).toBe(2);
    expect(d.activeDays).toBe(2);
  });

  it('never mutates its inputs', () => {
    const input = { days: { '2026-09-01': c({ c: 1 }) }, events: [ev('p', at(2026, 9, 2))], settings, badges: {}, now: at(2026, 9, 3) };
    const snapshot = JSON.stringify(input);
    derive(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
