import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { claimDmToday, clearDmSeen, getOrCreateSalt, hashThreadKey } from './dm';
import { dmSeen } from './repo';

const HEX64 = /^[0-9a-f]{64}$/;

describe('DM fingerprints', () => {
  it('hashes to 64 hex chars, deterministically for one salt and differently across salts', async () => {
    const a = await hashThreadKey('salt-1', 'thread-x');
    expect(a).toMatch(HEX64);
    expect(await hashThreadKey('salt-1', 'thread-x')).toBe(a);
    expect(await hashThreadKey('salt-2', 'thread-x')).not.toBe(a);
    expect(await hashThreadKey('salt-1', 'thread-y')).not.toBe(a);
  });

  it('creates the salt once, in session storage only', async () => {
    const first = await getOrCreateSalt();
    expect(first).toMatch(HEX64);
    expect(await getOrCreateSalt()).toBe(first);
    expect(await fakeBrowser.storage.session.get('dmSalt')).toEqual({ dmSalt: first });
    expect(await fakeBrowser.storage.local.get('dmSalt')).toEqual({});
  });

  it('claims a thread once per day, without ever storing the key', async () => {
    expect(await claimDmToday('thread-A', '2026-09-09')).toBe('first');
    expect(await claimDmToday('thread-A', '2026-09-09')).toBe('seen');
    expect(await claimDmToday('thread-B', '2026-09-09')).toBe('first');
    const seen = await dmSeen.getValue();
    expect(seen?.d).toBe('2026-09-09');
    expect(seen?.hashes).toHaveLength(2);
    for (const h of seen!.hashes) expect(h).toMatch(HEX64);
    expect(JSON.stringify(await fakeBrowser.storage.session.get(null))).not.toContain('thread-');
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });

  it('starts fresh on a new day key and after clearDmSeen', async () => {
    expect(await claimDmToday('thread-A', '2026-09-09')).toBe('first');
    expect(await claimDmToday('thread-A', '2026-09-10')).toBe('first');
    expect(await claimDmToday('thread-A', '2026-09-10')).toBe('seen');
    await clearDmSeen();
    expect(await dmSeen.getValue()).toBeNull();
    expect(await claimDmToday('thread-A', '2026-09-10')).toBe('first');
  });
});
