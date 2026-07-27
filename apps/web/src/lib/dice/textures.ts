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
 * pale pick keeps its numerals readable, and numerals are drawn with an
 * emboss pass so they read as incised rather than printed.
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

/**
 * Draws one numeral with an emboss pass so it reads incised into the face
 * rather than printed on it: a darkened copy offset up-left (the shadowed
 * wall of the recess) and a lightened copy offset down-right (the lit wall),
 * then the ink glyph on top. Derived from `face`, so it works on any color.
 */
function drawGlyph(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  size: number,
  face: string,
  ink: string,
): void {
  const off = size * 0.012;
  ctx.fillStyle = shade(face, 0.55);
  ctx.fillText(label, x - off, y - off);
  ctx.fillStyle = shade(face, 1.35);
  ctx.fillText(label, x + off, y + off);
  ctx.fillStyle = ink;
  ctx.fillText(label, x, y);
}

function drawNumber(
  ctx: CanvasRenderingContext2D,
  size: number,
  label: string,
  face: string,
  ink: string,
): void {
  const cx = size / 2;
  const cy = size / 2;
  // R19.5: numerals sized to the reference — prominent but margined. Two-digit
  // faces shrink so both glyphs fit within the face.
  const fontSize = label.length >= 2 ? size * 0.38 : size * 0.5;
  setNumberFont(ctx, fontSize);
  // Nudge up slightly so the optical center sits mid-face.
  drawGlyph(ctx, label, cx, cy - size * 0.02, size, face, ink);
  // Underline ambiguous single digits (6/9) so orientation is unmistakable.
  if (label === '6' || label === '9') {
    const w = fontSize * 0.5;
    const y = cy + fontSize * 0.42;
    ctx.strokeStyle = ink;
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

const MATERIAL_PARAMS = {
  // R19.2: glossy plastic — lower roughness for a soft specular, low
  // metalness, flatShading kept so facet edges stay crisp.
  roughness: 0.3,
  metalness: 0.1,
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
    drawNumber(ctx, size, label, bg, inkFor(bg, theme));
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, ...MATERIAL_PARAMS });
  materialCache.set(key, mat);
  return mat;
}

/**
 * A d4 face carries three numbers, one at each corner, so that whichever apex
 * points up its value reads on the surrounding faces (R3.2). The three corner
 * values differ per face and per roll, so these are composed on demand (cheap;
 * only when a d4 is in play) rather than cached like the single-number atlas.
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
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, bg);
    setNumberFont(ctx, size * 0.24);
    for (const { label, uv } of corners) {
      // Canvas V grows downward; UV V grows upward — flip to match.
      drawGlyph(ctx, label, uv[0] * size, (1 - uv[1]) * size, size, bg, ink);
    }
  });
  return new THREE.MeshStandardMaterial({ map: tex, ...MATERIAL_PARAMS });
}

/** Drops every cached material + texture (call on theme change). */
export function clearDiceMaterialCache(): void {
  for (const mat of materialCache.values()) {
    mat.map?.dispose();
    mat.dispose();
  }
  materialCache.clear();
}
