// Draws a character grid (src/ui/sprites/parrot.ts) as an inline SVG: one
// <rect> per horizontal run of same-coloured pixels, shape-rendering
// crispEdges, so it stays sharp at any DPI and any scale. No hooks, no state —
// a pure function of its props, so it renders the same on the server, in a
// test, or in the popup.
import { PALETTE } from './sprites/parrot';
import type { Grid, Palette } from './sprites/parrot';

export interface PixelSpriteProps {
  grid: Grid;
  /** CSS pixels per grid pixel. 4 turns a 24-grid into 96 × 96. */
  scale?: number;
  /** The accessible name — what a screen reader says for the image. */
  title: string;
  className?: string;
  /** Recolour: character → colour, `null` for transparent. Defaults to the parrot palette. */
  palette?: Palette;
}

/** A horizontal run of one colour: `w` pixels starting at (x, y). */
export interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/**
 * The rects a grid needs. Adjacent same-colour pixels in a row merge into one
 * run; transparent ('.') and unknown characters are skipped.
 */
export function spriteRuns(grid: Grid, palette: Palette = PALETTE): Run[] {
  const runs: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const fill = ch === undefined ? null : palette[ch];
      if (!fill) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return runs;
}

export function PixelSprite({ grid, scale = 4, title, className, palette = PALETTE }: PixelSpriteProps) {
  const height = grid.length;
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      className={className}
    >
      {spriteRuns(grid, palette).map((run) => (
        <rect key={`${run.x},${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.fill} />
      ))}
    </svg>
  );
}
