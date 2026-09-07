import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, q, setPath } from './fixture-harness';
import {
  SELECTORS_VERSION,
  commentFormOf,
  connectCardOf,
  hasEmbeddedActivity,
  isCommentEditor,
  isConnectButton,
  isMessageComposer,
  isPendingState,
  isPrimaryFooterButton,
  isShareDialog,
  messageComposerOf,
  messageListOf,
  postContainerOf,
  threadKeyFor,
} from './selectors';

beforeEach(() => setPath('/feed/'));
afterEach(() => {
  document.body.innerHTML = '';
});

describe('SELECTORS_VERSION', () => {
  it('is a YYYY-MM-DD date, as the health row and issue template expect', () => {
    expect(SELECTORS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('threadKeyFor — read at confirm time, never stored', () => {
  const BUBBLE_WITH_LINK =
    '<main><a href="/in/someone-else-1a2b/">x</a></main>' +
    '<aside><ul><li><a href="/messaging/thread/2-DECOY==/">list</a></li></ul>' +
    '<div><header><a href="/in/FIXTURE-PERSON/">name</a><a href="/messaging/thread/2-abc123==/">open</a></header>' +
    '<ul><li>msg</li></ul><form><div contenteditable="true"><p>hi</p></div></form></div></aside>';

  it('1. the thread id in the URL wins', () => {
    setPath('/messaging/thread/2-MTc1MDAwMDAwMDAwMF9mYWtl==/');
    mount(BUBBLE_WITH_LINK);
    expect(threadKeyFor(q('form'))).toBe('2-MTc1MDAwMDAwMDAwMF9mYWtl==');
  });

  it("2. else the bubble's own thread link — the nearest ancestor that carries one, not the overlay list", () => {
    mount(BUBBLE_WITH_LINK);
    expect(threadKeyFor(q('form'))).toBe('2-abc123==');
  });

  it("3. else the participant's /in/ slug in the bubble header", () => {
    mount(
      '<main><a href="/in/someone-else-1a2b/">x</a></main>' +
        '<aside><div class="msg-overlay-conversation-bubble"><header><a href="/in/FIXTURE-PERSON/">name</a></header>' +
        '<ul><li>msg</li></ul><form><div contenteditable="true"><p>hi</p></div></form></div></aside>',
    );
    expect(threadKeyFor(q('form'))).toBe('FIXTURE-PERSON');
  });

  it('is undefined when nothing identifies the conversation', () => {
    mount('<main><form><div contenteditable="true"><p>hi</p></div></form></main>');
    expect(threadKeyFor(q('form'))).toBeUndefined();
  });
});

describe('forms', () => {
  it('a form under an activity node is a comment form; one under /messaging/ is a composer', () => {
    mount('<div data-urn="urn:li:activity:1"><form><div contenteditable="true"></div></form></div>');
    expect(commentFormOf(q('[contenteditable]'))).toBe(q('form'));
    expect(isCommentEditor(q('[contenteditable]'))).toBe(true);
    expect(messageComposerOf(q('[contenteditable]'))).toBeNull();

    setPath('/messaging/thread/x/');
    mount('<main><ul><li>a</li></ul><form><div contenteditable="true"></div></form></main>');
    expect(isMessageComposer(q('form'))).toBe(true);
    expect(commentFormOf(q('[contenteditable]'))).toBeNull();
    expect(messageListOf(q('form'))).toBe(q('ul'));
  });

  it('a form with no editor is neither', () => {
    mount('<div data-urn="urn:li:activity:1"><form><input></form></div>');
    expect(commentFormOf(q('input'))).toBeNull();
    expect(messageComposerOf(q('input'))).toBeNull();
  });

  it('postContainerOf prefers identity attributes over the class fallback', () => {
    mount('<div class="feed-shared-update-v2"><div data-urn="urn:li:activity:1"><form></form></div></div>');
    expect(postContainerOf(q('form'))).toBe(q('[data-urn]'));
    mount('<div class="feed-shared-update-v2"><form></form></div>');
    expect(postContainerOf(q('form'))).toBe(q('.feed-shared-update-v2'));
  });
});

describe('share dialog', () => {
  it('needs role=dialog AND a non-empty editor', () => {
    mount('<div role="dialog"><div contenteditable="true"><p><br></p></div><button class="share-actions__primary-action" type="button"></button></div>');
    expect(isShareDialog(q('[role=dialog]'))).toBe(false);
    q('[contenteditable]').innerHTML = '<p>text</p>';
    expect(isShareDialog(q('[role=dialog]'))).toBe(true);
    expect(isPrimaryFooterButton(q('button'))).toBe(true);
    q('button').setAttribute('disabled', '');
    expect(isPrimaryFooterButton(q('button'))).toBe(false);
  });

  it('hasEmbeddedActivity spots a reshared activity node', () => {
    mount('<div role="dialog"><div contenteditable="true"><p>t</p></div></div>');
    expect(hasEmbeddedActivity(q('[role=dialog]'))).toBe(false);
    q('[role=dialog]').insertAdjacentHTML('beforeend', '<div data-urn="urn:li:activity:9"></div>');
    expect(hasEmbeddedActivity(q('[role=dialog]'))).toBe(true);
  });
});

describe('connect', () => {
  it('matches a button or a role=button dropdown item carrying the connect icon', () => {
    mount(
      '<section><button type="button"><svg data-test-icon="connect-medium"></svg></button>' +
        '<div role="button"><svg data-test-icon="connect-small"></svg></div>' +
        '<button type="button"><svg data-test-icon="send-privately-small"></svg></button></section>',
    );
    expect(isConnectButton(q('button'))).toBe(true);
    expect(isConnectButton(q('[role=button]'))).toBe(true);
    expect(isConnectButton(q('button:last-child'))).toBe(false);
    expect(connectCardOf(q('button'))).toBe(q('section'));
  });

  it('isPendingState is the clock icon', () => {
    mount('<button><svg data-test-icon="clock-small"></svg></button><button><svg data-test-icon="connect-small"></svg></button>');
    expect(isPendingState(q('button'))).toBe(true);
    expect(isPendingState(q('button:last-child'))).toBe(false);
  });
});
