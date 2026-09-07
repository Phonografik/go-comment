// The vocabulary of the detection pipeline. Nothing here knows LinkedIn's
// DOM — that is selectors.ts's job — and nothing here is ever stored: a
// Pending lives in memory for at most a few seconds and holds only weak
// references to page elements.
import type { EventType } from '../core/types';

/**
 * A hint is a user action seen in the capture phase (click / submit / keydown)
 * that MIGHT be one of the six counted actions. It costs nothing if no
 * outcome follows. `anchor` is the element that identifies the action for
 * dedup (one Pending per anchor); `container` is where the outcome is looked
 * for.
 */
export type Hint =
  | {
      /** comment or reply on a post */
      type: 'c' | 'r';
      /** the comment form */
      anchor: Element;
      /** the post container (comment) or the parent comment node (reply) */
      container: Element;
      editor: Element;
    }
  | {
      /** post or repost-with-thoughts from the share dialog */
      type: 'p' | 'q';
      /** the dialog itself */
      anchor: Element;
      container: Element;
    }
  | {
      /** connection request */
      type: 'n';
      /** the button that was clicked */
      anchor: Element;
      /** the card / top card the button lives in */
      container: Element;
    }
  | {
      /** direct message */
      type: 'm';
      /** the composer form */
      anchor: Element;
      /** the conversation the composer belongs to */
      container: Element;
      editor: Element;
      /** the message list to watch for a new item, when one can be found */
      list: Element | null;
    }
  | {
      /**
       * The submit button of a dialog that a connect hint opened ("Send" /
       * "Send without a note"). Not an action on its own: it refreshes any
       * pending connection and marks it as submitted.
       */
      type: 'dialog-submit';
      anchor: Element;
    };

export type ActionHint = Exclude<Hint, { type: 'dialog-submit' }>;

/** A hint that is waiting for its DOM outcome. */
export interface Pending {
  type: EventType;
  anchor: WeakRef<Element>;
  container: WeakRef<Element>;
  editor: WeakRef<Element> | null;
  list: WeakRef<Element> | null;
  /** epoch ms (from the injected clock) after which the hint is dropped as unconfirmed */
  deadline: number;
  /** what the outcome must exceed: comment nodes / message items / pending icons at hint time */
  baseline: number;
  /** the same count taken one level wider (document / conversation), used if the container is re-rendered */
  fallbackBaseline: number;
  /** dialogs already on the page when the hint fired — anything else is "a second dialog" */
  knownDialogs: WeakSet<Element>;
  /** a dialog that was NOT known at hint time has appeared since */
  dialogSeen: boolean;
  /** a dialog-submit hint arrived while this was pending (connect only) */
  submitted: boolean;
  /** the anchor carried the `disabled` attribute at hint time (connect only) */
  disabledAtHint: boolean;
  /** an observed negative outcome (discard-confirm dialog, cancelled dialog) — never confirms */
  vetoed: boolean;
}

/** Outcome window per event type, in ms, from the plan's table. */
export const DEADLINES: Record<EventType, number> = {
  c: 6_000,
  r: 6_000,
  p: 8_000,
  q: 8_000,
  n: 8_000,
  m: 4_000,
};

/** After a confirm, hints on the same anchor are ignored for this long. */
export const COOLDOWN_MS = 5_000;
