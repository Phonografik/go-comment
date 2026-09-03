// Asserts the BUILT manifest is exactly what we intend — nothing more.
// Runs after `npm run build` + `npm run build:firefox` (npm run test:build).
//
// Why exact equality: the permission set is a promise to the 7 existing Web
// Store users (no re-prompt) and to everyone reading PRIVACY.md. A dependency
// or a WXT upgrade that quietly adds `host_permissions`, `optional_permissions`
// or a wider match pattern must go red here, not get noticed in store review.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string; description: string };

const ICONS = { '16': 'icon/16.png', '32': 'icon/32.png', '48': 'icon/48.png', '128': 'icon/128.png' };
const CONTENT_SCRIPTS = [
  {
    matches: ['https://www.linkedin.com/*'],
    run_at: 'document_idle',
    js: ['content-scripts/linkedin.js'],
  },
];

function load(target: string): Record<string, unknown> {
  const path = `.output/${target}/manifest.json`;
  if (!existsSync(path)) throw new Error(`${path} missing — run \`npm run build\` and \`npm run build:firefox\` first`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('built manifest', () => {
  it('chrome-mv3 is exactly the expected manifest', () => {
    expect(load('chrome-mv3')).toEqual({
      manifest_version: 3,
      name: 'Go Comment',
      description: pkg.description,
      version: pkg.version,
      icons: ICONS,
      permissions: ['storage', 'alarms'],
      background: { service_worker: 'background.js' },
      action: { default_title: 'Go Comment', default_popup: 'popup.html' },
      content_scripts: CONTENT_SCRIPTS,
    });
  });

  it('firefox-mv2 is exactly the expected manifest', () => {
    expect(load('firefox-mv2')).toEqual({
      manifest_version: 2,
      name: 'Go Comment',
      description: pkg.description,
      version: pkg.version,
      icons: ICONS,
      permissions: ['storage', 'alarms'],
      browser_specific_settings: {
        gecko: { id: 'go-comment@phonografik.com', data_collection_permissions: { required: ['none'] } },
      },
      background: { scripts: ['background.js'] },
      browser_action: { default_title: 'Go Comment', default_popup: 'popup.html' },
      content_scripts: CONTENT_SCRIPTS,
    });
  });

  it.each(['chrome-mv3', 'firefox-mv2'])('%s asks for nothing beyond storage + alarms', (target) => {
    const m = load(target);
    expect(m.permissions).toEqual(['storage', 'alarms']);
    expect(m.host_permissions).toBeUndefined();
    expect(m.optional_permissions).toBeUndefined();
    expect(m.optional_host_permissions).toBeUndefined();
    expect(m.web_accessible_resources).toBeUndefined();
  });
});
