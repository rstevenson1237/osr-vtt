/**
 * Core geometry types for the Vector Map System POC (SPEC §2.0).
 *
 * ONE coordinate space everywhere: cell-lattice units (floats). Pixels appear
 * only at the render boundary (see ../render/canvas.ts). Nothing here knows
 * about cellSize, Pixi, or Firebase — this is the layer WI-A ports verbatim
 * into packages/shared/src/map/.
 */

/** A point in lattice units. */
export interface Point {
  x: number;
  y: number;
}

/** A closed ring of lattice points (first vertex implicitly joins the last).
 * Matches polygon-clipping's Ring, aside from our named type. */
export type Ring = Point[];

/** A polygon = outer ring + optional holes (rings[1..]). SPEC §2.1. */
export type Poly = Ring[];

/** The floor union: many disjoint polygons, each possibly holed. This is what
 * a boolean op naturally yields — disjoint regions and split-on-bisection fall
 * out for free (validated: difference across a region returns 2 polys). */
export type MultiPoly = Poly[];

// ---- Wall / door model (SPEC §3) ----

export type WallSource = 'perimeter' | 'explicit' | 'imported';

/** The single wall primitive (SPEC §3.1). Perimeter walls are derived, never
 * stored; explicit/imported are persisted (in the real system). */
export interface Segment {
  a: Point;
  b: Point;
  source: WallSource;
  blocksSight: boolean;
  blocksMovement: boolean;
}

export type DoorType = 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred';
export type DoorState = 'open' | 'closed';

/** A geometry-anchored overlay door (SPEC §3.2) — free endpoints, floating
 * layer, no wall attachment. */
export interface Door {
  id: string;
  a: Point;
  b: Point;
  type: DoorType;
  state: DoorState;
}

/** Does this door let sight/passage through right now? (SPEC §3.3 semantics,
 * mirrors the old doorPassesSight rule.) `barred` always blocks. */
export function doorPasses(door: Door): boolean {
  if (door.type === 'barred') return false;
  return door.state === 'open';
}

// ---- vector <-> lib bridge helpers ----

export function toPair(p: Point): [number, number] {
  return [p.x, p.y];
}

export function fromPair(pair: readonly number[]): Point {
  return { x: pair[0] ?? 0, y: pair[1] ?? 0 };
}
