// The background under fake-browser: real messages through the protocol,
// real storage items, real alarms — only the clock is injected.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { toDateKey } from '../core/calendar';
import type { ActivityEvent, EventType } from '../core/types';
import { sendMessage, type ExportFile } from '../messaging/protocol';
import { ALARM_EVENING, ALARM_ROLLOVER } from './alarms';
import { setupBackground, type BackgroundHandle } from './background-main';
import { runInstallHooks } from './install-hooks';
import * as repo from './repo';

vi.mock('./install-hooks', () => ({ runInstallHooks: vi.fn(async () => {}) }));

const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
const WED = at(2026, 9, 9); // a weekday, BST
const ev = (t: EventType, when: Date): ActivityEvent => ({ t, ts: when.getTime(), d: toDateKey(when) });

const alarm = (name: string, scheduledTime: number) => ({ name, scheduledTime, persistAcrossSessions: true });

const GREEN = [34, 160, 107, 255];
const AMBER = [240, 192, 0, 255];
const GREY = [107, 114, 128, 255];

let handle: BackgroundHandle | undefined;
let clock = WED;

function boot(start = WED) {
  clock = start;
  handle = setupBackground({ now: () => clock });
}

async function onboard(level = 1) {
  return sendMessage('setSettings', { level: level as 0 | 1 | 2 | 3 | 4 | 5 });
}

async function badge() {
  return { text: await fakeBrowser.action.getBadgeText({}), colour: await fakeBrowser.action.getBadgeBackgroundColor({}) };
}

afterEach(() => {
  handle?.teardown();
  handle = undefined;
  vi.unstubAllEnvs();
  vi.mocked(runInstallHooks).mockClear();
});

describe('onboarding and state', () => {
  it('is not onboarded until a level is set, then snapshots with a fresh derived', async () => {
    boot();
    expect(await sendMessage('getState')).toEqual({ onboarded: false });
    expect(await repo.schemaVersion.getValue()).toBeNull();

    const snap = await onboard(2);
    expect(snap.onboarded).toBe(true);
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.settings).toEqual({ level: 2, memberSince: WED.getTime() });
    expect(snap.derived.level).toBe(2);
    expect(snap.derived.today).toBe('2026-09-09');
    expect(snap.badges).toEqual({});
    expect(snap.legacy).toBeUndefined();
    expect(snap.health).toEqual(repo.emptyHealth());
    expect(await repo.schemaVersion.getValue()).toBe(2);

    const again = await sendMessage('getState');
    expect(again).toEqual(snap);
    expect(await repo.derived.getValue()).toEqual(snap.derived);
  });

  it('setSettings merges a patch and ignores garbage', async () => {
    boot();
    await onboard(1);
    const snap = await sendMessage('setSettings', { level: 3 });
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.settings).toEqual({ level: 3, memberSince: WED.getTime() });
    const junk = await sendMessage('setSettings', { level: 9 as never });
    if (!junk.onboarded) throw new Error('unreachable');
    expect(junk.settings.level).toBe(3);
    expect(await sendMessage('setSettings', {})).toMatchObject({ onboarded: true });
  });

  it('a patch without a level does not onboard', async () => {
    boot();
    expect(await sendMessage('setSettings', { memberSince: 1 })).toEqual({ onboarded: false });
  });

  it('never touches storage.sync', async () => {
    boot();
    await onboard();
    await sendMessage('action', ev('c', clock));
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
  });
});

