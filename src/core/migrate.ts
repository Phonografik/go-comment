// v1 → v2 migration, as a pure function over the raw contents of
// chrome.storage.local. The background calls this once from
// runtime.onInstalled (when `schemaVersion` is absent and any v1 key is
// present), writes the result through the storage repo, keeps the raw v1
// object as `v1Backup`, and deletes V1_KEYS. Nothing here touches a browser
// API; `now` is injected so the synthetic "today" is testable.
//
// What v1 stored (Phonografik/go-comment-v1, background.js): flat keys, no
// prefix. Points were comment 1 / connection 2 / post 8, uncapped. The streak
// was WEEKLY (goal met → +1, missed → 0), so it is carried as an archive line
// (`legacy.weeklyStreak`), never merged into v2's daily streak. `todayStats`
// was only ever reset by a manual button, so on migration day it may hold more
// than one day's activity — we still stamp it as today (today counts as shown
// up) and let the daily caps bound the points. `totalStats` already includes
// `todayStats` (v1 incremented both together), so today's counts are taken OUT
// of the lifetime carry to avoid counting them twice — the same subtraction
// the week carry does.
//
// Everything week-shaped in v1 (`weekStartDate`, `weeklyHistory`, …) is
// dropped: v1 built its week key with `toISOString()` on a local midnight,
// which in BST is the previous UTC day, so those rows are off by a week all
// summer. Defensive throughout — a malformed field falls back to a sensible
// default; nothing here throws on garbage.
import { toDateKey } from './calendar';
import type { ActivityEvent, Badges, Legacy, Level, Settings } from './types';

/** Every key v1 ever wrote to storage.local — the list the background deletes after migrating. */
export const V1_KEYS = [
  'selectedLevel',
  'weeklyTarget',
  'todayStats',
  'totalStats',
  'currentWeekPoints',
  'weekStartDate',
  'weeklyStats',
  'currentStreak',
  'longestStreak',
  'bestWeek',
  'memberSince',
  'lastWeekGoalMet',
  'totalWeeksCompleted',
  'lastActiveWeek',
  'achievements',
  'weeklyHistory',
] as const;

export type V1Key = (typeof V1_KEYS)[number];

/** v1 keys that have no v2 home. Reported in `V1Migration.dropped` when present. */
export const V1_DROPPED_KEYS = [
  'weeklyTarget',
  'weeklyStats',
  'weekStartDate',
  'weeklyHistory',
  'lastWeekGoalMet',
  'totalWeeksCompleted',
  'lastActiveWeek',
] as const satisfies readonly V1Key[];

/** v1's `selectedLevel` slugs → v2 level numbers. Anything else → 0. */
export const V1_LEVELS: Readonly<Record<string, Level>> = {
  'no-comment': 0,
  'go-comment': 1,
  'go-go-go': 2,
  'this-dial-goes-to-11': 3,
  'leader-of-thoughts': 4,
  'linkedin-lunatic': 5,
};

/** v1's point weights, needed to take today back out of `currentWeekPoints`. */
export const V1_POINTS = { comments: 1, connections: 2, posts: 8 } as const;

/** v1 achievement id → v2 badge id. The two weekly-streak achievements are not mapped: `legacy.weeklyStreak` already carries that. */
export const V1_ACHIEVEMENTS: Readonly<Record<string, keyof Badges>> = {
  overachiever: 'overachiever',
  'first-week': 'first-word',
};

/** Ceiling on how many synthetic events one v1 counter may produce — a garbage value can't blow the log up. */
const MAX_TODAY_PER_TYPE = 10_000;

export interface V1Migration {
  settings: Settings;
  events: ActivityEvent[];
  legacy: Legacy;
  badges: Badges;
  /** v1 keys that were present but have no v2 home */
  dropped: string[];
}

type V1Stats = { comments: number; connections: number; posts: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A finite, non-negative integer, or the fallback. */
function count(v: unknown, fallback = 0): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return fallback;
  return Math.floor(v);
}

function stats(v: unknown): V1Stats {
  const r = isRecord(v) ? v : {};
  return { comments: count(r.comments), connections: count(r.connections), posts: count(r.posts) };
}

function v1Points(s: V1Stats): number {
  return s.comments * V1_POINTS.comments + s.connections * V1_POINTS.connections + s.posts * V1_POINTS.posts;
}

/** ISO string (what v1 wrote) or epoch ms → epoch ms; anything unparseable → `now`. */
function memberSince(v: unknown, now: Date): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return now.getTime();
}

/** True when this is untouched v1 storage: no `schemaVersion` and at least one v1 key. */
export function isV1Storage(raw: Record<string, unknown>): boolean {
  if (!isRecord(raw)) return false;
  if ('schemaVersion' in raw) return false;
  return V1_KEYS.some((k) => k in raw);
}

/**
 * Map raw v1 storage to the v2 items. Returns null when `raw` is not v1
 * storage (empty, or already carrying a `schemaVersion`).
 */
export function migrateV1(raw: Record<string, unknown>, now: Date): V1Migration | null {
  if (!isV1Storage(raw)) return null;

  const level: Level = typeof raw.selectedLevel === 'string' ? (V1_LEVELS[raw.selectedLevel] ?? 0) : 0;
  const settings: Settings = { level, memberSince: memberSince(raw.memberSince, now) };

  const total = stats(raw.totalStats);
  const todayRaw = stats(raw.todayStats);
  const today: V1Stats = {
    comments: Math.min(todayRaw.comments, MAX_TODAY_PER_TYPE),
    connections: Math.min(todayRaw.connections, MAX_TODAY_PER_TYPE),
    posts: Math.min(todayRaw.posts, MAX_TODAY_PER_TYPE),
  };

  // Today's activity becomes real events at 12:00 local (DST-safe: the Date
  // constructor takes local wall-clock fields), stamped with today's day key.
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const ts = noon.getTime();
  const d = toDateKey(now);
  const events: ActivityEvent[] = [
    ...Array.from({ length: today.comments }, (): ActivityEvent => ({ t: 'c', ts, d })),
    ...Array.from({ length: today.connections }, (): ActivityEvent => ({ t: 'n', ts, d })),
    ...Array.from({ length: today.posts }, (): ActivityEvent => ({ t: 'p', ts, d })),
  ];

  const weeklyStreak = count(raw.currentStreak);
  const legacy: Legacy = {
    // Lifetime carry = v1 totals minus what became today's events (v1 counted
    // an action in both), so derive()'s lifetime equals v1's totals exactly.
    c: Math.max(0, total.comments - today.comments),
    n: Math.max(0, total.connections - today.connections),
    p: Math.max(0, total.posts - today.posts),
    bestWeek: count(raw.bestWeek),
    weeklyStreak,
    longestWeeklyStreak: Math.max(weeklyStreak, count(raw.longestStreak)),
    weekCarry: Math.max(0, count(raw.currentWeekPoints) - v1Points(today)),
    importedAt: now.getTime(),
  };

  const badges: Badges = {};
  if (Array.isArray(raw.achievements)) {
    for (const a of raw.achievements) {
      if (typeof a !== 'string') continue;
      const id = V1_ACHIEVEMENTS[a];
      if (id !== undefined) badges[id] = now.getTime();
    }
  }

  const dropped = V1_DROPPED_KEYS.filter((k) => k in raw);

  return { settings, events, legacy, badges, dropped: [...dropped] };
}
