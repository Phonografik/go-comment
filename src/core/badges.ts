// Twelve badges. Earned once, never revoked — the store keeps `badges`
// (id → unlockedAt) and derive() only ever reports NEW ones. Conditions are
// evaluated against the whole history, so a badge missed at the moment it
// was earned (a rules bug, a skipped derive) is still awarded next time.
import type { BadgeId, Badges, Counts, WeekSummary } from './types';

export interface BadgeContext {
  lifetime: Counts;
  longestStreak: number;
  weeks: WeekSummary[];
  target: number;
  backFromTheDead: boolean;
}

export interface BadgeDef {
  id: BadgeId;
  name: string;
  how: string;
  earned: (ctx: BadgeContext) => boolean;
}

const total = (c: Counts) => c.c + c.r + c.p + c.q + c.n + c.m;

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-word', name: 'First Word', how: 'Your first counted action.', earned: (x) => total(x.lifetime) >= 1 },
  { id: 'five-alive', name: 'Five Alive', how: 'A 5-day streak.', earned: (x) => x.longestStreak >= 5 },
  { id: 'fortnight', name: 'Fortnight', how: 'A 10-day streak.', earned: (x) => x.longestStreak >= 10 },
  { id: 'quarter-parrot', name: 'Quarter Parrot', how: 'A 60-day streak.', earned: (x) => x.longestStreak >= 60 },
  { id: 'centurion', name: 'Centurion', how: 'A 100-day streak.', earned: (x) => x.longestStreak >= 100 },
  {
    id: 'full-house',
    name: 'Full House',
    how: 'Hit the weekly target with all five weekdays shown up.',
    earned: (x) => x.target > 0 && x.weeks.some((w) => w.targetHit && w.shownUpDays === 5),
  },
  {
    id: 'overachiever',
    name: 'Overachiever',
    how: 'Double the weekly target in one week.',
    earned: (x) => x.target > 0 && x.weeks.some((w) => w.points >= 2 * x.target),
  },
  { id: 'thousand-words', name: 'Thousand Words', how: '1,000 comments and replies, lifetime.', earned: (x) => x.lifetime.c + x.lifetime.r >= 1000 },
  { id: 'broadcaster', name: 'Broadcaster', how: '50 posts, lifetime.', earned: (x) => x.lifetime.p >= 50 },
  { id: 'networker', name: 'Networker', how: '100 connection requests, lifetime.', earned: (x) => x.lifetime.n >= 100 },
  { id: 'opener', name: 'Opener', how: '100 DMs, lifetime.', earned: (x) => x.lifetime.m >= 100 },
  {
    id: 'back-from-the-dead',
    name: 'Back From The Dead',
    how: 'Your first action after 14+ silent days.',
    earned: (x) => x.backFromTheDead,
  },
];

export function badgeDef(id: BadgeId): BadgeDef {
  return BADGES.find((b) => b.id === id)!;
}

/** Badges whose condition holds now and that aren't already held. */
export function newBadges(ctx: BadgeContext, held: Badges): BadgeId[] {
  return BADGES.filter((b) => held[b.id] === undefined && b.earned(ctx)).map((b) => b.id);
}
