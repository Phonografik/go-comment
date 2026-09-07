// Renders the Chrome Web Store assets and the README screenshots from the REAL
// popup: it builds the extension, loads it into Playwright's Chromium, seeds a
// realistic history through the same `importData` message the settings page
// uses, and screenshots each screen. Nothing is mocked — every number on every
// shot is what src/core derives from the seed. compose.html then frames the
// popup shots at the store's exact pixel sizes.
//
//   node scripts/store-assets/render.mjs <outDir> [--at 2026-09-09T10:42] [--no-build] [--readme]
//
// Needs Playwright's Chromium (`npx playwright install chromium` once, or
// PLAYWRIGHT_BROWSERS_PATH pointing at an install). Runs `npx wxt build` first
// unless --no-build; the production build is enough — importData is a real
// feature, not a debug hook. --readme also copies the three README shots into
// docs/screenshots/.
//
// The clock is FIXED, in the popup page and in the background service worker
// alike (a Date shim in both), so the run is reproducible on any day. `--at`
// must be a Wednesday: the seed is shaped around mid-week (Monday frozen,
// Tuesday done, today in progress), and the at-risk and moult states are the
// same seed viewed at 18:35 that day and 09:10 the following Monday.
//
// Output (<outDir>/):
//   128.png                     store icon (a copy of public/icon/128.png)
//   screenshot-1.png … -6.png   1280×800 — dashboard, at-risk, badges, onboarding, settings, moult
//   tile-440x280.png            small promo tile
//   marquee-1400x560.png        marquee (optional in the dashboard)
//   popup/<state>.png           the raw popup at 2× (640×1200) — the README shots
//   popup/<state>@1.2x.png      the popup at 1.2× (384×720), what the screenshots frame
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const EXTENSION_PATH = path.join(ROOT, '.output/chrome-mv3');
const POPUP_SIZE = { width: 320, height: 600 };

// ---- args -------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const outDir = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--at');
if (!outDir) {
  console.error('usage: node scripts/store-assets/render.mjs <outDir> [--at YYYY-MM-DDTHH:mm] [--no-build] [--readme]');
  process.exit(2);
}
const OUT = path.resolve(outDir);
const AT = opt('--at', '2026-09-09T10:42');

// ---- local-date helpers (the same rules as src/core/calendar.ts) --------------

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k, n) => {
  const [y, m, d] = k.split('-').map(Number);
  return toKey(new Date(y, m - 1, d + n));
};
/** Local time on a day key: at(key, 9, 30) → 09:30 that day. */
const at = (key, h, min = 0) => {
  const d = fromKey(key);
  d.setHours(h, min, 0, 0);
  return d.getTime();
};

const anchor = new Date(AT);
if (Number.isNaN(anchor.getTime())) throw new Error(`--at is not a date: ${AT}`);
if (anchor.getDay() !== 3) throw new Error(`--at must be a Wednesday (got ${toKey(anchor)}); the seed is shaped around mid-week`);
const WED = toKey(anchor);
const MON = addDays(WED, -2);

// ---- the seed ---------------------------------------------------------------
//
// Level 3, Turn Dial to 11 (111 a week). Points: post 8 · DM 4 · repost 3 ·
// connection 2 · comment 1 · reply 1. Read top to bottom it tells one story:
//
//   Thu, ~6 weeks ago   one comment                       First Word
//   (silence)
//   Mon–Fri, 2 wks ago  28+20+24+21+18 = 111 exactly      Back From The Dead (Mon),
//                                                         Five Alive + Full House (Fri), freeze #1
//   Mon–Fri, last week  30+21+25+34+26 = 136              Fortnight (Fri, day 10), freeze #2
//   Mon, this week      nothing                           freeze #1 spent → 1 banked
//   Tue                 25
//   Wed (today, 10:42)  33                                this week 58 / 111, streak 12
//
// The parrot is a Show-off (stage 4) because last week cleared 111.
const D = (c = 0, r = 0, p = 0, q = 0, n = 0, m = 0) => ({ c, r, p, q, n, m });
const WEEK_MINUS_2 = [D(5, 1, 1, 0, 3, 2), D(4, 2, 0, 0, 3, 2), D(5, 0, 1, 1, 2, 1), D(6, 1, 0, 0, 3, 2), D(4, 2, 0, 0, 2, 2)];
const WEEK_MINUS_1 = [D(6, 0, 1, 0, 4, 2), D(5, 2, 0, 0, 3, 2), D(4, 0, 1, 1, 3, 1), D(5, 0, 1, 1, 3, 3), D(7, 3, 0, 0, 4, 2)];
const TUESDAY = D(6, 2, 0, 1, 3, 2);
const TODAY = D(7, 2, 1, 0, 4, 2);
/** Only the moult view has these: the rest of the week, kept under 111 so the parrot drops. */
const THURSDAY = D(5, 1, 0, 0, 3, 2);
const FRIDAY = D(6, 2, 0, 0, 2, 2);

