// The v1 → v2 install hook under fake-browser: real storage, the real
// background wiring (install-hooks is NOT mocked here, unlike background.test.ts),
// the migration fixture seeded as raw v1 keys.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { migrateV1, V1_KEYS } from '../core/migrate';
import type { Counts } from '../core/types';
import { zeroCounts } from '../core/types';
import { sendMessage } from '../messaging/protocol';
import fixture from '../../test/fixtures/v1-storage.json';
import { setupBackground, type BackgroundHandle } from './background-main';
import { migrateFromV1, runInstallHooks } from './install-hooks';
import * as repo from './repo';

// Monday 7 Sep 2026, 15:30 BST.
const NOW = new Date(2026, 8, 7, 15, 30);
const c = (p: Partial<Counts>): Counts => ({ ...zeroCounts(), ...p });
const v1 = () => JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;

async function seedV1(raw = v1()) {
  await fakeBrowser.storage.local.set(raw);
}

/** fake-browser answers a keyed get with `undefined` for absent keys (Chrome omits them) — count only real values. */
async function v1KeysLeft(): Promise<string[]> {
  const got = await fakeBrowser.storage.local.get([...V1_KEYS]);
  return Object.keys(got).filter((k) => got[k] !== undefined);
}

let handle: BackgroundHandle | undefined;

afterEach(() => {
  handle?.teardown();
  handle = undefined;
  vi.useRealTimers();
});

describe('migrateFromV1', () => {
  it('moves a v1 store into the v2 items, keeps a raw backup, deletes the v1 keys, leaves the schema stamp to the caller', async () => {
    await seedV1();
    expect(await migrateFromV1(NOW)).toBe(true);

    const expected = migrateV1(v1(), NOW)!;
    expect(await repo.settings.getValue()).toEqual(expected.settings);
    expect(await repo.events.getValue()).toEqual(expected.events);
    expect(await repo.legacy.getValue()).toEqual(expected.legacy);
    expect(await repo.badges.getValue()).toEqual(expected.badges);
    expect(await repo.days.getValue()).toEqual({});
    expect(await repo.v1Backup.getValue()).toEqual({ raw: v1(), savedAt: NOW.getTime() });
    expect(await v1KeysLeft()).toEqual([]);
    expect(await repo.schemaVersion.getValue()).toBeNull();
  });

  it('does nothing on a fresh install (empty store)', async () => {
    expect(await migrateFromV1(NOW)).toBe(false);
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });

  it('leaves a v2 store alone, even with a stray v1-looking key beside it', async () => {
    const v2 = {
      schemaVersion: 2,
      settings: { level: 3, memberSince: 1 },
      events: [{ t: 'c', ts: NOW.getTime(), d: '2026-09-07' }],
      totalStats: { comments: 999, connections: 0, posts: 0 },
    };
    await fakeBrowser.storage.local.set(v2);
    expect(await migrateFromV1(NOW)).toBe(false);
    expect(await fakeBrowser.storage.local.get(null)).toEqual(v2);
    expect(await repo.v1Backup.getValue()).toBeNull();
  });

  it('a v1 install that never picked a level stays not onboarded, but its totals and today carry over', async () => {
    await seedV1({ ...v1(), selectedLevel: null });
    expect(await migrateFromV1(NOW)).toBe(true);
    expect(await repo.settings.getValue()).toBeNull();
    expect(await repo.legacy.getValue()).toMatchObject({ c: 308, n: 45, p: 18 });
    expect(await repo.events.getValue()).toHaveLength(7);
    expect(await v1KeysLeft()).toEqual([]);
    // fake-browser drops null values on set (Chrome keeps them), so the backup may carry null or nothing — never a level.
    expect((await repo.v1Backup.getValue())?.raw.selectedLevel ?? null).toBeNull();
  });

  it('backs up only the v1 keys, not whatever else the store held', async () => {
    await seedV1({ ...v1(), unrelated: 'thing' });
    await migrateFromV1(NOW);
    const backup = await repo.v1Backup.getValue();
    expect(backup?.raw).not.toHaveProperty('unrelated');
    expect(Object.keys(backup!.raw).sort()).toEqual([...V1_KEYS].sort());
    expect((await fakeBrowser.storage.local.get('unrelated')).unrelated).toBe('thing');
  });

  it('re-running after a partial run converges on the same result', async () => {
    await seedV1();
    await migrateFromV1(NOW);
    // Pretend the delete never happened: the trigger still holds, so it runs again.
    await seedV1();
    expect(await migrateFromV1(NOW)).toBe(true);
    expect(await repo.events.getValue()).toEqual(migrateV1(v1(), NOW)!.events);
    expect(await repo.legacy.getValue()).toEqual(migrateV1(v1(), NOW)!.legacy);
    expect(await v1KeysLeft()).toEqual([]);
  });
});

describe('runtime.onInstalled through the real background', () => {
  it('update from v1: migrates, stamps schema 2, and the first getState shows v1 numbers', async () => {
    // The hook reads the wall clock (the background does not pass its clock through the seam).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    handle = setupBackground({ now: () => NOW });
    await seedV1();

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '1.0.1', temporary: false } as never);

    expect(await repo.schemaVersion.getValue()).toBe(2);
    expect(await v1KeysLeft()).toEqual([]);
    expect((await repo.v1Backup.getValue())?.savedAt).toBe(NOW.getTime());

    const snap = await sendMessage('getState');
    expect(snap.onboarded).toBe(true);
    if (!snap.onboarded) throw new Error('unreachable');
    expect(snap.settings).toEqual({ level: 2, memberSince: Date.parse('2025-05-19T08:03:27.412Z') });
    expect(snap.legacy).toMatchObject({ c: 308, n: 45, p: 18, bestWeek: 92, weeklyStreak: 3, longestWeeklyStreak: 4, weekCarry: 21 });
    expect(snap.derived.lifetime).toEqual(c({ c: 312, n: 47, p: 19 }));
    expect(snap.derived.shownUpToday).toBe(true);
    expect(snap.derived.streak).toBe(1);
    expect(snap.derived.weekPoints).toBe(37);
    expect(snap.derived.bestWeekPoints).toBe(92);
    expect(snap.badges).toEqual({ 'first-word': NOW.getTime(), overachiever: NOW.getTime() });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('1');
  });

  it('fresh install: nothing to migrate, schema stamped, still not onboarded', async () => {
    handle = setupBackground({ now: () => NOW });
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);
    expect(await repo.schemaVersion.getValue()).toBe(2);
    expect(await sendMessage('getState')).toEqual({ onboarded: false });
    expect(await repo.v1Backup.getValue()).toBeNull();
  });

  it('a later update on a v2 store changes nothing', async () => {
    handle = setupBackground({ now: () => NOW });
    await sendMessage('setSettings', { level: 4 });
    const before = await fakeBrowser.storage.local.get(null);
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '2.0.0', temporary: false } as never);
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
  });

  it('runInstallHooks accepts an injected clock', async () => {
    await seedV1();
    await runInstallHooks({ reason: 'update', temporary: false } as never, { now: NOW });
    expect((await repo.legacy.getValue())?.importedAt).toBe(NOW.getTime());
  });
});
