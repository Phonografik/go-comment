// The parrot, as data. Seven 24×24 stage grids and the 16×16 toolbar icon,
// copied verbatim from the mock (workspace deliverable
// 2026-09-03_parrot-and-dashboard-mock.md). One character per pixel; PALETTE
// maps each character to a colour and '.' is transparent.
//
// This is the single source of truth for the mascot: <PixelSprite> draws these
// grids in the popup, and scripts/render-icons.mjs rasterises ICON_16 to
// public/icon/*.png. Node 24 imports this file directly (type stripping), so
// keep the syntax erasable — type annotations and `as const` only. No enums,
// no namespaces, no parameter properties, and no imports.

/** A sprite: one string per row, one character per pixel. */
export type Grid = readonly string[];

/** Character → colour. `null` is transparent. */
export const PALETTE = {
  '.': null, // transparent
  k: '#12242A', // ink
  g: '#45C24A', // parrot green
  d: '#2A8A3C', // dark green (wing, tail)
  l: '#9BE88F', // light green (highlight, belly)
  o: '#FF6B35', // beak orange
  w: '#FFFFFF', // white (eye)
  y: '#F0C000', // amber (feet, crown)
  c: '#00D4DD', // cyan (cheek, sound, icon tile)
  v: '#8E6FD1', // violet (tail feather, gem)
  r: '#FF4757', // red (lunatic pupil)
  e: '#F4E9D2', // egg
  s: '#D6C4A0', // egg shade
  t: '#008B8D', // teal (egg speckle)
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Any character → colour map a sprite can be drawn with. `null` = transparent. */
export type Palette = Readonly<Record<string, string | null>>;

// 0 · Egg — no activity for two weeks
const EGG: Grid = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '...........kkk..........',
  '.........kkeeekk........',
  '........keweeeeek.......',
  '........kwteeeeek.......',
  '.......keeeeeeetek......',
  '.......keeeeeeeeek......',
  '.......keeeeetssek......',
  '......keeeeesssssek.....',
  '.......keeeesssssk......',
  '.......ketessssssk......',
  '.......keeessssssk......',
  '........keeessssk.......',
  '........keeessssk.......',
  '.........kkeeskk........',
  '...........kkk..........',
  '........................',
  '........................',
  '........................',
];

// 1 · Hatchling — any activity, under 25 points
const HATCHLING: Grid = [
  '........................',
  '........................',
  '........................',
  '........................',
  '...........kk...........',
  '..........kllk..........',
  '...........klk..........',
  '..........kgggk.........',
  '.........kgggggk........',
  '........kgwwggggk.......',
  '.......kogkwggggk.......',
  '.......kogggggggk.......',
  '.......kkkgggggk.k......',
  '......kekekgggkskek.....',
  '.......keeeesssssk......',
  '.......keeesstsssk......',
  '.......ketessssssk......',
  '........keeessssk.......',
  '........keeessssk.......',
  '.........kkeeskk........',
  '...........kkk..........',
  '........................',
  '........................',
  '........................',
];

// 2 · Fledgling — 25 — Go Comment
const FLEDGLING: Grid = [
  '........................',
  '........................',
  '........................',
  '........................',
  '...........k.k..........',
  '..........klklk.........',
  '...........klk..........',
  '.........kkkgkkk........',
  '........kgggggggk.......',
  '.......kgggggggggk......',
  '.......kgwwggggggk......',
  '......kggkwgggggggk.....',
  '.....kogggggggdddgk.....',
  '....kooggggggdddddk.....',
  '....kokgglllgdddddk.....',
  '.....kkgglllgdddddk.....',
  '.......klllllgdddk......',
  '.......kglllgggggk......',
  '........klllggggk.......',
  '.........kkkgkkk........',
  '.........kykkkyk........',
  '........kyyykyyyk.......',
  '.........kkk.kkk........',
  '........................',
];

// 3 · Parrot — 50 — Go Go Go!
const PARROT: Grid = [
  '........................',
  '.......kkkkk............',
  '......kgggggk...........',
  '.....kgllggggk..........',
  '....kglgggggggk.........',
  '...kkggwwgggggk.........',
  '..kogggkwggggggk........',
  '.kooogggggggggk.........',
  '.koooccgggggggk.........',
  '..kokkgggggggkkk........',
  '...k..kgggggggggk.......',
  '.......kgggggddggk......',
  '......kggggddddddgk.....',
  '......kggggddddddgk.....',
  '......kgllddddddddk.....',
  '......kglllddddddgk.....',
  '......kllllddddddgk.....',
  '.......klllggddgddk.....',
  '........kllgggggkddk....',
  '.........kkkgkkk.kddk...',
  '.......kkykkykkk..kddk..',
  '......kyyyykyyyyk..kddk.',
  '.......kkkk.kkkk....kk..',
  '........................',
];

