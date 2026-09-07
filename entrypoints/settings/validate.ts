// Shape check for a file the user picked in the Import section. Pure: no DOM,
// no messaging — the page parses the JSON, hands the result here, and only a
// file that passes is ever sent to the background. Every failure names the
// field that broke so the reason on screen is actionable ("events[3].d …"),
// never "invalid file".
import { EVENT_TYPES } from '../../src/core/types';
import type { ExportFile } from '../../src/messaging/protocol';

export type ValidationResult = { ok: true; file: ExportFile } | { ok: false; reason: string };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_FIELDS = ['c', 'n', 'p', 'bestWeek', 'weeklyStreak', 'longestWeeklyStreak', 'weekCarry', 'importedAt'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const fail = (reason: string): ValidationResult => ({ ok: false, reason });

export function validateExportFile(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Not a Go Comment export: the file is not a JSON object.');

  if (!('schemaVersion' in input)) return fail('Not a Go Comment export: no schemaVersion field.');
  if (input.schemaVersion !== 2) return fail(`schemaVersion is ${JSON.stringify(input.schemaVersion)} — this page only reads version 2 exports.`);
  if (!isFinite(input.exportedAt)) return fail('exportedAt is missing or not a number.');

  const data = input.data;
  if (!isRecord(data)) return fail('data is missing or not an object.');

  // events: [{ t, ts, d }]
  if (!Array.isArray(data.events)) return fail('data.events is missing or not an array.');
  for (const [i, e] of data.events.entries()) {
    if (!isRecord(e)) return fail(`events[${i}] is not an object.`);
    if (typeof e.t !== 'string' || !(EVENT_TYPES as readonly string[]).includes(e.t)) {
      return fail(`events[${i}].t is ${JSON.stringify(e.t)}, expected one of ${EVENT_TYPES.join(', ')}.`);
    }
    if (!isFinite(e.ts)) return fail(`events[${i}].ts is not a number.`);
    if (typeof e.d !== 'string' || !DAY_KEY.test(e.d)) return fail(`events[${i}].d is not a YYYY-MM-DD day key.`);
  }

  // days: { 'YYYY-MM-DD': { c, r, p, q, n, m } }
  if (!isRecord(data.days)) return fail('data.days is missing or not an object.');
  for (const [d, counts] of Object.entries(data.days)) {
    if (!DAY_KEY.test(d)) return fail(`days has a key ${JSON.stringify(d)} that is not a YYYY-MM-DD day key.`);
    if (!isRecord(counts)) return fail(`days[${d}] is not an object of counts.`);
    for (const t of EVENT_TYPES) {
      const n = counts[t];
      if (n !== undefined && (!isFinite(n) || n < 0)) return fail(`days[${d}].${t} is not a non-negative number.`);
    }
  }

  // settings: { level 0–5, memberSince }
  if (!isRecord(data.settings)) return fail('data.settings is missing or not an object.');
  const { level, memberSince } = data.settings;
  if (!isFinite(level) || !Number.isInteger(level) || level < 0 || level > 5) {
    return fail(`settings.level is ${JSON.stringify(level)}, expected a whole number from 0 to 5.`);
  }
  if (!isFinite(memberSince)) return fail('settings.memberSince is missing or not a number.');

  // badges: { id: unlockedAt }
  if (!isRecord(data.badges)) return fail('data.badges is missing or not an object.');
  for (const [id, at] of Object.entries(data.badges)) {
    if (!isFinite(at)) return fail(`badges.${id} is not a timestamp.`);
  }

  // legacy (optional): the v1 carry — every field numeric so derive() never sees NaN
  if (data.legacy !== undefined) {
    if (!isRecord(data.legacy)) return fail('data.legacy is present but not an object.');
    for (const f of LEGACY_FIELDS) {
      if (!isFinite(data.legacy[f])) return fail(`legacy.${f} is missing or not a number.`);
    }
  }

  // health: counters only; the background overwrites most of it anyway
  if (!isRecord(data.health)) return fail('data.health is missing or not an object.');

  return { ok: true, file: input as unknown as ExportFile };
}
