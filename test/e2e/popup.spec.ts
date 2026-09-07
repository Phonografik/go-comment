// The popup smoke: open the built popup, seed state through the background,
// and screenshot every screen at 320×600. Seeding uses the same messages the
// popup itself sends — `setSettings` (the first call with a level completes
// onboarding) and `debugInject` (WXT_E2E builds only; `npm run smoke` sets it).
//
// Messages go over @webext-core/messaging's wire envelope, straight through
// chrome.runtime.sendMessage from the popup page; a reply is `{ res, err }`.
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './extension';

const SCREENS = 'test-results/screens';
const SIZE = { width: 320, height: 600 };

interface Reply {
  res?: unknown;
  err?: unknown;
}

/** The extension page's `chrome.runtime.sendMessage` — typed here because the spec compiles under Node's types, not the browser's. */
type ExtensionGlobal = { chrome: { runtime: { sendMessage(message: unknown): Promise<Reply | undefined> } } };

async function send(page: Page, type: string, data?: unknown): Promise<unknown> {
  const reply = await page.evaluate(
    ([type, data]) =>
      (globalThis as unknown as ExtensionGlobal).chrome.runtime.sendMessage({ id: Date.now(), type, data, timestamp: Date.now() }),
    [type, data] as const,
  );
  if (reply?.err) throw new Error(`background answered ${type} with an error: ${JSON.stringify(reply.err)}`);
  return reply?.res;
}

async function shoot(page: Page, name: string) {
  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: `${SCREENS}/${name}.png` });
}

test('onboarding → dashboard → badges → settings, screenshotted at 320×600', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize(SIZE);
  const popup = `chrome-extension://${extensionId}/popup.html`;

  // 1. A fresh install opens on onboarding.
  await page.goto(popup);
  const frame = page.locator('[data-screen]');
  await expect(frame).toHaveAttribute('data-screen', 'onboarding');
  await expect(page.getByText('Points mean prizes! (disclaimer: there are no prizes)')).toBeVisible();
  await expect(page.getByRole('radio', { name: /LinkedIn Lunatic/ })).toBeVisible();
  await shoot(page, 'onboarding');

  // 2. Seed: pick Go Go Go! and count three comments.
  await send(page, 'setSettings', { level: 2 });
  await send(page, 'debugInject', { t: 'c', count: 3 });

  // 3. The dashboard, from the background's own snapshot.
  await page.reload();
  await expect(frame).toHaveAttribute('data-screen', 'dashboard');
  await expect(page.getByText('GO COMMENT')).toBeVisible();
  await expect(page.getByText('Go Go Go!')).toBeVisible();
  await expect(page.getByTestId('counter-c')).toHaveText('Comments3/15');
  await expect(page.getByTestId('week-points')).toHaveText('3 / 50 this week');
  await expect(page.getByTestId('streak')).toHaveText(/^[01]$/); // 1 on a weekday, 0 at a weekend
  await expect(page.locator('[data-sprite-stage] svg rect').first()).toBeAttached();
  await shoot(page, 'dashboard');

  // 4. Badges: First Word is earned by the three comments.
  await page.getByRole('button', { name: /Badges \d+\/12/ }).click();
  await expect(frame).toHaveAttribute('data-screen', 'badges');
  await expect(page.getByTestId('badge-first-word')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('badge-centurion')).toHaveAttribute('data-unlocked', 'false');
  await shoot(page, 'badges');
  await page.getByRole('button', { name: 'Back to dashboard' }).click();

  // 5. Settings: the picked level is checked, the version is the manifest's.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(frame).toHaveAttribute('data-screen', 'settings');
  await expect(page.getByRole('radio', { name: /Go Go Go!/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/v\d+\.\d+\.\d+/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export or import your data' })).toHaveAttribute('href', /settings\.html$/);
  await shoot(page, 'settings');

  // 6. Changing level round-trips through the background.
  await page.getByRole('radio', { name: /Turn Dial to 11/ }).click();
  await expect(page.getByRole('radio', { name: /Turn Dial to 11/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await expect(page.getByTestId('week-points')).toHaveText('3 / 111 this week');
});
