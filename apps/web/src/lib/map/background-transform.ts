/**
 * Background image placement math (SPEC-039 §3, reversing SPEC-038 §3) —
 * moving and eight-handle resizing of a placed `MapBackground`'s rect.
 *
 * Every rect here is in **lattice units as floats** (RULE-006); nothing in
 * this file knows about `cellSize`, which is applied once at the render
 * boundary. Pure on purpose: the canvas gesture in `VectorMapView` is a thin
 * wrapper over these functions, so the interesting arithmetic — "does a
 * corner preserve the native ratio", "can a resize invert the rect" — is
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

/** One of the eight resize handles (SPEC-039 §3): four corners, which scale
 * `w` and `h` together from the image's native ratio, and four edge
 * midpoints, which move one dimension only. */
export type BgHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Corner-before-edge is the hit-test tie-break where a corner and an
 * adjacent edge handle's grab radii overlap. */
export const BG_CORNER_HANDLES: readonly BgHandle[] = ['nw', 'ne', 'se', 'sw'];
export const BG_EDGE_HANDLES: readonly BgHandle[] = ['n', 'e', 's', 'w'];

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

/** Where a given handle sits on `rect` — the four corners plus the four edge
 * midpoints. */
export function backgroundHandlePoint(rect: BgRect, handle: BgHandle): LatticePoint {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  switch (handle) {
    case 'nw':
      return { x: rect.x, y: rect.y };
    case 'n':
      return { x: cx, y: rect.y };
    case 'ne':
      return { x: rect.x + rect.w, y: rect.y };
    case 'e':
      return { x: rect.x + rect.w, y: cy };
    case 'se':
      return { x: rect.x + rect.w, y: rect.y + rect.h };
    case 's':
      return { x: cx, y: rect.y + rect.h };
    case 'sw':
      return { x: rect.x, y: rect.y + rect.h };
    case 'w':
      return { x: rect.x, y: cy };
  }
}

/** A corner resize (SPEC-039 §3): the handle is dragged to `pointer`, the
 * opposite corner — named by `signX`/`signY`, `1` meaning that axis's anchor
 * sits at the rect's own `x`/`y` and `-1` meaning it sits at the far edge —
 * stays put, and `w`/`h` scale together from the image's native `aspect` so
 * the result is never stretched. `se` (`signX: 1, signY: 1`) is the original
 * single-handle behaviour.
 *
 * The driving axis is whichever the pointer has moved further along, so
 * dragging mostly sideways sizes by width and mostly along the other axis
 * sizes by height. A pointer dragged past the anchor clamps the driven axis
 * to `MIN_BACKGROUND_CELLS` rather than inverting the rect: a negative `w`/`h`
 * would render as a flipped sprite and store a rect whose corner ordering no
 * other reader expects.
 */
function resizeCorner(
  rect: BgRect,
  pointer: LatticePoint,
  aspect: number,
  signX: 1 | -1,
  signY: 1 | -1,
): BgRect {
  const anchorX = signX === 1 ? rect.x : rect.x + rect.w;
  const anchorY = signY === 1 ? rect.y : rect.y + rect.h;
  const byWidth = signX * (pointer.x - anchorX);
  const byHeight = signY * (pointer.y - anchorY) * aspect;
  const w = Math.max(MIN_BACKGROUND_CELLS, Math.max(byWidth, byHeight));
  const h = w / aspect;
  return {
    x: signX === 1 ? anchorX : anchorX - w,
    y: signY === 1 ? anchorY : anchorY - h,
    w,
    h,
  };
}

/** An edge resize along x (SPEC-039 §3): only `w` changes, anchored at the
 * opposite edge — `signX: 1` anchors `x` (the `e` handle), `-1` anchors
 * `x + w` (the `w` handle). The image stretches; there is no ratio to keep. */
function resizeEdgeX(rect: BgRect, pointer: LatticePoint, signX: 1 | -1): BgRect {
  const anchorX = signX === 1 ? rect.x : rect.x + rect.w;
  const w = Math.max(MIN_BACKGROUND_CELLS, signX * (pointer.x - anchorX));
  return { x: signX === 1 ? anchorX : anchorX - w, y: rect.y, w, h: rect.h };
}

/** An edge resize along y (SPEC-039 §3): only `h` changes, anchored at the
 * opposite edge — `signY: 1` anchors `y` (the `s` handle), `-1` anchors
 * `y + h` (the `n` handle). */
function resizeEdgeY(rect: BgRect, pointer: LatticePoint, signY: 1 | -1): BgRect {
  const anchorY = signY === 1 ? rect.y : rect.y + rect.h;
  const h = Math.max(MIN_BACKGROUND_CELLS, signY * (pointer.y - anchorY));
  return { x: rect.x, y: signY === 1 ? anchorY : anchorY - h, w: rect.w, h };
}

/**
 * The resize interaction for whichever of the eight handles is being dragged
 * (SPEC-039 §3, reversing SPEC-038 §3's single ratio-locked handle): a corner
 * scales `w`/`h` together from the image's **native** `aspect` (width ÷
 * height); an edge moves one dimension only, stretching the image. `aspect`
 * is unused for an edge handle but always required, so callers never have to
 * branch on handle kind before computing it.
 */
export function resizeBackground(
  rect: BgRect,
  pointer: LatticePoint,
  handle: BgHandle,
  aspect: number,
): BgRect {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : rect.w / rect.h || 1;
  switch (handle) {
    case 'nw':
      return resizeCorner(rect, pointer, safeAspect, -1, -1);
    case 'ne':
      return resizeCorner(rect, pointer, safeAspect, 1, -1);
    case 'se':
      return resizeCorner(rect, pointer, safeAspect, 1, 1);
    case 'sw':
      return resizeCorner(rect, pointer, safeAspect, -1, 1);
    case 'e':
      return resizeEdgeX(rect, pointer, 1);
    case 'w':
      return resizeEdgeX(rect, pointer, -1);
    case 's':
      return resizeEdgeY(rect, pointer, 1);
    case 'n':
      return resizeEdgeY(rect, pointer, -1);
  }
}

/** What a pointerdown at `p` grabs on a selected background: a resize handle
 * (corner-before-edge, and either before the body, wherever their grab radii
 * overlap), the body, or nothing at all, in which case the press falls
 * through to the active map tool untouched.
 *
 * `handleRadius` is in lattice units — the caller converts the fixed
 * on-screen hit radius through the live zoom, so a handle stays equally
 * grabbable however far the referee has zoomed in.
 */
export function backgroundHitTest(
  rect: BgRect,
  p: LatticePoint,
  handleRadius: number,
): { kind: 'handle'; handle: BgHandle } | { kind: 'body' } | null {
  for (const handle of [...BG_CORNER_HANDLES, ...BG_EDGE_HANDLES]) {
    const pt = backgroundHandlePoint(rect, handle);
    if (Math.abs(p.x - pt.x) <= handleRadius && Math.abs(p.y - pt.y) <= handleRadius) {
      return { kind: 'handle', handle };
    }
  }
  if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
    return { kind: 'body' };
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
