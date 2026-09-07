// The moult card. The mascot stage is the best of this week and last, so it
// only ever drops on a Monday, when a good week falls out of that window —
// and `Derived` alone can't tell a drop from a plateau (it has no
// week-before-last). The popup remembers the last stage it showed, in its own
// localStorage: one small number and a week key, never exported, never a count
// of anything. If `Derived` ever grows a `lastMascotStage`, delete this file.
import { addDays, type DateKey, type Derived } from '@/src/core';

export const STAGE_SEEN_KEY = 'gc.stageSeen';

export interface StageSeen {
  stage: number;
  /** Monday of the week the stage was seen */
  week: DateKey;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readStageSeen(): StageSeen | undefined {
  try {
    const raw = storage()?.getItem(STAGE_SEEN_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { stage, week } = parsed as Partial<StageSeen>;
    if (typeof stage !== 'number' || typeof week !== 'string') return undefined;
    return { stage, week };
  } catch {
    return undefined;
  }
}

export function writeStageSeen(seen: StageSeen): void {
  try {
    storage()?.setItem(STAGE_SEEN_KEY, JSON.stringify(seen));
  } catch {
    // a popup without storage just never shows the moult card
  }
}

/** True when the remembered peak is recent enough to still be "the parrot you had": this week or last. */
function recent(seen: StageSeen, d: Derived): boolean {
  return seen.week >= addDays(d.weekStart, -7);
}

/** The stage the parrot dropped from, if it has moulted since the popup last saw it at its peak. */
export function moultedFrom(seen: StageSeen | undefined, d: Derived): number | undefined {
  if (!seen || seen.stage <= d.mascotStage || !recent(seen, d)) return undefined;
  return seen.stage;
}

/** What to remember after this render: the current stage unless a recent, higher peak is still worth mourning. */
export function nextStageSeen(seen: StageSeen | undefined, d: Derived): StageSeen {
  if (moultedFrom(seen, d) !== undefined) return seen!;
  return { stage: d.mascotStage, week: d.weekStart };
}
