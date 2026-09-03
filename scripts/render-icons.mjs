// Renders the extension icons (16/32/48/128) from a pixel grid, with no image
// tooling — a tiny PNG encoder over node's zlib. The grid is placeholder art
// until the parrot sprites land in src/ui/sprites/; then this script points at
// the stage-3 parrot and re-renders. Run: `npm run icons`.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

// Palette index → RGBA. 0 is transparent.
const PALETTE = [
  [0, 0, 0, 0],
  [0x00, 0xd4, 0xdd, 255], // cyan
  [0x12, 0x24, 0x2a, 255], // ink
  [0xff, 0xff, 0xff, 255], // white
  [0xff, 0x6b, 0x35, 255], // orange
];

// 16×16 placeholder: a cyan rounded tile with an ink "G".
const GRID = [
  '0111111111111110',
  '1111111111111111',
  '1111111111111111',
  '1111122222211111',
  '1111222222221111',
  '1112221111222111',
  '1112211111112111',
  '1112211111111111',
  '1112211122222111',
  '1112211122222111',
  '1112211111122111',
  '1112221111222111',
  '1111222222221111',
  '1111122222211111',
  '1111111111111111',
  '0111111111111110',
].map((row) => [...row].map(Number));

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

export function encodePng(size, grid, palette = PALETTE) {
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
  mkdirSync('public/icon', { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(`public/icon/${size}.png`, encodePng(size, GRID));
  }
  console.log('icons rendered: public/icon/{16,32,48,128}.png');
}
