/**
 * Which hexes cover a rectangle of the screen — the viewport arithmetic the
 * infinite hex grid renders from (SPEC-030 §1, WI-039).
 *
 * A hex crawl has no bounded plane to draw once: `0,0` is its centre and both
 * axes run forever from there, so the renderer draws "whatever the viewer can
 * see" and redraws on every pan and zoom, exactly as the square lattice's
 * `gridLineBounds` does. This module is the pure half of that — no Pixi, no
 * viewport object, just the rectangle and the hex `size` — so the culling can
 * be unit-tested without a canvas.
 *
 * Everything here works in **pixels**, the far side of RULE-006's
 * render-time-only multiplier: a rect in pixels goes in, `Axial` hexes come
 * out. Nothing in here is ever stored.
 */

import { hexMetrics, type Axial, type HexPixel } from './axial.js';

/** A rectangle of world **pixels** — what the renderer hands in as "what is on
 * screen". Negative `width`/`height` are accepted (either corner order). */
export interface HexPixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One column of the grid, `q`, and the inclusive `r` range that covers the
 * rect within it. The range is **per column** rather than one rectangle over
 * both axes because a column's vertical offset grows with `q` (odd columns sit
 * half a row down): a single global `r` range would over-cover by half the `q`
 * span, which on a wide viewport is most of the hexes it returns. */
export interface HexColumnRange {
  q: number;
  rMin: number;
  rMax: number;
}

/**
 * How far past the rect to reach, in hexes. One hex of slack covers the hexes
 * clipped by the rect's edge, and it is also what makes `hexGridEdges`'
 * three-edges-per-hex tiling complete inside the rect: the edges a hex does
 * not own belong to its west/north neighbours, which have to be in the range
 * for those edges to be drawn at all.
 */
const MARGIN_HEXES = 1;

/**
 * Every grid column crossing `rect`, with the `r` range each one needs, in
 * ascending `q`. Empty for a non-positive `size` — the caller has no grid to
 * draw and should not have to special-case an empty loop.
 */
export function hexColumnsInRect(rect: HexPixelRect, size: number): HexColumnRange[] {
  if (!(size > 0)) return [];
  const { width, rowStep } = hexMetrics(size);
  const marginX = MARGIN_HEXES * width;
  const marginY = MARGIN_HEXES * rowStep;
  const left = Math.min(rect.x, rect.x + rect.width) - marginX;
  const right = Math.max(rect.x, rect.x + rect.width) + marginX;
  const top = Math.min(rect.y, rect.y + rect.height) - marginY;
  const bottom = Math.max(rect.y, rect.y + rect.height) + marginY;

  // Inverting `axialToPixel`: x = 1.5·size·q, and y = √3·size·(q/2 + r).
  const qMin = Math.floor((2 / 3) * (left / size));
  const qMax = Math.ceil((2 / 3) * (right / size));
  const columns: HexColumnRange[] = [];
  for (let q = qMin; q <= qMax; q++) {
    columns.push({
      q,
      rMin: Math.floor(top / rowStep - q / 2),
      rMax: Math.ceil(bottom / rowStep - q / 2),
    });
  }
  return columns;
}

/**
 * How many hexes `hexesInRect` would return, without building the array. The
 * renderer checks this against its own cap before drawing: a hex grid is three
 * line segments per hex where the square lattice is one line per *row*, so a
 * far-out zoom on a large canvas is the one case where the difference between
 * the two grids is a performance question rather than a visual one.
 */
export function hexCountInRect(rect: HexPixelRect, size: number): number {
  let total = 0;
  for (const col of hexColumnsInRect(rect, size)) total += col.rMax - col.rMin + 1;
  return total;
}

/**
 * Every hex covering `rect`, column-major (ascending `q`, then ascending `r`).
 * The order is stable so a caller keying cached per-hex nodes off it — the
 * coordinate pills — sees the same hex in the same place across redraws.
 */
export function hexesInRect(rect: HexPixelRect, size: number): Axial[] {
  const out: Axial[] = [];
  for (const col of hexColumnsInRect(rect, size)) {
    for (let r = col.rMin; r <= col.rMax; r++) out.push({ q: col.q, r });
  }
  return out;
}

/**
 * The three edges a hex **owns**, as a single open polyline through four of its
 * corners: NE → E → SE → SW (corner indices 5, 0, 1, 2 of `hexCorners`).
 *
 * Every edge of the plane is shared by exactly two hexes, so drawing all six
 * per hex would draw each edge twice — visibly heavier lines where they
 * overlap, and double the tessellation work. These three are the edges shared
 * with the NE, SE and S neighbours, which tiles the plane with each edge drawn
 * once: a hex's remaining three edges are owned by its NW, N and SW
 * neighbours. The one hex of margin in `hexColumnsInRect` is what keeps the
 * rect's own west and north edges from going missing.
 */
export function hexOwnedEdgePath(hex: Axial, size: number): HexPixel[] {
  const { width, rowStep } = hexMetrics(size);
  const cx = size * 1.5 * hex.q;
  const cy = rowStep * (hex.q / 2 + hex.r);
  const halfW = width / 4; // size/2 — the x-offset of an off-axis corner
  const halfH = rowStep / 2;
  return [
    { x: cx + halfW, y: cy - halfH }, // 5 — NE
    { x: cx + size, y: cy }, //          0 — E
    { x: cx + halfW, y: cy + halfH }, // 1 — SE
    { x: cx - halfW, y: cy + halfH }, // 2 — SW
  ];
}

/**
 * The midpoint of a hex's **bottom edge** — where SPEC-030 §1's coordinate
 * pill sits. Returned as the edge point itself rather than the pill's centre
 * so the renderer can hang the pill off it by its own height; the pill's size
 * is a render-time concern and this module has no opinion on it.
 */
export function hexPillAnchor(hex: Axial, size: number): HexPixel {
  const { rowStep } = hexMetrics(size);
  return {
    x: size * 1.5 * hex.q,
    y: rowStep * (hex.q / 2 + hex.r) + rowStep / 2,
  };
}
