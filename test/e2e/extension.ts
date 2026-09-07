// Playwright fixture: a persistent Chromium context with the built extension
// loaded, plus the extension id resolved from its service worker.
//
// Extensions only run in a persistent context. Playwright runs them headless
// through Chromium's "new headless" — which the `chromium` channel (a full
// Chromium) and Google Chrome both support; the headless-shell build does not.
// Locally the default is the installed Google Chrome (no download). CI installs
// the `chromium` channel. Override with PW_CHANNEL=chrome|chromium.
import path from 'node:path';
import { chromium, test as base, type BrowserContext } from '@playwright/test';

export const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: process.env.PW_CHANNEL ?? (process.env.CI ? 'chromium' : 'chrome'),
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
