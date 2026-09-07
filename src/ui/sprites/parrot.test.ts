import { describe, expect, it } from 'vitest';
import { MASCOT_STAGES } from '../../core/mascot';
import { ICON_16, PALETTE, PARROT_STAGES } from './parrot';

const isSquare = (grid: readonly string[], size: number) =>
  grid.length === size && grid.every((row) => row.length === size);

describe('parrot sprites', () => {
  it('has one grid per mascot stage, in MASCOT_STAGES order', () => {
    expect(PARROT_STAGES).toHaveLength(MASCOT_STAGES.length);
    expect(PARROT_STAGES).toHaveLength(7);
  });

  it.each(MASCOT_STAGES.map((name, i) => [i, name] as const))('stage %i (%s) is exactly 24 × 24', (i) => {
    expect(isSquare(PARROT_STAGES[i]!, 24)).toBe(true);
  });

  it('the toolbar icon is exactly 16 × 16', () => {
    expect(isSquare(ICON_16, 16)).toBe(true);
  });

  it('every pixel in every grid is a PALETTE key', () => {
    const keys = new Set(Object.keys(PALETTE));
    for (const grid of [...PARROT_STAGES, ICON_16]) {
      for (const row of grid) {
        for (const ch of row) expect(keys.has(ch), `unknown pixel '${ch}'`).toBe(true);
      }
    }
  });

  it('the palette is hex colours, with only "." transparent', () => {
    for (const [ch, hex] of Object.entries(PALETTE)) {
      if (ch === '.') expect(hex).toBeNull();
      else expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('stages differ from each other', () => {
    expect(new Set(PARROT_STAGES.map((g) => g.join('\n'))).size).toBe(7);
  });
});
