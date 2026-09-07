# Contributing to Go Comment

Thanks for helping. Most contributions are one of two things: a detection repair after LinkedIn
changed its page, or a small fix somewhere else. Both go through the same gate.

Before anything else, read [What it never does](README.md#what-it-never-does). A pull request that
crosses one of the five rules will be closed however good the code is.

## The fixture repair loop (when LinkedIn changes something)

Go Comment never records a click. It records the moment the page shows the action happened: the
editor empties and your comment appears, the Connect button turns to Pending, the share dialog
closes. That means detection depends on the shape of LinkedIn's page, and exactly one file,
`src/detect/selectors.ts`, is allowed to know that shape. When LinkedIn changes the page, that file
is what needs fixing, and a fixture pair is what proves the fix.

A fixture pair is two sanitised HTML snapshots of the same container: `<action>.before.html` (the
moment before you act) and `<action>.after.html` (after the page has shown the outcome). The tests
mount *before*, fire the hint, swap in *after*, and assert that exactly one event was emitted. The
real detection pipeline, MutationObserver included, is what runs under test.

Step by step:

1. **Go to the page where detection broke** and open DevTools on the Console tab. If the popup's
   health row says "Last comment detected 2 days ago", comments are the action to capture.
2. **Paste the capture snippet.** Copy the contents of `scripts/capture-fixture.js` into the console
   and press Enter. It defines `captureFixture(container, name)`.
3. **Pick the container.** Select the post (or dialog, conversation panel, or profile card) in the
   Elements tab so it becomes `$0`, or find it with `document.querySelector`. Use the smallest
   element that contains both the thing you'll click and the place the outcome will appear.
4. **Capture *before*:** `captureFixture($0, 'comment.before')`, with your comment typed but not
   submitted (or the dialog open, or the Connect button still showing Connect).
5. **Do the action.** Submit the comment, send the message, click Connect. Wait for the page to
   show it happened.
6. **Capture *after*:** `captureFixture($0, 'comment.after')`.
7. **Save both** into `test/fixtures/linkedin/` as `comment.before.html` and `comment.after.html`
   (the snippet copies the sanitised HTML to your clipboard). Use the existing action names:
   `comment`, `reply`, `post`, `repost`, `connect`, `dm-thread`, `dm-overlay`. Negatives
   (`post-discarded`, `comment-deleted`, `dm-incoming`, `reaction`) are snapshots of things that
   must *not* count, and they follow the same shape. Connect is the one action with an
   intermediate state: capture `connect.before`, click Connect, capture the add-a-note dialog as
   `connect.dialog`, send, then capture `connect.after`. `captureFixture` accepts `.dialog` as a
   name for exactly this.
8. **Run `npm test`.** It should go red, with the new fixture as the failing test. If it stays
   green, the fixture doesn't reproduce the break: capture a tighter container or a different
   moment.
9. **Edit `src/detect/selectors.ts` and nothing else** until `npm test` is green. Every other file
   calls the named predicates exported from there (`isCommentEditor`, `postContainerOf`,
   `isShareDialog`, `isConnectButton`, `isPendingState`, `isMessageComposer` and friends), so a
   repair should never need to touch a second file. Prefer structure and ARIA (`form` plus a
   `submit` event, `[role=dialog]`, `button[type=submit]`, the `disabled` attribute), then
   LinkedIn's own identity attributes (`data-id` and `data-urn` matching `urn:li:…`,
   `svg[data-test-icon]`, the `/messaging/thread/` URL), and class names only as a last resort.
10. **Bump `SELECTORS_VERSION`** in the same file to today's date, `YYYY-MM-DD`. The popup shows it
    in the health row and includes it in issue reports, so we can tell which rules a user is on.
11. **Run `npm run verify`**, commit the fixture pair and the selectors change together, and open a
    pull request. Say which action broke, which browser, and which UI language you captured in.

### What the snippet scrubs

`captureFixture` serialises the container's HTML with every text node replaced by same-length
lorem, every `href` replaced with `#` except that `/in/<slug>/` links become
`/in/FIXTURE-PERSON-1/`, `/in/FIXTURE-PERSON-2/`… and `/messaging/thread/<id>/` ids become
`FIXTURE-1`, `FIXTURE-2`… (one per distinct id, kept consistent across a before/after pair),
`src` attributes stripped, URNs randomised but pattern-preserved, and `<code>` JSON blocks
removed. It is built
to be safe for a public repository. Still, read the file before you commit it. If you can see a
name, a message or a post in there, don't push it. Open an issue instead and we'll capture it
another way.

## What a pull request must keep

- **The five rules.** Nothing on linkedin.com, observe only, counts not content, network-silent,
  no AI help. Rules 3 and 4 have tests and a bundle scan behind them; the reviewer checks the rest
  by reading the diff.
- **`src/detect/selectors.ts` is the only file that knows LinkedIn.** If a change anywhere else
  needs a LinkedIn class name, attribute or URL, it is in the wrong file.
- **A selectors change without a fixture pair is rejected.** No exceptions. The fixture is the test.
- **`src/core` stays pure.** No browser APIs, no DOM, no `Date.now()`; `now` is always passed in.
  ESLint refuses `wxt` imports there. A rules change without a test is not done.
- **The manifest test and the no-network guard stay green.** Built `permissions` are exactly
  `storage` + `alarms`, there are no `host_permissions`, the content script matches only
  `https://www.linkedin.com/*`, and the built bundle contains no `fetch`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon` or `EventSource`, and no URL outside a short allowlist. If a
  dependency brings one in, the dependency goes.
- **Never visible text or `aria-label` as a detection signal.** Both are localised. That is how
  version 1 died.

## The gate

```
npm run verify
```

Typecheck, lint, unit tests, Chrome build, Firefox build, the manifest-equality test, the
no-network bundle scan. It must be green before every commit, not just before the PR. CI runs the
same command on every push and pull request, followed by the Playwright smoke
(`npx playwright install chromium` once, then `npm run smoke`).

## Branches and commits

- Small commits, each one green. Run `npm run verify` before each.
- One concern per pull request. A selectors repair and a popup tweak are two PRs.
- Commit messages in plain English: what changed and why, first line short.
- Leave version bumps and releases to the maintainer. A `v*` tag builds the zips into a GitHub
  Release.

## Reporting a detection break

You don't have to fix it to report it. The popup's health row turns yellow when a linkedin.com
page has loaded recently but nothing has been detected for a while, or when several hints have gone
unconfirmed. Its **Report** link opens a prefilled GitHub issue carrying the selectors version, your
browser, and the unconfirmed counts. No content, no URLs, nothing about what you did or to whom.
Add which action stopped counting and which UI language you use, and send it.

Or open an issue by hand at
[github.com/Phonografik/go-comment/issues](https://github.com/Phonografik/go-comment/issues).