describe('action', () => {
  it('records a confirmed event, derives, and stamps lastDetected', async () => {
    boot();
    await onboard();
    const e = ev('c', clock);
    expect(await sendMessage('action', e)).toBe('recorded');
    expect(await repo.events.getValue()).toEqual([e]);
    const snap = await sendMessage('getState');
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.derived.todayCounts.c).toBe(1);
    expect(snap.derived.shownUpToday).toBe(true);
    expect(snap.derived.streak).toBe(1);
    expect(snap.health.lastDetected).toEqual({ c: e.ts });
    expect(snap.badges).toEqual({ 'first-word': clock.getTime() });
    expect(snap.derived.newBadges).toEqual([]);
    expect(await badge()).toEqual({ text: '1', colour: GREEN });
  });

  it('ignores a malformed message', async () => {
    boot();
    await onboard();
    expect(await sendMessage('action', { t: 'x' as EventType, ts: 1, d: '2026-09-09' })).toBe('ignored');
    expect(await sendMessage('action', { t: 'c', ts: Number.NaN, d: '2026-09-09' })).toBe('ignored');
    expect(await sendMessage('action', { t: 'c', ts: 1, d: '2026-09-31' })).toBe('ignored');
    expect(await repo.events.getValue()).toEqual([]);
  });

  it('rejects a same-type event within 2 s of the last recorded one, accepts a different type', async () => {
    boot();
    await onboard();
    const t0 = clock.getTime();
    expect(await sendMessage('action', { t: 'c', ts: t0, d: '2026-09-09' })).toBe('recorded');
    expect(await sendMessage('action', { t: 'c', ts: t0 + 1_500, d: '2026-09-09' })).toBe('duplicate');
    expect(await sendMessage('action', { t: 'r', ts: t0 + 1_500, d: '2026-09-09' })).toBe('recorded');
    expect(await sendMessage('action', { t: 'c', ts: t0 + 2_000, d: '2026-09-09' })).toBe('recorded');
    expect(await repo.events.getValue()).toHaveLength(3);
  });

  it('records while not onboarded, so a first-day dashboard is not empty', async () => {
    boot();
    expect(await sendMessage('action', ev('c', clock))).toBe('recorded');
    expect(await sendMessage('getState')).toEqual({ onboarded: false });
    expect(await badge()).toEqual({ text: '', colour: GREY });
    const snap = await onboard();
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.derived.todayCounts.c).toBe(1);
  });

  it('serialises concurrent writes so no append is lost', async () => {
    boot();
    await onboard();
    const t0 = clock.getTime();
    const sends = Array.from({ length: 30 }, (_, i) => sendMessage('action', { t: 'c', ts: t0 + i * 3_000, d: '2026-09-09' }));
    const results = await Promise.all(sends);
    expect(results.every((r) => r === 'recorded')).toBe(true);
    expect(await repo.events.getValue()).toHaveLength(30);
  });
});

