import { browser, type Browser } from 'wxt/browser';
import { isV1Storage, migrateV1, V1_KEYS } from '../core/migrate';
import * as repo from './repo';

/**
 * Runs from `runtime.onInstalled` before the alarms are armed and the badge is
 * drawn, inside the writer queue, so anything it writes is visible to the
 * first `getState`. The caller stamps `schemaVersion` afterwards.
 *
 * Today's only hook is the v1 → v2 migration. `now` is injectable for tests;
 * the background calls this with the real clock.
 */
export async function runInstallHooks(details: Browser.runtime.InstalledDetails, opts: { now?: Date } = {}): Promise<void> {
  void details; // the trigger is what storage holds, not the install reason
  await migrateFromV1(opts.now ?? new Date());
}

/**
 * v1 → v2, once. Fires when `schemaVersion` is absent and any v1 key exists —
 * i.e. the Web Store update landing on one of the seven v1 installs. Order is
 * chosen so a crash at any point loses nothing: the raw v1 keys are copied to
 * `v1Backup` first, then the mapped store is written, and only then are the
 * v1 slots deleted. A partial run re-runs on the next install event because
 * the trigger condition still holds. Rollover purges the backup after 30 days.
 *
 * A v1 install that never picked a level stays NOT onboarded in v2 (no
 * `settings` written) — v1 never showed its dashboard without a level either.
 * Its totals still carry over and appear once a level is chosen.
 *
 * Returns true when a migration happened.
 */
export async function migrateFromV1(now: Date): Promise<boolean> {
  const raw = (await browser.storage.local.get(null)) as Record<string, unknown>;
  if (!isV1Storage(raw)) return false;
  const out = migrateV1(raw, now);
  if (!out) return false;

  const backup: Record<string, unknown> = {};
  for (const k of V1_KEYS) if (k in raw) backup[k] = raw[k];
  await repo.v1Backup.setValue({ raw: backup, savedAt: now.getTime() });

  const hadLevel = typeof raw.selectedLevel === 'string';
  await repo.writeStore({
    events: out.events,
    ...(hadLevel ? { settings: out.settings } : {}),
    badges: out.badges,
    legacy: out.legacy,
  });

  await browser.storage.local.remove([...V1_KEYS]);
  return true;
}
