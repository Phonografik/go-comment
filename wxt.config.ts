import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// The manifest is deliberately tiny. `permissions` must stay a SUBSET of v1's
// (`storage` + `alarms`) so the existing Web Store users are never re-prompted,
// and there are no `host_permissions` at all — the content script's `matches`
// is all an observer needs. test/build/manifest.test.ts asserts the built
// manifest equals exactly what we expect, so an accidental expansion goes red.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  srcDir: '.',
  outDir: '.output',
  manifest: ({ browser }) => ({
    name: 'Go Comment',
    permissions: ['storage', 'alarms'],
    // Firefox needs a stable add-on id and (since Nov 2025) a data-collection
    // declaration — ours is honestly "none". Chrome warns on the unknown key.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: { id: 'go-comment@phonografik.com', data_collection_permissions: { required: ['none'] } },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      // Vite's modulepreload polyfill contains a `fetch(` (it fetches the
      // extension's own chunks on old browsers). Every browser we ship to
      // supports <link rel=modulepreload>, so drop the polyfill and keep the
      // bundle free of network primitives for the no-network guard.
      modulePreload: { polyfill: false },
    },
  }),
});
