/**
 * The thirds lattice — `HexPoint` (SPEC-047 §1, DEC-081).
 *
 * `axial.ts` addresses **hexes**: one integer `Axial` per hex, which is all
 * SPEC-030 needed. An overlay drawn on a hex map needs more than hex centres —
 * a road runs corner to corner, a symbol may sit anywhere — and DEC-081's
 * finding is what makes that expressible without a second coordinate space:
 *
 * > Every hex centre and every hex corner is an exact integer multiple of ⅓ of
 * > an axial coordinate, at every hex and every `hex.size`.
 *
 * So this module scales the axial space by three and stores integers. A
 * `HexPoint { q, r }` is in **thirds of a hex step**; the render boundary is
 * crossed exactly where it already was, `axialToPixel({ q: q / 3, r: r / 3 },
 * size)`. RULE-006 is untouched: same basis, same `0,0` at the map's centre,
 * same single render-time-only multiplier, and emphatically not pixels. The
 * rule never said integer, and SPEC-030 §1's "integer" is about the addressing
 * scheme, which still holds — a hex is still named by an integer pair.
 *
 * **Integers rather than floats is load-bearing.** Three hexes computing their
 * shared corner `(⅔, −⅓)` in floating point produce three different doubles
 * (`0.66666666666666662966`, `0.66666666666666674068`,
 * `0.66666666666666640761`), so two roads meeting at a corner would not
 * literally meet and "do these join?" would become a tolerance question. In
 * thirds they are the same value, exactly, and equality is equality.
 *
 * Everything here is pure and store-free, like `axial.ts` beside it.
 */

import { type Axial, type HexPixel, axialRound, axialToPixel } from './axial.js';

/** `Math.sqrt(3)`, hoisted — as in `axial.ts`, the only irrational here. */
const SQRT3 = Math.sqrt(3);

/**
 * A point on the thirds lattice — `q` and `r` in **thirds of a hex step**.
 *
 * A **snapped** point is integer-valued: `(q + r) mod 3 === 0` is a hex centre,
 * anything else is a hex corner (`isHexCentre`/`isHexCorner`). A **free** point
 * is not integer-valued — a symbol dropped where the referee let go of it — and
 * is the one case that carries floats.
 *
 * Structurally identical to `Axial` and deliberately not assignable to it: the
 * two spaces differ by a factor of three, so mixing them renders at the wrong
 * scale rather than failing loudly. The `__space` brand exists only in the type
 * system — it is never present at runtime — and it is what makes the mistake
 * RULE-006 warns about a type error, the same way `Axial` is not a lattice
 * `Point`. An object literal `{ q, r }` still satisfies either.
 */
export interface HexPoint {
  q: number;
  r: number;
  /** Phantom brand; never written, never read. See above. */
  readonly __space?: 'thirds';
}

/** The map's centre, in thirds — the same place as `HEX_ORIGIN`. */
export const HEX_POINT_ORIGIN: HexPoint = { q: 0, r: 0 };

/**
 * The six corner offsets from a hex's centre, in thirds — DEC-081's finding
 * written down. Clockwise from due east, the same order and the same corners
 * as `hexCorners` produces in pixels, and constant at every hex and every
 * `hex.size` because the render conversion is linear in the size.
 *
 * Two adjacent hexes reach the two corners they share through different
 * offsets and land on the *same* `HexPoint`, exactly — that is the property
 * the road tool (SPEC-047 §4) is built on.
 */
export const HEX_CORNER_OFFSETS: readonly HexPoint[] = [
  { q: 2, r: -1 }, // E
  { q: 1, r: 1 }, // SE
  { q: -1, r: 2 }, // SW
  { q: -2, r: 1 }, // W
  { q: -1, r: -1 }, // NW
  { q: 1, r: -2 }, // NE
];

