// The background is the single writer of storage. Every message in the
// protocol lands here, every write goes through one WriterQueue, and after
// every write the pure `derive()` fold rebuilds the cache and redraws the
// toolbar badge. Nothing is incremented in place.
//
// `setupBackground()` is the whole background; `entrypoints/background.ts`
// just calls it. `now` is injectable so tests control the clock.
import { browser, type Browser } from 'wxt/browser';
import { isValidDateKey, toDateKey } from '../core/calendar';
import { derive } from '../core/derive';
import { compact } from '../core/stats';
import type { ActivityEvent, Badges, Counts, DayRollup, EventType, Legacy, Level, Settings } from '../core/types';
import { EVENT_TYPES, zeroCounts } from '../core/types';
import type { ActionMessage, ExportFile, Health, StateSnapshot } from '../messaging/protocol';
import { onMessage } from '../messaging/protocol';
import { ALARM_EVENING, ALARM_ROLLOVER, armAlarms, armEvening, armRollover } from './alarms';
import { applyBadge, badgeState } from './badge';
import { claimDmToday, clearDmSeen } from './dm';
import { runInstallHooks } from './install-hooks';
import * as repo from './repo';
import { WriterQueue } from './writer-queue';

/** A second confirmed event of the same type inside this window is the same action seen twice. */
export const DEDUP_WINDOW_MS = 2_000;

export interface BackgroundOptions {
  now?: () => Date;
}

export interface BackgroundHandle {
  /** Unregisters every listener this setup added. Tests call it between cases. */
  teardown(): void;
}

/**
 * `debugInject` exists for dev builds and for the Playwright smoke, which
 * builds with `WXT_E2E=true` (see package.json). Vite inlines both values at
 * build time, so a production zip carries `false` and the handler is inert.
 */
export function debugAllowed(): boolean {
  return Boolean(import.meta.env.DEV) || import.meta.env.WXT_E2E === 'true';
}

// ---- validation: messages arrive over the wire, trust nothing ---------------

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isEventType = (t: unknown): t is EventType => typeof t === 'string' && (EVENT_TYPES as readonly string[]).includes(t);
const isLevel = (l: unknown): l is Level => typeof l === 'number' && Number.isInteger(l) && l >= 0 && l <= 5;
const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function isEvent(e: unknown): e is ActivityEvent {
  return isRecord(e) && isEventType(e.t) && isFiniteNumber(e.ts) && isValidDateKey(e.d);
}

const byTs = (a: ActivityEvent, b: ActivityEvent) => a.ts - b.ts;

function maxCounts(a: Counts, b: Counts): Counts {
  const out = zeroCounts();
  for (const t of EVENT_TYPES) out[t] = Math.max(a[t], b[t]);
  return out;
}

function cleanEvents(list: unknown[]): ActivityEvent[] {
  return list.filter(isEvent).map(({ t, ts, d }) => ({ t, ts, d }));
}

function cleanDays(raw: Record<string, unknown>): DayRollup {
  const out: DayRollup = {};
  for (const [d, counts] of Object.entries(raw)) {
    if (!isValidDateKey(d) || !isRecord(counts)) continue;
    const c = zeroCounts();
    for (const t of EVENT_TYPES) {
      const n = counts[t];
      c[t] = isFiniteNumber(n) && n >= 0 ? Math.floor(n) : 0;
    }
    out[d] = c;
  }
  return out;
}

function cleanBadges(raw: Record<string, unknown>): Badges {
  const out: Badges = {};
  for (const [id, at] of Object.entries(raw)) if (isFiniteNumber(at)) out[id as keyof Badges] = at;
  return out;
}

// ---- the one path every write ends on ---------------------------------------

async function stampSchema(): Promise<void> {
  if ((await repo.schemaVersion.getValue()) !== repo.SCHEMA_VERSION) await repo.schemaVersion.setValue(repo.SCHEMA_VERSION);
}

/**
 * derive → commit any newly earned badges → cache `derived` → redraw the
 * badge → return the snapshot. Called after every write and on every read,
 * so the cache and the toolbar can never lag the facts.
 */
async function settle(store: repo.Store, now: Date): Promise<StateSnapshot> {
  if (!store.settings) {
    await repo.derived.removeValue();
    await applyBadge(badgeState(null, now));
    return { onboarded: false };
  }
  const input = { days: store.days, events: store.events, legacy: store.legacy ?? undefined, settings: store.settings, now };
  let badges = store.badges;
  let d = derive({ ...input, badges });
  if (d.newBadges.length) {
    badges = { ...badges };
    for (const id of d.newBadges) badges[id] = now.getTime();
    await repo.writeStore({ badges });
    d = derive({ ...input, badges });
  }
  await repo.derived.setValue(d);
  await applyBadge(badgeState(d, now));
  return {
    onboarded: true,
    derived: d,
    settings: store.settings,
    badges,
    ...(store.legacy ? { legacy: store.legacy } : {}),
    health: store.health,
  };
}

