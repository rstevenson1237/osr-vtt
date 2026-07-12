import * as THREE from 'three';
import type { FaceVariant } from './geometry';

/**
 * Number faces, drawn at runtime on a canvas (Master Plan v2, R3.2). Nothing
 * is loaded from disk — the ink and face colors come from the active theme's
 * design tokens, so the dice recolor with the theme, and 6/9 get an underline
 * so they read unambiguously. Materials are cached per (theme, variant, label)
 * and reused across rolls: an atlas built once, never rebuilt per roll.
 */

export interface DiceTheme {
  id: string;
  face: string;
  faceTens: string;
  ink: string;
  tray: string;
  bg: string;
}

const FALLBACK: DiceTheme = {
  // The reference aesthetic: blue rock, light ink, lighter tray.
  id: 'fallback',
  face: '#2f6fb0',
  faceTens: '#204d7a',
  ink: '#e8f0fa',
  tray: '#5fb2d6',
  bg: '#0e1b2c',
};

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
  return {
    id: themeId,
    face: readVar(style, '--dice-face', FALLBACK.face),
    faceTens: readVar(style, '--dice-face-tens', FALLBACK.faceTens),
    ink: readVar(style, '--dice-ink', FALLBACK.ink),
    tray: readVar(style, '--dice-tray', FALLBACK.tray),
    bg: readVar(style, '--dice-bg', FALLBACK.bg),
  };
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function faceColor(theme: DiceTheme, variant: FaceVariant): string {
  return variant === 'tens' ? theme.faceTens : theme.face;
}

function drawFace(ctx: CanvasRenderingContext2D, size: number, bg: string): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
}

function drawNumber(ctx: CanvasRenderingContext2D, size: number, label: string, ink: string): void {
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = label.length >= 2 ? size * 0.42 : size * 0.56;
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

/** A cached material showing `label`, tinted for its variant, in the active
 * theme. Reused across dice and rolls. */
export function faceMaterial(
  theme: DiceTheme,
  variant: FaceVariant,
  label: string,
): THREE.MeshStandardMaterial {
  const key = `${theme.id}|${variant}|${label}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const bg = faceColor(theme, variant);
  const tex = makeTexture((ctx, size) => {
    drawFace(ctx, size, bg);
    drawNumber(ctx, size, label, theme.ink);
  });
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.45,
    metalness: 0.15,
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
    drawFace(ctx, size, theme.face);
    ctx.fillStyle = theme.ink;
    ctx.font = `600 ${size * 0.2}px "Inter", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { label, uv } of corners) {
      // Canvas V grows downward; UV V grows upward — flip to match.
      ctx.fillText(label, uv[0] * size, (1 - uv[1]) * size);
    }
  });
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.45,
    metalness: 0.15,
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
