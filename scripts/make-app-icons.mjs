#!/usr/bin/env node
// Generates the installed-app icons (SPEC-033 §5) from one procedural drawing.
//
//   node scripts/make-app-icons.mjs
//
// Why a script rather than checked-in art from a design tool: the icons are a
// handful of flat shapes in the theme's own tokens, and the repo has no image
// toolchain (RULE-010 keeps the stack thin — no new dependency for four PNGs).
// Committing the generator alongside its output keeps the sizes reproducible
// and the colours a single edit away from `theme/tokens.css`.
//
// The drawing is the app in miniature: a room outlined in brass with a doorway
// gap, lattice lines inside it, and one token on the floor. Everything sits
// inside the central 60% so the same art is safe under a `maskable` crop.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'icons',
);

// `theme/tokens.css`, parchment-dark (the pre-JS default, so the icon matches
// what an installed launch actually paints before any theme is applied).
const BG = [0x1b, 0x17, 0x12]; // --bg-root
const LINE = [0x4a, 0x40, 0x30]; // --line-strong
const ACCENT = [0xa6, 0x76, 0x3f]; // --accent
const INK = [0xf2, 0xc9, 0x8a]; // --accent-text

/** Signed distance to a rounded rectangle centred on the origin. Negative
 * inside, positive outside — so a ring is `|sd| < half the stroke width`. */
function sdRoundRect(x, y, halfW, halfH, r) {
  const qx = Math.abs(x) - halfW + r;
  const qy = Math.abs(y) - halfH + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** The icon as a pure function of normalised coordinates in [-0.5, 0.5]. */
function shade(x, y) {
  const ROOM = 0.28; // half-extent of the room outline
  const STROKE = 0.03;

  // Doorway: a gap in the bottom wall, with the floor showing through.
  const inDoorway = Math.abs(x) < 0.075 && y > 0;

  const wall = Math.abs(sdRoundRect(x, y, ROOM, ROOM, 0.045));
  if (wall < STROKE && !inDoorway) return ACCENT;

  const inside = sdRoundRect(x, y, ROOM, ROOM, 0.045) < 0;
  if (inside) {
    // One token, standing on the floor.
    if (Math.hypot(x, y + 0.06) < 0.075) return INK;
    // Lattice lines (SPEC's cell units, drawn as the map draws them).
    const onLattice = [-0.14, 0.14].some((c) => Math.abs(x - c) < 0.009 || Math.abs(y - c) < 0.009);
    if (onLattice) return LINE;
  }
  return BG;
}

/** 4×4 supersampled render — no antialiasing anywhere else in the pipeline. */
function render(size) {
  const px = Buffer.alloc(size * size * 3);
  const S = 4;
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = shade((ix + (sx + 0.5) / S) / size - 0.5, (iy + (sy + 0.5) / S) / size - 0.5);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = (iy * size + ix) * 3;
      px[o] = Math.round(r / (S * S));
      px[o + 1] = Math.round(g / (S * S));
      px[o + 2] = Math.round(b / (S * S));
    }
  }
  return px;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** Minimal 8-bit truecolour PNG: one IHDR, one IDAT, one IEND. */
function encodePng(size, rgb) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  // iOS reads only this one, and only as PNG — no SVG, no manifest icon.
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, render(size)));
  process.stdout.write(`wrote ${name} (${size}×${size})\n`);
}
