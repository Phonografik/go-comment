// Renders the extension icons (16/32/48/128) from ICON_16 — the toolbar grid in
// src/ui/sprites/parrot.ts, the same data the popup draws from — with no image
// tooling: a tiny PNG encoder over node's zlib. Node 24 strips the types on
// import, which is why parrot.ts stays free of non-erasable syntax.
//
// 32/48/128 are the 16-grid scaled 2× / 3× / 8×, nearest-neighbour, so every
// grid pixel stays a square block (the mock's decision — the 24-grid stages do
// not scale to 16). Run: `npm run icons`.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_16, PALETTE } from '../src/ui/sprites/parrot.ts';

const OUT_DIR = fileURLToPath(new URL('../public/icon/', import.meta.url));
const SIZES = [16, 32, 48, 128];

/** '#RRGGBB' → [r, g, b, 255]; null (transparent) → [0, 0, 0, 0]. */
function rgba(hex) {
  if (!hex) return [0, 0, 0, 0];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
}

// Character grid → palette-index grid, palette → RGBA table, so the encoder
// stays a plain index lookup.
const KEYS = Object.keys(PALETTE);
const RGBA_PALETTE = KEYS.map((k) => rgba(PALETTE[k]));
const toIndexGrid = (grid) => grid.map((row) => [...row].map((ch) => KEYS.indexOf(ch)));

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode a square palette-index grid as an RGBA PNG of `size` px, nearest-
 * neighbour scaled. `size` must be a whole multiple of the grid size.
 */
export function encodePng(size, grid, palette = RGBA_PALETTE) {
  if (size % grid.length !== 0) throw new Error(`${size}px is not a whole multiple of a ${grid.length}-grid`);
  const scale = size / grid.length;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const idx = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      const [r, g, b, a] = palette[idx];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && process.argv[1].endsWith('render-icons.mjs')) {
  const grid = toIndexGrid(ICON_16);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) writeFileSync(join(OUT_DIR, `${size}.png`), encodePng(size, grid));
  console.log(`icons rendered from ICON_16: ${SIZES.map((s) => `${s}.png`).join(', ')} in public/icon/`);
}
