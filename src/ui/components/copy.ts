// Every line of popup copy that isn't generated from src/core, in one place.
// Level names come from LEVELS and recipes from recipeText() — never retyped here.
import { LEVELS, MASCOT_STAGES, type Derived, type Level } from '@/src/core';

/** v1's per-level taunts, verbatim from go-comment-v1/popup.js. L0 had no tagline; its v1 "description" carries over. */
export const TAGLINES: Record<Level, string> = {
  0: 'What are you waiting for?',
  1: "That's it, you can do this",
  2: "Look Jack, I'm flying",
  3: 'The keyboard is on fire',
  4: 'Spread your wisdom',
  5: 'Bow down before me',
};

export const PRIZES_LINE = 'Points mean prizes! (disclaimer: there are no prizes)';
export const CHOOSE_LINE = 'Choose your commitment level and start building your streak:';
export const BEGIN_LABEL = 'Begin Challenge';
export const CAPPED_LINE = 'LinkedIn Lunatic detected. Points paused. Touch grass.';
export const NUDGE_TITLE = 'Nothing yet today.';
export const NUDGE_BODY = 'The streak ends at midnight — or a freeze gets spent.';
export const MOULT_TITLE = 'Your parrot has moulted.';
export const MOULT_BODY = 'It happens.';

/** Mascot stage → the level whose target unlocks it. Egg and Hatchling need no target, so they wear L0's slate. */
export const STAGE_TIER: readonly Level[] = [0, 0, 1, 2, 3, 4, 5];

export function tierVar(level: Level): string {
  return `var(--color-tier-${level})`;
}

export function stageTier(stage: number): Level {
  return STAGE_TIER[stage] ?? 0;
}

export function stageName(stage: number): string {
  return MASCOT_STAGES[stage] ?? MASCOT_STAGES[0];
}

/** Weekly points a stage needs. Stage 0 and 1 need none. */
export function stageTarget(stage: number): number {
  if (stage < 2) return 0;
  return LEVELS[Math.min(stage, 6) - 1]?.target ?? 0;
}

/** "Stage 4 · Loudmouth at 160" — what the next stage costs. */
export function stageLine(stage: number): string {
  if (stage >= 6) return 'Stage 6 · top of the tree';
  if (stage === 0) return `Stage 0 · ${stageName(1)} on the first action`;
  return `Stage ${stage} · ${stageName(stage + 1)} at ${stageTarget(stage + 1)}`;
}

/** The one-line note under the stage name. `moultedFrom` is the stage the parrot just dropped from, if any. */
export function stageNote(d: Derived, moultedFrom?: number): string {
  const s = d.mascotStage;
  if (moultedFrom !== undefined && moultedFrom > s) {
    return `Last week: ${d.lastWeekPoints}. Hit ${stageTarget(moultedFrom)} this week and ${stageName(moultedFrom)} comes back.`;
  }
  if (s === 0) return 'Nothing counted for two weeks. One action hatches it.';
  if (s === 1) return `Alive on activity alone. Hit ${stageTarget(2)} this week to fledge.`;
  const need = stageTarget(s);
  if (d.weekPoints >= need) {
    if (s >= 6) return 'Earned this week. There is nothing above this.';
    return `Earned this week. ${stageTarget(s + 1) - d.weekPoints} more for ${stageName(s + 1)}.`;
  }
  return `Held by last week's ${d.lastWeekPoints}. Finish this week under ${need} and it moults on Monday.`;
}
