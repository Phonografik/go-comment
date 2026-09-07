// The real pipeline — hints, MutationObserver, dedup, deadlines — against the
// fixture pairs in test/fixtures/linkedin/. Every test mounts a `.before`,
// fires the hint the way a user would, morphs the tree to the `.after`, and
// asserts on what was sent to the (fake) background.
//
// The fixtures are PROVISIONAL (synthesised, not captured). Green here proves
// the pipeline does what the plan says on the assumed DOM; only a capture
// from a real LinkedIn session can prove the assumptions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toDateKey } from '../core/calendar';
import { apply, click, fixture, flush, keydown, mount, q, recorder, setPath, submit } from './fixture-harness';
import { mountPipeline } from './pipeline';

let unmount: (() => void) | null = null;

function start(before: string) {
  mount(fixture(before));
  const rec = recorder();
  unmount = mountPipeline({ send: rec.send });
  return rec;
}

const COMMENT_SUBMIT = '.social-details-social-activity > .comments-comment-box form button[type="submit"]';
const COMMENT_EDITOR = '.social-details-social-activity > .comments-comment-box form [contenteditable="true"]';
const REPLY_FORM = 'article[data-id^="urn:li:comment"] form';
const SHARE_PRIMARY = '[role="dialog"] .share-actions__primary-action';
const SHARE_EDITOR = '[role="dialog"] [contenteditable="true"]';
const CONNECT_ICON = 'svg[data-test-icon="connect-small"]';
const DIALOG_PRIMARY = '[role="dialog"] .artdeco-modal__actionbar .artdeco-button--primary';
const DM_FORM = 'form.msg-form';
const DM_SUBMIT = 'form.msg-form button[type="submit"]';
const DM_EDITOR = 'form.msg-form [contenteditable="true"]';

beforeEach(() => {
  vi.useFakeTimers();
  setPath('/feed/');
});

afterEach(() => {
  unmount?.();
  unmount = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('comment', () => {
  it('confirms via the submit button once the editor empties and a new comment node appears', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions).toHaveLength(1);
    expect(rec.actions[0]).toEqual({ t: 'c', ts: Date.now(), d: toDateKey(new Date()) });
    expect(rec.unconfirmed).toEqual([]);
  });

  it('confirms via the form submit event', async () => {
    const rec = start('comment.before');
    submit(q(COMMENT_SUBMIT).closest('form')!);
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['c']);
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])('confirms via Enter with %o in the editor', async (mod) => {
    const rec = start('comment.before');
    keydown(q(COMMENT_EDITOR), { key: 'Enter', ...mod });
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['c']);
  });

  it('a plain Enter in the comment editor is a newline, not a hint', async () => {
    const rec = start('comment.before');
    keydown(q(COMMENT_EDITOR), { key: 'Enter' });
    apply(fixture('comment.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('does not confirm while the editor still has text, even if a comment node appears', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    const list = q('.comments-comments-list');
    list.insertAdjacentHTML('afterbegin', '<article data-id="urn:li:comment:(urn:li:activity:7370000000000000001,7370000000000000199)"></article>');
    await flush();
    expect(rec.actions).toEqual([]);
  });

  it('does not confirm when the editor empties but no comment node appears (a cleared draft)', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    q(COMMENT_EDITOR).innerHTML = '<p><br></p>';
    await flush();
    expect(rec.actions).toEqual([]);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(rec.unconfirmed).toEqual(['c']);
  });
});

