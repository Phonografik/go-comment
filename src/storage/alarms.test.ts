import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ALARM_EVENING, ALARM_ROLLOVER, armAlarms, nextEvening, nextMidnight } from './alarms';

const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
const HOUR = 3_600_000;

describe('alarm times', () => {
  it('nextMidnight is the first local 00:00 strictly after now', () => {
    expect(nextMidnight(at(2026, 9, 9, 12))).toBe(at(2026, 9, 10, 0).getTime());
    expect(nextMidnight(at(2026, 9, 10, 0, 0, 5))).toBe(at(2026, 9, 11, 0).getTime());
  });

  it('nextEvening is today at 18:00 before then, tomorrow at 18:00 from 18:00 on', () => {
    expect(nextEvening(at(2026, 9, 9, 12))).toBe(at(2026, 9, 9, 18).getTime());
    expect(nextEvening(at(2026, 9, 9, 18, 0, 0))).toBe(at(2026, 9, 10, 18).getTime());
    expect(nextEvening(at(2026, 9, 9, 18, 0, 3))).toBe(at(2026, 9, 10, 18).getTime());
  });

  it('crosses the spring clock change with a 23-hour day (a fixed period would land at 01:00)', () => {
    expect(new Date(2026, 2, 29).getTimezoneOffset()).toBe(0); // GMT before the change
    expect(new Date(2026, 2, 30).getTimezoneOffset()).toBe(-60); // BST after
    const firedAt = at(2026, 3, 29, 0, 0, 5);
    const next = nextMidnight(firedAt);
    expect(new Date(next).getHours()).toBe(0);
    expect(next - at(2026, 3, 29, 0).getTime()).toBe(23 * HOUR);
  });

  it('crosses the autumn clock change with a 25-hour day', () => {
    const firedAt = at(2026, 10, 25, 0, 0, 5);
    const next = nextMidnight(firedAt);
    expect(new Date(next).getHours()).toBe(0);
    expect(next - at(2026, 10, 25, 0).getTime()).toBe(25 * HOUR);
    expect(nextEvening(at(2026, 10, 25, 18, 0, 1)) - at(2026, 10, 25, 18).getTime()).toBe(24 * HOUR);
  });

  it('armAlarms creates both with an absolute when and no period', async () => {
    await armAlarms(at(2026, 9, 9, 12));
    const rollover = await fakeBrowser.alarms.get(ALARM_ROLLOVER);
    const evening = await fakeBrowser.alarms.get(ALARM_EVENING);
    expect(rollover?.scheduledTime).toBe(at(2026, 9, 10, 0).getTime());
    expect(rollover?.periodInMinutes).toBeUndefined();
    expect(evening?.scheduledTime).toBe(at(2026, 9, 9, 18).getTime());
    expect(evening?.periodInMinutes).toBeUndefined();
  });
});
