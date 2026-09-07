// THE ONLY FILE ALLOWED TO KNOW LINKEDIN'S DOM.
//
// Everything else in the extension calls the named predicates and finders
// exported here, so when LinkedIn changes its markup the repair is: capture a
// new fixture pair with scripts/capture-fixture.js → the fixture tests go red →
// edit THIS file until green → bump SELECTORS_VERSION → release.
//
// Signal hierarchy — the highest layer available wins, and every predicate
// below says which layer(s) it uses:
//
//   L1  structural / ARIA: `[contenteditable=true]`, `form` + the `submit`
//       event, `[role=dialog]`, `button[type=submit]`, `disabled`, list markup.
//   L2  LinkedIn's own identity attributes — they exist for its tooling, not
//       for styling, so they outlive restyles: `data-id` / `data-urn` starting
//       `urn:li:activity` / `urn:li:comment`, `svg[data-test-icon]`
//       (`connect-*`, `clock-*`), and the `/messaging/thread/<id>/` URL shape.
//       Read at runtime, never stored.
//   L3  class names — fallback only, and only in this file. These are the
//       names v1 matched (see the v1 repo's content.js) and are the first
//       thing to break.
//
// NEVER visible text or `aria-label`: both are localised and were v1's fatal
// flaw. Nothing in this file returns text, names, URNs or URLs — finders
// return elements, counters return numbers, and the one string that leaves
// (`threadKeyFor`) is read at confirm time, handed to the background to hash,
// and never stored or logged.
//
// UNVERIFIED (2026-09-07): every selector here is synthesised from the best-
// known LinkedIn DOM, not captured. The three assumptions the plan flags —
// the comment form fires `submit`; `data-test-icon` is present on Connect /
// Pending; the overlay bubble carries a thread link — plus everything in the
// L3 layer, only a real capture can confirm.

export const SELECTORS_VERSION = '2026-09-07';

// ---------------------------------------------------------------- L1 --------
const EDITOR = '[contenteditable="true"]';
const DIALOG = '[role="dialog"]';
const SUBMIT_BUTTON = 'button[type="submit"]';
const CLICKABLE = 'button, [role="button"]';
const LIST = 'ul, ol, [role="list"]';
const LIST_ITEM = 'li, [role="listitem"]';

