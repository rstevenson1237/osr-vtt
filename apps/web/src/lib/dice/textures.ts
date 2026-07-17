import * as THREE from 'three';
import type { DieKind, FaceVariant } from './geometry';

/**
 * Number faces, drawn at runtime on a canvas (Master Plan v2, R3.2 / R19).
 * Nothing is loaded from disk — the ink comes from the active theme's design
 * tokens and each die's face color comes from the per-kind reference palette
 * (`DICE_KIND_COLOR`), theme-overridable via `--dice-<kind>` custom props. 6/9
 * get an underline so they read unambiguously. Materials are cached per
 * (theme, kind, variant, label) and reused across rolls: an atlas built once,
 * never rebuilt per roll.
 */

export interface DiceTheme {
  id: string;
  face: string;
  faceTens: string;
  ink: string;
  tray: string;
  bg: string;
  /** Per-die-kind face colors overriding the reference palette; a theme sets
   * these via `--dice-d4`…`--dice-d20`. Absent kinds fall back to
   * `DICE_KIND_COLOR`. */
  kindColors?: Partial<Record<DieKind, string>>;
}

/**
 * The reference set's per-die-kind colors (R19.3): d4 crimson, d6 green, d8
 * blue, d10 gold, d12 orange, d20 purple. This is the out-of-box look; a theme
 * overrides any entry through `theme.kindColors`. d100 renders as two d10s, its
 * `tens` die shown a shade darker (see `faceColor`).
 */
export const DICE_KIND_COLOR: Record<DieKind, string> = {
  d4: '#b23b3b',
  d6: '#3f8f4a',
  d8: '#3f5fb0',
  d10: '#d9b23a',
  d12: '#d98a3a',
  d20: '#6b4a9e',
};

const ALL_KINDS: DieKind[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

const FALLBACK: DiceTheme = {
  // The reference aesthetic: warm white ink over the per-kind palette.
  id: 'fallback',
  face: '#3f5fb0',
  faceTens: '#2c4a86',
  ink: '#f6f1e6',
  tray: '#5fb2d6',
  bg: '#0e1b2c',
};

/** Darkens a `#rrggbb` color toward black by `factor` (0..1). Non-hex inputs
 * (e.g. an `hsl()` theme override) are returned unchanged. */
function darken(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function readVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  return value || fallback;
}

/** Resolves the current dice palette from CSS custom properties. Falls back to
 * the reference blues when tokens or the DOM are unavailable (SSR / tests). */
export function resolveDiceTheme(): DiceTheme {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return FALLBACK;
  }
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const themeId = root.getAttribute('data-theme') ?? 'default';
  const kindColors: Partial<Record<DieKind, string>> = {};
  for (const kind of ALL_KINDS) {
    const value = style.getPropertyValue(`--dice-${kind}`).trim();
    if (value) kindColors[kind] = value;
  }
  return {
    id: themeId,
    face: readVar(style, '--dice-face', FALLBACK.face),
    faceTens: readVar(style, '--dice-face-tens', FALLBACK.faceTens),
    ink: readVar(style, '--dice-ink', FALLBACK.ink),
    tray: readVar(style, '--dice-tray', FALLBACK.tray),
    bg: readVar(style, '--dice-bg', FALLBACK.bg),
    ...(Object.keys(kindColors).length > 0 ? { kindColors } : {}),
  };
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** The face color for a die kind: the theme override if present, else the
 * reference palette (R19.3). A `tens` die (the tens half of a d100) is drawn a
 * shade darker than its d10 so the pair reads as tens + units. */
function faceColor(theme: DiceTheme, kind: DieKind, variant: FaceVariant): string {
  const base = theme.kindColors?.[kind] ?? DICE_KIND_COLOR[kind];
  return variant === 'tens' ? darken(base, 0.72) : base;
}

function drawFace(ctx: CanvasRenderingContext2D, size: number, bg: string): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
}

function drawNumber(ctx: CanvasRenderingContext2D, size: number, label: string, ink: string): void {
  const cx = size / 2;
  const cy = size / 2;
  // R19.5: numerals sized to the reference — prominent but margined. Two-digit
  // faces shrink so both glyphs fit within the face.
  const fontSize = label.length >= 2 ? size * 0.38 : size * 0.5;
  ctx.fillStyle = ink;
  ctx.font = `600 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Nudge up slightly so the optical center sits mid-face.
  ctx.fillText(label, cx, cy - size * 0.02);
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

/** A cached material showing `label` on `kind`'s face color, in the active
 * theme. Reused across dice and rolls. The cache key includes `kind` because
 * the same label reads on differently-colored faces (a green d6 "5" vs. a blue
 * d8 "5"), so kind must disambiguate the entry. */
export function faceMaterial(
  theme: DiceTheme,
  kind: DieKind,
  variant: FaceVariant,
  label: string,
): THREE.MeshStandardMaterial {
  const key = `${theme.id}|${kind}|${variant}|${label}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const bg = faceColor(theme, kind, variant);
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, bg);
    drawNumber(ctx, size, label, theme.ink);
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    // R19.2: glossy plastic — lower roughness for a soft specular, low
    // metalness, flatShading kept so facet edges stay crisp.
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
  });
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
  corners: Array<{ label: string; uv: [number, number] }>,
): THREE.MeshStandardMaterial {
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, faceColor(theme, 'd4', 'normal'));
    ctx.fillStyle = theme.ink;
    ctx.font = `600 ${size * 0.24}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { label, uv } of corners) {
      // Canvas V grows downward; UV V grows upward — flip to match.
      ctx.fillText(label, uv[0] * size, (1 - uv[1]) * size);
    }
  });
  return new THREE.MeshStandardMaterial({
    map: tex,
    // Match the glossy retune of the numbered atlas (R19.2).
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}

/** Drops every cached material + texture (call on theme change). */
export function clearDiceMaterialCache(): void {
  for (const mat of materialCache.values()) {
    mat.map?.dispose();
    mat.dispose();
  }
  materialCache.clear();
}
