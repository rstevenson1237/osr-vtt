/**
 * Vector Map System — store wiring (SPEC §9 step 5, WI-C).
 *
 * WI-A's `map/vector/los.ts` builds the SPEC §3.3 sight/movement segment
 * lists from three in-memory values (the floor union, explicit walls, and
 * doors). WI-B exposed those three as independently-subscribable
 * `CampaignStore` collections (`floorRegions`, `wallSegments`, `doors`) but
 * left them unconnected — see the "WI-C/WI-D wire them into the app" note on
 * `CampaignStore`. This module is that wire: it composes the three live
 * subscriptions into one recomputed `VectorScene`, so a consumer (a WI-D
 * renderer, fog/vision code, or a test) reads reconciled segment lists
 * without touching `FloorRegion`/`StoredVectorWall`/`VectorDoor` shapes.
 *
 * `map/vector/` stays store-free by design (its own docblock: "no store,
 * rules, render, or app dependencies") — this bridge lives in `store/`
 * instead, alongside the `CampaignStore` types it depends on.
 */
import {
  buildMovementSegments,
  buildSightSegments,
  regionsToMultiPoly,
  type MultiPoly,
  type Segment,
} from '../map/vector/index.js';
import type {
  CampaignStore,
  StoredVectorWall,
  Unsubscribe,
  VectorDoor,
  VectorFloorRegion,
} from './campaign-store.js';

export interface VectorScene {
  /** The baked floor union (SPEC §2.1) — every `FloorRegion` merged into one. */
  floor: MultiPoly;
  /** SPEC §3.3 build output: perimeter + sight-blocking walls, doors reconciled. */
  sight: Segment[];
  /** SPEC §3.3 build output for passage (REVIEW M8): perimeter + movement-blocking
   * walls, doors reconciled. */
  movement: Segment[];
}

/**
 * Pure combinator over already-fetched store data — SPEC §3.3's build-time
 * reconciliation, with the `FloorRegion[]` → `MultiPoly` step folded in. No
 * Firestore/RTDB dependency, so it's usable for one-shot reads and tests
 * without a live subscription.
 */
export function buildVectorScene(
  regions: readonly VectorFloorRegion[],
  walls: readonly StoredVectorWall[],
  doors: readonly VectorDoor[],
): VectorScene {
  const floor = regionsToMultiPoly(regions);
  const explicit = [...walls];
  const doorList = [...doors];
  return {
    floor,
    sight: buildSightSegments(floor, explicit, doorList),
    movement: buildMovementSegments(floor, explicit, doorList),
  };
}

/**
 * Subscribes to a map's floor/wall/door collections and recomputes the
 * `VectorScene` whenever any one of them changes — SPEC §3.3's "build-once,
 * probe-many": rebuilt once per change, never per-frame-per-cell. Committed
 * writes (not per-frame drag preview, which rides the separate
 * `VectorMapDraft` RTDB channel) are what drive these collections, so no
 * additional debouncing is applied here; each collection's own snapshot
 * (including its initial one) re-fires the callback independently, the same
 * fan-in behavior as combining any other set of `CampaignStore` listeners.
 */
export function subscribeVectorScene(
  store: CampaignStore,
  roomId: string,
  mapId: string,
  cb: (scene: VectorScene) => void,
): Unsubscribe {
  let regions: readonly VectorFloorRegion[] = [];
  let walls: readonly StoredVectorWall[] = [];
  let doors: readonly VectorDoor[] = [];

  const emit = () => cb(buildVectorScene(regions, walls, doors));

  const unsubRegions = store.subscribeFloorRegions(roomId, mapId, (r) => {
    regions = r;
    emit();
  });
  const unsubWalls = store.subscribeWallSegments(roomId, mapId, (w) => {
    walls = w;
    emit();
  });
  const unsubDoors = store.subscribeDoors(roomId, mapId, (d) => {
    doors = d;
    emit();
  });

  return () => {
    unsubRegions();
    unsubWalls();
    unsubDoors();
  };
}
