/**
 * Core geometry types for the Vector Map System (WI-A graduation of the
 * `poc/vector-floor/` §9.1 sandbox). SPEC §2.0/§2.1/§3.
 *
 * ONE coordinate space everywhere: cell-lattice (map) units, floats. `cellSize`
 * is a render-time concern only — nothing in this module knows about pixels,
 * Pixi, or Firebase. This is the pure-geometry layer; the render/LoS-build
 * boundary multiplies by `cellSize` once, uniformly (SPEC §2.0).
 *
 * These types are deliberately re-implemented (not imported) from the POC
 * sandbox per the scaffold's graduation rule, and are namespaced under
 * `map/vector/` so they never collide with the existing cellular map system
 * (`map/natural.ts` `Point`, `map/los.ts` `Segment`).
 */

/** A point in lattice units. */
export interface Point {
  x: number;
  y: number;
}

/** A closed ring of lattice points (first vertex implicitly joins the last).
 * Matches polygon-clipping's `Ring`, aside from our named point type. */
export type Ring = Point[];

/** A polygon = outer ring + optional holes (`rings[1..]`). SPEC §2.1. */
export type Poly = Ring[];

/** The floor union: many disjoint polygons, each possibly holed. This is what a
 * boolean op naturally yields — disjoint regions and split-on-bisection fall out
 * for free (a difference across a region can return two polys). */
export type MultiPoly = Poly[];

/** Axis-aligned bounding range for spatial queries (SPEC §2.1). Derived,
 * recomputed on every commit, never authoritative, never hand-edited. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A stored floor region (SPEC §2.1) — the baked union model (Model A). Stores
 * only the resulting boundary rings + a derived bbox; the primitive that
 * produced it (rect / n-gon / brush path) is NOT persisted. A map's floor is
 * the union of all its regions.
 */
export interface FloorRegion {
  id: string;
  /** `rings[0]` = outer boundary, `rings[1..]` = holes; lattice units (§2.0). */
  rings: Poly;
  /** Derived bounding range; recomputed every commit, never hand-edited. */
  bbox: BBox;
}

// ---- Wall / door model (SPEC §3) ----

export type WallSource = 'perimeter' | 'explicit' | 'imported';

/**
 * The single wall primitive (SPEC §3.1). `blocksSight`/`blocksMovement` decouple
 * line-of-sight from passage. Perimeter walls are derived from a `FloorRegion`
 * boundary at build time and never stored; explicit/imported are persisted (in
 * the real system, WI-B).
 */
export interface Segment {
  a: Point;
  b: Point;
  source: WallSource;
  blocksSight: boolean;
  blocksMovement: boolean;
}

export type DoorType = 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred';
export type DoorState = 'open' | 'closed';

/** A geometry-anchored overlay door (SPEC §3.2) — free endpoints on the floating
 * layer, no durable wall attachment. The builder reconciles overlaps each pass. */
export interface Door {
  id: string;
  a: Point;
  b: Point;
  type: DoorType;
  state: DoorState;
  facing?: DoorFacing;
}

/** One-way door facing (SPEC §3.2). Unused by LoS today; carried for WI-D. */
export type DoorFacing = 'a' | 'b';

/**
 * Does this door let sight/passage through right now? (SPEC §3.3 semantics,
 * mirrors the old `doorPassesSight` rule.) A `barred` door always blocks.
 */
export function doorPasses(door: Door): boolean {
  if (door.type === 'barred') return false;
  return door.state === 'open';
}

// ---- vector <-> library bridge helpers ----

export function toPair(p: Point): [number, number] {
  return [p.x, p.y];
}

export function fromPair(pair: readonly number[]): Point {
  return { x: pair[0] ?? 0, y: pair[1] ?? 0 };
}
