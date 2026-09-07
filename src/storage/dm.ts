// "First DM to a person per day" without ever storing who the person is.
//
// The content script hands the background a thread key (the id from the
// messaging URL, or a profile slug in an overlay bubble). The background
// hashes it with a random per-session salt and keeps only the hash, in
// `storage.session`, for the current day. The key itself is never written,
// never logged, and never leaves this module. PRIVACY.md discloses exactly
// this: a one-way, randomly salted fingerprint, in memory, for one day.
import type { DateKey } from '../core/types';
import { dmSalt, dmSeen } from './repo';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function hashThreadKey(salt: string, threadKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + threadKey));
  return toHex(new Uint8Array(digest));
}

/** The session salt, created on first use. Gone when the browser closes. */
export async function getOrCreateSalt(): Promise<string> {
  const existing = await dmSalt.getValue();
  if (existing) return existing;
  const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
  await dmSalt.setValue(salt);
  return salt;
}

/**
 * Records that this thread was messaged on `today`. Returns 'first' when it
 * had not been seen today (the caller records the DM) or 'seen' (a repeat —
 * the caller reports 'duplicate'). A `dmSeen` from another day is discarded.
 */
export async function claimDmToday(threadKey: string, today: DateKey): Promise<'first' | 'seen'> {
  const salt = await getOrCreateSalt();
  const hash = await hashThreadKey(salt, threadKey);
  const current = await dmSeen.getValue();
  const seen = current && current.d === today ? current : { d: today, hashes: [] };
  if (seen.hashes.includes(hash)) return 'seen';
  await dmSeen.setValue({ d: today, hashes: [...seen.hashes, hash] });
  return 'first';
}

/** Rollover: forget every fingerprint. The salt can stay — it is per session, not per day. */
export async function clearDmSeen(): Promise<void> {
  await dmSeen.removeValue();
}
