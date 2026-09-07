// The settings tab in a real Chromium: export produces a real download, reset
// wipes, importing the downloaded file with Replace restores an identical
// state, and merging it again changes nothing. Needs the WXT_E2E build
// (`npm run smoke`) because seeding goes through `debugInject`.
//
// Not covered here: the v1 → v2 install path. onInstalled cannot be re-fired
// on a loaded extension and the protocol has no test-only migration message,
// so that path is gated by src/storage/install-hooks.test.ts (fake-browser)
// plus Ryan's manual run with his real exported v1 storage.
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { toDateKey } from '../../src/core/calendar';
import type { StateSnapshot } from '../../src/messaging/protocol';
import { expect, test } from './extension';

declare const chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } };

/** The @webext-core/messaging envelope, sent from an extension page the way the popup does. */
async function send<T>(page: Page, type: string, data?: unknown): Promise<T> {
  const reply = (await page.evaluate(
    ([type, data]) => chrome.runtime.sendMessage({ id: Math.floor(Math.random() * 1e9), type, data, timestamp: Date.now() }),
    [type, data] as const,
  )) as { res?: T; err?: unknown };
  if (reply?.err != null) throw new Error(`background rejected ${type}: ${JSON.stringify(reply.err)}`);
  return reply.res as T;
}

async function state(page: Page) {
  const snap = await send<StateSnapshot>(page, 'getState');
  if (!snap.onboarded) throw new Error('expected an onboarded state');
  return snap;
}

test('export → reset → import (replace) round-trips to identical state; merging the same file again is a no-op', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(page).toHaveTitle('Go Comment — Settings');

  // Seed through the protocol: onboard at level 2, then a day's worth of actions.
  await send(page, 'setSettings', { level: 2 });
  await send(page, 'debugInject', { t: 'c', count: 3 });
  await send(page, 'debugInject', { t: 'n', count: 2 });
  await send(page, 'debugInject', { t: 'p', count: 1 });
  const before = await state(page);
  expect(before.derived.lifetime).toMatchObject({ c: 3, n: 2, p: 1 });
  expect(before.derived.shownUpToday).toBe(true);

  await page.reload();
  await expect(page.getByText('Go Go Go!').first()).toBeVisible();

  // Export: one click, one real download, named by the local day.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export', exact: true }).click()]);
  expect(download.suggestedFilename()).toBe(`go-comment-${toDateKey(new Date())}.json`);
  const path = (await download.path())!;
  const file = JSON.parse(await readFile(path, 'utf8')) as { schemaVersion: number; data: { events: unknown[]; settings: { level: number } } };
  expect(file.schemaVersion).toBe(2);
  expect(file.data.events).toHaveLength(6);
  expect(file.data.settings.level).toBe(2);
  await expect(page.getByText('6 events in the file')).toBeVisible();

  // Reset: asks first, then everything but the level is gone.
  await page.getByRole('button', { name: 'Reset all activity', exact: true }).click();
  await expect(page.getByText('This can’t be undone')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, wipe it', exact: true }).click();
  await expect(page.getByText('Reset. You now have:')).toBeVisible();
  const wiped = await state(page);
  expect(wiped.derived.lifetime).toEqual({ c: 0, r: 0, p: 0, q: 0, n: 0, m: 0 });
  expect(wiped.derived.shownUpToday).toBe(false);
  expect(wiped.settings.level).toBe(2);
  expect(wiped.badges).toEqual({});

  // Import the file we just exported, Replace: identical to before.
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('6 events across 1 day, level Go Go Go!')).toBeVisible();
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByText('Replaced. You now have:')).toBeVisible();
  const restored = await state(page);
  expect(restored.derived).toEqual(before.derived);
  expect(restored.badges).toEqual(before.badges);
  expect(restored.settings).toEqual(before.settings);
  expect(restored.legacy).toBeUndefined();

  // Merge the same file again: union by type + timestamp, so nothing double-counts.
  await page.locator('input[type=file]').setInputFiles(path);
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  await expect(page.getByText('Merged. You now have:')).toBeVisible();
  const merged = await state(page);
  expect(merged.derived).toEqual(before.derived);
  expect(merged.badges).toEqual(before.badges);
});

test('a file that is not an export is refused with the reason, and nothing is sent', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/settings.html`);
  await send(page, 'setSettings', { level: 1 });
  await page.reload();

  await page.locator('input[type=file]').setInputFiles({
    name: 'old-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, data: {} })),
  });
  await expect(page.getByRole('alert')).toHaveText('Can’t import old-v1.json: schemaVersion is 1 — this page only reads version 2 exports.');
  await expect(page.getByRole('button', { name: 'Replace', exact: true })).toHaveCount(0);
  const snap = await state(page);
  expect(snap.settings.level).toBe(1);
});
