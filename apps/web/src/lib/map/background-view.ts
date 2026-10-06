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

/**
 * Loads every background's texture and settles each one on its own (SPEC-059
 * §2.1, DEC-124): one rejected load never blocks another, the way a single
 * `Promise.all` used to freeze the whole layer on one dead ref. `loaded`
 * keeps the input order, so a caller walking it still adds sprites in paint
 * order; `failed` holds the backgrounds whose image could not be loaded, which
 * draw nothing (§2.2).
 */
export async function settleBackgroundTextures<T>(
  bgs: readonly MapBackground[],
  load: (bg: MapBackground) => Promise<T>,
): Promise<{ loaded: { bg: MapBackground; texture: T }[]; failed: MapBackground[] }> {
  const results = await Promise.allSettled(bgs.map((bg) => load(bg)));
  const loaded: { bg: MapBackground; texture: T }[] = [];
  const failed: MapBackground[] = [];
  results.forEach((result, i) => {
    const bg = bgs[i]!;
    if (result.status === 'fulfilled') loaded.push({ bg, texture: result.value });
    else failed.push(bg);
  });
  return { loaded, failed };
}
