// The parrot. Stage = the highest level target hit THIS week or LAST week,
// regardless of the level the user picked — so it can moult back down. That
// is the joke. Seven sprites, 0 = egg.
import { LEVELS } from './levels';

export const MASCOT_STAGES = [
  'Egg',
  'Hatchling',
  'Fledgling',
  'Parrot',
  'Show-off',
  'Loudmouth',
  'Crowned Lunatic',
] as const;

export type MascotStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function mascotStage(thisWeekPoints: number, lastWeekPoints: number, activeRecently: boolean): MascotStage {
  const best = Math.max(thisWeekPoints, lastWeekPoints);
  for (let level = 5; level >= 1; level--) {
    if (best >= LEVELS[level]!.target) return (level + 1) as MascotStage;
  }
  return activeRecently || best > 0 ? 1 : 0;
}
