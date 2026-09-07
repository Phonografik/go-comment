// A click is a hint. Three capture-phase listeners on `document` turn user
// actions into Hints; nothing here decides that an action happened — that is
// outcomes.ts, watching the DOM. Hints can be liberal because a hint with no
// outcome costs nothing.
//
// Observe only: these listeners never call preventDefault / stopPropagation,
// never dispatch anything, and never read text out of the page.
import {
  clickableOf,
  commentFormOf,
  connectCardOf,
  conversationOf,
  editorIn,
  editorHasText,
  editorOf,
  hasEmbeddedActivity,
  isConnectButton,
  isDialogSubmitButton,
  isPrimaryFooterButton,
  isSubmitButton,
  elementOf,
  messageComposerOf,
  messageListOf,
  postContainerOf,
  replyTargetOf,
  shareDialogOf,
} from './selectors';
import type { Hint } from './types';

/** Comment or reply, when `form` is a comment form with something typed. */
function commentHint(form: Element): Hint | null {
  const editor = editorIn(form);
  if (!editor || !editorHasText(editor)) return null;
  const reply = replyTargetOf(form);
  if (reply) return { type: 'r', anchor: form, container: reply, editor };
  const container = postContainerOf(form) ?? form.ownerDocument.body;
  return { type: 'c', anchor: form, container, editor };
}

/** DM, when `form` is a message composer with something typed. */
function dmHint(form: Element): Hint | null {
  const editor = editorIn(form);
  if (!editor || !editorHasText(editor)) return null;
  return { type: 'm', anchor: form, container: conversationOf(form), editor, list: messageListOf(form) };
}

/** Post or repost, from the share dialog (which by definition has text in it). */
function shareHint(dialog: Element): Hint {
  return { type: hasEmbeddedActivity(dialog) ? 'q' : 'p', anchor: dialog, container: dialog };
}

/** A form's hint, whichever kind of form it is. */
function formHint(form: Element, loc: Location): Hint | null {
  if (commentFormOf(form, loc)) return commentHint(form);
  if (messageComposerOf(form, loc)) return dmHint(form);
  return null;
}

export function hintFromClick(e: Event, loc: Location): Hint | null {
  const target = elementOf(e.target);
  if (!target) return null;
  const button = clickableOf(target);
  if (!button) return null;

  // Comment / DM submit buttons first: a comment box can live inside a
  // dialog (the image viewer), so the form wins over the dialog.
  if (isSubmitButton(button)) {
    const form = button.closest('form');
    if (form) {
      const hint = formHint(form, loc);
      if (hint) return hint;
    }
  }

  if (isConnectButton(button)) {
    return { type: 'n', anchor: button, container: connectCardOf(button) };
  }

  const dialog = shareDialogOf(button);
  if (dialog && isPrimaryFooterButton(button)) return shareHint(dialog);

  if (isDialogSubmitButton(button)) return { type: 'dialog-submit', anchor: button };

  return null;
}

export function hintFromSubmit(e: Event, loc: Location): Hint | null {
  const form = elementOf(e.target);
  if (!form || !form.matches('form')) return null;
  return formHint(form, loc);
}

export function hintFromKeydown(e: KeyboardEvent, loc: Location): Hint | null {
  if (e.key !== 'Enter' || e.isComposing) return null;
  const target = elementOf(e.target);
  const editor = target && editorOf(target);
  if (!editor) return null;
  const cmdEnter = e.metaKey || e.ctrlKey;

  const comment = commentFormOf(editor, loc);
  if (comment) return cmdEnter ? commentHint(comment) : null;

  const composer = messageComposerOf(editor, loc);
  if (composer) return e.shiftKey ? null : dmHint(composer);

  const dialog = shareDialogOf(editor);
  if (dialog) return cmdEnter ? shareHint(dialog) : null;

  return null;
}

/**
 * Attach the three capture-phase listeners. Returns a function that removes
 * them. Listener errors are swallowed: a page must never see an exception
 * from us, and we log nothing.
 */
export function attachHintListeners(doc: Document, loc: Location, onHint: (hint: Hint) => void): () => void {
  const guard =
    <E extends Event>(f: (e: E, loc: Location) => Hint | null) =>
    (e: Event) => {
      try {
        const hint = f(e as E, loc);
        if (hint) onHint(hint);
      } catch {
        // observe only — never surface an error on linkedin.com
      }
    };
  const onClick = guard(hintFromClick);
  const onSubmit = guard(hintFromSubmit);
  const onKeydown = guard<KeyboardEvent>(hintFromKeydown);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('submit', onSubmit, true);
  doc.addEventListener('keydown', onKeydown, true);
  return () => {
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('submit', onSubmit, true);
    doc.removeEventListener('keydown', onKeydown, true);
  };
}
