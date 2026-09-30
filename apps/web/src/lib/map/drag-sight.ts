/**
 * The floor layer's live scene during a Select-tool vertex drag, without a
 * per-move LoS rebuild (WI-193, SPEC-057 §4.2).
 *
 * The drag moves exactly one owner — a floor region, a wall or a door — and
 * the floor layer strokes `buildVectorScene`'s sight segments as its walls. A
 * full rebuild per pointer move reconciles every segment against every open
 * door, twice (sight and movement), and was ≈ 60% of a large dungeon's drag
 * frame (WI-192). But the reconciliation clips each segment independently of
 * every other (`clipOpenDoors`), so everything the drag does not touch can be
 * reconciled once, when the drag starts, and each move only reconciles what
 * it does:
 *
 *   - a region: its own perimeter, clipped by the open doors;
 *   - a wall:   its own segment, clipped by the open doors;
 *   - a door:   the cached segments clipped by that one door if it is open,
 *               or its own blocking segment appended if it is not.
 *
 * The result is the same segment set `buildVectorScene` would give the
 * displayed geometry (up to order, which the stroke pass does not see). It is
 * a render preview only: `movement` is never built here, and the committed
 * scene is rebuilt once, from the store, when the drag is released.
 */
import {
  vectorMap,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import type { RenderedScene } from './vector-engine';
import type { HandleOwner, OwnerRecord } from './vector-tools';

/** The committed geometry a drag started from — the subscribed arrays, not
 * the drag's display substitution. */
export interface DragSightBase {
  regions: readonly VectorFloorRegion[];
  walls: readonly StoredVectorWall[];
  doors: readonly VectorDoor[];
}

/** A blocking door's own segment, exactly as the build-time reconciliation
 * adds it. */
function doorSegment(door: VectorDoor): vectorMap.Segment {
  return { a: door.a, b: door.b, source: 'explicit', blocksSight: true, blocksMovement: true };
}

/**
 * Reconciles everything but `owner` once, and returns the per-move function
 * that adds the owner's working copy back. The returned function reads the
 * working copy afresh on every call, so a drag that mutates it in place (as
 * `updateSelectDrag` does) needs no new builder per move — only a new one
 * when the drag, or the committed arrays under it, change.
 */
export function createDragSight(
  base: DragSightBase,
  owner: HandleOwner,
): (working: OwnerRecord) => RenderedScene {
  const isOwner = (kind: HandleOwner['kind'], id: string) => owner.kind === kind && owner.id === id;
  // Copied once, here: the arrays a view passes in may be reactive proxies,
  // and the per-move function below should not read through them.
  const committedFloor = vectorMap.regionsToMultiPoly(base.regions);
  const ownerRegion = base.regions.findIndex((r) => isOwner('region', r.id));
  const staticWalls = base.walls.filter((w) => !isOwner('wall', w.id));
  const staticDoors = base.doors.filter((d) => !isOwner('door', d.id));
  // Like `displayState`, a drag whose owner has since been deleted (by a
  // peer, mid-drag) previews without it rather than resurrecting it.
  const ownerPresent =
    owner.kind === 'region'
      ? ownerRegion >= 0
      : owner.kind === 'wall'
        ? staticWalls.length < base.walls.length
        : staticDoors.length < base.doors.length;
  const openDoors = staticDoors.filter(vectorMap.doorPasses);
  const blocking = staticDoors.filter((d) => !vectorMap.doorPasses(d)).map(doorSegment);
  const staticSegs = vectorMap.clipOpenDoors(
    [
      ...vectorMap.perimeterSegments(committedFloor.filter((_, i) => i !== ownerRegion)),
      ...staticWalls.filter((w) => w.blocksSight),
    ],
    openDoors,
  );
  const committed: RenderedScene = { floor: committedFloor, sight: [...staticSegs, ...blocking] };

  return (working) => {
    if (!ownerPresent) return committed;
    if (owner.kind === 'region') {
      const region = working as VectorFloorRegion;
      return {
        floor: committedFloor.map((poly, i) => (i === ownerRegion ? region.rings : poly)),
        sight: [
          ...staticSegs,
          ...vectorMap.clipOpenDoors(vectorMap.perimeterSegments([region.rings]), openDoors),
          ...blocking,
        ],
      };
    }
    if (owner.kind === 'wall') {
      const wall = working as StoredVectorWall;
      return {
        floor: committedFloor,
        sight: [
          ...staticSegs,
          ...(wall.blocksSight ? vectorMap.clipOpenDoors([wall], openDoors) : []),
          ...blocking,
        ],
      };
    }
    const door = working as VectorDoor;
    return {
      floor: committedFloor,
      sight: vectorMap.doorPasses(door)
        ? [...vectorMap.clipOpenDoors(staticSegs, [door]), ...blocking]
        : [...staticSegs, ...blocking, doorSegment(door)],
    };
  };
}
