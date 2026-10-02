/**
 * Placed-background rect helpers lifted out of `VectorMapView` (WI-207, from
 * WI-171 §4 item 1). Lattice units throughout (RULE-006); pure, like
 * `background-transform.ts` beside it.
 */

import type { MapBackground } from '@osr-vtt/shared';
import type { BgRect } from './background-transform';

/** A stored background's rect. */
export function backgroundRect(bg: MapBackground): BgRect {
  return { x: bg.x, y: bg.y, w: bg.w, h: bg.h };
}

/** The live rect of a selected background: the in-progress gesture's if one is
 * running on it, the stored one otherwise. What both the overlay and the sprite
 * are drawn from. */
export function liveBackgroundRect(
  bg: MapBackground,
  drag: { id: string; rect: BgRect } | null,
): BgRect {
  return drag && drag.id === bg.id ? drag.rect : backgroundRect(bg);
}

/** Native width ÷ height of a loaded texture, or — when it has not reported a
 * size — the ratio of `fallback`, or 1. */
export function nativeAspect(
  texture: { width: number; height: number } | undefined,
  fallback: BgRect,
): number {
  const w = texture?.width ?? 0;
  const h = texture?.height ?? 0;
  return w > 0 && h > 0 ? w / h : fallback.w / fallback.h || 1;
}