// ---- handlers ---------------------------------------------------------------

async function recordAction(msg: ActionMessage, now: Date): Promise<'recorded' | 'duplicate' | 'ignored'> {
  if (!isEvent(msg)) return 'ignored';
  const store = await repo.readStore();
  const last = store.health.lastDetected[msg.t];
  if (last !== undefined && Math.abs(msg.ts - last) < DEDUP_WINDOW_MS) return 'duplicate';
  if (msg.t === 'm') {
    // First DM to a thread per day. The key is hashed and forgotten here — it is never stored.
    if (typeof msg.threadKey !== 'string' || msg.threadKey === '') return 'ignored';
    if ((await claimDmToday(msg.threadKey, toDateKey(now))) === 'seen') return 'duplicate';
  }
  const event: ActivityEvent = { t: msg.t, ts: msg.ts, d: msg.d };
  const { events, days } = compact([...store.events, event], store.days, repo.EVENT_CAP);
  const health: Health = { ...store.health, lastDetected: { ...store.health.lastDetected, [msg.t]: msg.ts } };
  await repo.writeStore({ events, days, health });
  await settle({ ...store, events, days, health }, now);
  return 'recorded';
}

async function pageLoad(msg: { selectorsVersion: string }, now: Date): Promise<void> {
  const h = await repo.health.getValue();
  const selectorsVersion = typeof msg?.selectorsVersion === 'string' ? msg.selectorsVersion : h.selectorsVersion;
  await repo.health.setValue({ ...h, lastPageLoad: now.getTime(), selectorsVersion });
}

async function unconfirmed(msg: { t: EventType }): Promise<void> {
  if (!isEventType(msg?.t)) return;
  const h = await repo.health.getValue();
  await repo.health.setValue({ ...h, unconfirmed: { ...h.unconfirmed, [msg.t]: (h.unconfirmed[msg.t] ?? 0) + 1 } });
}

async function setSettings(patch: Partial<Settings>, now: Date): Promise<StateSnapshot> {
  const store = await repo.readStore();
  const level = isLevel(patch?.level) ? patch.level : undefined;
  const memberSince = isFiniteNumber(patch?.memberSince) ? patch.memberSince : undefined;
  let settings = store.settings;
  if (settings) {
    settings = { ...settings, ...(level !== undefined ? { level } : {}), ...(memberSince !== undefined ? { memberSince } : {}) };
  } else if (level !== undefined) {
    // Onboarding: the first patch that carries a level creates the record.
    settings = { level, memberSince: memberSince ?? now.getTime() };
  }
  if (settings !== store.settings) {
    await repo.writeStore({ settings });
    await stampSchema();
  }
  return settle({ ...store, settings }, now);
}

async function exportData(now: Date): Promise<ExportFile> {
  const store = await repo.readStore();
  if (!store.settings) throw new Error('Nothing to export yet — finish onboarding first');
  return {
    schemaVersion: repo.SCHEMA_VERSION,
    exportedAt: now.getTime(),
    data: {
      events: store.events,
      days: store.days,
      settings: store.settings,
      badges: store.badges,
      ...(store.legacy ? { legacy: store.legacy } : {}),
      health: store.health,
    },
  };
}

/** Light shape check — the settings page validates thoroughly before it ever sends. */
function checkExportFile(file: unknown): ExportFile['data'] {
  const f = isRecord(file) ? file : undefined;
  const d = f && isRecord(f.data) ? f.data : undefined;
  const ok =
    f?.schemaVersion === repo.SCHEMA_VERSION &&
    d !== undefined &&
    Array.isArray(d.events) &&
    isRecord(d.days) &&
    isRecord(d.settings) &&
    isLevel(d.settings.level) &&
    isRecord(d.badges) &&
    isRecord(d.health);
  if (!ok) throw new Error('Not a Go Comment v2 export file');
  return d as ExportFile['data'];
}

