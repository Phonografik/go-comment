import { defineConfig } from '@playwright/test';

// The Playwright smoke: loads the BUILT extension (.output/chrome-mv3) into a
// persistent Chromium context and drives the popup / settings pages. Run
// `npm run build` first, then `npm run smoke`. See test/e2e/extension.ts for
// the fixture that launches the browser and resolves the extension id.
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
