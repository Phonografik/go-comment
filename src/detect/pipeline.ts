// Hints in, confirmed events out. Owns the pending set, dedup, cooldown and
// deadlines; knows nothing about LinkedIn (selectors.ts) and nothing about
// the wire (the injected `send`).
//
//   dedup     one Pending per anchor — a repeat hint refreshes the deadline
//   cooldown  5 s per anchor after a confirm, so a double-fired submit can't
//             double count
//   deadline  passed → drop, unconfirmed[type]++ in memory, send('unconfirmed')
//   confirm   send('action', { t, ts, d, threadKey? }) — `d` is the LOCAL day
//             key computed at event time; `threadKey` only for DMs, read at
//             confirm time and never kept
import { toDateKey } from '../core/calendar';
import type { Counts, EventType } from '../core/types';
import { zeroCounts } from '../core/types';
import type { ActionMessage } from '../messaging/protocol';
import { attachHintListeners } from './hints';
import { checkOutcome, observeOutcomes } from './outcomes';
import {
  commentNodesIn,
  dialogsIn,
  isEnabled,
  messageItemsIn,
  pendingIconsIn,
  threadKeyFor,
} from './selectors';
import type { ActionHint, Hint, Pending } from './types';
import { COOLDOWN_MS, DEADLINES } from './types';

/** The two messages the pipeline emits. `pageLoad` is the mount point's job. */
export interface Send {
  (type: 'action', data: ActionMessage): unknown;
  (type: 'unconfirmed', data: { t: EventType }): unknown;
}

export interface PipelineOptions {
  send: Send;
  /** injected clock, epoch ms */
  now?: () => number;
  doc?: Document;
  loc?: Location;
}

/** Mount the pipeline. Returns `unmount`, which removes every listener and timer. */
export function mountPipeline(options: PipelineOptions): () => void {
  const { send } = options;
  const now = options.now ?? (() => Date.now());
  const doc = options.doc ?? document;
  const loc = options.loc ?? location;

  const pending = new Set<Pending>();
  const cooldownUntil = new WeakMap<Element, number>();
  const unconfirmed: Counts = zeroCounts();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const findByAnchor = (el: Element): Pending | undefined => {
    for (const p of pending) if (p.anchor.deref() === el) return p;
    return undefined;
  };

  const schedule = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    let next = Infinity;
    for (const p of pending) next = Math.min(next, p.deadline);
    timer = setTimeout(expire, Math.max(0, next - now()));
  };

  const expire = () => {
    timer = null;
    const t = now();
    for (const p of [...pending]) {
      if (p.deadline > t) continue;
      pending.delete(p);
      unconfirmed[p.type] += 1;
      send('unconfirmed', { t: p.type });
    }
    schedule();
  };

  const confirm = (p: Pending) => {
    pending.delete(p);
    const ts = now();
    const anchor = p.anchor.deref();
    if (anchor) cooldownUntil.set(anchor, ts + COOLDOWN_MS);
    const msg: ActionMessage = { t: p.type, ts, d: toDateKey(new Date(ts)) };
    if (p.type === 'm' && anchor) {
      const threadKey = threadKeyFor(anchor, loc);
      if (threadKey) msg.threadKey = threadKey;
    }
    send('action', msg);
  };

  const evaluate = () => {
    for (const p of [...pending]) {
      const verdict = checkOutcome(p, doc);
      if (verdict === 'confirmed') confirm(p);
      else if (verdict === 'dropped') pending.delete(p);
    }
    schedule();
  };

  const toPending = (hint: ActionHint, t: number): Pending => {
    const known = new WeakSet<Element>();
    for (const d of dialogsIn(doc)) known.add(d);
    const base: Pending = {
      type: hint.type,
      anchor: new WeakRef(hint.anchor),
      container: new WeakRef(hint.container),
      editor: null,
      list: null,
      deadline: t + DEADLINES[hint.type],
      baseline: 0,
      fallbackBaseline: 0,
      knownDialogs: known,
      dialogSeen: false,
      submitted: false,
      disabledAtHint: false,
      vetoed: false,
    };
    switch (hint.type) {
      case 'c':
      case 'r':
        base.editor = new WeakRef(hint.editor);
        base.baseline = commentNodesIn(hint.container);
        base.fallbackBaseline = commentNodesIn(doc.body);
        break;
      case 'n':
        base.baseline = pendingIconsIn(hint.container);
        base.disabledAtHint = !isEnabled(hint.anchor);
        break;
      case 'm': {
        base.editor = new WeakRef(hint.editor);
        const watch = hint.list ?? hint.container;
        base.list = new WeakRef(watch);
        base.baseline = messageItemsIn(watch);
        base.fallbackBaseline = messageItemsIn(hint.container);
        break;
      }
      case 'p':
      case 'q':
        break;
    }
    return base;
  };

  const onHint = (hint: Hint) => {
    const t = now();
    if (hint.type === 'dialog-submit') {
      for (const p of pending) {
        if (p.type !== 'n') continue;
        p.submitted = true;
        p.deadline = t + DEADLINES.n;
      }
      schedule();
      return;
    }
    const existing = findByAnchor(hint.anchor);
    if (existing) {
      existing.deadline = t + DEADLINES[hint.type];
      schedule();
      return;
    }
    const until = cooldownUntil.get(hint.anchor);
    if (until !== undefined && t < until) return;
    pending.add(toPending(hint, t));
    schedule();
  };

  const detachHints = attachHintListeners(doc, loc, onHint);
  const disconnect = observeOutcomes(doc, () => pending.size > 0, evaluate);

  return () => {
    detachHints();
    disconnect();
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending.clear();
  };
}
