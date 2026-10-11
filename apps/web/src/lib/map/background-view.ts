/**
 * Placed-background rect helpers lifted out of `VectorMapView` (WI-207, from
 * WI-171 §4 item 1). Pure, like `background-transform.ts` beside it.
 *
 * Every rect here is in its map's **background space** (`BackgroundSpace`),
 * which the grid kind fixes (RULE-006, SPEC-059 §3): lattice units on a
 * square-grid map, world pixels on a hex-grid map. The transform maths in
 * `background-transform.ts` is the same in both; only how a rect is read from
 * and written back to the store differs, and that lives here.
 */

import {
  hexMap,
  type BackgroundHexCorners,
  type BackgroundTransform,
  type MapBackground,
} from '@osr-vtt/shared';
import { MIN_BACKGROUND_CELLS, type BgRect } from './background-transform';

/**
 * The space a background's rect is drawn and dragged in, fixed by its map's
 * grid kind (RULE-006):
 *
 *  - **square** — lattice units, the stored `x, y, w, h` themselves;
 *    `cellSize` multiplies them into world pixels.
 *  - **hex** (SPEC-059 §3.3) — world pixels: the gesture runs in pixels and
 *    crosses into `HexPoint`s once, at the settled write. `hexSize` is that
 *    crossing's multiplier; `cellSize` is read only to draw a background the
 *    v35 migration has not reached yet (see `backgroundRect`).
 */
export type BackgroundSpace =
  { kind: 'square'; cellSize: number } | { kind: 'hex'; hexSize: number; cellSize: number };

/** World pixels per unit of `space` — the one multiplier the sprite, the
 * overlay and the handle grab radius go through. */
export function backgroundSpaceScale(space: BackgroundSpace): number {
  return space.kind === 'hex' ? 1 : space.cellSize;
}

/** The smallest a background may be resized to per axis, in `space`'s units:
 * `MIN_BACKGROUND_CELLS` of a cell on a square map, and the same fraction of
 * a hex's circumradius on a hex map, so the handles stay apart on either. */
export function minBackgroundSize(space: BackgroundSpace): number {
  return space.kind === 'hex' ? MIN_BACKGROUND_CELLS * space.hexSize : MIN_BACKGROUND_CELLS;
}

/**
 * A stored background's rect in `space`.
 *
 * On a hex map it is the pixel rect `MapBackground.hex`'s two corners span,
 * each through `hexPointToPixel` once (SPEC-059 §3.1). A hex-map background
 * still without `hex` — a room no referee has opened since v35, so the
 * migration has not run — is drawn from its old lattice rect scaled by
 * `cellSize`, which is exactly where the migration will place it.
 */
export function backgroundRect(bg: MapBackground, space: BackgroundSpace): BgRect {
  if (space.kind === 'hex') {
    if (!bg.hex) {
      const c = space.cellSize;
      return { x: bg.x * c, y: bg.y * c, w: bg.w * c, h: bg.h * c };
    }
    const tl = hexMap.hexPointToPixel(bg.hex.tl, space.hexSize);
    const br = hexMap.hexPointToPixel(bg.hex.br, space.hexSize);
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  }
  return { x: bg.x, y: bg.y, w: bg.w, h: bg.h };
}

/** The live rect of a selected background: the in-progress gesture's if one is
 * running on it, the stored one otherwise. What both the overlay and the sprite
 * are drawn from. */
export function liveBackgroundRect(
  bg: MapBackground,
  drag: { id: string; rect: BgRect } | null,
  space: BackgroundSpace,
): BgRect {
  return drag && drag.id === bg.id ? drag.rect : backgroundRect(bg, space);
}

/**
 * What a settled gesture writes (`CampaignStore.setBackgroundTransform`): the
 * lattice rect as it is on a square map; on a hex map the rect's top-left and
 * bottom-right corners, each crossing into a free-valued `HexPoint` once
 * (SPEC-059 §3.3) — never snapped, because background corners are free.
 */
export function backgroundTransform(rect: BgRect, space: BackgroundSpace): BackgroundTransform {
  if (space.kind === 'square') return rect;
  return { hex: hexCornersOfRect(rect, space.hexSize) };
}

/** A world-pixel rect's top-left and bottom-right corners as free-valued
 * `HexPoint`s — `MapBackground.hex`'s stored form (SPEC-059 §3.1). */
export function hexCornersOfRect(rect: BgRect, hexSize: number): BackgroundHexCorners {
  return {
    tl: hexMap.pixelToHexPoint({ x: rect.x, y: rect.y }, hexSize),
    br: hexMap.pixelToHexPoint({ x: rect.x + rect.w, y: rect.y + rect.h }, hexSize),
  };
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
