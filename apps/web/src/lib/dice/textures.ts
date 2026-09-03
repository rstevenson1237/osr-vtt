import * as THREE from 'three';
import type { FaceVariant } from './geometry';

/**
 * Number faces, drawn at runtime on a canvas (Master Plan v2, R3.2 / R19).
 * Nothing is loaded from disk.
 *
 * **One source of truth for die color.** A die's face color is the roller's
 * character color — `ProfileInstance.color`, picked on the character quick
 * sheet — and nothing else. It is baked into the face *texture*, not applied
 * as a Three.js material tint: `material.color` multiplies the `map`, so a
 * tint over a pre-colored texture renders `pick x texture`, never the picked
 * hex. (That was the long-standing "the dice are never the colour I chose"
 * bug: faces used to be painted from a hardcoded per-die-kind palette — d4
 * crimson, d6 green, d8 blue... — which the tint then modulated.) The only
 * remaining non-pick color is `theme.face`, the single neutral used when a
 * character has not picked one yet.
 *
 * Ink is chosen per-die by contrast against that face color (`inkFor`), so a
 * pale pick keeps its numerals readable, and numerals read as incised via a
 * generated **normal map** (SPEC-045 §3) rather than a canvas emboss trick —
 * the highlight then tracks the actual key light as the die turns, instead of
 * sitting where a fixed offset copy put it.
 *
 * Materials are cached per (theme, face, variant, label) and reused across
 * rolls: an atlas built once, never rebuilt per roll. `kind` is deliberately
 * *not* part of the key — now that face color comes from the roller rather
 * than the die kind, a d6 "5" and a d8 "5" are the same bitmap.
 */

export interface DiceTheme {
  id: string;
  /** The neutral face color for a roller who hasn't picked a character color.
   * The single non-pick color source in the whole dice renderer. */
  face: string;
  /** Ink for a dark face. */
  ink: string;
  /** Ink for a light face — see `inkFor`. */
  inkDark: string;
}

const FALLBACK: DiceTheme = {
  // The reference aesthetic: warm white ink over the neutral blue face. Used
  // under SSR / tests, where there is no DOM to read custom properties from.
  id: 'fallback',
  face: '#3f5fb0',
  ink: '#f6f1e6',
  inkDark: '#221c14',
};

/** Parses `#rgb`/`#rrggbb` to 0..255 components, or null if it isn't hex. */
function parseHex(color: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length === 3) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

/** Scales a color toward black (`factor < 1`) or white (`factor > 1`).
 * Non-hex input is returned unchanged — it can't be scaled, and returning it
 * verbatim keeps the face at least *visible*. */
export function shade(color: string, factor: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  if (factor <= 1) return toHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
  const t = Math.min(1, factor - 1);
  return toHex(rgb.r + (255 - rgb.r) * t, rgb.g + (255 - rgb.g) * t, rgb.b + (255 - rgb.b) * t);
}

/** Perceived brightness 0..1 (Rec. 709 luma over sRGB components — close
 * enough for a light-or-dark decision, and stable for non-hex input at the
 * "assume dark" end). */
export function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 0;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

/**
 * The ink to print on `face`: the theme's dark ink over a light face, its
 * light ink over a dark one. Without this a pale character color (say
 * `#f0e0c0`) gets near-white numerals and the die is unreadable — the old
 * renderer used one fixed ink because faces came from a fixed palette.
 */
export function inkFor(face: string, theme: DiceTheme): string {
  return luminance(face) > 0.55 ? theme.inkDark : theme.ink;
}

/**
 * The face color actually painted for one physical die: the roller's color,
 * or the theme neutral when they haven't picked one. A d100's `tens` half is
 * drawn a shade darker than its units die so the pair reads as tens + units —
 * the one place a die's color is derived rather than taken verbatim, and it
 * derives from the roller's own color, not from a palette.
 */
export function faceColor(
  theme: DiceTheme,
  tint: string | undefined,
  variant: FaceVariant,
): string {
  const base = tint ?? theme.face;
  return variant === 'tens' ? shade(base, 0.72) : base;
}

function readVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value || fallback;
}

/** Resolves the current dice palette from CSS custom properties. Falls back to
 * the reference values when tokens or the DOM are unavailable (SSR / tests). */
export function resolveDiceTheme(): DiceTheme {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return FALLBACK;
  }
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    id: root.getAttribute('data-theme') ?? 'default',
    face: readVar(style, '--dice-face', FALLBACK.face),
    ink: readVar(style, '--dice-ink', FALLBACK.ink),
    inkDark: readVar(style, '--dice-ink-dark', FALLBACK.inkDark),
  };
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
/** Body materials (SPEC-045 §4) are keyed on `(theme, face colour)` alone — no
 * label, no texture — so they get their own map rather than a sentinel key in
 * `materialCache`. Cleared together with it. */
