/**
 * Hex Crawl coordinates — the second coordinate space (SPEC-030 §1).
 *
 * RULE-006, as amended by WI-037, fixes a map's coordinate space **per grid
 * kind**: a square-grid map stores lattice (cell) units as floats, and a
 * hex-grid map stores **integer axial hex coordinates with `0,0` at the map's
 * centre**. The two are not interchangeable — neighbours, distance and the
 * floor union do not carry over — so this module deliberately does not reuse
 * `map/vector`'s `Point`. An `Axial` is `{ q, r }`; a lattice `Point` is
 * `{ x, y }`; neither is assignable to the other, and the mistake RULE-006
 * warns about is a type error rather than a silently wrong map.
 *
 * This module addresses **hexes**, in whole axial steps. Since SPEC-047 §1 the
 * space also carries geometry that is not a hex — corners, free-placed points —
 * as a `HexPoint` in **thirds** of a step (`point.ts`), and those *are* stored.
 * The header's earlier claim that the fractional case "is never stored" was
 * true only while hexes were the only addressable thing; thirds are integers
 * and are stored as integers, which is DEC-081's point.
 *
 * Everything here is pure and store-free, exactly like `map/vector/`. The hex
 * `size` is a **render-time-only multiplier** (RULE-006): it is a parameter of
 * the conversion functions at the bottom of this file, never a term in a
 * stored coordinate.
 *
 * **Orientation is fixed: flat-top hexes in columns**, the classic overland
 * hex-crawl look. It is a property of the render boundary, not of the data, so
 * it is a constant here rather than a stored field — `q` steps one column east,
 * `r` steps one row down that column.
 */

/**
 * One hex, in axial coordinates — whole hex steps. Integers for a real hex;
 * the fractional case exists only as the intermediate value `axialRound`
 * collapses back onto the grid.
 *
 * `{ q: 0, r: 0 }` is the map's centre (SPEC-030 §1), and both axes run
 * positive and negative from there — a hex map is infinite in every direction,
 * so there is no origin corner to count from.
 *
 * An `Axial` addresses a **hex**. A position that is not a hex — a corner, a
 * free-placed symbol — is a `HexPoint` in thirds (`point.ts`, SPEC-047 §1),
 * which is this same space scaled by three and therefore not assignable to
 * this one: the `__space` brand exists in the type system only, so that
 * rendering thirds at whole-step scale is a type error rather than a map drawn
 * three times too large.
 */
export interface Axial {
  q: number;
  r: number;
  /** Phantom brand; never written, never read. See above. */
  readonly __space?: 'axial';
}

/**
 * A point in **pixels** — the far side of the render-time multiplier, produced
 * by `axialToPixel`/`hexCorners` and consumed by `pixelToAxial`. Never stored
 * (RULE-006: "never store pixel coordinates"), and never a lattice `Point`.
 */
export interface HexPixel {
  x: number;
  y: number;
}

/** The map's centre — the hex a fresh hex map opens on. */
export const HEX_ORIGIN: Axial = { q: 0, r: 0 };

/**
 * The six neighbour offsets, in clockwise order starting due north.
 *
 * Read against the fixed flat-top orientation: N, NE, SE, S, SW, NW. The
 * offsets themselves are orientation-independent — only their pixel direction
 * depends on it — so an index into this array is a stable compass direction.
 */
export const AXIAL_DIRECTIONS: readonly Axial[] = [
  { q: 0, r: -1 }, // N
  { q: 1, r: -1 }, // NE
  { q: 1, r: 0 }, // SE
  { q: 0, r: 1 }, // S
  { q: -1, r: 1 }, // SW
  { q: -1, r: 0 }, // NW
];

