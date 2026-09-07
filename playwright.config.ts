import { defineConfig } from '@playwright/test';

// The Playwright smoke: `npm run smoke` builds the extension with WXT_E2E=true
// (which is the ONLY thing that enables the `debugInject` message the specs use
// to seed state — production builds refuse it), loads .output/chrome-mv3 into a
// persistent Chromium context and drives the popup / settings pages. See
// test/e2e/extension.ts for the fixture that launches the browser and resolves
// the extension id. Needs `npx playwright install chromium` once.
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.ts',
  // One browser at a time: every test launches its own persistent context with the extension loaded.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
  },
});