const bodyCache = new Map<string, THREE.MeshStandardMaterial>();

function drawFace(ctx: CanvasRenderingContext2D, size: number, bg: string): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
}

/** Sets up the shared numeral typography for one face draw. */
function setNumberFont(ctx: CanvasRenderingContext2D, fontSize: number): void {
  ctx.font = `600 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

/** Draws one numeral glyph, filled with `color`. Used both for the visible
 * ink (on the diffuse texture) and for the recess (on the normal map's height
 * layer, see `makeNormalMap`) — same shape, different paint. */
function drawGlyph(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
}

function drawNumber(ctx: CanvasRenderingContext2D, size: number, label: string, color: string): void {
  const cx = size / 2;
  const cy = size / 2;
  // R19.5: numerals sized to the reference — prominent but margined. Two-digit
  // faces shrink so both glyphs fit within the face.
  const fontSize = label.length >= 2 ? size * 0.38 : size * 0.5;
  setNumberFont(ctx, fontSize);
  // Nudge up slightly so the optical center sits mid-face.
  drawGlyph(ctx, label, cx, cy - size * 0.02, color);
  // Underline ambiguous single digits (6/9) so orientation is unmistakable.
  if (label === '6' || label === '9') {
    const w = fontSize * 0.5;
    const y = cy + fontSize * 0.42;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx + w / 2, y);
    ctx.stroke();
  }
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Neutral mid-height for the normal map's height layer — a flat facet.
 * Numerals paint darker than this (a recess); nothing paints lighter. */
const HEIGHT_FLAT = '#808080';
/** How dark the incised stroke reads on the height layer — the recess depth.
 * Not black: a full-depth cliff would produce a normal-map edge steep enough
 * to alias under `flatShading`'s already-hard facet normals. */
const HEIGHT_RECESS = '#3c3c3c';
const NORMAL_MAP_SIZE = 128;
/** Central-difference → normal strength. Tuned by eye: legible incision
 * without turning the glyph into a bright rim-lit outline. */
const NORMAL_STRENGTH = 3;

/**
 * Builds a normal map from a height layer: `drawHeight` paints a grayscale
 * canvas (127 = flat, darker = recessed) exactly as `drawNumber`/`drawGlyph`
 * paint the diffuse ink, then a Sobel-style central difference turns that
 * height field into a tangent-space normal per texel. This is what makes the
 * numerals read as **carved geometry** (SPEC-045 §3): the highlight comes
 * from the real key light hitting a real slope, not a canvas offset baked at
 * a fixed angle, so it tracks correctly as the die tumbles.
 */
function makeNormalMap(drawHeight: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.Texture {
  const size = NORMAL_MAP_SIZE;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hctx = hCanvas.getContext('2d')!;
  hctx.fillStyle = HEIGHT_FLAT;
  hctx.fillRect(0, 0, size, size);
  // A little blur feathers the recess edge into a slope rather than a cliff,
  // which is what gives the normal map something to shade smoothly.
  hctx.filter = 'blur(1.5px)';
  drawHeight(hctx, size);
  hctx.filter = 'none';

  const height = hctx.getImageData(0, 0, size, size).data;
  const heightAt = (x: number, y: number): number => {
    const cx = Math.min(size - 1, Math.max(0, x));
    const cy = Math.min(size - 1, Math.max(0, y));
    return height[(cy * size + cx) * 4]! / 255;
  };

  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nctx = nCanvas.getContext('2d')!;
  const img = nctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * NORMAL_STRENGTH;
      const dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * NORMAL_STRENGTH;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round((-dx / len) * 0.5 * 255 + 127.5);
      img.data[i + 1] = Math.round((-dy / len) * 0.5 * 255 + 127.5);
      img.data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);
      img.data[i + 3] = 255;
    }
  }
  nctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(nCanvas);
  // Normal maps are linear data, never sRGB-decoded like the diffuse map.
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Normal maps depend only on the glyph shape (`label`), never on face color
 * or theme, so they're cached separately from — but dropped alongside —
 * `materialCache`. Never rebuilt per roll (SPEC-045 §3). */
const normalMapCache = new Map<string, THREE.Texture>();

function labelNormalMap(label: string): THREE.Texture {
  const cached = normalMapCache.get(label);
  if (cached) return cached;
  const tex = makeNormalMap((ctx, size) => drawNumber(ctx, size, label, HEIGHT_RECESS));
  normalMapCache.set(label, tex);
  return tex;
}

const MATERIAL_PARAMS = {
  // R19.2, retuned for SPEC-045 §3: the normal-mapped incision needs a touch
  // more roughness than the old flat-emboss material to keep its highlight
  // soft rather than aliasing against `flatShading`'s hard facet normals, and
  // `envMapIntensity` gives the added environment map (`scene.ts`) something
  // to actually contribute instead of a flat hemisphere-only gloss.
  roughness: 0.34,
  metalness: 0.09,
  envMapIntensity: 0.6,
  flatShading: true,
  side: THREE.DoubleSide,
} as const;

/** A cached material showing `label` on `face`, in the active theme. Reused
 * across dice and rolls. `material.color` is deliberately left white: the
 * color lives in the texture (see the module comment). */
export function faceMaterial(
  theme: DiceTheme,
  face: string,
  variant: FaceVariant,
  label: string,
): THREE.MeshStandardMaterial {
  const bg = faceColor(theme, face, variant);
  const key = `${theme.id}|${bg}|${label}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, bg);
    drawNumber(ctx, size, label, inkFor(bg, theme));
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: labelNormalMap(label),
    ...MATERIAL_PARAMS,
  });
  materialCache.set(key, mat);
  return mat;
}

