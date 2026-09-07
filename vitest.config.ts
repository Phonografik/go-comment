import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Playwright specs (*.spec.ts under test/e2e) are run by `npm run smoke`, never by Vitest.
    exclude: ['**/node_modules/**', '.output/**', 'test/e2e/**'],
    setupFiles: ['test/setup.ts'],
  },
});
