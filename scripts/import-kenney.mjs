#!/usr/bin/env node
// Builds public/assets/kenney/atlas.{png,json} from Kenney's CC0 "Topdown Shooter" pack.
//
// The pack is fetched from the series-ai/jam-ready-assets GitHub mirror (pinned commit),
// because kenney.nl itself is not reachable from the build workers. Characters come from
// the pack's vector file, rendered with headless Chromium at 2x-4x so they stay crisp when
// Phaser scales them; crates and barrels come from the 2X tilesheet. See CREDITS.md.
//
// Usage: node scripts/import-kenney.mjs   (needs Playwright; CHROME_PATH overrides the browser)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'kenney');
const MIRROR_COMMIT = '2d7c41049c1db4d670b1ded88a7aeec0d7c2f38c';
const PACK = 'kenney-topdown-shooter/2D/misc';
const RAW = `https://raw.githubusercontent.com/series-ai/jam-ready-assets/${MIRROR_COMMIT}/${PACK}`;
// Binary files in the mirror are Git LFS objects; this host serves their contents.
const LFS = `https://media.githubusercontent.com/media/series-ai/jam-ready-assets/${MIRROR_COMMIT}/${PACK}`;

const CHARACTERS_SVG = `${RAW}/Vector/topdownShooter_characters_vector.svg`;
const TILESHEET_2X = `${LFS}/Tilesheet/tilesheet_complete_2X.png`;
const LICENSE = `${RAW}/License.txt`;

// The vector file is a Flash export: sprite N is every <use> whose href starts with #Layer0_N_.
// Indices were identified from a rendered contact sheet. `scale` is the render scale over the
// pack's 1x size; `filter` is a canvas filter applied while drawing.
const CHARACTER_FRAMES = [
  { key: 'soldier', index: 4, scale: 2 }, // Soldier 1, machine gun
  { key: 'walker', index: 23, scale: 2 }, // Zombie 1, arms out
  { key: 'runner', index: 26, scale: 2 }, // Zombie 2, arms out
  { key: 'brute', index: 24, scale: 3 }, // Zombie 1, standing (drawn large)
  { key: 'boss', index: 28, scale: 4, filter: 'hue-rotate(290deg) saturate(1.8) brightness(0.95)' }, // Zombie 2 with a machine gun, recoloured
  { key: 'heroSarge', index: 43, scale: 2 }, // Soldier 2, gun
  { key: 'heroDoc', index: 67, scale: 2 }, // Woman (old), gun
  { key: 'heroBlaze', index: 79, scale: 2 }, // Man (red), gun
  { key: 'rifle', index: 97, scale: 2 },
  { key: 'smg', index: 98, scale: 2 },
];

// tilesheet_complete_2X.png is a 27-column grid of 128 px tiles in tile_NN order.
const TILE_FRAMES = [
  { key: 'crate', tile: 129 },
  { key: 'crateSmall', tile: 130 },
  { key: 'barrel', tile: 316 },
  { key: 'barrelGrey', tile: 317 },
];
const TILE_COLS = 27;
const TILE_SIZE = 128;

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
};
const fetchDataUrl = async (url, mime) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
};

console.log('downloading pack files...');
const [svg, tilesheet, license] = await Promise.all([
  fetchText(CHARACTERS_SVG),
  fetchDataUrl(TILESHEET_2X, 'image/png'),
  fetchText(LICENSE),
]);
if (!/Creative Commons Zero/.test(license)) throw new Error('pack license is not CC0; refusing to import');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });

// Bounding box of each sprite in SVG user units (the viewBox maps 1:1 to CSS px here).
await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
const boxes = await page.evaluate(() => {
  const groups = new Map();
  for (const use of document.querySelectorAll('svg g use')) {
    const m = /#Layer0_(\d+)_/.exec(use.getAttribute('xlink:href') ?? use.getAttribute('href') ?? '');
    if (!m) continue;
    const r = use.getBoundingClientRect();
    const b = groups.get(Number(m[1])) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    b.x0 = Math.min(b.x0, r.left);
    b.y0 = Math.min(b.y0, r.top);
    b.x1 = Math.max(b.x1, r.right);
    b.y1 = Math.max(b.y1, r.bottom);
    groups.set(Number(m[1]), b);
  }
  return Object.fromEntries(groups);
});

