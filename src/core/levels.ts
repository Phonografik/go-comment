// The weekly-target ladder. v1's six names carry over verbatim; every target
// is reachable Monday–Friday under the daily caps. The recipe under each
// target is DATA, and the prose the popup shows is generated from it — so the
// numbers a user reads can never drift from the numbers the maths uses.
// levels.test.ts asserts every recipe actually sums to (or just over) its target.
import { DAILY_CAPS, POINTS } from './stats';
import type { Counts, EventType, Level } from './types';
import { EVENT_LABELS, EVENT_TYPES } from './types';

export interface Recipe {
  /** actions done some number of times over the week */
  weekly?: Partial<Counts>;
  /** actions done every weekday (× 5) */
  daily?: Partial<Counts>;
}

export interface LevelDef {
  level: Level;
  name: string;
  target: number;
  recipe: Recipe;
  /** optional sign-off appended to the recipe text */
  tail?: string;
}

export const LEVELS: readonly LevelDef[] = [
  { level: 0, name: 'No Comment', target: 0, recipe: {} },
  { level: 1, name: 'Go Comment', target: 25, recipe: { daily: { m: 1, c: 1 } } },
  { level: 2, name: 'Go Go Go!', target: 50, recipe: { daily: { m: 1, n: 2, c: 2 } } },
  { level: 3, name: 'Turn Dial to 11', target: 111, recipe: { weekly: { p: 2 }, daily: { m: 2, n: 3, c: 5 } } },
  { level: 4, name: 'Leader of Thoughts', target: 160, recipe: { weekly: { p: 3 }, daily: { m: 3, n: 5, c: 6 } } },
  { level: 5, name: 'LinkedIn Lunatic', target: 250, recipe: { daily: { p: 1, m: 5, n: 8, c: 6 } }, tail: 'Good luck.' },
];

export function levelDef(level: Level): LevelDef {
  return LEVELS[level]!;
}

export function targetFor(level: Level): number {
  return levelDef(level).target;
}

export function recipePoints(recipe: Recipe): number {
  let pts = 0;
  for (const t of EVENT_TYPES) {
    pts += (recipe.weekly?.[t] ?? 0) * POINTS[t];
    pts += (recipe.daily?.[t] ?? 0) * 5 * POINTS[t];
  }
  return pts;
}

/** True when the recipe never asks for more of one action than a day allows. */
export function recipeFitsCaps(recipe: Recipe): boolean {
  return EVENT_TYPES.every((t) => {
    const perWeek = (recipe.weekly?.[t] ?? 0) + (recipe.daily?.[t] ?? 0) * 5;
    return (recipe.daily?.[t] ?? 0) <= DAILY_CAPS[t] && perWeek <= DAILY_CAPS[t] * 5;
  });
}

const label = (t: EventType, n: number) => `${n} ${n === 1 ? EVENT_LABELS[t].one : EVENT_LABELS[t].many}`;

const list = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** "2 posts a week, plus 2 DMs, 3 connections and 5 comments each weekday (that's 111)" */
export function recipeText(def: LevelDef): string {
  if (def.target === 0) return 'Streak only. No target, no parrot growth, no pressure.';
  const weekly = EVENT_TYPES.filter((t) => def.recipe.weekly?.[t]).map((t) => label(t, def.recipe.weekly![t]!));
  const daily = EVENT_TYPES.filter((t) => def.recipe.daily?.[t]).map((t) => label(t, def.recipe.daily![t]!));
  const bits: string[] = [];
  if (weekly.length) bits.push(`${list(weekly)} a week`);
  if (daily.length) bits.push(`${weekly.length ? 'plus ' : ''}${list(daily)} each weekday`);
  let text = bits.join(', ');
  const sum = recipePoints(def.recipe);
  if (sum !== def.target) text += ` (that's ${sum})`;
  if (def.tail) text += `. ${def.tail}`;
  return text;
}
