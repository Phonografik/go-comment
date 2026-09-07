import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PixelSprite, spriteRuns } from './PixelSprite';
import { ICON_16, PALETTE, PARROT_STAGES } from './sprites/parrot';

const rects = (html: string) => html.match(/<rect\b[^>]*>/g) ?? [];

describe('spriteRuns', () => {
  it('merges horizontal runs of one colour and skips transparent pixels', () => {
    expect(spriteRuns(['gg.k', '....'])).toEqual([
      { x: 0, y: 0, w: 2, fill: PALETTE.g },
      { x: 3, y: 0, w: 1, fill: PALETTE.k },
    ]);
  });

  it('does not merge across a colour change', () => {
    expect(spriteRuns(['gd'])).toEqual([
      { x: 0, y: 0, w: 1, fill: PALETTE.g },
      { x: 1, y: 0, w: 1, fill: PALETTE.d },
    ]);
  });

  it('skips characters the palette does not know', () => {
    expect(spriteRuns(['?g'])).toEqual([{ x: 1, y: 0, w: 1, fill: PALETTE.g }]);
  });
});

describe('<PixelSprite>', () => {
  it('renders an accessible, crisp inline svg sized by the grid and the scale', () => {
    const html = renderToStaticMarkup(<PixelSprite grid={['gg.', '.k.']} scale={10} title="Two pixels" />);
    expect(html).toMatch(/^<svg\b/);
    expect(html).toContain('viewBox="0 0 3 2"');
    expect(html).toContain('width="30"');
    expect(html).toContain('height="20"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Two pixels"');
  });

  it('draws one rect per run and none for transparent pixels', () => {
    const html = renderToStaticMarkup(<PixelSprite grid={['gg.', '.k.']} title="t" />);
    expect(rects(html)).toEqual([
      expect.stringContaining('x="0" y="0" width="2" height="1" fill="#45C24A"'),
      expect.stringContaining('x="1" y="1" width="1" height="1" fill="#12242A"'),
    ]);
  });

  it('defaults to scale 4 and passes className through', () => {
    const html = renderToStaticMarkup(<PixelSprite grid={['g']} title="t" className="hero" />);
    expect(html).toContain('width="4"');
    expect(html).toContain('height="4"');
    expect(html).toContain('class="hero"');
  });

  it('recolours through a custom palette', () => {
    const html = renderToStaticMarkup(<PixelSprite grid={['gk']} title="t" palette={{ g: '#ABCDEF', k: null }} />);
    expect(rects(html)).toHaveLength(1);
    expect(html).toContain('fill="#ABCDEF"');
  });

  it('renders every parrot stage and the icon', () => {
    for (const grid of [...PARROT_STAGES, ICON_16]) {
      const html = renderToStaticMarkup(<PixelSprite grid={grid} title="Parrot" />);
      expect(rects(html).length).toBeGreaterThan(20);
      expect(html).not.toContain('fill="null"');
    }
  });
});