/** Day key → counts, for one of the three views of the same history. */
function history(variant) {
  const days = new Map();
  days.set(addDays(MON, -39), D(1));
  WEEK_MINUS_2.forEach((c, i) => days.set(addDays(MON, -14 + i), c));
  WEEK_MINUS_1.forEach((c, i) => days.set(addDays(MON, -7 + i), c));
  days.set(addDays(MON, 1), TUESDAY);
  if (variant !== 'at-risk') days.set(WED, TODAY);
  if (variant === 'moult') {
    days.set(addDays(MON, 3), THURSDAY);
    days.set(addDays(MON, 4), FRIDAY);
  }
  return days;
}

/** The ExportFile the settings page would import — events from 09:30, three minutes apart. */
function exportFile(variant, nowMs) {
  const events = [];
  for (const [d, counts] of history(variant)) {
    let i = 0;
    for (const t of ['p', 'm', 'q', 'n', 'c', 'r']) {
      for (let k = 0; k < counts[t]; k++) events.push({ t, ts: at(d, 9, 30) + i++ * 180_000, d });
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  const lastDetected = {};
  for (const e of events) lastDetected[e.t] = Math.max(lastDetected[e.t] ?? 0, e.ts);
  // The last linkedin.com page load was shortly after the last action — not "now": the popup
  // can be opened before LinkedIn is, and a Monday-morning load with Friday's last comment
  // would (correctly, per health.ts) turn the detection row yellow.
  const lastPageLoad = Math.max(...Object.values(lastDetected)) + 20 * 60_000;
  const firstOn = (key) => events.find((e) => e.d === key).ts;
  const lastOn = (key) => events.filter((e) => e.d === key).at(-1).ts;
  const selectorsVersion = readFileSync(path.join(ROOT, 'src/detect/selectors.ts'), 'utf8').match(/SELECTORS_VERSION = '([^']+)'/)?.[1] ?? '';
  return {
    schemaVersion: 2,
    exportedAt: nowMs,
    data: {
      events,
      days: {},
      settings: { level: 3, memberSince: at(addDays(MON, -39), 9, 0) },
      badges: {
        'first-word': firstOn(addDays(MON, -39)),
        'back-from-the-dead': firstOn(addDays(MON, -14)),
        'five-alive': firstOn(addDays(MON, -10)),
        'full-house': lastOn(addDays(MON, -10)),
        fortnight: firstOn(addDays(MON, -3)),
      },
      health: { lastPageLoad, unconfirmed: {}, lastDetected, selectorsVersion },
    },
  };
}

// ---- the states -------------------------------------------------------------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const headerDate = (ms) => {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const STATES = [
  { name: 'onboarding', now: anchor.getTime(), seed: null, screen: 'onboarding' },
  { name: 'dashboard', now: anchor.getTime(), seed: 'week', screen: 'dashboard', expect: { streak: '12', week: '58 / 111 this week' } },
  { name: 'badges', now: anchor.getTime(), seed: 'week', screen: 'badges' },
  { name: 'settings', now: anchor.getTime(), seed: 'week', screen: 'settings' },
  { name: 'at-risk', now: at(WED, 18, 35), seed: 'at-risk', screen: 'dashboard', expect: { streak: '11' } },
  // Must render after `dashboard`: the moult card needs the stage the popup last showed (src/ui/components/moult.ts).
  { name: 'moult', now: at(addDays(MON, 7), 9, 10), seed: 'moult', screen: 'dashboard', expect: { streak: '14', notice: 'Your parrot has moulted.' } },
];

