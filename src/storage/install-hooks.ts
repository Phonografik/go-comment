import type { Browser } from 'wxt/browser';

/**
 * Runs from `runtime.onInstalled` before the alarms are armed and the badge is
 * drawn, inside the writer queue, so anything it writes is visible to the
 * first `getState`.
 *
 * Does nothing today: the v1 → v2 migration lands here — owned by the
 * migrate-export branch in wave 2. It should run `core/migrate` when
 * `local:schemaVersion` is absent and any v1 key exists, write the mapped
 * store, copy the raw v1 keys into `local:v1Backup` (`{ raw, savedAt }`), and
 * delete the old slots. Rollover purges the backup once `savedAt` is 30+ days old.
 */
export async function runInstallHooks(details: Browser.runtime.InstalledDetails): Promise<void> {
  void details;
}