/** Component-wise sum — `b` read as an offset from `a`. */
export function axialAdd(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Component-wise difference — the offset that carries `b` to `a`. */
export function axialSubtract(a: Axial, b: Axial): Axial {
  return { q: a.q - b.q, r: a.r - b.r };
}

/** Do these name the same hex? Value equality: an `Axial` is never identity. */
export function axialEquals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * The neighbour in direction `index` (see `AXIAL_DIRECTIONS`). The index wraps,
 * so `axialNeighbor(h, 6)` is `axialNeighbor(h, 0)` and a caller stepping a
 * rotation never has to normalise.
 */
export function axialNeighbor(hex: Axial, index: number): Axial {
  const dir = AXIAL_DIRECTIONS[((index % 6) + 6) % 6]!;
  return axialAdd(hex, dir);
}

/** All six neighbours, in `AXIAL_DIRECTIONS` order. */
export function axialNeighbors(hex: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((dir) => axialAdd(hex, dir));
}

/**
 * How many hex steps apart two hexes are — the hex-crawl travel distance, and
 * the only "distance" a hex map has.
 *
 * This is the cube distance written in axial terms; it is **not** the square
 * lattice's Chebyshev or Euclidean distance, and the `RoomMeasure.perSquare`
 * arithmetic that reads a span in lattice cells does not apply to it.
 */
export function axialDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * The canonical string form of a hex, `"q,r"` — e.g. `"0,0"`, `"-3,12"`.
 *
 * SPEC-030 §1 makes coordinates **the addressing scheme**, superseding the map
 * labels a referee used to invent and place, so this one string is both:
 *
 *  - the **document id** for anything stored per hex (terrain, contents, notes
 *    — WI-040/WI-041), which is why it carries no spaces and no `/`; and
 *  - the **`x,y` label** SPEC-030 §1 shows in each hex's coordinate pill,
 *    verbatim (WI-039).
 *
 * One function, so an id and the pill above it can never drift apart.
 */
export function axialKey(hex: Axial): string {
  return `${hex.q},${hex.r}`;
}

/**
 * The inverse of `axialKey`, or `null` for anything that is not one — a
 * document id written by another build, a hand-edited archive, a truncated
 * string. Integers only: a fractional or exponent-bearing key names no hex, so
 * it is rejected rather than rounded into one.
 */
export function parseAxialKey(key: string): Axial | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return null;
  const q = Number(match[1]);
  const r = Number(match[2]);
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) return null;
  return { q, r };
}

/**
 * Collapse a fractional axial coordinate onto the hex that contains it.
 *
 * Rounding each component independently would land outside the hex near its
 * corners, so this rounds in cube space and re-derives whichever component
 * moved furthest — the standard cube-rounding fix. `pixelToAxial` is the only
 * caller that matters, but a caller interpolating along a hex line needs the
 * same collapse.
 */
export function axialRound(hex: Axial): Axial {
  // Cube coordinates: x = q, z = r, y = -x - z (they sum to zero).
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);

  // Re-derive the component with the largest rounding error from the other
  // two, which restores the x + y + z === 0 invariant the rounding broke.
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

  // `|| 0` because `-0` is a legitimate rounding result and `"0,0"` must not
  // be reachable as `"-0,0"` — an id is a string, and `-0 === 0` would not
  // save it.
  return { q: rx || 0, r: rz || 0 };
}

/** `Math.sqrt(3)`, hoisted — every conversion below multiplies by it. */
const SQRT3 = Math.sqrt(3);

/**
 * The pixel dimensions one hex occupies at a given `size`, where **`size` is
 * the circumradius** — the centre-to-corner distance, and the render-time-only
 * multiplier RULE-006 names (`GameMap.hex.size`).
 *
 * For the fixed flat-top orientation: `width` is corner to corner across the
 * flat-top hex (`2 · size`), `height` is flat to flat (`√3 · size`), columns
 * step `colStep` apart horizontally (three quarters of a width, because
 * adjacent columns interlock), and rows step a full `height` apart with
 * odd columns offset half a `height` down.
 */
export function hexMetrics(size: number): {
  width: number;
  height: number;
  colStep: number;
  rowStep: number;
} {
  return {
    width: 2 * size,
    height: SQRT3 * size,
    colStep: 1.5 * size,
    rowStep: SQRT3 * size,
  };
}

/**
 * Where a hex's **centre** falls in pixels — the render boundary, crossed once
 * (RULE-006). `HEX_ORIGIN` is pixel `{ x: 0, y: 0 }`, so the map's centre is
 * the world origin and the space stays symmetric about it in both axes.
 */
export function axialToPixel(hex: Axial, size: number): HexPixel {
  return {
    x: size * 1.5 * hex.q,
    y: size * SQRT3 * (hex.q / 2 + hex.r),
  };
}

/**
 * Which hex a pixel lands in — the inverse of `axialToPixel`, rounded back onto
 * the grid, so a point anywhere inside a hex (not only near its centre) returns
 * that hex. This is hex picking: the hex-map counterpart of square-lattice
 * snapping, which is undefined here.
 */
export function pixelToAxial(point: HexPixel, size: number): Axial {
  return axialRound({
    q: (2 / 3) * (point.x / size),
    r: (-point.x / 3 + (SQRT3 / 3) * point.y) / size,
  });
}

/**
 * A hex's six corners in pixels, clockwise from due east (angle 0), ready to
 * be drawn as a polygon. Flat-top, so the first corner is a point rather than
 * an edge midpoint; every corner sits exactly `size` from the centre, and two
 * adjacent hexes agree on the two corners they share.
 */
export function hexCorners(hex: Axial, size: number): HexPixel[] {
  const centre = axialToPixel(hex, size);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return {
      x: centre.x + size * Math.cos(angle),
      y: centre.y + size * Math.sin(angle),
    };
  });
}
