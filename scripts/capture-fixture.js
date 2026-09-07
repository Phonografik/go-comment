// Go Comment — fixture capture snippet. Paste the WHOLE file into the DevTools
// console on a linkedin.com tab and press Enter. It defines one function:
//
//     captureFixture(container, name)
//
//   container  a CSS selector or an element ($0 from the Elements tab). Use the
//              smallest element that holds both the thing you'll act on and the
//              place the outcome will appear (the post, the dialog, the
//              conversation panel, the profile top card).
//   name       the fixture name, e.g. 'comment.before' — one of comment, reply,
//              post, repost, connect, dm-thread, dm-overlay, or a negative:
//              post-discarded, comment-deleted, dm-incoming, reaction.
//
// The loop, per action:
//   1. captureFixture($0, 'comment.before')   ← comment typed, not submitted
//   2. do the action on LinkedIn; wait for the page to show it happened
//   3. captureFixture($0, 'comment.after')
//   4. save each into test/fixtures/linkedin/<name>.html, run `npm test`
//
// What it does to the HTML before it leaves the page: works on a CLONE (the
// page itself is never touched); every text node becomes same-length lorem;
// every href becomes '#', except /messaging/thread/<id>/ links, whose ids
// become FIXTURE-1, FIXTURE-2… (one per distinct id, kept consistent between
// your before and after captures), and /in/<slug>/ links, which become
// /in/FIXTURE-PERSON-1/…; src / srcset / poster and url() styles are
// stripped; digit runs inside urn:li:… values are randomised but keep their
// length (consistently, so a comment's data-id matches across the pair);
// text-bearing attributes (aria-label, title, alt, placeholder, value…) are
// lorem'd; <script>, <style>, <code>, <template>, <noscript>, <iframe> and
// HTML comments are removed; data-* identity attributes and class names are
// kept. The result is copied to the clipboard (or printed if the clipboard
// refuses) with a header comment saying when it was captured.
//
// READ THE FILE BEFORE YOU COMMIT IT. If you can see a name, a message or a
// post in there, don't push it — open an issue instead.
(() => {
  const LOREM = 'loremipsumdolorsitametconsecteturadipiscingelitseddoeiusmodtemporincididuntutlaboreetdoloremagnaaliqua';
  const threadIds = new Map();
  const profileSlugs = new Map();
  const digitRuns = new Map();

  function loremise(text) {
    let i = 0;
    return text.replace(/[A-Za-z0-9]/g, (ch) => {
      if (/[0-9]/.test(ch)) return '0';
      const l = LOREM[i++ % LOREM.length];
      return ch === ch.toUpperCase() ? l.toUpperCase() : l;
    });
  }

  function randomDigits(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function scrubUrns(value) {
    if (!value.includes('urn:li:')) return value;
    return value.replace(/\d{6,}/g, (run) => {
      if (!digitRuns.has(run)) digitRuns.set(run, randomDigits(run.length));
      return digitRuns.get(run);
    });
  }

  function scrubHref(value) {
    const thread = /\/messaging\/thread\/([^/?#]+)/.exec(value);
    if (thread) {
      if (!threadIds.has(thread[1])) threadIds.set(thread[1], `FIXTURE-${threadIds.size + 1}`);
      return `/messaging/thread/${threadIds.get(thread[1])}/`;
    }
    const profile = /\/in\/([^/?#]+)/.exec(value);
    if (profile) {
      if (!profileSlugs.has(profile[1])) profileSlugs.set(profile[1], `FIXTURE-PERSON-${profileSlugs.size + 1}`);
      return `/in/${profileSlugs.get(profile[1])}/`;
    }
    return '#';
  }

  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'LINK', 'META']);
  const DROP_ATTRS = new Set(['src', 'srcset', 'poster', 'data-delayed-url', 'data-ghost-url', 'data-ghost-classes']);
  const TEXT_ATTRS = new Set(['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'data-placeholder', 'value', 'name', 'content']);

  function scrubElement(el) {
    for (const attr of Array.from(el.attributes)) {
      const { name, value } = attr;
      if (DROP_ATTRS.has(name)) el.removeAttribute(name);
      else if (name === 'href' || name === 'action') el.setAttribute(name, scrubHref(value));
      else if (name === 'style' && /url\(/i.test(value)) el.removeAttribute(name);
      else if (TEXT_ATTRS.has(name)) el.setAttribute(name, loremise(value));
      else if (value.includes('urn:li:')) el.setAttribute(name, scrubUrns(value));
      else if (/https?:\/\//.test(value)) el.setAttribute(name, '#');
    }
  }

  function scrub(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 8) child.remove();
      else if (child.nodeType === 3) child.nodeValue = loremise(child.nodeValue);
      else if (child.nodeType === 1) {
        if (DROP_TAGS.has(child.tagName)) child.remove();
        else {
          scrubElement(child);
          scrub(child);
        }
      }
    }
  }

  function captureFixture(container, name) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el || el.nodeType !== 1) throw new Error('captureFixture: container must be a selector or an element');
    if (typeof name !== 'string' || !/^[a-z-]+\.(before|after|dialog)$/.test(name)) {
      throw new Error("captureFixture: name must look like 'comment.before' or 'comment.after'");
    }
    const clone = el.cloneNode(true);
    scrubElement(clone);
    scrub(clone);
    const date = new Date().toISOString().slice(0, 10);
    const page = scrubHref(location.pathname) === '#' ? location.pathname : scrubHref(location.pathname);
    const out = `<!-- captured ${date}, sanitised by scripts/capture-fixture.js -->\n<!-- ${name} | page: ${page} -->\n${clone.outerHTML}\n`;
    const bytes = new TextEncoder().encode(out).length;
    const done = () => console.info(`captureFixture: ${name} — ${bytes} bytes, copied to the clipboard. Save as test/fixtures/linkedin/${name}.html`);
    const fallback = () => {
      console.info(`captureFixture: ${name} — ${bytes} bytes. Clipboard unavailable; copy the string below.`);
      console.log(out);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out).then(done, fallback);
    else fallback();
    return out;
  }

  window.captureFixture = captureFixture;
  console.info("captureFixture(container, name) is ready. Example: captureFixture($0, 'comment.before')");
})();
