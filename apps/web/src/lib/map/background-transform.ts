/**
 * Background image placement math (SPEC-038 §3) — moving and aspect-locked
 * resizing of a placed `MapBackground`'s rect.
 *
 * Every rect here is in **lattice units as floats** (RULE-006); nothing in
 * this file knows about `cellSize`, which is applied once at the render
 * boundary. Pure on purpose: the canvas gesture in `VectorMapView` is a thin
 * wrapper over these functions, so the interesting arithmetic — "does the
 * handle preserve the native ratio", "can a resize invert the rect" — is
 * unit-tested without a Pixi context or a Playwright drag.
 */

export interface BgRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LatticePoint {
  x: number;
  y: number;
}

/**
 * The smallest a background may be dragged down to, in lattice units. Half a
 * cell, matching the finest snap step the map tools work in — small enough to
 * place an inset detail, large enough that the resize handle never collapses
 * under the pointer and becomes ungrabbable.
 */
export const MIN_BACKGROUND_CELLS = 0.5;

/** The rect an image with `aspect` (native width ÷ height) takes when it is
 * first placed on a `grid`: fitted inside the whole grid without distortion
 * (the smaller of the two fits wins) and anchored at the origin.
 *
 * Anchoring at 0,0 rather than centring matches the v22→v23 fold, so the
 * first image added to a map lands where an upgraded room's folded background
 * already sits — the referee then drags it from a predictable start.
 */
export function fitBackgroundToGrid(grid: { w: number; h: number }, aspect: number): BgRect {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const w = Math.min(grid.w, grid.h * safeAspect);
  const h = w / safeAspect;
  return { x: 0, y: 0, w, h };
}

/** Translates the whole rect; `w`/`h` are untouched, so a move can never
 * change the image's size (SPEC-038 §3 — `x, y` move together). */
export function moveBackground(rect: BgRect, dx: number, dy: number): BgRect {
  return { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h };
}

/**
 * The single resize interaction (SPEC-038 §3): the bottom-right handle is
 * dragged to `pointer`, the top-left corner stays put, and `w`/`h` scale
 * together from the image's **native** `aspect` (width ÷ height) so the result
 * is never stretched. There is deliberately no width-only or height-only
 * variant to call.
 *
 * The driving edge is whichever the pointer has moved further along, measured
 * in units of the current rect, so dragging mostly sideways sizes by width and
 * mostly downwards sizes by height — a single handle that always felt like it
 * followed the pointer, rather than one that only tracked x.
 *
 * A pointer dragged above/left of the anchor clamps to `MIN_BACKGROUND_CELLS`
 * rather than inverting the rect: a negative `w`/`h` would render as a flipped
 * sprite and store a rect whose corner ordering no other reader expects.
 */
export function resizeBackground(rect: BgRect, pointer: LatticePoint, aspect: number): BgRect {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : rect.w / rect.h || 1;
  const byWidth = pointer.x - rect.x;
  const byHeight = (pointer.y - rect.y) * safeAspect;
  const w = Math.max(MIN_BACKGROUND_CELLS, Math.max(byWidth, byHeight));
  return { x: rect.x, y: rect.y, w, h: w / safeAspect };
}

/** Where the one resize handle sits: the rect's bottom-right corner. */
export function backgroundHandlePoint(rect: BgRect): LatticePoint {
  return { x: rect.x + rect.w, y: rect.y + rect.h };
}

/**
 * What a pointerdown at `p` grabs on a selected background: its resize handle
 * (which wins wherever the two overlap — the handle sits on the rect's own
 * corner), its body, or nothing at all, in which case the press falls through
 * to the active map tool untouched.
 *
 * `handleRadius` is in lattice units — the caller converts the fixed on-screen
 * hit radius through the live zoom, so the handle stays equally grabbable
 * however far the referee has zoomed in.
 */
export function backgroundHitTest(
  rect: BgRect,
  p: LatticePoint,
  handleRadius: number,
): 'handle' | 'body' | null {
  const handle = backgroundHandlePoint(rect);
  if (Math.abs(p.x - handle.x) <= handleRadius && Math.abs(p.y - handle.y) <= handleRadius) {
    return 'handle';
  }
  if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
    return 'body';
  }
  return null;
}

/** True when two rects differ by more than float noise — the guard that keeps
 * a click (a drag that never moved) from writing a transform to Firestore
 * (RULE-003: one settled write per gesture, and none at all for a no-op). */
export function backgroundRectChanged(a: BgRect, b: BgRect): boolean {
  const EPS = 1e-6;
  return (
    Math.abs(a.x - b.x) > EPS ||
    Math.abs(a.y - b.y) > EPS ||
    Math.abs(a.w - b.w) > EPS ||
    Math.abs(a.h - b.h) > EPS
  );
}