/** What the composed screenshots say. Never automation, never AI, never a claim about LinkedIn itself. */
const CAPTIONS = {
  dashboard: {
    title: 'Keep score of your own activity.',
    body: 'Comments, replies, posts, reposts, connection requests and DMs, counted as you do them. A weekday streak, a weekly target, and a parrot that grows when you hit it.',
  },
  'at-risk': {
    title: 'It watches. It counts. It nags.',
    body: 'Nothing by 18:00 on a weekday? The toolbar badge turns amber and the popup reminds you the streak ends at midnight, unless a freeze you earned covers the day.',
  },
  badges: {
    title: 'Twelve badges. Earned once, never taken away.',
    body: 'From your first counted action to a hundred-day streak. Points mean prizes! (disclaimer: there are no prizes)',
  },
  onboarding: {
    title: 'Pick a weekly target.',
    body: 'Six levels, from No Comment to LinkedIn Lunatic. Each comes with a recipe that adds up to the target, so you always know what a week looks like.',
  },
  settings: {
    title: 'Nothing leaves your device.',
    body: 'Counts and day keys only, kept in the browser’s extension storage. No account, no server, no analytics. Export, import or wipe it whenever you like.',
  },
  moult: {
    title: 'Stop, and the parrot moults.',
    body: 'Its stage is the best of this week and last. Finish a week under the target and it drops back down on Monday. That is the joke.',
  },
};
const SCREENSHOT_ORDER = ['dashboard', 'at-risk', 'badges', 'onboarding', 'settings', 'moult'];

// ---- browser plumbing -------------------------------------------------------

/** Pins `new Date()` / `Date.now()` to `fixedMs`; everything else about Date is untouched. Runs in the page and in the worker. */
function installClock(fixedMs) {
  const g = globalThis;
  const Real = g.__gcRealDate ?? g.Date;
  g.__gcRealDate = Real;
  class Fixed extends Real {
    constructor(...args) {
      if (args.length === 0) super(fixedMs);
      else super(...args);
    }
    static now() {
      return fixedMs;
    }
  }
  g.Date = Fixed;
}

async function serviceWorker(context) {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker;
}

/** chrome.runtime.sendMessage over @webext-core/messaging's envelope, from an extension page. Replies are `{ res, err }`. */
async function send(page, type, data) {
  const reply = await page.evaluate(
    ([type, data]) => globalThis.chrome.runtime.sendMessage({ id: Date.now(), type, data, timestamp: Date.now() }),
    [type, data],
  );
  if (reply?.err) throw new Error(`background answered ${type} with an error: ${JSON.stringify(reply.err)}`);
  return reply?.res;
}

async function expectText(locator, text, what) {
  const actual = (await locator.textContent())?.trim();
  if (actual !== text) throw new Error(`${what}: expected "${text}", popup shows "${actual}"`);
}

