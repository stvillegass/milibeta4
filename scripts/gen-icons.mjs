#!/usr/bin/env node
/**
 * Genera iconos PNG de la PWA (sin dependencias) usando zlib (builtin).
 * Diseño: rombo/diamante dorado (marca Milibeauty) sobre fondo oscuro.
 * Salida: public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

// ---- CRC32 ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >> 1) : c >> 1;
  CRC_TABLE[n] = c;
}
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >> 8);
  return c ^ 0xffffffff;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((crc32(body) >>> 0));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 2;    // color type RGB
  // raw: each row prefixed by filter 0
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb, y * stride, (y + 1) * stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, 9);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- dibujo ----
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexRgb(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function inRoundRect(x, y, w, h, r) {
  if (x < r) return Math.hypot(x - r, y - r) <= r;
  if (x > w - r) return Math.hypot(x - (w - r), y - r) <= r;
  return y <= h - r || Math.hypot(x - r, y - (h - r)) <= r;
}

const DARK = hexRgb('#1B1E24');
const GOLD = hexRgb('#C5A065');
const MCOL = hexRgb('#14161a');

function makeIcon(size) {
  const rgb = new Uint8Array(size * size * 3);
  const r = size * 0.22;
  const W = size, H = size;
  const cx = size * 0.5, cy = size * 0.5;
  const goldR = size * 0.33;
  const mHalf = 0.0; // no-op

  // M en coordenadas normalizadas en [0,1]
  const lines = [
    [0.30, 0.22, 0.30, 0.80],
    [0.70, 0.22, 0.70, 0.80],
    [0.30, 0.22, 0.50, 0.42],
    [0.70, 0.22, 0.50, 0.42],
    [0.50, 0.42, 0.50, 0.80],
  ];
  const stroke = size * 0.09;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      // fondo: rect redondeado oscuro
      if (!inRoundRect(x + 0.5, y + 0.5, W, H, r)) {
        rgb[i] = 0; rgb[i + 1] = 0; rgb[i + 2] = 0; // transparente-esquinas negras
        continue;
      }
      rgb[i] = DARK[0]; rgb[i + 1] = DARK[1]; rgb[i + 2] = DARK[2];
      // círculo dorado
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= goldR) { rgb[i] = GOLD[0]; rgb[i + 1] = GOLD[1]; rgb[i + 2] = GOLD[2]; }
      // letra M oscura encima del oro
      if (d <= goldR) {
        for (const [x1, y1, x2, y2] of lines) {
          if (distSeg(x + 0.5, y + 0.5, x1 * size, y1 * size, x2 * size, y2 * size) <= stroke / 2) {
            rgb[i] = MCOL[0]; rgb[i + 1] = MCOL[1]; rgb[i + 2] = MCOL[2];
            break;
          }
        }
      }
    }
  }
  return rgb;
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size] of targets) {
  const rgb = makeIcon(size);
  const png = encodePNG(size, size, rgb);
  writeFileSync(join(OUT, name), png);
  console.log('✓', name, png.length, 'bytes');
}
console.log('Iconos generados en', OUT);