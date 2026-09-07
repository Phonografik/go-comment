// The toolbar badge is the whole nudge: the streak as text, and a colour that
// says whether today is safe. No notifications permission needed.
//
//   green — shown up today
//   amber — a weekday, nothing yet, a streak to lose, and it's 18:00 or later
//           (the evening alarm is what flips it; the badge never polls)
//   grey  — weekends, level 0, or a weekday morning that hasn't started yet
import { browser } from 'wxt/browser';
import { isWeekday } from '../core/calendar';
import type { Derived } from '../core/types';

export const EVENING_HOUR = 18;

export type BadgeColour = 'green' | 'amber' | 'grey';

export const BADGE_COLOURS: Record<BadgeColour, string> = {
  green: '#22a06b',
  amber: '#f0c000',
  grey: '#6b7280',
};

export interface BadgeState {
  /** the streak, or '' when there is none */
  text: string;
  colour: BadgeColour;
}

/** Pure: what the badge should show for this derived state at this moment. */
export function badgeState(derived: Derived | null, now: Date): BadgeState {
  if (!derived) return { text: '', colour: 'grey' };
  const text = derived.streak > 0 ? String(derived.streak) : '';
  if (derived.level === 0 || !isWeekday(derived.today)) return { text, colour: 'grey' };
  if (derived.shownUpToday) return { text, colour: 'green' };
  if (derived.atRisk && now.getHours() >= EVENING_HOUR) return { text, colour: 'amber' };
  return { text, colour: 'grey' };
}

/** Firefox MV2 has no `action`; it calls the same API `browserAction`. */
function actionApi() {
  const b = browser as { action?: typeof browser.action; browserAction?: typeof browser.browserAction };
  return b.action ?? b.browserAction;
}

export async function applyBadge(state: BadgeState): Promise<void> {
  const action = actionApi();
  if (!action) return;
  await action.setBadgeText({ text: state.text });
  await action.setBadgeBackgroundColor({ color: BADGE_COLOURS[state.colour] });
}
