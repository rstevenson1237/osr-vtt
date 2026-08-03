/**
 * Shape emission (SPEC §2.5, §5 steps 1-2). Every primitive turns its collected
 * point stream into a `Poly`/`MultiPoly` in lattice units. Primitives differ
 * ONLY here — downstream (boolean combine, simplify) is shared. This is the "one
 * shared abstraction" the spec asks for: five point collectors, one pipeline.
 *
 * `bufferPolyline` is the offset stand-in for SPEC §5 step 2 / REVIEW M6 — a
 * union of per-segment quads + round caps rather than a true polygon offset.
 * The §8.1 spike (see OFFSET-SPIKE.md) measured it against a real Clipper offset
 * and found them quality-equivalent after simplify; its only weakness was
 * per-stroke perf, now fixed by `decimatePolyline`. So this is a measured,
 * mitigated choice, not a temporary shortcut.
 */
import type { BooleanBackend } from './backend.js';
import { snapCell, snapCellCenter, snapCellSize, type VectorSnapMode } from './snap.js';
import type { MultiPoly, Point, Poly, Ring } from './types.js';

/** Room: two opposite corners → axis-aligned rectangle (CCW-agnostic; the
 * boolean backend normalizes winding). Returns null for a degenerate rect. */
export function rectPoly(a: Point, b: Point): Poly | null {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (maxX - minX < 1e-9 || maxY - minY < 1e-9) return null;
  return [
    [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  ];
}

/**
 * Room, cell-anchored: the whole-cell rectangle spanning the cells `a` and `b`
 * are in, both ends inclusive. A click with no drag is one cell, and the rect
 * grows a whole cell at a time from there.
 *
 * `rectPoly` corner-to-corner cannot express this: its corners are lattice
 * *vertices*, so a click with no movement collapses to nothing at all, and a
 * drag that ends mid-cell leaves a partial cell of floor. Freeform keeps the
 * corner-to-corner behaviour, where a partial cell is exactly the point.
 */
export function cellRectPoly(a: Point, b: Point, mode: VectorSnapMode): Poly | null {
  if (mode === 'free') return rectPoly(a, b);
  const step = snapCellSize(mode);
  const loCell = snapCell({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, mode);
  const hiCell = snapCell({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }, mode);
  return [
    [
      { x: loCell.x, y: loCell.y },
      { x: hiCell.x + step, y: loCell.y },
      { x: hiCell.x + step, y: hiCell.y + step },
      { x: loCell.x, y: hiCell.y + step },
    ],
  ];
}

/** Irregular polygon: the collected vertices, directly. Needs ≥3 vertices. */
export function polygonPoly(vertices: Point[]): Poly | null {
  if (vertices.length < 3) return null;
  return [vertices.map((p) => ({ x: p.x, y: p.y }))];
}

/**
 * Regular n-gon centered at `center`, `radius`, `rotation` radians. `n <= 1` is
 * the degenerate circle case (SPEC §2.5) → sampled as a fine polygon. Returns
 * null for a non-positive radius.
 */
export function regularPoly(center: Point, radius: number, n: number, rotation = 0): Poly | null {
  if (radius <= 0) return null;
  const sides = n <= 1 ? 64 : Math.max(3, Math.round(n));
  const ring: Ring = [];
  for (let i = 0; i < sides; i++) {
    const t = rotation + (i / sides) * Math.PI * 2;
    ring.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
  }
  return [ring];
}

/** How many sides `regularPoly` samples a circle at. `ngonPoly` needs the same
 * number to convert a circle's across-flats measure, and the two must agree or
 * a snapped circle comes out the wrong size. */
const CIRCLE_SIDES = 64;

/** The side counts the N-gon tool offers. `1` is the circle (`regularPoly`'s
 * existing degenerate case); above 8 a polygon reads as a circle anyway, so the
 * dropdown stops there. */
export const NGON_SIDE_OPTIONS = [1, 3, 4, 5, 6, 7, 8] as const;

export interface NgonSpec {
  center: Point;
  /** Diameter measured **across the flats** — face to opposite face, i.e. the
   * inscribed circle. This is what makes a snapped polygon sit flush inside a
   * whole number of cells; the circumscribed measure would leave its edges off
   * the grid by `cos(π/n)`. */
  acrossFlats: number;
  /** `NGON_SIDE_OPTIONS` member; `<= 1` is the circle. */
  sides: number;
  /** Direction, in radians, that one flat face's outward normal points — the
   * direction of the drag that authored the shape. */
  faceAngle: number;
}

/**
 * The N-gon tool's shape: a regular polygon sized across its flats and rotated
 * so a face squarely meets `faceAngle`.
 *
 * Both conversions happen here rather than in `regularPoly`, which stays a
 * plain centre/circumradius/vertex-phase builder because it is also the
 * circular-wall utility (SPEC-011 §5) and the LoS ring sampler.
 *
 * - **Size.** `R = (acrossFlats / 2) / cos(π / n)`, the standard apothem
 *   relation. A circle is its own inscribed circle, so it takes `R = D / 2`.
 * - **Rotation.** `regularPoly` puts a *vertex* at its rotation argument, and
 *   the first edge midpoint sits half a step further round, so a face normal
 *   lands on `faceAngle` when the vertex phase is `faceAngle - π / n`.
 */
export function ngonPoly({ center, acrossFlats, sides, faceAngle }: NgonSpec): Poly | null {
  if (acrossFlats <= 0) return null;
  const n = sides <= 1 ? CIRCLE_SIDES : Math.max(3, Math.round(sides));
  // A 64-gon's apothem is within 0.12% of its circumradius, but going through
  // the same relation keeps "diameter" meaning one thing for every side count.
  const radius = acrossFlats / 2 / Math.cos(Math.PI / n);
  return regularPoly(center, radius, n, faceAngle - Math.PI / n);
}

/** A quad for one segment offset to half-width on both sides. */
function segmentQuad(a: Point, b: Point, halfWidth: number): Ring {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halfWidth;
  const ny = (dx / len) * halfWidth;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

/** A round cap / join fan at a point. */
function roundCap(c: Point, r: number, steps = 12): Ring {
  const ring: Ring = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    ring.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
  }
  return ring;
}

/**
 * Drop interior points closer than `minSpacing` to the last kept point
 * (endpoints always survive). Raw pointer input is sampled far denser than a
 * brush-radius buffer can resolve, and the stand-in below does one boolean union
 * per surviving segment — so decimating first is what bounds its per-stroke cost
 * (the §8.1 offset-spike finding: the stand-in's only real weakness is perf that
 * scales with point count, and it's fixed here, not by a new library).
 */
export function decimatePolyline(points: Point[], minSpacing: number): Point[] {
  if (points.length <= 2 || minSpacing <= 0) return points.slice();
  const min2 = minSpacing * minSpacing;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy >= min2) out.push(p);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Buffer an open polyline to a corridor of `width` (SPEC §5 step 2 stand-in).
 * Powers the **free-snap** Path (`pathPoly`) and the free-snap Carve brush —
 * the round-capped organic ribbon. Returns a single unioned MultiPoly. See the
 * file header: this is the M6 offset stand-in, not a true offset.
 *
 * Points are decimated to `minSpacing` (default `width / 4`) first, which caps
 * the boolean-union count so a long freeform drag stays cheap — the §8.1 spike
 * showed that per-stroke cost, not offset quality, is the stand-in's weak point.
 */
export function bufferPolyline(
  points: Point[],
  width: number,
  backend: BooleanBackend,
  minSpacing = width / 4,
): MultiPoly {
  const half = width / 2;
  if (points.length === 0 || half <= 0) return [];
  if (points.length === 1) return [[roundCap(points[0]!, half)]];
  const pts = decimatePolyline(points, minSpacing);
  const parts: Poly[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    parts.push([segmentQuad(pts[i]!, pts[i + 1]!, half)]);
  }
  for (const p of pts) parts.push([roundCap(p, half)]);
  return backend.union([], parts);
}

/**
 * The widths the Corridor and Path tools offer, in cells (SPEC-028 §7). One set
 * shared by both tools, so the two hold a single width vocabulary rather than
 * each inventing its own (DEC-032). Carve keeps its free-form ribbon and is not
 * on this list.
 */
export const BAND_WIDTH_OPTIONS = [0.125, 0.25, 0.5, 1, 2] as const;

/**
 * The band's low cross-axis edge for a centerline at `center`. Shared with the
 * corner block so the turn lands on exactly the same lines as the two legs.
 *
 * Snapped, the band is simply **centred inside the cell (or half-cell) the
 * pointer is in** — `snapCellCenter - width / 2`, with no further quantization
 * (SPEC-028 §7, DEC-032). Every expectation the old rule stated survives: width
 * 1 under cell snap fills exactly the pointed-at cell, width ½ under half snap
 * fills exactly the pointed-at half-cell, and width 2 straddles the pointed-at
 * cell evenly. What changes is the sub-step widths: they now inset evenly
 * inside the tile instead of collapsing onto one of its edges.
 *
 * The removed quantization was `Math.round((cellCenter - width/2) / min(step,
 * width)) * min(step, width)`, which made `width = ½ · snap = cell` land on a
 * half-cell line — indistinguishable from `width = ½ · snap = half` — and had
 * no honest answer at all for ⅛ and ¼.
 *
 * Freeform still centres on the raw centerline, which is what freeform means.
 */
function bandLo(center: number, width: number, mode: VectorSnapMode): number {
  if (mode === 'free') return center - width / 2;
  return snapCellCenter({ x: center, y: center }, mode).x - width / 2;
}

/**
 * An axis-aligned rectangle band of `width` around the run p→q (which must share
 * a row or column). Flat ends, square corners — no rounding; under snap the Path
 * shares this band exactly (SPEC-028 §7), and only a free-snap Path rounds. When
 * snapped, the band is centred in the pointed-at cell (see `bandLo`) and runs
 * whole cells, exactly like a Room.
 */
/** The band's along-axis extent: whole cells, both end cells included, so a
 * snapped corridor's flat caps land on grid lines and its length grows a cell
 * at a time — the same rule `cellRectPoly` applies to a Room. */
function bandSpan(a: number, b: number, mode: VectorSnapMode): [number, number] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (mode === 'free') return [lo, hi];
  const step = snapCellSize(mode);
  return [snapCell({ x: lo, y: lo }, mode).x, snapCell({ x: hi, y: hi }, mode).x + step];
}

function bandRect(p: Point, q: Point, width: number, mode: VectorSnapMode): Poly | null {
  const horizontal = Math.abs(q.y - p.y) <= Math.abs(q.x - p.x);
  let [x0, x1] = bandSpan(p.x, q.x, mode);
  let [y0, y1] = bandSpan(p.y, q.y, mode);
  if (horizontal) {
    y0 = bandLo(p.y, width, mode);
    y1 = y0 + width;
  } else {
    x0 = bandLo(p.x, width, mode);
    x1 = x0 + width;
  }
  if (x1 - x0 < 1e-9 || y1 - y0 < 1e-9) return null;
  return [
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  ];
}

/**
 * Corridor: an L-shaped run (horizontal leg then vertical leg) of fixed width,
 * ALWAYS cardinal — the corner is a right angle, ends are flat, joints are
 * square (SPEC corridor default). Freeform only means the endpoints are raw
 * (unsnapped); the legs stay axis-aligned regardless. Built as the union of two
 * axis-aligned rectangles, so the flat caps come for free.
 *
 * A third `width × width` square fills the turn. Each leg runs only between its
 * *centerline* endpoints, so at a bend the horizontal leg stops half a width
 * short of the vertical leg's outer wall — leaving a `half × width` notch that,
 * at width 2, read as the corner collapsing to a single tile. The corner block
 * spans both legs' cross-axis extents (same `bandLo` quantization), so the turn
 * stays the corridor's full width.
 *
 * Which legs exist is decided from the **snapped cells**, not from the raw
 * endpoints. The tool now hands over unsnapped points, so a corridor dragged
 * straight along a row still has a few hundredths of stray cross-axis drift in
 * it; comparing raw coordinates would read that as a real turn and grow a
 * one-cell stub off the end. When both cells coincide the horizontal leg is
 * kept, so a click with no drag is one cell of corridor rather than nothing —
 * the same floor the Room tool gives for the same gesture.
 */
export function corridorPoly(
  a: Point,
  b: Point,
  width: number,
  backend: BooleanBackend,
  mode: VectorSnapMode,
): MultiPoly {
  const corner: Point = { x: b.x, y: a.y };
  const cellA = snapCell(a, mode);
  const cellB = snapCell(b, mode);
  const noH = mode !== 'free' && cellA.x === cellB.x;
  const noV = mode !== 'free' && cellA.y === cellB.y;
  const legs: Poly[] = [];
  const h = noH && !noV ? null : bandRect(a, corner, width, mode);
  const v = noV ? null : bandRect(corner, b, width, mode);
  if (h) legs.push(h);
  if (v) legs.push(v);
  // Both legs exist ⇒ there is a real turn; fill it to full width.
  if (h && v) legs.push(cornerBlock(corner, width, mode));
  if (!legs.length) return [];
  return backend.union([], legs);
}

/** The `width × width` block that fills a turn, on exactly the lines `bandLo`
 * gives the two legs it joins. Shared by the Corridor's single corner and the
 * Path's every interior vertex — a square of side `width` centred on the join
 * contains the round join of radius `width / 2`, so it covers a turn at any
 * angle, not just a right one. */
function cornerBlock(at: Point, width: number, mode: VectorSnapMode): Poly {
  const cx = bandLo(at.x, width, mode);
  const cy = bandLo(at.y, width, mode);
  return [
    [
      { x: cx, y: cy },
      { x: cx + width, y: cy },
      { x: cx + width, y: cy + width },
      { x: cx, y: cy + width },
    ],
  ];
}

/**
 * The square the Corridor/Path targeted-cell indicator draws under Cell or
 * Half snap: side `width`, on exactly the same lines `bandLo` gives every leg
 * and `cornerBlock` gives every turn — so the indicator shows the band that
 * will actually be carved, not the whole tile it sits in (SPEC-028 §6, WI-052).
 * Sub-step widths (⅛, ¼) are what make this differ from the tile at all; at
 * `width = 1` under cell snap it coincides with the tile exactly.
 */
export function targetedBandRect(
  at: Point,
  width: number,
  mode: VectorSnapMode,
): { x: number; y: number; size: number } {
  return { x: bandLo(at.x, width, mode), y: bandLo(at.y, width, mode), size: width };
}

/** A segment quad with each end optionally pushed out along the run — the
 * squared (90°) cap. `extend` of `0` leaves the end flush with the point. */
function cappedQuad(a: Point, b: Point, halfWidth: number, extendA: number, extendB: number): Ring {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return segmentQuad(
    { x: a.x - ux * extendA, y: a.y - uy * extendA },
    { x: b.x + ux * extendB, y: b.y + uy * extendB },
    halfWidth,
  );
}

/**
 * Path (SPEC-028 §4, §7): a polyline of `width` cells, cell-anchored under
 * Cell/Half snap and a free-form ribbon under Free.
 *
 *  - **Free** is unchanged — `bufferPolyline`, round caps and round joins. The
 *    circle the snap indicator shows under Free is that cap.
 *  - **Snapped**, every clicked point anchors to the centre of the cell it fell
 *    in, and the run between two anchors is built exactly as a Corridor leg is:
 *    an axis-aligned pair goes through `bandRect`, so the band is centred in the
 *    pointed-at tile and the length covers whole cells, both ends inclusive.
 *    Every interior vertex gets the Corridor's own `cornerBlock`. A path drawn
 *    between right-angle points is therefore *geometrically identical* to the
 *    corridor drawn between the same points, which is what DEC-032 asked for.
 *
 * A diagonal run has no cell-aligned band to quantize to, so it stays a quad
 * between the two cell centres, squared off at the path's two ends by half a
 * step — the same "reach the edge of the cell you clicked" rule the axis-aligned
 * case gets from `bandRect`. Interior ends are left flush, because a cap that
 * overshot an interior vertex would spur out past a sharp turn; `cornerBlock`
 * covers the join instead.
 *
 * A single clicked point is one cell of path, matching the Corridor's
 * click-with-no-drag rather than emitting nothing.
 */
export function pathPoly(
  points: readonly Point[],
  width: number,
  backend: BooleanBackend,
  mode: VectorSnapMode,
): MultiPoly {
  if (mode === 'free') return bufferPolyline([...points], width, backend);
  if (!points.length || width <= 0) return [];

  // Anchor to cell centres, dropping consecutive repeats: several clicks (or
  // several drag samples) inside one cell are one point, not a zero-length run.
  const cells: Point[] = [];
  for (const p of points) {
    const c = snapCellCenter(p, mode);
    const last = cells[cells.length - 1];
    if (!last || Math.abs(last.x - c.x) > 1e-9 || Math.abs(last.y - c.y) > 1e-9) cells.push(c);
  }

  const parts: Poly[] = [];
  if (cells.length === 1) {
    const only = cells[0]!;
    const one = bandRect(only, only, width, mode);
    if (one) parts.push(one);
  }
  const cap = snapCellSize(mode) / 2;
  for (let i = 0; i < cells.length - 1; i++) {
    const a = cells[i]!;
    const b = cells[i + 1]!;
    if (Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) {
      const leg = bandRect(a, b, width, mode);
      if (leg) parts.push(leg);
    } else {
      parts.push([
        cappedQuad(a, b, width / 2, i === 0 ? cap : 0, i === cells.length - 2 ? cap : 0),
      ]);
    }
  }
  for (let i = 1; i < cells.length - 1; i++) parts.push(cornerBlock(cells[i]!, width, mode));

  if (!parts.length) return [];
  return backend.union([], parts);
}