describe('DMs', () => {
  it('needs a threadKey, counts the first message to a thread per day, and never stores the key', async () => {
    boot();
    await onboard();
    const t0 = clock.getTime();
    expect(await sendMessage('action', { t: 'm', ts: t0, d: '2026-09-09' })).toBe('ignored');
    expect(await sendMessage('action', { t: 'm', ts: t0, d: '2026-09-09', threadKey: 'thread-A' })).toBe('recorded');
    expect(await sendMessage('action', { t: 'm', ts: t0 + 5_000, d: '2026-09-09', threadKey: 'thread-A' })).toBe('duplicate');
    expect(await sendMessage('action', { t: 'm', ts: t0 + 10_000, d: '2026-09-09', threadKey: 'thread-B' })).toBe('recorded');

    const events = await repo.events.getValue();
    expect(events).toHaveLength(2);
    for (const e of events) expect(Object.keys(e).sort()).toEqual(['d', 't', 'ts']);

    const local = JSON.stringify(await fakeBrowser.storage.local.get(null));
    const session = JSON.stringify(await fakeBrowser.storage.session.get(null));
    expect(local).not.toContain('thread-');
    expect(session).not.toContain('thread-');
    const seen = await repo.dmSeen.getValue();
    expect(seen?.d).toBe('2026-09-09');
    expect(seen?.hashes).toHaveLength(2);
    expect(await repo.dmSalt.getValue()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('counts the same thread again after the midnight rollover', async () => {
    boot();
    await onboard();
    expect(await sendMessage('action', { t: 'm', ts: clock.getTime(), d: '2026-09-09', threadKey: 'thread-A' })).toBe('recorded');
    clock = at(2026, 9, 10, 0, 0, 2);
    await fakeBrowser.alarms.onAlarm.trigger(alarm(ALARM_ROLLOVER, at(2026, 9, 10, 0).getTime()));
    expect(await repo.dmSeen.getValue()).toBeNull();
    expect(await sendMessage('action', { t: 'm', ts: clock.getTime(), d: '2026-09-10', threadKey: 'thread-A' })).toBe('recorded');
    expect(await repo.events.getValue()).toHaveLength(2);
  });
});

describe('debugInject', () => {
  it('puts "1" on the badge in a dev build', async () => {
    boot();
    await onboard();
    expect(await badge()).toEqual({ text: '', colour: GREY });
    const snap = await sendMessage('debugInject', { t: 'c' });
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.derived.todayCounts.c).toBe(1);
    expect(await badge()).toEqual({ text: '1', colour: GREEN });
    const more = await sendMessage('debugInject', { t: 'p', count: 3 });
    if (!more.onboarded) throw new Error('unreachable');
    expect(more.derived.todayCounts).toMatchObject({ c: 1, p: 3 });
    expect(more.health.lastDetected).toEqual({});
  });

  it('is inert outside dev and e2e builds', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('WXT_E2E', '');
    boot();
    await onboard();
    const snap = await sendMessage('debugInject', { t: 'c', count: 5 });
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.derived.todayCounts.c).toBe(0);
    expect(await repo.events.getValue()).toEqual([]);
    expect(await badge()).toEqual({ text: '', colour: GREY });
  });
});

describe('health', () => {
  it('pageLoad and unconfirmed touch health and nothing else', async () => {
    boot();
    await onboard();
    await sendMessage('pageLoad', { selectorsVersion: '2026-09-07' });
    await sendMessage('unconfirmed', { t: 'c' });
    await sendMessage('unconfirmed', { t: 'c' });
    await sendMessage('unconfirmed', { t: 'n' });
    await sendMessage('unconfirmed', { t: 'zz' as EventType });
    expect(await repo.health.getValue()).toEqual({
      lastPageLoad: clock.getTime(),
      selectorsVersion: '2026-09-07',
      unconfirmed: { c: 2, n: 1 },
      lastDetected: {},
    });
    expect(await repo.events.getValue()).toEqual([]);
  });
});