/** Component-wise sum — `b` read as an offset from `a`, in thirds. */
export function hexPointAdd(a: HexPoint, b: HexPoint): HexPoint {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Do these name the same point? Value equality, exact — see the header. */
export function hexPointEquals(a: HexPoint, b: HexPoint): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * The canonical string form, `"q,r"` in thirds — the document id for anything
 * stored at a point (SPEC-047 §2), and the counterpart of `axialKey`.
 *
 * `-0` is normalised to `0` for the same reason `axialRound` does it: an id is
 * a string, so `"-0,0"` and `"0,0"` would be two documents for one point and
 * `-0 === 0` would not save them.
 */
export function hexPointKey(point: HexPoint): string {
  return `${point.q || 0},${point.r || 0}`;
}

/**
 * The inverse of `hexPointKey`, or `null` for anything that is not one — a
 * document id written by another build, a hand-edited archive, a truncated
 * string. Integers only: a free point has no key, so a fractional or
 * exponent-bearing string is rejected rather than rounded onto the lattice.
 */
export function parseHexPointKey(key: string): HexPoint | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return null;
  const q = Number(match[1]);
  const r = Number(match[2]);
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) return null;
  return { q: q || 0, r: r || 0 };
}

/**
 * Is this a hex centre? The mod-3 test from DEC-081, not a float comparison:
 * an integer point with `(q + r) mod 3 === 0`. A free (non-integer) point is
 * neither a centre nor a corner.
 */
export function isHexCentre(point: HexPoint): boolean {
  if (!Number.isInteger(point.q) || !Number.isInteger(point.r)) return false;
  return (((point.q + point.r) % 3) + 3) % 3 === 0;
}

/** Is this a hex corner? Every other integer point — see `isHexCentre`. */
export function isHexCorner(point: HexPoint): boolean {
  if (!Number.isInteger(point.q) || !Number.isInteger(point.r)) return false;
  return (((point.q + point.r) % 3) + 3) % 3 !== 0;
}

/**
 * The hex this point *is*, or `null` if it is not a hex centre — a corner is
 * shared by three hexes and a free point is inside one, so neither has an
 * answer here. The integer `Axial` returned is exactly the one `hexTiles` is
 * keyed by, so `axialKey(hexPointToAxial(p))` is that document's id.
 */
export function hexPointToAxial(point: HexPoint): Axial | null {
  if (!isHexCentre(point)) return null;
  return { q: point.q / 3 || 0, r: point.r / 3 || 0 };
}

/** A hex's centre as a `HexPoint` — the total direction of the conversion. */
export function axialToHexPoint(hex: Axial): HexPoint {
  return { q: hex.q * 3 || 0, r: hex.r * 3 || 0 };
}

/** A hex's six corners as `HexPoint`s, in `HEX_CORNER_OFFSETS` order. */
export function hexPointCorners(hex: Axial): HexPoint[] {
  const centre = axialToHexPoint(hex);
  return HEX_CORNER_OFFSETS.map((offset) => hexPointAdd(centre, offset));
}

/**
 * Where a point falls in pixels — the render boundary, crossed once
 * (RULE-006), and the same crossing `axialToPixel` already is: thirds are
 * divided out here and nowhere else.
 */
export function hexPointToPixel(point: HexPoint, size: number): HexPixel {
  return axialToPixel({ q: point.q / 3, r: point.r / 3 }, size);
}

/**
 * The point a pixel lands on, **unsnapped** — a free `HexPoint`, generally not
 * integer-valued. This is what a Free-snap gesture stores; `snapHexPoint`
 * collapses it onto the lattice when the gesture is snapped.
 */
export function pixelToHexPoint(point: HexPixel, size: number): HexPoint {
  // `pixelToAxial`'s formula with the thirds factor folded in, deliberately
  // not `pixelToAxial` itself: that rounds to the nearest hex, and the
  // fractional value is the answer here.
  return {
    q: (2 * point.x) / size,
    r: (-point.x + SQRT3 * point.y) / size,
  };
}

/**
 * The nearest thirds-lattice point — what Hex snap resolves to (SPEC-047 §3)
 * for a tool that anchors on centres and corners alike.
 *
 * The thirds lattice, read in `(q, r)`, *is* an integer axial lattice, so
 * "nearest" is the same cube rounding `axialRound` does — component-wise
 * rounding would land outside the containing triangle near its corners. The
 * literal below is a fresh `{ q, r }` rather than the branded `HexPoint`
 * precisely because the two spaces coincide here and nowhere else.
 */
export function snapHexPoint(point: HexPoint): HexPoint {
  const rounded = axialRound({ q: point.q, r: point.r });
  return { q: rounded.q, r: rounded.r };
}
