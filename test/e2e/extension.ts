// Playwright fixture: a persistent Chromium context with the built extension
// loaded, plus the extension id resolved from its service worker.
//
// Extensions only run in a persistent context, and headless only through
// Playwright's `chromium` channel (a full Chromium in new-headless mode). The
// branded Google Chrome binary never surfaces the extension's service worker
// when launched headless (tried 2026-09-07, Chrome 152), and the headless-shell
// build has no extension support at all. So: `npx playwright install chromium`
// once (or point PLAYWRIGHT_BROWSERS_PATH at an existing install), then
// `npm run build` and `npm run smoke`.
import path from 'node:path';
import { chromium, test as base, type BrowserContext } from '@playwright/test';

export const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2]!);
  },
});

export const expect = test.expect;