describe('install, startup and alarms', () => {
  it('install runs the hooks first, stamps the schema, arms both alarms with an absolute when', async () => {
    boot();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);
    expect(runInstallHooks).toHaveBeenCalledTimes(1);
    expect(runInstallHooks).toHaveBeenCalledWith(expect.objectContaining({ reason: 'install' }));
    expect(await repo.schemaVersion.getValue()).toBe(2);
    const rollover = await fakeBrowser.alarms.get(ALARM_ROLLOVER);
    const evening = await fakeBrowser.alarms.get(ALARM_EVENING);
    expect(rollover).toMatchObject({ scheduledTime: at(2026, 9, 10, 0).getTime() });
    expect(rollover?.periodInMinutes).toBeUndefined();
    expect(evening).toMatchObject({ scheduledTime: at(2026, 9, 9, 18).getTime() });
    expect(evening?.periodInMinutes).toBeUndefined();
  });

  it('startup re-arms the alarms and redraws the badge from storage', async () => {
    boot();
    await onboard();
    await sendMessage('action', ev('c', clock));
    await fakeBrowser.action.setBadgeText({ text: '' });
    await fakeBrowser.alarms.clearAll();
    await fakeBrowser.runtime.onStartup.trigger();
    expect(await badge()).toEqual({ text: '1', colour: GREEN });
    expect((await fakeBrowser.alarms.getAll()).map((a) => a.name).sort()).toEqual([ALARM_EVENING, ALARM_ROLLOVER]);
  });

  it('rollover re-arms for the following midnight; evening for the following 18:00', async () => {
    boot();
    clock = at(2026, 9, 10, 0, 0, 4);
    await fakeBrowser.alarms.onAlarm.trigger(alarm(ALARM_ROLLOVER, at(2026, 9, 10, 0).getTime()));
    expect((await fakeBrowser.alarms.get(ALARM_ROLLOVER))?.scheduledTime).toBe(at(2026, 9, 11, 0).getTime());
    clock = at(2026, 9, 10, 18, 0, 1);
    await fakeBrowser.alarms.onAlarm.trigger(alarm(ALARM_EVENING, at(2026, 9, 10, 18).getTime()));
    expect((await fakeBrowser.alarms.get(ALARM_EVENING))?.scheduledTime).toBe(at(2026, 9, 11, 18).getTime());
    expect(await fakeBrowser.alarms.get('unknown')).toBeUndefined();
  });

  it('the evening alarm turns an empty weekday amber when there is a streak to lose', async () => {
    boot(at(2026, 9, 8));
    await onboard();
    await sendMessage('action', ev('c', clock)); // Tuesday
    clock = at(2026, 9, 9, 9);
    await sendMessage('getState');
    expect(await badge()).toEqual({ text: '1', colour: GREY });
    clock = at(2026, 9, 9, 18, 0, 1);
    await fakeBrowser.alarms.onAlarm.trigger(alarm(ALARM_EVENING, at(2026, 9, 9, 18).getTime()));
    expect(await badge()).toEqual({ text: '1', colour: AMBER });
    await sendMessage('action', ev('c', clock));
    expect(await badge()).toEqual({ text: '2', colour: GREEN });
  });

  it('rollover purges a v1 backup 30+ days old and keeps a younger one', async () => {
    boot();
    const fire = async () => fakeBrowser.alarms.onAlarm.trigger(alarm(ALARM_ROLLOVER, clock.getTime()));
    await repo.v1Backup.setValue({ raw: { selectedLevel: 2 }, savedAt: at(2026, 8, 20).getTime() });
    await fire();
    expect(await repo.v1Backup.getValue()).not.toBeNull();
    await repo.v1Backup.setValue({ raw: { selectedLevel: 2 }, savedAt: at(2026, 8, 9).getTime() });
    await fire();
    expect(await repo.v1Backup.getValue()).toBeNull();
  });
});

