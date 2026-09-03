import { describe, expect, it } from 'vitest';
import { LEVELS, levelDef, recipeFitsCaps, recipePoints, recipeText, targetFor } from './levels';
import type { Level } from './types';

describe('the ladder', () => {
  it("keeps v1's six names and targets", () => {
    expect(LEVELS.map((l) => l.name)).toEqual([
      'No Comment', 'Go Comment', 'Go Go Go!', 'Turn Dial to 11', 'Leader of Thoughts', 'LinkedIn Lunatic',
    ]);
    expect(LEVELS.map((l) => l.target)).toEqual([0, 25, 50, 111, 160, 250]);
    expect(targetFor(3)).toBe(111);
  });

  it.each([1, 2, 3, 4, 5] as Level[])('level %i recipe sums to its target (at most 5 over)', (level) => {
    const def = levelDef(level);
    const sum = recipePoints(def.recipe);
    expect(sum).toBeGreaterThanOrEqual(def.target);
    expect(sum).toBeLessThanOrEqual(def.target + 5);
  });

  it.each([1, 2, 3, 4, 5] as Level[])('level %i recipe is reachable under the daily caps', (level) => {
    expect(recipeFitsCaps(levelDef(level).recipe)).toBe(true);
  });

  it('generates the recipe prose from the numbers, so they cannot drift', () => {
    expect(recipeText(levelDef(1))).toBe('1 comment and 1 DM each weekday');
    expect(recipeText(levelDef(2))).toBe('2 comments, 2 connections and 1 DM each weekday');
    expect(recipeText(levelDef(3))).toBe('2 posts a week, plus 5 comments, 3 connections and 2 DMs each weekday');
    expect(recipeText(levelDef(4))).toBe("3 posts a week, plus 6 comments, 5 connections and 3 DMs each weekday (that's 164)");
    expect(recipeText(levelDef(5))).toBe('6 comments, 1 post, 8 connections and 5 DMs each weekday. Good luck.');
    expect(recipeText(levelDef(0))).toMatch(/^Streak only/);
  });
});
