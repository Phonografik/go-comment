// Tiny pixel glyphs (7×7 / 8×8 grids → SVG rects), so the popup never uses an
// emoji as an icon. Grids carried from the dashboard mock's build.mjs. Rendered
// in `currentColor`, so a Tailwind text-* class picks the colour.
import type { CSSProperties, ReactElement } from 'react';

const GLYPHS = {
  post: ['.kkkkk..', '.k...kk.', '.k....k.', '.k.kk.k.', '.k....k.', '.k.kk.k.', '.k....k.', '.kkkkkk.'],
  dm: ['........', 'kkkkkkkk', 'k......k', 'kk....kk', 'k.k..k.k', 'k..kk..k', 'k......k', 'kkkkkkkk'],
  repost: ['..kkkkk.', '..k...kk', '..k..kkk', '......k.', '.k......', 'kkk..k..', 'kk...k..', '.kkkkk..'],
  connect: ['..kk....', '.k..k...', '.k..k.k.', '..kk.kkk', '.k..k.k.', 'k....k..', 'k....k..', 'kkkkkk..'],
  comment: ['.kkkkkk.', 'k......k', 'k......k', 'k......k', '.kkkkkk.', '..kk....', '.k......', '........'],
  reply: ['.kkkkkk.', 'k......k', 'k..k...k', 'k.kkk..k', '.kkkkkk.', '....kk..', '......k.', '........'],
  snow: ['...k...', '.k.k.k.', '..kkk..', 'kkkkkkk', '..kkk..', '.k.k.k.', '...k...'],
  tick: ['.......', '......k', '.....k.', 'k...k..', '.k.k...', '..k....', '.......'],
  gear: ['..kkk..', '.kkkkk.', 'kkk.kkk', 'kk...kk', 'kkk.kkk', '.kkkkk.', '..kkk..'],
  badge: ['..kkk..', '.k...k.', 'k..k..k', 'k.kkk.k', 'k..k..k', '.k...k.', '..kkk..'],
  back: ['...k...', '..k....', '.k.....', 'k......', '.k.....', '..k....', '...k...'],
  lock: ['..kkk..', '.k...k.', '.k...k.', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk', 'kkkkkkk'],
} as const;

export type GlyphName = keyof typeof GLYPHS;

interface Props {
  name: GlyphName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name. Without one the glyph is decorative and hidden from AT. */
  title?: string;
}

export function Glyph({ name, size = 12, className, style, title }: Props) {
  const grid = GLYPHS[name];
  const n = grid.length;
  const rects: ReactElement[] = [];
  for (let y = 0; y < n; y++) {
    const row = grid[y] ?? '';
    let x = 0;
    while (x < n) {
      if (row[x] !== 'k') {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < n && row[end + 1] === 'k') end++;
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={end - x + 1} height={1} />);
      x = end + 1;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className}
      style={{ display: 'block', flex: 'none', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {rects}
    </svg>
  );
}
