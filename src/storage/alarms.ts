// Two alarms, each re-armed with an ABSOLUTE `when` every time it fires.
// A fixed `periodInMinutes` would drift by an hour across every DST change;
// computing "the next local 00:00" through the Date constructor cannot.
//
//   rollover — next 00:00 local: forget DM fingerprints, purge the stale v1
//              backup, re-derive (yesterday is now closed), redraw the badge
//   evening  — next 18:00 local: re-derive and redraw so an empty weekday
//              turns the badge amber while there is still time to fix it
import { browser } from 'wxt/browser';
import { EVENING_HOUR } from './badge';

export const ALARM_ROLLOVER = 'rollover';
export const ALARM_EVENING = 'evening';

/** Epoch ms of the first local midnight strictly after `now`. */
export function nextMidnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).getTime();
}

/** Epoch ms of the first local 18:00 strictly after `now`. */
export function nextEvening(now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), EVENING_HOUR, 0, 0, 0).getTime();
  if (today > now.getTime()) return today;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, EVENING_HOUR, 0, 0, 0).getTime();
}

export async function armRollover(now: Date): Promise<void> {
  await browser.alarms.create(ALARM_ROLLOVER, { when: nextMidnight(now) });
}

export async function armEvening(now: Date): Promise<void> {
  await browser.alarms.create(ALARM_EVENING, { when: nextEvening(now) });
}

/** Install / startup: (re)create both. `alarms.create` replaces an alarm of the same name. */
export async function armAlarms(now: Date): Promise<void> {
  await armRollover(now);
  await armEvening(now);
}
