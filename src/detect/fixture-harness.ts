// Test-only helpers for the fixture tests. Mounts a `.before.html` fixture,
// lets a test fire the hint the way a user would, then MORPHS the live tree
// into the `.after.html` state — patching attributes, text and children in
// place rather than replacing innerHTML — so the pipeline's WeakRefs stay
// connected exactly as they would on a page LinkedIn re-renders in place,
// and the real MutationObserver sees realistic mutations.
//
// Not shipped: nothing under entrypoints/ imports this file.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import type { EventType } from '../core/types';
import type { ActionMessage } from '../messaging/protocol';
import type { Send } from './pipeline';

// Resolved from this file, not from the working directory, so the tests pass
// however vitest is invoked.
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../test/fixtures/linkedin');

/** Raw HTML of `test/fixtures/linkedin/<name>.html`. */
export function fixture(name: string): string {
  return readFileSync(resolve(DIR, `${name}.html`), 'utf8');
}

/** Replace the whole body with a fixture. Use for the BEFORE state only. */
export function mount(html: string): void {
  document.body.innerHTML = html;
}

/** Morph the live body into `html` in place. Use for AFTER / intermediate states. */
export function apply(html: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(document.body, tpl.content);
}

/** Let MutationObserver microtasks and zero-delay timers run. */
export async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
}

/** A fake `send` that records what the pipeline emits. */
export function recorder() {
  const actions: ActionMessage[] = [];
  const unconfirmed: EventType[] = [];
  const send: Send = (_type: 'action' | 'unconfirmed', data: ActionMessage | { t: EventType }) => {
    if ('ts' in data) actions.push(data);
    else unconfirmed.push(data.t);
  };
  return { send, actions, unconfirmed };
}

/** First match or throw — a fixture that lacks the element is a broken fixture, not a passing test. */
export function q(selector: string, root: ParentNode = document): Element {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`fixture has no element matching ${selector}`);
  return el;
}

// Dispatching events on a fixture is fine IN TESTS — the shipped code never does.
export function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}
export function submit(form: Element): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
export function keydown(el: Element, init: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}
export function setPath(path: string): void {
  history.replaceState(null, '', path);
}

// ------------------------------------------------------------- morph --------

function keyOf(n: Node): string | null {
  if (n.nodeType !== 1) return null;
  const e = n as Element;
  return e.getAttribute('data-id') ?? e.getAttribute('data-urn') ?? (e.id || null);
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return (a as Element).tagName === (b as Element).tagName && keyOf(a) === keyOf(b);
}

function morphAttributes(a: Element, b: Element): void {
  for (const attr of Array.from(a.attributes)) {
    if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
  }
  for (const attr of Array.from(b.attributes)) {
    if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
  }
}

/** Patch `from`'s children to match `to`'s: reuse nodes of the same kind (keyed by data-id / data-urn / id), insert what's new, remove what's gone. */
export function morphChildren(from: ParentNode, to: ParentNode): void {
  const old = Array.from(from.childNodes);
  const used = new Set<Node>();
  Array.from(to.childNodes).forEach((want, i) => {
    const reused = old.find((n) => !used.has(n) && sameKind(n, want));
    const node = reused ?? document.importNode(want, true);
    used.add(node);
    const current = from.childNodes[i] ?? null;
    if (current !== node) from.insertBefore(node, current);
    if (!reused) return;
    if (node.nodeType === 1) {
      morphAttributes(node as Element, want as Element);
      morphChildren(node as Element, want as Element);
    } else if (node.nodeValue !== want.nodeValue) {
      node.nodeValue = want.nodeValue;
    }
  });
  for (const n of old) if (!used.has(n)) (n as ChildNode).remove();
}