const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
await page.setContent('<html><body style="margin:0"><canvas id="atlas"></canvas></body></html>');
const atlas = await page.evaluate(
  async ({ svgUrl, tilesUrl, boxes, characters, tiles, tileCols, tileSize }) => {
    const load = (src) => {
      const img = new Image();
      img.src = src;
      return img.decode().then(() => img);
    };
    const [svgImg, tilesImg] = await Promise.all([load(svgUrl), load(tilesUrl)]);

    const PAD = 2;
    const items = [];
    for (const c of characters) {
      const b = boxes[c.index];
      const w = Math.ceil((b.x1 - b.x0) * c.scale) + 2;
      const h = Math.ceil((b.y1 - b.y0) * c.scale) + 2;
      items.push({
        key: c.key,
        w,
        h,
        draw: (ctx, x, y) => {
          ctx.save();
          if (c.filter) ctx.filter = c.filter;
          ctx.drawImage(svgImg, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, x + 1, y + 1, w - 2, h - 2);
          ctx.restore();
        },
      });
    }
    for (const t of tiles) {
      const sx = ((t.tile - 1) % tileCols) * tileSize;
      const sy = Math.floor((t.tile - 1) / tileCols) * tileSize;
      items.push({ key: t.key, w: tileSize, h: tileSize, draw: (ctx, x, y) => ctx.drawImage(tilesImg, sx, sy, tileSize, tileSize, x, y, tileSize, tileSize) });
    }

    // Shelf packing into a 512-wide sheet, tallest first.
    items.sort((a, b) => b.h - a.h);
    const WIDTH = 512;
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    const placed = [];
    for (const item of items) {
      if (x + item.w + PAD > WIDTH) {
        x = PAD;
        y += rowH + PAD;
        rowH = 0;
      }
      placed.push({ ...item, x, y });
      x += item.w + PAD;
      rowH = Math.max(rowH, item.h);
    }
    const HEIGHT = y + rowH + PAD;

    const canvas = document.getElementById('atlas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const frames = {};
    for (const p of placed) {
      p.draw(ctx, p.x, p.y);
      frames[p.key] = {
        frame: { x: p.x, y: p.y, w: p.w, h: p.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
        sourceSize: { w: p.w, h: p.h },
      };
    }
    return { png: canvas.toDataURL('image/png'), frames, size: { w: WIDTH, h: HEIGHT } };
  },
  { svgUrl: svgDataUrl, tilesUrl: tilesheet, boxes, characters: CHARACTER_FRAMES, tiles: TILE_FRAMES, tileCols: TILE_COLS, tileSize: TILE_SIZE },
);
await browser.close();

mkdirSync(OUT_DIR, { recursive: true });
const png = Buffer.from(atlas.png.split(',')[1], 'base64');
writeFileSync(join(OUT_DIR, 'atlas.png'), png);
writeFileSync(
  join(OUT_DIR, 'atlas.json'),
  JSON.stringify(
    {
      frames: atlas.frames,
      meta: {
        app: 'scripts/import-kenney.mjs',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: atlas.size,
        scale: '1',
        source: `https://github.com/series-ai/jam-ready-assets/tree/${MIRROR_COMMIT}/${PACK}`,
        license: 'CC0 1.0 (Kenney, Topdown Shooter 1.0)',
      },
    },
    null,
    2,
  ),
);
writeFileSync(join(OUT_DIR, 'LICENSE-kenney.txt'), license);
console.log(`atlas.png ${atlas.size.w}x${atlas.size.h} ${png.length} bytes, ${Object.keys(atlas.frames).length} frames`);
for (const [key, f] of Object.entries(atlas.frames)) console.log(`  ${key.padEnd(12)} ${f.frame.w}x${f.frame.h}`);