async function importData(msg: { file: ExportFile; mode: 'replace' | 'merge' }, now: Date): Promise<StateSnapshot> {
  const file = checkExportFile(msg?.file);
  const mode = msg.mode === 'merge' ? 'merge' : 'replace';
  const incoming = {
    events: cleanEvents(file.events).sort(byTs),
    days: cleanDays(file.days as Record<string, unknown>),
    settings: { level: file.settings.level, memberSince: isFiniteNumber(file.settings.memberSince) ? file.settings.memberSince : now.getTime() },
    badges: cleanBadges(file.badges as Record<string, unknown>),
    legacy: isRecord(file.legacy) ? (file.legacy as unknown as Legacy) : null,
    health: { ...repo.emptyHealth(), ...file.health },
  };
  const local = await repo.readStore();

  let next: repo.Store;
  if (mode === 'replace') {
    next = incoming;
  } else {
    const byKey = new Map(local.events.map((e) => [`${e.t}:${e.ts}`, e]));
    for (const e of incoming.events) {
      const k = `${e.t}:${e.ts}`;
      if (!byKey.has(k)) byKey.set(k, e);
    }
    // Merge means "the same history from two places" — the same rule as the event
    // dedup by t+ts. A day on both sides takes the per-type MAX, never the sum, so
    // merging one export twice can't double a compacted day. (Two machines that
    // genuinely both did things on a compacted day undercount slightly — the safer error.)
    const days: DayRollup = { ...local.days };
    for (const [d, counts] of Object.entries(incoming.days)) {
      const mine = days[d];
      days[d] = mine ? maxCounts(mine, counts) : counts;
    }
    const badges: Badges = { ...incoming.badges };
    for (const [id, at] of Object.entries(local.badges) as Array<[keyof Badges, number]>) {
      const theirs = badges[id];
      badges[id] = theirs === undefined ? at : Math.min(theirs, at);
    }
    next = {
      events: [...byKey.values()].sort(byTs),
      days,
      settings: local.settings ?? incoming.settings,
      badges,
      legacy: local.legacy ?? incoming.legacy,
      health: local.health,
    };
  }
  const compacted = compact(next.events, next.days, repo.EVENT_CAP);
  next = { ...next, events: compacted.events, days: compacted.days };
  await repo.writeStore(next);
  await stampSchema();
  return settle(next, now);
}

async function debugInject(msg: { t: EventType; count?: number }, now: Date): Promise<StateSnapshot> {
  const store = await repo.readStore();
  if (!debugAllowed() || !isEventType(msg?.t)) return settle(store, now);
  const n = Math.max(1, Math.min(1000, Math.floor(isFiniteNumber(msg.count) ? msg.count : 1)));
  const d = toDateKey(now);
  const base = now.getTime();
  const injected: ActivityEvent[] = Array.from({ length: n }, (_, i) => ({ t: msg.t, ts: base + i, d }));
  const { events, days } = compact([...store.events, ...injected], store.days, repo.EVENT_CAP);
  await repo.writeStore({ events, days });
  return settle({ ...store, events, days }, now);
}

// ---- alarms -----------------------------------------------------------------

async function rollover(now: Date): Promise<void> {
  await clearDmSeen();
  const backup = await repo.v1Backup.getValue();
  if (backup && now.getTime() - backup.savedAt >= repo.V1_BACKUP_TTL_MS) await repo.v1Backup.removeValue();
  await settle(await repo.readStore(), now);
  await armRollover(now);
}

async function evening(now: Date): Promise<void> {
  await settle(await repo.readStore(), now);
  await armEvening(now);
}

// ---- wiring -----------------------------------------------------------------

export function setupBackground(opts: BackgroundOptions = {}): BackgroundHandle {
  const now = opts.now ?? (() => new Date());
  const q = new WriterQueue();
  const refresh = () => q.run(async () => settle(await repo.readStore(), now()));

  const removers = [
    onMessage('action', ({ data }) => q.run(() => recordAction(data, now()))),
    onMessage('pageLoad', ({ data }) => q.run(() => pageLoad(data, now()))),
    onMessage('unconfirmed', ({ data }) => q.run(() => unconfirmed(data))),
    onMessage('getState', () => refresh()),
    onMessage('setSettings', ({ data }) => q.run(() => setSettings(data ?? {}, now()))),
    onMessage('exportData', () => q.run(() => exportData(now()))),
    onMessage('importData', ({ data }) => q.run(() => importData(data, now()))),
    onMessage('debugInject', ({ data }) => q.run(() => debugInject(data, now()))),
  ];

  const onInstalled = async (details: Browser.runtime.InstalledDetails) => {
    await q.run(async () => {
      await runInstallHooks(details);
      await stampSchema();
    });
    await armAlarms(now());
    await refresh();
  };
  const onStartup = async () => {
    await armAlarms(now());
    await refresh();
  };
  const onAlarm = async (alarm: Browser.alarms.Alarm) => {
    if (alarm.name === ALARM_ROLLOVER) await q.run(() => rollover(now()));
    else if (alarm.name === ALARM_EVENING) await q.run(() => evening(now()));
  };

  browser.runtime.onInstalled.addListener(onInstalled);
  browser.runtime.onStartup.addListener(onStartup);
  browser.alarms.onAlarm.addListener(onAlarm);

  return {
    teardown() {
      for (const remove of removers) remove();
      browser.runtime.onInstalled.removeListener(onInstalled);
      browser.runtime.onStartup.removeListener(onStartup);
      browser.alarms.onAlarm.removeListener(onAlarm);
    },
  };
}
