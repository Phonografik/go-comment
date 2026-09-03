// The daily streak — the core loop. "Did you show up today?"
//
// Rules (context/project-overview.md § Game):
// - A weekday is "shown up" with ≥1 event of ANY type. Deliberately low: the
//   streak is the habit, points are the volume.
// - Monday–Friday only. Weekends never break it and never extend it (weekend
//   points still count toward the week).
// - Today is neutral until it ends: an empty weekday is "at risk", not broken.
// - Freezes: hitting the weekly target earns one (once per week); bank cap 2;
//   auto-applied to the first missed weekday. A frozen day preserves the
//   streak but does not extend it. No purchase, no manual placement.
// - Level 0 (target 0) earns no freezes — streak and level are independent.
//
// The whole thing is one chronological fold over calendar days from the first
// active day to today. Nothing is incremented in place anywhere else; a rules
// bug is fixed by shipping the fix and re-running this.
import { addDays, daysBetween, isWeekday, weekStart } from './calendar';
import { dayPoints, totalOf } from './stats';
import type { Counts, DateKey, WeekSummary } from './types';

export interface StreakInput {
  /** per-day counts — only days with activity need be present */
  dayCounts: Map<DateKey, Counts>;
  today: DateKey;
  /** weekly points target; 0 = no target, no freezes */
  target: number;
  /** points credited to one specific week only (the v1 migration week) */
  carry?: { week: DateKey; points: number };
}

export interface StreakResult {
  streak: number;
  longestStreak: number;
  shownUpToday: boolean;
  atRisk: boolean;
  freezes: number;
  frozenDays: Set<DateKey>;
  /** every week touched by the fold, keyed by Monday */
  weeks: Map<DateKey, WeekSummary>;
  /** an active day that followed 14+ silent calendar days */
  backFromTheDead: boolean;
  activeDays: number;
}

const FREEZE_BANK_CAP = 2;

export function foldStreak(input: StreakInput): StreakResult {
  const { dayCounts, today, target, carry } = input;
  const weeks = new Map<DateKey, WeekSummary>();
  const frozenDays = new Set<DateKey>();
  let streak = 0;
  let longest = 0;
  let bank = 0;
  let backFromTheDead = false;
  let activeDays = 0;
  let lastActive: DateKey | undefined;
  let carryApplied = false;

  const week = (d: DateKey): WeekSummary => {
    const start = weekStart(d);
    let w = weeks.get(start);
    if (!w) {
      w = { start, points: 0, targetHit: false, shownUpDays: 0, frozenDays: 0, missedDays: 0 };
      if (carry && carry.week === start && !carryApplied) {
        w.points += carry.points;
        carryApplied = true;
      }
      weeks.set(start, w);
    }
    return w;
  };

  const activeKeys = [...dayCounts.keys()].filter((d) => totalOf(dayCounts.get(d)!) > 0).sort();
  const first = activeKeys[0];
  // A migration week with no v2 activity yet still has v1 points to show.
  if (carry) week(carry.week);
  const shownUpToday = (dayCounts.get(today) && totalOf(dayCounts.get(today)!) > 0) ?? false;

  if (first === undefined || first > today) {
    return { streak: 0, longestStreak: 0, shownUpToday: false, atRisk: false, freezes: 0, frozenDays, weeks, backFromTheDead: false, activeDays: 0 };
  }

  const settle = (w: WeekSummary) => {
    if (!w.targetHit && target > 0 && w.points >= target) {
      w.targetHit = true;
      bank = Math.min(FREEZE_BANK_CAP, bank + 1);
    }
  };

  // Every completed day, first active day → yesterday.
  for (let d = first; d < today; d = addDays(d, 1)) {
    const counts = dayCounts.get(d);
    const active = counts !== undefined && totalOf(counts) > 0;
    const w = week(d);
    if (active) {
      w.points += dayPoints(counts);
      activeDays++;
      if (lastActive !== undefined && daysBetween(lastActive, d) >= 15) backFromTheDead = true;
      lastActive = d;
    }
    if (isWeekday(d)) {
      if (active) {
        streak++;
        w.shownUpDays++;
      } else if (bank > 0) {
        bank--;
        frozenDays.add(d);
        w.frozenDays++;
      } else {
        streak = 0;
        w.missedDays++;
      }
    }
    settle(w);
    longest = Math.max(longest, streak);
  }

  // Today: counts if it happened, never penalised yet.
  const w = week(today);
  if (shownUpToday) {
    w.points += dayPoints(dayCounts.get(today)!);
    activeDays++;
    if (lastActive !== undefined && daysBetween(lastActive, today) >= 15) backFromTheDead = true;
    if (isWeekday(today)) {
      streak++;
      w.shownUpDays++;
    }
    settle(w);
    longest = Math.max(longest, streak);
  }

  const atRisk = isWeekday(today) && !shownUpToday && streak > 0;
  return { streak, longestStreak: longest, shownUpToday, atRisk, freezes: bank, frozenDays, weeks, backFromTheDead, activeDays };
}

