import { describe, expect, it } from 'vitest';
import { MASCOT_STAGES, mascotStage } from './mascot';

describe('the parrot', () => {
  it('has seven stages, egg first', () => {
    expect(MASCOT_STAGES).toHaveLength(7);
    expect(MASCOT_STAGES[0]).toBe('Egg');
    expect(MASCOT_STAGES[6]).toBe('Crowned Lunatic');
  });

  it('grows with the best of this week and last, whatever level is set', () => {
    expect(mascotStage(0, 0, false)).toBe(0);
    expect(mascotStage(0, 0, true)).toBe(1);
    expect(mascotStage(10, 0, true)).toBe(1);
    expect(mascotStage(25, 0, true)).toBe(2);
    expect(mascotStage(0, 50, true)).toBe(3);
    expect(mascotStage(111, 0, true)).toBe(4);
    expect(mascotStage(160, 0, true)).toBe(5);
    expect(mascotStage(250, 0, true)).toBe(6);
    expect(mascotStage(999, 0, true)).toBe(6);
  });

  it('moults back down when last week rolls off', () => {
    expect(mascotStage(10, 250, true)).toBe(6);
    expect(mascotStage(10, 10, true)).toBe(1);
  });
});
