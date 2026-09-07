// Every storage item the extension owns, in one place. The background is the
// ONLY writer (see background-main.ts); everything else reads through
// messages. `storage.local` holds facts; `storage.session` holds the two DM
// dedup values that must never touch disk. There is NO `storage.sync` — the
// data never leaves the device, and that is the whole privacy story.
//
// Why not `wxt/utils/storage`: its bundle carries two documentation URLs
// inside an error message, and the no-network guard (rightly) refuses any URL
// it doesn't know. A typed item over `browser.storage` is thirty lines and
// keeps the built background free of strings that even look like a network.
import { browser } from 'wxt/browser';
import type { ActivityEvent, Badges, DateKey, DayRollup, Derived, Legacy, Settings } from '../core/types';
import type { Health } from '../messaging/protocol';

export const SCHEMA_VERSION = 2 as const;
/** Events kept in the append-only log before the oldest whole day folds into `days`. */
export const EVENT_CAP = 10_000;
/** The raw v1 storage copy is kept this long after migration, then purged at rollover. */
export const V1_BACKUP_TTL_MS = 30 * 86_400_000;

/** Raw v1 keys, copied verbatim by the migration so a bad mapping can be re-run. */
export interface V1Backup {
  raw: Record<string, unknown>;
  savedAt: number;
}

/** The DM fingerprints seen on day `d`. Session-only; cleared at rollover. */
export interface DmSeen {
  d: DateKey;
  hashes: string[];
}

export const emptyHealth = (): Health => ({ lastPageLoad: 0, unconfirmed: {}, lastDetected: {}, selectorsVersion: '' });

// ---- the item abstraction ---------------------------------------------------

export type StorageArea = 'local' | 'session';

export interface Item<T> {
  readonly area: StorageArea;
  readonly key: string;
  /** A fresh default, used whenever the key is absent. */
  readonly fallback: () => T;
  /** The stored value, or a fresh fallback when absent. */
  getValue(): Promise<T>;
  /** `null` / `undefined` removes the key. */
  setValue(value: T): Promise<void>;
  removeValue(): Promise<void>;
}

export function defineItem<T>(area: StorageArea, key: string, fallback: () => T): Item<T> {
  const store = () => browser.storage[area];
  return {
    area,
    key,
    fallback,
    async getValue() {
      const value = (await store().get(key))[key];
      return value === undefined || value === null ? fallback() : (value as T);
    },
    async setValue(value) {
      if (value === undefined || value === null) await store().remove(key);
      else await store().set({ [key]: value });
    },
    async removeValue() {
      await store().remove(key);
    },
  };
}

// ---- local: the facts -------------------------------------------------------

/** Absent on a fresh install until the first write; the v1 → v2 migration keys off its absence. */
export const schemaVersion = defineItem<number | null>('local', 'schemaVersion', () => null);
export const events = defineItem<ActivityEvent[]>('local', 'events', () => []);
export const days = defineItem<DayRollup>('local', 'days', () => ({}));
/** null = not onboarded. The first `setSettings` carrying a `level` creates it. */
export const settings = defineItem<Settings | null>('local', 'settings', () => null);
export const badges = defineItem<Badges>('local', 'badges', () => ({}));
export const legacy = defineItem<Legacy | null>('local', 'legacy', () => null);
export const health = defineItem<Health>('local', 'health', emptyHealth);
/** Cache only — rebuilt by derive() after every write. Never the source of truth. */
export const derived = defineItem<Derived | null>('local', 'derived', () => null);
/** Filled by the migration (wave 2); purged at rollover once `savedAt` is 30+ days old. */
export const v1Backup = defineItem<V1Backup | null>('local', 'v1Backup', () => null);

// ---- session: memory only, wiped when the browser closes ---------------------

/** 32 random bytes as hex, created lazily by the first DM. */
export const dmSalt = defineItem<string | null>('session', 'dmSalt', () => null);
export const dmSeen = defineItem<DmSeen | null>('session', 'dmSeen', () => null);

// ---- whole-store helpers -----------------------------------------------------

/** Everything derive() needs plus health — the facts, read together. */
export interface Store {
  events: ActivityEvent[];
  days: DayRollup;
  settings: Settings | null;
  badges: Badges;
  legacy: Legacy | null;
  health: Health;
}

const STORE_ITEMS = { events, days, settings, badges, legacy, health } as const;

export async function readStore(): Promise<Store> {
  const raw = await browser.storage.local.get(Object.values(STORE_ITEMS).map((i) => i.key));
  const pick = <T>(item: Item<T>): T => {
    const v = raw[item.key];
    return v === undefined || v === null ? item.fallback() : (v as T);
  };
  return {
    events: pick(events),
    days: pick(days),
    settings: pick(settings),
    badges: pick(badges),
    legacy: pick(legacy),
    health: pick(health),
  };
}

/** Writes only the keys present in `patch`, in one `set` (plus one `remove` for nulls). */
export async function writeStore(patch: Partial<Store>): Promise<void> {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const name of Object.keys(STORE_ITEMS) as Array<keyof Store>) {
    const value = patch[name];
    if (value === undefined) continue;
    if (value === null) remove.push(STORE_ITEMS[name].key);
    else set[STORE_ITEMS[name].key] = value;
  }
  if (Object.keys(set).length) await browser.storage.local.set(set);
  if (remove.length) await browser.storage.local.remove(remove);
}
