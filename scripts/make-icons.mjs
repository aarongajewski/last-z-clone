#!/usr/bin/env node
// Generates the PWA / Home Screen icon set into public/icons without any
// external dependency: shapes are rasterised here and written as PNG via zlib.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SUPERSAMPLE = 3;

const PALETTE = {
  background: [0x0b, 0x0f, 0x14],
  zombie: [0x5f, 0xbf, 0x5f],
  zombieDark: [0x2f, 0x6f, 0x2f],
  eye: [0xff, 0x4d, 0x4d],
  crosshair: [0xff, 0xd1, 0x66],
};

// ---- PNG encoding -----------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Tiny rasteriser --------------------------------------------------------

class Raster {
  constructor(size) {
    this.size = size;
    this.w = size * SUPERSAMPLE;
    this.data = new Float32Array(this.w * this.w * 4);
  }

  // Shapes are described in unit coordinates (0..1) so one drawing scales to every icon size.
  paint(color, bbox, inside) {
    const [r, g, b] = color;
    const x0 = Math.max(0, Math.floor(bbox[0] * this.w));
    const y0 = Math.max(0, Math.floor(bbox[1] * this.w));
    const x1 = Math.min(this.w, Math.ceil(bbox[2] * this.w));
    const y1 = Math.min(this.w, Math.ceil(bbox[3] * this.w));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const ux = (px + 0.5) / this.w;
        const uy = (py + 0.5) / this.w;
        if (!inside(ux, uy)) continue;
        const i = (py * this.w + px) * 4;
        this.data[i] = r;
        this.data[i + 1] = g;
        this.data[i + 2] = b;
        this.data[i + 3] = 255;
      }
    }
  }

  circle(cx, cy, radius, color) {
    this.paint(color, [cx - radius, cy - radius, cx + radius, cy + radius], (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  ring(cx, cy, outer, inner, color) {
    this.paint(color, [cx - outer, cy - outer, cx + outer, cy + outer], (x, y) => {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d2 <= outer * outer && d2 >= inner * inner;
    });
  }

  roundedRect(x, y, w, h, radius, color) {
    this.paint(color, [x, y, x + w, y + h], (px, py) => {
      const qx = Math.max(Math.abs(px - (x + w / 2)) - (w / 2 - radius), 0);
      const qy = Math.max(Math.abs(py - (y + h / 2)) - (h / 2 - radius), 0);
      return qx * qx + qy * qy <= radius * radius;
    });
  }

  toPng() {
    const { size, w, data } = this;
    const out = Buffer.alloc(size * size * 4);
    const samples = SUPERSAMPLE * SUPERSAMPLE;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < SUPERSAMPLE; sy++) {
          for (let sx = 0; sx < SUPERSAMPLE; sx++) {
            const i = ((y * SUPERSAMPLE + sy) * w + (x * SUPERSAMPLE + sx)) * 4;
            const alpha = data[i + 3] / 255;
            r += data[i] * alpha;
            g += data[i + 1] * alpha;
            b += data[i + 2] * alpha;
            a += alpha;
          }
        }
        const o = (y * size + x) * 4;
        if (a > 0) {
          out[o] = Math.round(r / a);
          out[o + 1] = Math.round(g / a);
          out[o + 2] = Math.round(b / a);
        }
        out[o + 3] = Math.round((a / samples) * 255);
      }
    }
    return encodePng(size, out);
  }
}

// ---- Icon artwork -----------------------------------------------------------

/**
 * A zombie head caught in a crosshair.
 * @param {Raster} r
 * @param {{ fullBleed: boolean; safeZone: number }} opts
 */
function drawIcon(r, { fullBleed, safeZone }) {
  if (fullBleed) r.roundedRect(0, 0, 1, 1, 0, PALETTE.background);
  else r.roundedRect(0, 0, 1, 1, 0.22, PALETTE.background);

  const s = safeZone;
  const c = 0.5;
  const scaled = (v) => v * s;

  r.ring(c, c, scaled(0.42), scaled(0.37), PALETTE.crosshair);
  const tick = scaled(0.045);
  const tickLen = scaled(0.1);
  r.roundedRect(c - tick / 2, c - scaled(0.47), tick, tickLen, tick / 2, PALETTE.crosshair);
  r.roundedRect(c - tick / 2, c + scaled(0.47) - tickLen, tick, tickLen, tick / 2, PALETTE.crosshair);
  r.roundedRect(c - scaled(0.47), c - tick / 2, tickLen, tick, tick / 2, PALETTE.crosshair);
  r.roundedRect(c + scaled(0.47) - tickLen, c - tick / 2, tickLen, tick, tick / 2, PALETTE.crosshair);

  r.circle(c, c, scaled(0.27), PALETTE.zombieDark);
  r.circle(c, c, scaled(0.22), PALETTE.zombie);
  r.circle(c - scaled(0.085), c + scaled(0.03), scaled(0.045), PALETTE.eye);
  r.circle(c + scaled(0.085), c + scaled(0.03), scaled(0.045), PALETTE.eye);
}

const ICONS = [
  { file: 'favicon-32x32.png', size: 32, fullBleed: false, safeZone: 1 },
  { file: 'apple-touch-icon.png', size: 180, fullBleed: true, safeZone: 0.9 },
  { file: 'pwa-192x192.png', size: 192, fullBleed: false, safeZone: 1 },
  { file: 'pwa-512x512.png', size: 512, fullBleed: false, safeZone: 1 },
  { file: 'maskable-512x512.png', size: 512, fullBleed: true, safeZone: 0.8 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const icon of ICONS) {
  const raster = new Raster(icon.size);
  drawIcon(raster, icon);
  const png = raster.toPng();
  writeFileSync(join(OUT_DIR, icon.file), png);
  console.log(`${icon.file}  ${icon.size}x${icon.size}  ${png.length} bytes`);
}
