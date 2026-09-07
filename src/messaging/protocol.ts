// The typed message contract between the three worlds of the extension:
// content script (linkedin.com) → background, and popup / settings page →
// background. The background is the ONLY writer of storage; everyone else
// sends one of these messages and gets a reply.
//
// This file is a shared contract. Changing a shape here changes what every
// entrypoint compiles against — do it deliberately, in its own commit.
//
// Wire-level: @webext-core/messaging v4 talks to the `chrome.*` globals, which
// Firefox also exposes. Under Vitest, WxtVitest stubs `chrome`/`browser` with
// @webext-core/fake-browser, so `sendMessage()` reaches `onMessage()` handlers
// registered in the same test without any extra plumbing.
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ActivityEvent, Badges, DayRollup, Derived, EventType, Legacy, Settings } from '../core/types';

/** Detection-health counters. Counts and timestamps only — never content. */
export interface Health {
  /** epoch ms of the last content-script mount on linkedin.com */
  lastPageLoad: number;
  /** hints that never got a DOM outcome, per event type (flushed as counts) */
  unconfirmed: Partial<Record<EventType, number>>;
  /** epoch ms of the last confirmed event, per type — the popup's "last comment detected 2 days ago" row */
  lastDetected: Partial<Record<EventType, number>>;
  /** SELECTORS_VERSION from src/detect/selectors.ts, as reported by the last page load */
  selectorsVersion: string;
}

/**
 * A confirmed event from the content script. `threadKey` is only present for
 * DMs (`t: 'm'`): the background hashes it with the session salt to enforce
 * "first message to a person per day", then discards it. It is NEVER stored.
 */
export interface ActionMessage extends ActivityEvent {
  threadKey?: string;
}

export type StateSnapshot =
  | { onboarded: false }
  | {
      onboarded: true;
      derived: Derived;
      settings: Settings;
      badges: Badges;
      legacy?: Legacy;
      health: Health;
    };

/** What settings.html writes out and reads back. `storage.session` is never included. */
export interface ExportFile {
  schemaVersion: 2;
  exportedAt: number;
  data: {
    events: ActivityEvent[];
    days: DayRollup;
    settings: Settings;
    badges: Badges;
    legacy?: Legacy;
    health: Health;
  };
}

export interface ProtocolMap {
  /** content → background. 'duplicate' = same-type event within 2 s, or a DM to a thread already seen today. */
  action(msg: ActionMessage): 'recorded' | 'duplicate' | 'ignored';
  /** content → background, once per mount. */
  pageLoad(msg: { selectorsVersion: string }): void;
  /** content → background, when a hint's deadline passes without an outcome. */
  unconfirmed(msg: { t: EventType }): void;
  /** popup / settings → background. */
  getState(): StateSnapshot;
  /** The first call that sets `level` completes onboarding. */
  setSettings(patch: Partial<Settings>): StateSnapshot;
  exportData(): ExportFile;
  importData(msg: { file: ExportFile; mode: 'replace' | 'merge' }): StateSnapshot;
  /** Dev builds only (`import.meta.env.DEV`); the background refuses it in production. */
  debugInject(msg: { t: EventType; count?: number }): StateSnapshot;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
