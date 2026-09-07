import { describe, expect, it } from 'vitest';
import type { ExportFile } from '../../src/messaging/protocol';
import { validateExportFile } from './validate';

const good = (): ExportFile => ({
  schemaVersion: 2,
  exportedAt: Date.UTC(2026, 8, 7, 14, 0),
  data: {
    events: [
      { t: 'c', ts: Date.UTC(2026, 8, 7, 9, 0), d: '2026-09-07' },
      { t: 'm', ts: Date.UTC(2026, 8, 7, 9, 5), d: '2026-09-07' },
    ],
    days: { '2026-09-01': { c: 3, r: 0, p: 1, q: 0, n: 2, m: 1 } },
    settings: { level: 2, memberSince: Date.UTC(2025, 4, 19) },
    badges: { 'first-word': Date.UTC(2025, 4, 19) },
    legacy: { c: 300, n: 40, p: 12, bestWeek: 92, weeklyStreak: 3, longestWeeklyStreak: 4, weekCarry: 0, importedAt: Date.UTC(2026, 8, 7) },
    health: { lastPageLoad: 0, unconfirmed: {}, lastDetected: {}, selectorsVersion: '2026-09-07' },
  },
});

/** Mutate a deep copy of the good file and return the failure reason. */
function reasonAfter(mutate: (f: Record<string, unknown> & { data: Record<string, unknown> }) => void): string {
  const f = JSON.parse(JSON.stringify(good()));
  mutate(f);
  const r = validateExportFile(f);
  if (r.ok) throw new Error('expected the mutated file to fail');
  return r.reason;
}

describe('validateExportFile', () => {
  it('accepts a real export and hands the same object back', () => {
    const file = good();
    const r = validateExportFile(file);
    expect(r).toEqual({ ok: true, file });
  });

  it('accepts a file with no legacy block and with partial day counts', () => {
    const f = good();
    delete f.data.legacy;
    (f.data.days as Record<string, unknown>)['2026-09-02'] = { c: 1 };
    expect(validateExportFile(f).ok).toBe(true);
  });

  it('rejects things that are not objects', () => {
    expect(validateExportFile(null)).toEqual({ ok: false, reason: 'Not a Go Comment export: the file is not a JSON object.' });
    expect(validateExportFile([1, 2]).ok).toBe(false);
    expect(validateExportFile('{}').ok).toBe(false);
  });

  it('rejects a missing or wrong schemaVersion, naming the version it saw', () => {
    expect(validateExportFile({ data: {} })).toEqual({ ok: false, reason: 'Not a Go Comment export: no schemaVersion field.' });
    expect(reasonAfter((f) => (f.schemaVersion = 1))).toBe('schemaVersion is 1 — this page only reads version 2 exports.');
    expect(reasonAfter((f) => (f.schemaVersion = '2'))).toBe('schemaVersion is "2" — this page only reads version 2 exports.');
  });

  it('rejects a bad exportedAt or data', () => {
    expect(reasonAfter((f) => (f.exportedAt = '2026-09-07'))).toBe('exportedAt is missing or not a number.');
    expect(reasonAfter((f) => (f.data = [] as unknown as Record<string, unknown>))).toBe('data is missing or not an object.');
  });

  it('checks every event and points at the broken one', () => {
    expect(reasonAfter((f) => (f.data.events = {}))).toBe('data.events is missing or not an array.');
    expect(reasonAfter((f) => ((f.data.events as unknown[])[1] = 'c'))).toBe('events[1] is not an object.');
    expect(reasonAfter((f) => ((f.data.events as Record<string, unknown>[])[0]!.t = 'x'))).toBe('events[0].t is "x", expected one of c, r, p, q, n, m.');
    expect(reasonAfter((f) => ((f.data.events as Record<string, unknown>[])[1]!.ts = '9am'))).toBe('events[1].ts is not a number.');
    expect(reasonAfter((f) => ((f.data.events as Record<string, unknown>[])[0]!.d = '2026-09-07T00:00:00Z'))).toBe(
      'events[0].d is not a YYYY-MM-DD day key.',
    );
  });

  it('checks the day rollup keys and counts', () => {
    expect(reasonAfter((f) => (f.data.days = []))).toBe('data.days is missing or not an object.');
    expect(reasonAfter((f) => ((f.data.days as Record<string, unknown>)['Monday'] = {}))).toBe(
      'days has a key "Monday" that is not a YYYY-MM-DD day key.',
    );
    expect(reasonAfter((f) => ((f.data.days as Record<string, unknown>)['2026-09-01'] = 4))).toBe('days[2026-09-01] is not an object of counts.');
    expect(reasonAfter((f) => ((f.data.days as Record<string, Record<string, unknown>>)['2026-09-01']!.p = -1))).toBe(
      'days[2026-09-01].p is not a non-negative number.',
    );
  });

  it('checks settings: level 0–5 and a numeric memberSince', () => {
    expect(reasonAfter((f) => (f.data.settings = null))).toBe('data.settings is missing or not an object.');
    expect(reasonAfter((f) => ((f.data.settings as Record<string, unknown>).level = 6))).toBe('settings.level is 6, expected a whole number from 0 to 5.');
    expect(reasonAfter((f) => ((f.data.settings as Record<string, unknown>).level = 'go-go-go'))).toBe(
      'settings.level is "go-go-go", expected a whole number from 0 to 5.',
    );
    expect(reasonAfter((f) => ((f.data.settings as Record<string, unknown>).level = 1.5))).toBe('settings.level is 1.5, expected a whole number from 0 to 5.');
    expect(reasonAfter((f) => ((f.data.settings as Record<string, unknown>).memberSince = '2025-05-19'))).toBe(
      'settings.memberSince is missing or not a number.',
    );
  });

  it('checks badges, legacy and health', () => {
    expect(reasonAfter((f) => (f.data.badges = ['first-word']))).toBe('data.badges is missing or not an object.');
    expect(reasonAfter((f) => ((f.data.badges as Record<string, unknown>).centurion = true))).toBe('badges.centurion is not a timestamp.');
    expect(reasonAfter((f) => (f.data.legacy = 'v1'))).toBe('data.legacy is present but not an object.');
    expect(reasonAfter((f) => delete (f.data.legacy as Record<string, unknown>).weekCarry)).toBe('legacy.weekCarry is missing or not a number.');
    expect(reasonAfter((f) => delete f.data.health)).toBe('data.health is missing or not an object.');
  });
});
