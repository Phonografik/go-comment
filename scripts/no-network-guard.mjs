// Fails the gate if the BUILT bundle could talk to the network.
//
// Go Comment's whole privacy story is "nothing leaves your device". Manifest
// permissions can't prove that (a content script on linkedin.com can fetch),
// so this scans every JS file WXT emitted for the primitives a call would
// need, plus any URL that isn't on the short allowlist below. Run after
// `npm run build` and `npm run build:firefox`; CI runs it on every push.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '.output';
const TARGETS = ['chrome-mv3', 'firefox-mv2', 'firefox-mv3'];

// Primitives: any hit is a failure, no allowlist.
const PRIMITIVES = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bnavigator\.sendBeacon\b/, /\bEventSource\b/, /\bimportScripts\s*\(/];

// URL strings the bundle is allowed to contain. Everything else fails.
// Keep this list SHORT and explain every entry.
const URL_ALLOWLIST = [
  'https://www.linkedin.com/*', // the content-script match pattern
  'https://github.com/Phonografik/go-comment', // the "Report" link in the popup
  'https://phonografik.github.io/go-comment/', // PRIVACY.md on GitHub Pages, linked from settings
  'http://www.w3.org/', // SVG / XHTML namespace constants inside React DOM
  'https://react.dev/', // React's production error-decoder links
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith('.js')) files.push(p);
  }
  return files;
}

let failures = 0;
let scanned = 0;
for (const target of TARGETS) {
  const dir = join(OUT, target);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    scanned++;
    const src = readFileSync(file, 'utf8');
    for (const re of PRIMITIVES) {
      if (re.test(src)) {
        console.error(`✗ ${file}: network primitive ${re}`);
        failures++;
      }
    }
    for (const m of src.matchAll(/https?:\/\/[^\s"'`)\]]+/g)) {
      const url = m[0];
      if (!URL_ALLOWLIST.some((ok) => url.startsWith(ok))) {
        console.error(`✗ ${file}: URL not on allowlist: ${url}`);
        failures++;
      }
    }
  }
}

if (scanned === 0) {
  console.error('✗ no built JS found under .output — run `npm run build` first');
  process.exit(1);
}
if (failures > 0) {
  console.error(`\nno-network guard: ${failures} problem(s) in ${scanned} file(s)`);
  process.exit(1);
}
console.log(`no-network guard: ${scanned} file(s) clean`);