// 4 · Show-off — 111 — Turn Dial to 11
const SHOW_OFF: Grid = [
  '.......kkkkk............',
  '......kkkkkkk...c.......',
  '.....kkgggggkk..........',
  '....kkgllggggkk.....c...',
  '...kkglgggggggkk...c.c..',
  '..kkkggwwgggggkk...kc...',
  '.kkogggkwggggggkk.kkk...',
  'kkooogggggggggkk.kkdkk..',
  'kkoooccgggggggkkkkddkk..',
  '.kkokkgggggggkkkkddkk...',
  '..kkkkkggggggdddddkk....',
  '...k..kkggggdddddkk.....',
  '.....kkggggdddddddkk....',
  '.....kkggggdddddddkk....',
  '.....kkglllgdddddgkk....',
  '.....kkglllggdddggkk....',
  '.....kklllllggggggkkkkk.',
  '......kklllgggggkooooook',
  '.......kkllgggggvyyykkk.',
  '.......kkkkkgkkkkvkkyyk.',
  '......kkkykkykkkkkvkkkyk',
  '.....kkyyyykyyyykkkvkkkk',
  '......kkkkkkkkkkk..kvkk.',
  '.......kkkk.kkkk....kk..',
];

// 5 · Loudmouth — 160 — Leader of Thoughts
const LOUDMOUTH: Grid = [
  '........................',
  '.......kkkkk............',
  '......kgggggk...........',
  '.c...kgllggggk..........',
  'c...kglgggggggk.........',
  'c.kkkggwwgggggk.........',
  '.koogggkwggggggk........',
  '.kooogggggggggk.........',
  '..kkoccgggggggkk........',
  'c.kookggggggggggk.......',
  'ckook.kggggggggggk......',
  '.ckk..kggggggddgggk.....',
  '......kggggddddddgk.....',
  '......kggggddddddgk.....',
  '......kgllddddddddk.....',
  '......kglllddddddgk.....',
  '......kllllddddddgk.....',
  '.......klllggddgddk.....',
  '........kllgggggkddk....',
  '.........kkkgkkk.kddk...',
  '.......kkykkykkk..kddk..',
  '......kyyyykyyyyk..kddk.',
  '.......kkkk.kkkk....kk..',
  '........................',
];

// 6 · Crowned Lunatic — 250 — LinkedIn Lunatic
const CROWNED_LUNATIC: Grid = [
  '......y..v..y...........',
  '......yvyyyvy...........',
  '.....kkgggggkk..........',
  '.c..kkgllggggkk.........',
  'c.kkkglgggggggkk........',
  'ckkkkggwwgggggkk...k....',
  '.koogggwrggggggkk.kkk...',
  '.kooogggggggggkk.kkdkk..',
  '.kkkoccgggggggkkkkddkk..',
  'c.kookggggggggggkddkk...',
  'ckookkkggggggdddddkk....',
  '.ckkkkkgggggdddddgkk....',
  '..kk.kkggggdddddddkk....',
  '.....kkggggdddddddkk....',
  '.....kkglllgdddddgkk....',
  '.....kkglllggdddggkk....',
  '.....kklllllggggggkkkkk.',
  '......kklllgggggkooooook',
  '.......kkllgggggvyyykkk.',
  '.......kkkkkgkkkkvkkyyk.',
  '......kkkykkykkkkkvkkkyk',
  '.....kkyyyykyyyykkkvkkkk',
  '......kkkkkkkkkkk..kvkk.',
  '.......kkkk.kkkk....kk..',
];

/**
 * The seven stages, indexed exactly like MASCOT_STAGES in src/core/mascot.ts:
 * 0 Egg · 1 Hatchling · 2 Fledgling · 3 Parrot · 4 Show-off · 5 Loudmouth ·
 * 6 Crowned Lunatic. A MascotStage indexes this without an undefined check.
 */
export const PARROT_STAGES = [EGG, HATCHLING, FLEDGLING, PARROT, SHOW_OFF, LOUDMOUTH, CROWNED_LUNATIC] as const;

/**
 * The toolbar icon: the parrot's head on the cyan tile. Its own 16-grid — the
 * 24-grid does not scale to 16. The 32/48/128 icons are this grid scaled.
 */
export const ICON_16: Grid = [
  '.cccccccccccccc.',
  'cccccccccccccccc',
  'cccccccccccccccc',
  'cccccccckkkccccc',
  'cccccckkllgkkccc',
  'ccccckglgggggkcc',
  'cccckggwwgggggkc',
  'ccckkggkwgggggkc',
  'cckokgggggggggkc',
  'ckookgggggggggkc',
  'ckookgggggggggkc',
  'cckkckgggggggkcc',
  'cccccckkgggkkccc',
  'cccccccckkkccccc',
  'cccccccccccccccc',
  '.cccccccccccccc.',
];
