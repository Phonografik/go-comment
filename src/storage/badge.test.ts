import { describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Derived } from '../core/types';
import { applyBadge, badgeState } from './badge';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

const derivedWith = (patch: Partial<Derived>): Derived =>
  ({ today: '2026-09-09', level: 1, streak: 3, shownUpToday: false, atRisk: false, ...patch }) as Derived;

describe('badgeState', () => {
  it('is empty and grey before onboarding', () => {
    expect(badgeState(null, at(2026, 9, 9))).toEqual({ text: '', colour: 'grey' });
  });

  it('shows the streak as text, empty when zero', () => {
    expect(badgeState(derivedWith({ streak: 12, shownUpToday: true }), at(2026, 9, 9)).text).toBe('12');
    expect(badgeState(derivedWith({ streak: 0 }), at(2026, 9, 9)).text).toBe('');
  });

  it('is green once shown up today', () => {
    expect(badgeState(derivedWith({ shownUpToday: true }), at(2026, 9, 9, 9)).colour).toBe('green');
  });

  it('is amber only when at risk AND it is 18:00 or later', () => {
    expect(badgeState(derivedWith({ atRisk: true }), at(2026, 9, 9, 17)).colour).toBe('grey');
    expect(badgeState(derivedWith({ atRisk: true }), at(2026, 9, 9, 18)).colour).toBe('amber');
    expect(badgeState(derivedWith({ atRisk: false }), at(2026, 9, 9, 20)).colour).toBe('grey');
  });

  it('is grey at the weekend and at level 0, whatever else is true', () => {
    expect(badgeState(derivedWith({ today: '2026-09-12', shownUpToday: true }), at(2026, 9, 12)).colour).toBe('grey');
    expect(badgeState(derivedWith({ level: 0, shownUpToday: true }), at(2026, 9, 9)).colour).toBe('grey');
    expect(badgeState(derivedWith({ level: 0, atRisk: true }), at(2026, 9, 9, 19)).colour).toBe('grey');
  });
});

describe('applyBadge', () => {
  it('writes text and background colour to the action', async () => {
    await applyBadge({ text: '7', colour: 'amber' });
    expect(await fakeBrowser.action.getBadgeText({})).toBe('7');
    expect(await fakeBrowser.action.getBadgeBackgroundColor({})).toEqual([240, 192, 0, 255]);
  });

  it('falls back to browserAction when action is missing (Firefox MV2)', async () => {
    const b = browser as unknown as { action?: unknown; browserAction?: unknown };
    const saved = { action: b.action, browserAction: b.browserAction };
    const stub = { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}) };
    try {
      b.action = undefined;
      b.browserAction = stub;
      await applyBadge({ text: '2', colour: 'green' });
      expect(stub.setBadgeText).toHaveBeenCalledWith({ text: '2' });
      expect(stub.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#22a06b' });
    } finally {
      b.action = saved.action;
      b.browserAction = saved.browserAction;
    }
  });
});
