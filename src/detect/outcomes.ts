// A DOM outcome is the event. One MutationObserver on <body> whose callback
// returns immediately while nothing is pending (near-zero idle cost); while a
// hint is pending, every mutation batch re-checks it against the rules from
// the plan's table. Only a positive outcome confirms. An OBSERVED negative
// (a discard-confirm dialog, a connect dialog closed without sending) drops
// the hint silently — the user cancelled, detection isn't broken. Absence of
// any outcome is left to the deadline, which counts as `unconfirmed`.
import {
  commentNodesIn,
  dialogsIn,
  editorHasText,
  isPendingState,
  messageItemsIn,
  pendingIconsIn,
} from './selectors';
import type { Pending } from './types';

export type Verdict = 'confirmed' | 'dropped' | 'waiting';

const gone = (ref: WeakRef<Element> | null): boolean => {
  const el = ref?.deref();
  return !el || !el.isConnected;
};

/** Dialogs on the page that were not there when the hint fired. */
function strangeDialogs(p: Pending, doc: Document): number {
  return dialogsIn(doc).filter((d) => !p.knownDialogs.has(d)).length;
}

/** Comment / reply: editor emptied AND a new comment node in the container (or, if the container was re-rendered, anywhere). */
function checkComment(p: Pending, doc: Document): Verdict {
  const editor = p.editor?.deref();
  const emptied = !editor || !editor.isConnected || !editorHasText(editor);
  if (!emptied) return 'waiting';
  const container = p.container.deref();
  const grew =
    container && container.isConnected
      ? commentNodesIn(container) > p.baseline
      : commentNodesIn(doc.body) > p.fallbackBaseline;
  return grew ? 'confirmed' : 'waiting';
}

/** Post / repost: the dialog is removed and no second (discard-confirm) dialog ever appeared. */
function checkShare(p: Pending, doc: Document): Verdict {
  if (strangeDialogs(p, doc) > 0) p.vetoed = true;
  if (p.vetoed) return 'dropped';
  return gone(p.anchor) ? 'confirmed' : 'waiting';
}

/**
 * Connection: the origin button (or its replacement in the card) shows the
 * clock icon; or the button became disabled; or it is gone from the card with
 * no dialog left — provided any dialog that appeared was submitted.
 */
function checkConnect(p: Pending, doc: Document): Verdict {
  if (strangeDialogs(p, doc) > 0) {
    p.dialogSeen = true;
    return 'waiting';
  }
  const anchor = p.anchor.deref();
  const card = p.container.deref();
  if (anchor?.isConnected && isPendingState(anchor)) return 'confirmed';
  if (card?.isConnected && pendingIconsIn(card) > p.baseline) return 'confirmed';
  if (p.dialogSeen && !p.submitted) return 'dropped';
  if (gone(p.anchor)) return 'confirmed';
  if (anchor && anchor.hasAttribute('disabled') && !p.disabledAtHint) return 'confirmed';
  return 'waiting';
}

/** DM: editor emptied AND a new item in that conversation's message list. */
function checkMessage(p: Pending): Verdict {
  const editor = p.editor?.deref();
  const emptied = !editor || !editor.isConnected || !editorHasText(editor);
  if (!emptied) return 'waiting';
  const list = p.list?.deref();
  const container = p.container.deref();
  const grew =
    list && list.isConnected
      ? messageItemsIn(list) > p.baseline
      : container && container.isConnected
        ? messageItemsIn(container) > p.fallbackBaseline
        : false;
  return grew ? 'confirmed' : 'waiting';
}

export function checkOutcome(p: Pending, doc: Document): Verdict {
  switch (p.type) {
    case 'c':
    case 'r':
      return checkComment(p, doc);
    case 'p':
    case 'q':
      return checkShare(p, doc);
    case 'n':
      return checkConnect(p, doc);
    case 'm':
      return checkMessage(p);
  }
}

/**
 * The single observer. `hasPending` is consulted first on every batch so an
 * idle page costs one boolean check per mutation batch and nothing else.
 * Returns a function that disconnects it.
 */
export function observeOutcomes(doc: Document, hasPending: () => boolean, evaluate: () => void): () => void {
  const observer = new MutationObserver(() => {
    if (!hasPending()) return;
    try {
      evaluate();
    } catch {
      // observe only — never surface an error on linkedin.com
    }
  });
  observer.observe(doc.body ?? doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-test-icon', 'disabled'],
  });
  return () => observer.disconnect();
}