/**
 * The die **body** — every bevel strip and corner patch, in one material
 * (SPEC-045 §4, DEC-079). Untextured: a flat fill in the same colour the face
 * texture paints its background, so the bevel continues the face rather than
 * outlining it.
 *
 * **This is the one place a die's colour is a `material.color`,** and it is not
 * an exception to the module's rule so much as the case the rule was never
 * about: `color` misleads by *multiplying* a `map`, and there is no map here to
 * multiply. The two halves then agree only if colour management does, which it
 * does and which `textures.test.ts` pins: `THREE.Color` parses a hex string as
 * sRGB into the linear working space, and the face's `CanvasTexture` carries
 * `SRGBColorSpace` so the identical hex decodes to the identical linear triple.
 * Were either half raw-sRGB instead, the seam where bevel meets face would show
 * as a visible ring.
 *
 * `flatShading` is `false` here where the face materials keep `true` — the
 * split DEC-079 chose the one-extra-group structure for. The bevel's authored
 * normals interpolate from one face's normal to its neighbour's
 * (`buildDieGeometry`), so smooth shading reads it as a rounded edge, while the
 * value facets stay crisp.
 */
export function bodyMaterial(
  theme: DiceTheme,
  face: string,
  variant: FaceVariant,
): THREE.MeshStandardMaterial {
  const bg = faceColor(theme, face, variant);
  const key = `${theme.id}|${bg}`;
  const cached = bodyCache.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    ...MATERIAL_PARAMS,
    color: new THREE.Color(bg),
    flatShading: false,
  });
  bodyCache.set(key, mat);
  return mat;
}

/**
 * A d4 face carries three numbers, one at each corner, so that whichever apex
 * points up its value reads on the surrounding faces (R3.2). The three corner
 * values differ per face and per roll, so these are composed on demand (cheap;
 * only when a d4 is in play) rather than cached like the single-number atlas —
 * including the normal map, for the same reason.
 * Each corner supplies the UV position the geometry maps it to (so the numbers
 * sit exactly at the triangle's corners) and the label to draw there.
 */
export function d4FaceMaterial(
  theme: DiceTheme,
  face: string,
  corners: Array<{ label: string; uv: [number, number] }>,
): THREE.MeshStandardMaterial {
  const bg = faceColor(theme, face, 'normal');
  const ink = inkFor(bg, theme);
  const paintCorners = (color: string) => (ctx: CanvasRenderingContext2D, size: number) => {
    setNumberFont(ctx, size * 0.24);
    for (const { label, uv } of corners) {
      // Canvas V grows downward; UV V grows upward — flip to match.
      drawGlyph(ctx, label, uv[0] * size, (1 - uv[1]) * size, color);
    }
  };
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, bg);
    paintCorners(ink)(ctx, size);
  });
  const normalMap = makeNormalMap(paintCorners(HEIGHT_RECESS));
  return new THREE.MeshStandardMaterial({ map: tex, normalMap, ...MATERIAL_PARAMS });
}

/** Drops every cached material + texture (call on theme change). */
export function clearDiceMaterialCache(): void {
  for (const mat of materialCache.values()) {
    mat.map?.dispose();
    mat.dispose();
  }
  materialCache.clear();
  for (const mat of bodyCache.values()) mat.dispose();
  bodyCache.clear();
  for (const tex of normalMapCache.values()) tex.dispose();
  normalMapCache.clear();
}