// ---------------------------------------------------------------- L2 --------
const COMMENT_NODE = '[data-id^="urn:li:comment"]';
const ACTIVITY_NODE = [
  '[data-urn^="urn:li:activity"]',
  '[data-id^="urn:li:activity"]',
  '[data-urn^="urn:li:ugcPost"]',
  '[data-id^="urn:li:ugcPost"]',
  '[data-urn^="urn:li:share"]',
  '[data-id^="urn:li:share"]',
].join(', ');
const CONNECT_ICON = 'svg[data-test-icon^="connect"], li-icon[type^="connect"]';
const PENDING_ICON = 'svg[data-test-icon^="clock"], li-icon[type^="clock"]';
/** v1 read `data-control-name`; LinkedIn's older pages still carry it on primary actions. */
const CONNECT_CONTROL = '[data-control-name^="connect"]';
const THREAD_LINK = 'a[href*="/messaging/thread/"]';
const PROFILE_LINK = 'a[href*="/in/"]';
const THREAD_PATH = /\/messaging\/thread\/([^/?#]+)/;
const PROFILE_PATH = /\/in\/([^/?#]+)/;
const MESSAGING_PATH = /^\/messaging(\/|$)/;

// ---------------------------------------------------------------- L3 --------
const L3_COMMENT_BOX = '.comments-comment-box';
const L3_COMMENT_FORM = '.comments-comment-box__form';
const L3_POST_CONTAINER = '.feed-shared-update-v2';
const L3_SHARE_PRIMARY = '.share-actions__primary-action';
const L3_PRIMARY_BUTTON = '.artdeco-button--primary';
const L3_RESHARE = '[class*="reshare"]';
const L3_MESSAGE_FORM = '.msg-form';
const L3_MESSAGE_LIST = '.msg-s-message-list-content, .msg-s-message-list';
const L3_CONVERSATION = '.msg-overlay-conversation-bubble, .msg-convo-wrapper';
const L3_CARD = '.artdeco-card';

// ------------------------------------------------------------ helpers -------

const isElement = (n: unknown): n is Element =>
  typeof n === 'object' && n !== null && (n as Node).nodeType === 1;

/** The Element a DOM event landed on, or null for text / document targets. */
export function elementOf(target: EventTarget | null): Element | null {
  return isElement(target) ? target : null;
}

/** Nearest button-like ancestor (L1). Dropdown items on LinkedIn are `[role=button]` divs. */
export function clickableOf(el: Element): Element | null {
  return el.closest(CLICKABLE);
}

/** L1: the `disabled` attribute. */
export function isEnabled(el: Element): boolean {
  return !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true';
}

/** L1: `button[type=submit]`. */
export function isSubmitButton(el: Element): boolean {
  return el.matches(SUBMIT_BUTTON);
}

// ------------------------------------------------------------ editors -------

/** L1: `[contenteditable=true]`. */
export function isEditor(el: Element): boolean {
  return el.matches(EDITOR);
}

export function editorOf(el: Element): Element | null {
  return el.closest(EDITOR);
}

export function editorIn(scope: Element): Element | null {
  return scope.querySelector(EDITOR);
}

/**
 * L1. Whether the editor has any text. Returns a boolean only — the text
 * itself never leaves this function. An empty Quill editor is `<p><br></p>`.
 */
export function editorHasText(editor: Element): boolean {
  return (editor.textContent ?? '').trim().length > 0;
}

// ----------------------------------------------------- comments / replies ---

/** L2: `[data-id^="urn:li:comment"]`. */
export function isCommentNode(el: Element): boolean {
  return el.matches(COMMENT_NODE);
}

/** L2. A count, never the nodes' content. */
export function commentNodesIn(container: Element): number {
  return container.querySelectorAll(COMMENT_NODE).length;
}

/** L2 (`data-urn` / `data-id` activity identity), then L3 (`.feed-shared-update-v2`). */
export function postContainerOf(el: Element): Element | null {
  return el.closest(ACTIVITY_NODE) ?? el.closest(L3_POST_CONTAINER);
}

/** The comment node the element sits inside — a reply editor has one, a comment editor doesn't. L2. */
export function replyTargetOf(el: Element): Element | null {
  return el.closest(COMMENT_NODE);
}

type FormKind = 'comment' | 'dm' | null;

/**
 * What a form with an editor in it is. L2 first (a post ancestor → comment;
 * a messaging URL or thread link → DM), then L3 class fallbacks.
 */
function formKind(form: Element, loc: Location): FormKind {
  if (!editorIn(form)) return null;
  if (postContainerOf(form)) return 'comment';
  if (inMessagingContext(form, loc)) return 'dm';
  if (form.matches(L3_COMMENT_FORM) || form.closest(L3_COMMENT_BOX)) return 'comment';
  if (form.matches(L3_MESSAGE_FORM)) return 'dm';
  return null;
}

/** The comment form the element belongs to, or null. L1 `form` + L2/L3 classification. */
export function commentFormOf(el: Element, loc: Location = location): HTMLFormElement | null {
  const form = el.closest('form');
  return form && formKind(form, loc) === 'comment' ? form : null;
}

/** L1 editor inside a comment form. */
export function isCommentEditor(el: Element, loc: Location = location): boolean {
  return isEditor(el) && commentFormOf(el, loc) !== null;
}

// ------------------------------------------------------ share dialog --------

/** L1: `[role=dialog]` that contains a NON-EMPTY editor — the share box with something typed. */
export function isShareDialog(el: Element): boolean {
  if (!el.matches(DIALOG)) return false;
  const editor = editorIn(el);
  return editor !== null && editorHasText(editor);
}

export function dialogOf(el: Element): Element | null {
  return el.closest(DIALOG);
}

export function shareDialogOf(el: Element): Element | null {
  const dialog = dialogOf(el);
  return dialog && isShareDialog(dialog) ? dialog : null;
}

/** L2 (an embedded activity node = a repost), then L3 (`*reshare*` class). */
export function hasEmbeddedActivity(dialog: Element): boolean {
  return dialog.querySelector(ACTIVITY_NODE) !== null || dialog.querySelector(L3_RESHARE) !== null;
}

/**
 * The dialog's primary action ("Post"). L1 when it is `button[type=submit]`;
 * otherwise L3 `.share-actions__primary-action`. The primary button has no
 * structural signal we know of, so L3 is load-bearing here until a capture
 * says otherwise. Must be enabled (LinkedIn disables it while the editor is
 * empty and while a post is in flight).
 */
export function isPrimaryFooterButton(el: Element): boolean {
  if (!el.matches('button') || !isEnabled(el) || !dialogOf(el)) return false;
  return isSubmitButton(el) || el.matches(L3_SHARE_PRIMARY);
}

/**
 * An enabled action button in a dialog that is NOT the share box — the
 * "Send" of a connect-with-note dialog. L1 `type=submit`, else L3 primary.
 * Only ever used to refresh an existing connect hint, so it can be liberal.
 */
export function isDialogSubmitButton(el: Element): boolean {
  if (!el.matches('button') || !isEnabled(el)) return false;
  const dialog = dialogOf(el);
  if (!dialog || isShareDialog(dialog)) return false;
  return isSubmitButton(el) || el.matches(L3_PRIMARY_BUTTON);
}

/** Every `[role=dialog]` currently on the page (L1). */
export function dialogsIn(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(DIALOG));
}

// ---------------------------------------------------------- connect ---------

/** L2: a button-like element with a `connect-*` icon inside it, or a `connect*` control name. */
export function isConnectButton(el: Element): boolean {
  if (!el.matches(CLICKABLE)) return false;
  return el.querySelector(CONNECT_ICON) !== null || el.matches(CONNECT_CONTROL);
}

/**
 * The card the connect button belongs to — where its replacement ("Pending")
 * will render. L1 list item / article / section, L2 identity attributes, L3
 * `.artdeco-card`; the document body as a last resort.
 */
export function connectCardOf(button: Element): Element {
  const from = button.parentElement ?? button;
  return (
    from.closest(`li, article, ${ACTIVITY_NODE}, [data-view-name], section, ${L3_CARD}, main`) ??
    button.ownerDocument.body
  );
}

/** L2: `clock-*` icons within `scope` (the button, or its card). A count. */
export function pendingIconsIn(scope: Element): number {
  return scope.querySelectorAll(PENDING_ICON).length;
}

/** L2: the element shows the Pending state. */
export function isPendingState(el: Element): boolean {
  return pendingIconsIn(el) > 0;
}

// --------------------------------------------------------- messaging --------

/**
 * Is the element inside a conversation? L2: the page is under `/messaging/`,
 * or an ancestor carries an "open in messaging" thread link (the overlay
 * bubble's header); L3: the known conversation classes.
 */
function inMessagingContext(el: Element, loc: Location): boolean {
  if (MESSAGING_PATH.test(loc.pathname)) return true;
  if (ancestorWith(el, THREAD_LINK)) return true;
  return el.closest(L3_CONVERSATION) !== null;
}

/** The nearest ancestor (excluding body) that contains something matching `selector`. */
function ancestorWith(el: Element, selector: string): Element | null {
  const body = el.ownerDocument.body;
  for (let a = el.parentElement; a && a !== body; a = a.parentElement) {
    if (a.querySelector(selector)) return a;
  }
  return null;
}

/** The DM composer form the element belongs to, or null. L1 `form` + L2/L3 classification. */
export function messageComposerOf(el: Element, loc: Location = location): HTMLFormElement | null {
  const form = el.closest('form');
  return form && formKind(form, loc) === 'dm' ? form : null;
}

/** L1 form that classifies as a DM composer. */
export function isMessageComposer(el: Element, loc: Location = location): boolean {
  return el.matches('form') && formKind(el, loc) === 'dm';
}

/**
 * The conversation a composer belongs to: the scope for its message list and
 * its thread link. L3 conversation class when present (it is a boundary, not
 * a signal — it stops the walk-up from reaching other bubbles); else L2 the
 * nearest ancestor carrying a thread link; else L1 the nearest ancestor that
 * holds a list outside the form; else `main` / body.
 */
export function conversationOf(composer: Element): Element {
  const doc = composer.ownerDocument;
  const l3 = composer.closest(L3_CONVERSATION);
  if (l3) return l3;
  const linked = ancestorWith(composer, THREAD_LINK);
  if (linked) return linked;
  for (let a = composer.parentElement; a && a !== doc.body; a = a.parentElement) {
    if (listsIn(a).some((l) => !composer.contains(l))) return a;
  }
  return composer.closest('main') ?? doc.body;
}

function listsIn(scope: Element): Element[] {
  return Array.from(scope.querySelectorAll(LIST));
}

/**
 * The conversation's message list. L1: the lists in the conversation that
 * aren't inside the composer; L3 disambiguates when one carries the known
 * class, else the longest list wins (the thread is by far the biggest one).
 */
export function messageListOf(composer: Element): Element | null {
  const candidates = listsIn(conversationOf(composer)).filter((l) => !composer.contains(l));
  if (candidates.length === 0) return null;
  const known = candidates.find((l) => l.matches(L3_MESSAGE_LIST));
  if (known) return known;
  return candidates.reduce((best, l) => (messageItemsIn(l) > messageItemsIn(best) ? l : best));
}

/** L1: list items in the list. A count. */
export function messageItemsIn(list: Element): number {
  return list.querySelectorAll(LIST_ITEM).length;
}

/**
 * The key that identifies the conversation, read at confirm time and handed
 * to the background to hash — NEVER stored or logged. Three sources, L2 all:
 *   1. the thread id in `location.pathname` (`/messaging/thread/<id>/`);
 *   2. the thread id in the bubble's "open in messaging" link;
 *   3. the `/in/<slug>` of the participant link in the bubble header.
 * Returns undefined when none is found; the background then counts the DM
 * without the per-person rule.
 */
export function threadKeyFor(anchor: Element, loc: Location = location): string | undefined {
  const fromPath = THREAD_PATH.exec(loc.pathname)?.[1];
  if (fromPath) return fromPath;
  const scope = conversationOf(anchor);
  const threadLink = scope.querySelector(THREAD_LINK)?.getAttribute('href') ?? '';
  const fromLink = THREAD_PATH.exec(threadLink)?.[1];
  if (fromLink) return fromLink;
  const profileLink = scope.querySelector(PROFILE_LINK)?.getAttribute('href') ?? '';
  return PROFILE_PATH.exec(profileLink)?.[1];
}
