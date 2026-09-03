import { describe, expect, it } from 'vitest';
import { BADGES, newBadges, type BadgeContext } from './badges';
import type { Counts, WeekSummary } from './types';
import { zeroCounts } from './types';

const ctx = (p: Partial<BadgeContext> & { counts?: Partial<Counts> } = {}): BadgeContext => ({
  lifetime: { ...zeroCounts(), ...p.counts },
  longestStreak: p.longestStreak ?? 0,
  weeks: p.weeks ?? [],
  target: p.target ?? 25,
  backFromTheDead: p.backFromTheDead ?? false,
});
const week = (p: Partial<WeekSummary>): WeekSummary => ({ start: '2026-08-31', points: 0, targetHit: false, shownUpDays: 0, frozenDays: 0, missedDays: 0, ...p });

describe('badges', () => {
  it('are twelve, with unique ids', () => {
    expect(BADGES).toHaveLength(12);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(12);
  });

  it('nothing is earned from nothing', () => {
    expect(newBadges(ctx(), {})).toEqual([]);
  });

  it('First Word on the first counted action', () => {
    expect(newBadges(ctx({ counts: { n: 1 } }), {})).toEqual(['first-word']);
  });

  it('streak badges at 5 / 10 / 60 / 100', () => {
    expect(newBadges(ctx({ counts: { c: 1 }, longestStreak: 5 }), { 'first-word': 1 })).toEqual(['five-alive']);
    expect(newBadges(ctx({ counts: { c: 1 }, longestStreak: 100 }), { 'first-word': 1 })).toEqual([
      'five-alive', 'fortnight', 'quarter-parrot', 'centurion',
    ]);
  });

  it('Full House needs the target AND all five weekdays', () => {
    const held = { 'first-word': 1 };
    expect(newBadges(ctx({ counts: { c: 1 }, weeks: [week({ targetHit: true, shownUpDays: 5 })] }), held)).toEqual(['full-house']);
    expect(newBadges(ctx({ counts: { c: 1 }, weeks: [week({ targetHit: true, shownUpDays: 4, frozenDays: 1 })] }), held)).toEqual([]);
  });

  it('Overachiever is double the target; neither week badge exists at level 0', () => {
    const held = { 'first-word': 1 };
    expect(newBadges(ctx({ counts: { c: 1 }, weeks: [week({ points: 50, targetHit: true })] }), held)).toEqual(['overachiever']);
    expect(newBadges(ctx({ counts: { c: 1 }, target: 0, weeks: [week({ points: 500, targetHit: true, shownUpDays: 5 })] }), held)).toEqual([]);
  });

  it('lifetime badges count what they say', () => {
    const held = { 'first-word': 1 };
    expect(newBadges(ctx({ counts: { c: 600, r: 400 } }), held)).toEqual(['thousand-words']);
    expect(newBadges(ctx({ counts: { p: 50 } }), held)).toEqual(['broadcaster']);
    expect(newBadges(ctx({ counts: { n: 100 } }), held)).toEqual(['networker']);
    expect(newBadges(ctx({ counts: { m: 100 } }), held)).toEqual(['opener']);
  });

  it('Back From The Dead comes from the fold', () => {
    expect(newBadges(ctx({ counts: { c: 1 }, backFromTheDead: true }), { 'first-word': 1 })).toEqual(['back-from-the-dead']);
  });

  it('never reports a badge already held, and never revokes', () => {
    const held = { 'first-word': 1, 'five-alive': 2, centurion: 3 };
    expect(newBadges(ctx({ counts: { c: 1 }, longestStreak: 5 }), held)).toEqual([]);
  });
});