describe('reply', () => {
  it('confirms as a reply when the form sits inside a comment node', async () => {
    const rec = start('reply.before');
    submit(q(REPLY_FORM));
    apply(fixture('reply.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['r']);
    expect(rec.unconfirmed).toEqual([]);
  });
});

describe('post', () => {
  it('confirms when the share dialog is removed with no second dialog', async () => {
    const rec = start('post.before');
    click(q(SHARE_PRIMARY));
    apply(fixture('post.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['p']);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('confirms via Cmd+Enter in the share editor', async () => {
    const rec = start('post.before');
    keydown(q(SHARE_EDITOR), { key: 'Enter', metaKey: true });
    apply(fixture('post.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['p']);
  });

  it('ignores clicks on the dialog toolbar buttons', async () => {
    const rec = start('post.before');
    click(q('[role="dialog"] svg[data-test-icon="emoji-medium"]'));
    apply(fixture('post.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });
});

describe('repost with thoughts', () => {
  it('is a repost when the dialog embeds an activity', async () => {
    const rec = start('repost.before');
    click(q(SHARE_PRIMARY));
    apply(fixture('repost.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['q']);
  });
});

describe('connection request', () => {
  it('confirms the profile flow: Connect → note dialog → Send → button shows the clock', async () => {
    const rec = start('connect.before');
    click(q(CONNECT_ICON));
    apply(fixture('connect.dialog'));
    await flush();
    expect(rec.actions).toEqual([]);
    click(q(DIALOG_PRIMARY));
    apply(fixture('connect.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['n']);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('drops silently when the note dialog is closed without sending', async () => {
    const rec = start('connect.before');
    click(q(CONNECT_ICON));
    apply(fixture('connect.dialog'));
    await flush();
    apply(fixture('connect.before'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('confirms the card flow: no dialog, the button turns to Pending in place', async () => {
    mount(
      '<main><ul><li class="discover-entity-type-card"><a href="#">Lorem</a>' +
        '<button class="artdeco-button artdeco-button--secondary" type="button"><svg data-test-icon="connect-small"></svg><span>Lorem</span></button>' +
        '</li></ul></main>',
    );
    const rec = recorder();
    unmount = mountPipeline({ send: rec.send });
    click(q('button'));
    q('button svg').setAttribute('data-test-icon', 'clock-small');
    q('button').setAttribute('disabled', '');
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['n']);
  });

  it('confirms the card flow when the whole card is removed', async () => {
    mount('<main><ul><li><button type="button"><svg data-test-icon="connect-small"></svg></button></li><li><button type="button"><svg data-test-icon="connect-small"></svg></button></li></ul></main>');
    const rec = recorder();
    unmount = mountPipeline({ send: rec.send });
    click(q('li:first-child button'));
    q('li').remove();
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['n']);
  });
});

describe('direct message', () => {
  it('on /messaging/thread/ confirms via the send button with the thread id from the URL', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-thread.before');
    click(q(DM_SUBMIT));
    apply(fixture('dm-thread.after'));
    await flush();
    expect(rec.actions).toEqual([{ t: 'm', ts: Date.now(), d: toDateKey(new Date()), threadKey: 'FIXTURE-1' }]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('confirms via Enter without Shift', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-thread.before');
    keydown(q(DM_EDITOR), { key: 'Enter' });
    apply(fixture('dm-thread.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['m']);
  });

  it('Shift+Enter is a newline, not a hint', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-thread.before');
    keydown(q(DM_EDITOR), { key: 'Enter', shiftKey: true });
    apply(fixture('dm-thread.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('does not confirm when the editor empties but no message item appears (a cleared draft)', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-thread.before');
    click(q(DM_SUBMIT));
    q(DM_EDITOR).innerHTML = '<p><br></p>';
    await flush();
    expect(rec.actions).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rec.unconfirmed).toEqual(['m']);
  });

  it('in the overlay bubble confirms with the thread id from the bubble header, not the decoy in the list', async () => {
    const rec = start('dm-overlay.before');
    submit(q(DM_FORM));
    apply(fixture('dm-overlay.after'));
    await flush();
    expect(rec.actions).toHaveLength(1);
    expect(rec.actions[0]).toMatchObject({ t: 'm', threadKey: 'FIXTURE-1' });
  });

  it('never sends a threadKey for anything but a DM', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions[0]).not.toHaveProperty('threadKey');
  });
});

describe('negatives', () => {
  it('post-discarded: a discard-confirm dialog vetoes the hint, and the close counts nothing', async () => {
    const rec = start('post-discarded.before');
    keydown(q(SHARE_EDITOR), { key: 'Enter', metaKey: true });
    apply(fixture('post-discarded.after'));
    await flush();
    q('#artdeco-modal-outlet').replaceChildren();
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('comment-deleted: editor cleared and a comment removed is not a comment — it expires as unconfirmed', async () => {
    const rec = start('comment-deleted.before');
    keydown(q(COMMENT_EDITOR), { key: 'Enter', metaKey: true });
    apply(fixture('comment-deleted.after'));
    await flush();
    expect(rec.actions).toEqual([]);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(rec.unconfirmed).toEqual(['c']);
  });

  it('dm-incoming: a message arriving while typing is not a send', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-incoming.before');
    keydown(q(DM_EDITOR), { key: 'Enter' });
    apply(fixture('dm-incoming.after'));
    await flush();
    expect(rec.actions).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rec.unconfirmed).toEqual(['m']);
  });

  it('dm-incoming: with no hint at all, an arriving message is silent', async () => {
    setPath('/messaging/thread/FIXTURE-1/');
    const rec = start('dm-incoming.before');
    apply(fixture('dm-incoming.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('reaction: liking a post is not a hint, so nothing is pending and nothing expires', async () => {
    const rec = start('reaction.before');
    click(q('button.react-button__trigger'));
    apply(fixture('reaction.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });
});

describe('deadlines, dedup and cooldown', () => {
  it('a hint with no outcome expires once as unconfirmed at its deadline', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    await vi.advanceTimersByTimeAsync(5_999);
    expect(rec.unconfirmed).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(rec.unconfirmed).toEqual(['c']);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rec.unconfirmed).toEqual(['c']);
    expect(rec.actions).toEqual([]);
  });

  it('a repeat hint on the same anchor refreshes the deadline instead of adding a second pending', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    await vi.advanceTimersByTimeAsync(5_000);
    click(q(COMMENT_SUBMIT));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rec.unconfirmed).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rec.unconfirmed).toEqual(['c']);
  });

  it('after a confirm, the same anchor is on cooldown for 5 s and then counts again', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['c']);

    // A double-fired submit 1 s later, with the page re-rendering the editor: ignored.
    await vi.advanceTimersByTimeAsync(1_000);
    q(COMMENT_EDITOR).innerHTML = '<p>Lorem ipsum</p>';
    click(q(COMMENT_SUBMIT));
    q(COMMENT_EDITOR).innerHTML = '<p><br></p>';
    q('.comments-comments-list').insertAdjacentHTML('afterbegin', '<article data-id="urn:li:comment:(urn:li:activity:7370000000000000001,7370000000000000150)"></article>');
    await flush();
    expect(rec.actions).toHaveLength(1);

    // A genuine second comment after the cooldown: counted.
    await vi.advanceTimersByTimeAsync(5_000);
    q(COMMENT_EDITOR).innerHTML = '<p>Lorem ipsum</p>';
    click(q(COMMENT_SUBMIT));
    q(COMMENT_EDITOR).innerHTML = '<p><br></p>';
    q('.comments-comments-list').insertAdjacentHTML('afterbegin', '<article data-id="urn:li:comment:(urn:li:activity:7370000000000000001,7370000000000000151)"></article>');
    await flush();
    expect(rec.actions.map((a) => a.t)).toEqual(['c', 'c']);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('a hint on the same anchor during cooldown is not carried into an unconfirmed count either', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    apply(fixture('comment.after'));
    await flush();
    q(COMMENT_EDITOR).innerHTML = '<p>Lorem ipsum</p>';
    click(q(COMMENT_SUBMIT));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(rec.actions).toHaveLength(1);
    expect(rec.unconfirmed).toEqual([]);
  });
});

describe('mount / unmount', () => {
  it('unmount removes the listeners, the observer and any timer', async () => {
    const rec = start('comment.before');
    click(q(COMMENT_SUBMIT));
    expect(vi.getTimerCount()).toBe(1);
    unmount!();
    unmount = null;
    expect(vi.getTimerCount()).toBe(0);
    click(q(COMMENT_SUBMIT));
    apply(fixture('comment.after'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rec.actions).toEqual([]);
    expect(rec.unconfirmed).toEqual([]);
  });

  it('uses the injected clock for ts, d and deadlines', async () => {
    mount(fixture('comment.before'));
    const rec = recorder();
    // 2026-03-29 00:30 local (BST starts at 01:00 that night) — day key must be local, never ISO.
    let t = new Date(2026, 2, 29, 0, 30).getTime();
    unmount = mountPipeline({ send: rec.send, now: () => t });
    click(q(COMMENT_SUBMIT));
    t += 100;
    apply(fixture('comment.after'));
    await flush();
    expect(rec.actions).toEqual([{ t: 'c', ts: t, d: '2026-03-29' }]);
  });
});