/** Renders every state once at `scale` and returns name → PNG path. */
async function renderPopups(scale, suffix) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    viewport: POPUP_SIZE,
    deviceScaleFactor: scale,
  });
  const files = {};
  try {
    const extensionId = (await serviceWorker(context)).url().split('/')[2];
    const popup = `chrome-extension://${extensionId}/popup.html`;

    for (const state of STATES) {
      const page = await context.newPage();
      await page.addInitScript(installClock, state.now);
      const ready = () => page.locator('[data-screen]:not([data-screen="loading"])').waitFor();
      await page.goto(popup);
      await ready();

      // The worker is awake now (it just answered getState); pin its clock, then seed through it.
      await (await serviceWorker(context)).evaluate(installClock, state.now);
      if (state.seed) {
        await send(page, 'setSettings', { level: 3 });
        await send(page, 'importData', { file: exportFile(state.seed, state.now), mode: 'replace' });
      } else {
        await page.evaluate(() => globalThis.chrome.storage.local.clear());
      }
      await page.reload();
      await ready();
      const frame = page.locator('[data-screen]');

      if (state.seed) {
        await expectText(page.getByTestId('date'), headerDate(state.now), `${state.name} header date`);
        if (state.expect?.streak) await expectText(page.getByTestId('streak'), state.expect.streak, `${state.name} streak`);
        if (state.expect?.week) await expectText(page.getByTestId('week-points'), state.expect.week, `${state.name} week points`);
        if (state.expect?.notice) {
          const notice = (await page.getByTestId('notice').textContent()) ?? '';
          if (!notice.includes(state.expect.notice)) throw new Error(`${state.name}: expected the notice "${state.expect.notice}", got "${notice}"`);
        }
        if (state.screen === 'badges') await page.getByRole('button', { name: /Badges \d+\/12/ }).click();
        if (state.screen === 'settings') await page.getByRole('button', { name: 'Settings' }).click();
      }
      const screen = await frame.getAttribute('data-screen');
      if (screen !== state.screen) throw new Error(`${state.name}: expected the ${state.screen} screen, popup shows ${screen}`);
      await page.evaluate(() => document.fonts.ready);

      const file = path.join(OUT, 'popup', `${state.name}${suffix}.png`);
      await page.screenshot({ path: file });
      files[state.name] = file;
      console.log(`popup  ${path.relative(OUT, file)}  (${state.screen} at ${headerDate(state.now)} ${new Date(state.now).toTimeString().slice(0, 5)})`);
      await page.close();
    }
  } finally {
    await context.close();
  }
  return files;
}

// ---- composing --------------------------------------------------------------

const dataUri = (file, mime) => `data:${mime};base64,${readFileSync(file).toString('base64')}`;

async function composeAll(popups) {
  const font = dataUri(path.join(ROOT, 'node_modules/@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2'), 'font/woff2');
  const icon = dataUri(path.join(ROOT, 'public/icon/128.png'), 'image/png');
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const shoot = async (kind, size, data, file) => {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(HERE, 'compose.html')).href);
      await page.evaluate((d) => globalThis.compose(d), { kind, font, icon, ...size, ...data });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
      await page.screenshot({ path: file, clip: { x: 0, y: 0, ...size } });
      await page.close();
      console.log(`asset  ${path.relative(OUT, file)}  ${size.width}×${size.height}`);
    };

    let n = 0;
    for (const name of SCREENSHOT_ORDER) {
      n++;
      await shoot('screenshot', { width: 1280, height: 800 }, { shot: dataUri(popups[name], 'image/png'), ...CAPTIONS[name] }, path.join(OUT, `screenshot-${n}.png`));
    }
    await shoot('tile', { width: 440, height: 280 }, {}, path.join(OUT, 'tile-440x280.png'));
    await shoot('marquee', { width: 1400, height: 560 }, { shot: dataUri(popups.dashboard, 'image/png') }, path.join(OUT, 'marquee-1400x560.png'));
  } finally {
    await browser.close();
  }
}

// ---- main -------------------------------------------------------------------

if (!flag('--no-build')) {
  const build = spawnSync('npx', ['wxt', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
mkdirSync(path.join(OUT, 'popup'), { recursive: true });

const twoX = await renderPopups(2, '');
const framed = await renderPopups(1.2, '@1.2x');
await composeAll(framed);
copyFileSync(path.join(ROOT, 'public/icon/128.png'), path.join(OUT, '128.png'));
console.log('asset  128.png  128×128');

if (flag('--readme')) {
  const docs = path.join(ROOT, 'docs/screenshots');
  mkdirSync(docs, { recursive: true });
  for (const name of ['dashboard', 'badges', 'settings']) {
    copyFileSync(twoX[name], path.join(docs, `${name}.png`));
    console.log(`readme docs/screenshots/${name}.png`);
  }
}