describe('export and import', () => {
  async function seedWeek() {
    await onboard(1);
    for (const day of [1, 2, 3, 7, 8]) {
      clock = at(2026, 9, day);
      await sendMessage('action', ev('c', clock));
      await sendMessage('action', { ...ev('m', clock), threadKey: `thread-${day}` });
    }
    clock = at(2026, 9, 9);
    await sendMessage('action', ev('p', clock));
  }

  it('refuses to export before onboarding', async () => {
    boot();
    await expect(sendMessage('exportData')).rejects.toThrow(/onboarding/);
  });

  it('export → import (replace) round-trips to an identical derived', async () => {
    boot();
    await seedWeek();
    const before = await sendMessage('getState');
    const file = await sendMessage('exportData');
    expect(file.schemaVersion).toBe(2);
    expect(file.exportedAt).toBe(clock.getTime());
    expect(JSON.stringify(file)).not.toContain('dm');
    expect(file.data.events).toHaveLength(11);

    await fakeBrowser.storage.local.clear();
    expect(await sendMessage('getState')).toEqual({ onboarded: false });

    const after = await sendMessage('importData', { file: JSON.parse(JSON.stringify(file)), mode: 'replace' });
    expect(after).toEqual(before);
    expect(await repo.schemaVersion.getValue()).toBe(2);
    if (!before.onboarded) throw new Error('unreachable');
    expect(before.derived.streak).toBe(3); // Fri 4 Sep missed, no freeze at 15/25
    expect(await badge()).toEqual({ text: '3', colour: GREEN });
  });

  it('merge unions events, sums days, keeps the earliest badge, keeps local settings', async () => {
    boot();
    await onboard(2);
    const local = ev('c', at(2026, 9, 8));
    await sendMessage('action', local);
    await repo.days.setValue({ '2026-08-03': { c: 1, r: 0, p: 0, q: 0, n: 0, m: 0 } });
    const mine = await sendMessage('getState');
    if (!mine.onboarded) throw new Error('unreachable');
    expect(mine.badges['first-word']).toBe(at(2026, 9, 9).getTime());

    const theirs = ev('p', at(2026, 9, 7));
    const file: ExportFile = {
      schemaVersion: 2,
      exportedAt: 1,
      data: {
        events: [local, theirs],
        days: { '2026-08-03': { c: 2, r: 0, p: 0, q: 0, n: 0, m: 0 }, '2026-08-04': { c: 0, r: 0, p: 1, q: 0, n: 0, m: 0 } },
        settings: { level: 1, memberSince: 5 },
        badges: { 'first-word': 50, broadcaster: 70 },
        legacy: { c: 10, n: 2, p: 1, bestWeek: 30, weeklyStreak: 1, longestWeeklyStreak: 2, weekCarry: 0, importedAt: 5 },
        health: { lastPageLoad: 99, unconfirmed: { c: 4 }, lastDetected: {}, selectorsVersion: 'theirs' },
      },
    };
    const merged = await sendMessage('importData', { file, mode: 'merge' });
    if (!merged.onboarded) throw new Error('unreachable');
    expect(await repo.events.getValue()).toEqual([theirs, local]);
    expect(await repo.days.getValue()).toEqual({
      '2026-08-03': { c: 3, r: 0, p: 0, q: 0, n: 0, m: 0 },
      '2026-08-04': { c: 0, r: 0, p: 1, q: 0, n: 0, m: 0 },
    });
    // back-from-the-dead is genuinely earned by the merge: August days, then 14+ silent days.
    expect(merged.badges).toEqual({ 'first-word': 50, broadcaster: 70, 'back-from-the-dead': at(2026, 9, 9).getTime() });
    expect(merged.settings).toEqual({ level: 2, memberSince: at(2026, 9, 9).getTime() });
    expect(merged.legacy).toEqual(file.data.legacy);
    expect(merged.health).toEqual({ ...repo.emptyHealth(), lastDetected: { c: local.ts } });
    expect(merged.derived.lifetime).toMatchObject({ c: 14, p: 3, n: 2 });
  });

  it('rejects anything that is not a v2 export file', async () => {
    boot();
    await expect(sendMessage('importData', { file: { schemaVersion: 1 } as never, mode: 'replace' })).rejects.toThrow(/export file/);
    await expect(sendMessage('importData', { file: { schemaVersion: 2, data: { events: 'no' } } as never, mode: 'replace' })).rejects.toThrow();
    expect(await sendMessage('getState')).toEqual({ onboarded: false });
  });
});

describe('compaction', () => {
  it('folds the oldest whole day into days once the log passes the cap', async () => {
    boot();
    const old: ActivityEvent[] = [];
    for (let i = 0; i < 5_000; i++) old.push({ t: 'c', ts: at(2026, 9, 1, 9).getTime() + i, d: '2026-09-01' });
    for (let i = 0; i < 5_000; i++) old.push({ t: 'r', ts: at(2026, 9, 2, 9).getTime() + i, d: '2026-09-02' });
    await repo.events.setValue(old);
    await onboard();
    expect(await sendMessage('action', ev('p', clock))).toBe('recorded');
    const events = await repo.events.getValue();
    expect(events).toHaveLength(5_001);
    expect(events.every((e) => e.d !== '2026-09-01')).toBe(true);
    expect(await repo.days.getValue()).toEqual({ '2026-09-01': { c: 5000, r: 0, p: 0, q: 0, n: 0, m: 0 } });
    const snap = await sendMessage('getState');
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.derived.lifetime).toMatchObject({ c: 5000, r: 5000, p: 1 });
  });
});
