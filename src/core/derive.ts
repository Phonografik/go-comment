// The one pure fold that turns stored facts into everything the popup shows.
// Runs after every append and on popup open; its output is only ever a cache.
import { addDays, isWeekday, toDateKey, weekDays, weekStart } from './calendar';
import { newBadges } from './badges';
import { targetFor } from './levels';
import { mascotStage } from './mascot';
import { addCounts, cappedTypes, dayPoints, mergeDayCounts, totalOf } from './stats';
import { foldStreak } from './streak';
import type { ActivityEvent, Badges, DayRollup, Derived, Legacy, Settings } from './types';
import { zeroCounts } from './types';

export interface DeriveInput {
  days: DayRollup;
  events: ActivityEvent[];
  legacy?: Legacy;
  settings: Settings;
  badges: Badges;
  now: Date;
}

export function derive({ days, events, legacy, settings, badges, now }: DeriveInput): Derived {
  const today = toDateKey(now);
  const ws = weekStart(today);
  const target = targetFor(settings.level);
  const dayCounts = mergeDayCounts(days, events);

  const carry =
    legacy && legacy.weekCarry > 0 ? { week: weekStart(toDateKey(new Date(legacy.importedAt))), points: legacy.weekCarry } : undefined;

  const fold = foldStreak({ dayCounts, today, target, carry });

  const thisWeek = fold.weeks.get(ws);
  const lastWeek = fold.weeks.get(addDays(ws, -7));
  const weekPoints = thisWeek?.points ?? 0;
  const lastWeekPoints = lastWeek?.points ?? 0;
  const bestWeekPoints = Math.max(legacy?.bestWeek ?? 0, ...[...fold.weeks.values()].map((w) => w.points));

  const weekCounts = weekDays(ws).reduce((acc, d) => addCounts(acc, dayCounts.get(d) ?? {}), zeroCounts());
  const weekView = weekDays(ws).map((d) => {
    const counts = dayCounts.get(d) ?? zeroCounts();
    return {
      d,
      counts,
      points: dayPoints(counts),
      shownUp: totalOf(counts) > 0,
      frozen: fold.frozenDays.has(d),
      weekday: isWeekday(d),
      today: d === today,
      future: d > today,
    };
  });

  const todayCounts = dayCounts.get(today) ?? zeroCounts();

  let lifetime = zeroCounts();
  for (const counts of dayCounts.values()) lifetime = addCounts(lifetime, counts);
  if (legacy) lifetime = addCounts(lifetime, { c: legacy.c, n: legacy.n, p: legacy.p });

  const activeRecently = weekDays(ws).some((d) => dayCounts.has(d)) || weekDays(addDays(ws, -7)).some((d) => dayCounts.has(d));

  return {
    today,
    weekStart: ws,
    level: settings.level,
    weekTarget: target,
    streak: fold.streak,
    longestStreak: fold.longestStreak,
    shownUpToday: fold.shownUpToday,
    atRisk: fold.atRisk,
    freezes: fold.freezes,
    weekPoints,
    lastWeekPoints,
    bestWeekPoints,
    weekCounts,
    weekDays: weekView,
    todayCounts,
    todayPoints: dayPoints(todayCounts),
    capped: cappedTypes(todayCounts),
    lifetime,
    activeDays: fold.activeDays,
    mascotStage: mascotStage(weekPoints, lastWeekPoints, activeRecently),
    newBadges: newBadges(
      { lifetime, longestStreak: fold.longestStreak, weeks: [...fold.weeks.values()], target, backFromTheDead: fold.backFromTheDead },
      badges,
    ),
  };
}
