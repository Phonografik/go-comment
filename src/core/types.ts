// The shared vocabulary of the rules engine. Everything in src/core is pure:
// no browser APIs, no DOM, and `now` is always passed in.

export const EVENT_TYPES = ['c', 'r', 'p', 'q', 'n', 'm'] as const;
/** c=comment r=reply p=post q=repost-with-thoughts n=connection request m=DM */
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<EventType, { one: string; many: string }> = {
  c: { one: 'comment', many: 'comments' },
  r: { one: 'reply', many: 'replies' },
  p: { one: 'post', many: 'posts' },
  q: { one: 'repost', many: 'reposts' },
  n: { one: 'connection', many: 'connections' },
  m: { one: 'DM', many: 'DMs' },
};

/** Local calendar date, `YYYY-MM-DD`, computed from LOCAL getters at event time. Never ISO/UTC. */
export type DateKey = string;

export interface ActivityEvent {
  t: EventType;
  /** epoch ms — informational; the day an event belongs to is `d`, decided when it happened */
  ts: number;
  d: DateKey;
}

export type Counts = Record<EventType, number>;

export function zeroCounts(): Counts {
  return { c: 0, r: 0, p: 0, q: 0, n: 0, m: 0 };
}

/** Days compacted out of the event log, folded to counts. */
export type DayRollup = Record<DateKey, Counts>;

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

export interface Settings {
  level: Level;
  /** epoch ms */
  memberSince: number;
}

/** Totals carried over from v1 — lifetime numbers only, never merged into the daily streak. */
export interface Legacy {
  c: number;
  n: number;
  p: number;
  bestWeek: number;
  weeklyStreak: number;
  longestWeeklyStreak: number;
  /** v1's points for the migration week, minus today — counts toward that one week only */
  weekCarry: number;
  /** epoch ms */
  importedAt: number;
}

export type BadgeId =
  | 'first-word'
  | 'five-alive'
  | 'fortnight'
  | 'quarter-parrot'
  | 'centurion'
  | 'full-house'
  | 'overachiever'
  | 'thousand-words'
  | 'broadcaster'
  | 'networker'
  | 'opener'
  | 'back-from-the-dead';

/** badge id → unlockedAt (epoch ms). Earned once, never revoked. */
export type Badges = Partial<Record<BadgeId, number>>;

export interface WeekSummary {
  /** Monday's DateKey */
  start: DateKey;
  points: number;
  targetHit: boolean;
  shownUpDays: number;
  frozenDays: number;
  missedDays: number;
}

export interface DayView {
  d: DateKey;
  counts: Counts;
  points: number;
  shownUp: boolean;
  frozen: boolean;
  weekday: boolean;
  today: boolean;
  future: boolean;
}

export interface Derived {
  today: DateKey;
  weekStart: DateKey;
  level: Level;
  weekTarget: number;

  streak: number;
  longestStreak: number;
  shownUpToday: boolean;
  /** today is a weekday, nothing has happened yet, and there is a streak to lose */
  atRisk: boolean;
  freezes: number;

  weekPoints: number;
  lastWeekPoints: number;
  bestWeekPoints: number;
  weekCounts: Counts;
  weekDays: DayView[];

  todayCounts: Counts;
  todayPoints: number;
  /** event types that have hit today's cap (still recorded, score 0) */
  capped: EventType[];

  lifetime: Counts;
  activeDays: number;

  /** 0 = egg … 6 = crowned lunatic */
  mascotStage: number;
  /** badges whose condition now holds but that aren't yet in `badges` */
  newBadges: BadgeId[];
}
