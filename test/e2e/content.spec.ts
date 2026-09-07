// The content-script smoke: does the built extension actually mount on a
// linkedin.com URL and report in — without ever touching LinkedIn?
//
// Playwright fulfils https://www.linkedin.com/feed/ with a stub page. Chrome
// injects content scripts by URL match, not by who served the response, so the
// script mounts on the stub exactly as it would on the real feed. Then the
// background must show a page load with the selectors version, the stub page
// must be untouched (rule 1: zero injected UI), and `debugInject` must put "1"
// on the toolbar badge.
import type { Page } from '@playwright/test';
import { expect, test } from './extension';

interface Reply {
  res?: unknown;
  err?: unknown;
}
type ExtensionGlobal = { chrome: { runtime: { sendMessage(message: unknown): Promise<Reply | undefined> } } };
type WorkerGlobal = { chrome: { action: { getBadgeText(details: object): Promise<string> } } };

async function send(page: Page, type: string, data?: unknown): Promise<unknown> {
  const reply = await page.evaluate(
    ([type, data]) =>
      (globalThis as unknown as ExtensionGlobal).chrome.runtime.sendMessage({ id: Date.now(), type, data, timestamp: Date.now() }),
    [type, data] as const,
  );
  if (reply?.err) throw new Error(`background answered ${type} with an error: ${JSON.stringify(reply.err)}`);
  return reply?.res;
}

const STUB = '<!doctype html><html><head><title>stub</title></head><body><main id="stub">stub feed</main></body></html>';

test('the content script mounts on a linkedin.com URL, reports in, and paints nothing', async ({ context, extensionId }) => {
  await context.route('https://www.linkedin.com/**', (route) => route.fulfill({ contentType: 'text/html', body: STUB }));

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await send(popup, 'setSettings', { level: 1 });

  const feed = await context.newPage();
  await feed.goto('https://www.linkedin.com/feed/');
  await expect(feed.locator('#stub')).toHaveText('stub feed');

  // The mount sends `pageLoad`; the background stamps health.
  await expect
    .poll(async () => {
      const state = (await send(popup, 'getState')) as { onboarded: boolean; health?: { lastPageLoad: number; selectorsVersion: string } };
      return state.onboarded ? state.health?.lastPageLoad : 0;
    })
    .toBeGreaterThan(0);
  const state = (await send(popup, 'getState')) as { health: { selectorsVersion: string } };
  expect(state.health.selectorsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // Rule 1: nothing injected into the page — same single child in body, no extension nodes.
  expect(await feed.evaluate(() => document.body.children.length)).toBe(1);
  expect(await feed.evaluate(() => document.querySelectorAll('[class*="go-comment"], [id*="go-comment"], [data-go-comment]').length)).toBe(0);

  // The badge shows the streak after one injected event.
  await send(popup, 'debugInject', { t: 'c', count: 1 });
  const [worker] = context.serviceWorkers();
  await expect
    .poll(() => worker!.evaluate(() => (globalThis as unknown as WorkerGlobal).chrome.action.getBadgeText({})))
    .toBe('1');
});
