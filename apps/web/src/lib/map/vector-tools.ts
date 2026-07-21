/**
 * Vector Map editor (WI-D) — pure, framework-free tool logic. Ports the proven
 * POC interactions (originally `poc/vector-floor/sandbox/src/app.ts`, since
 * deleted) onto the real `CampaignStore` (WI-B) instead of an in-memory
 * sandbox `MapState`:
 *
 *  - Stroke → shape emission for the five §2.5 primitives + the §2.4 hole tool,
 *    reusing `vectorMap`'s shared carve pipeline unchanged.
 *  - Snapshot-batch undo/redo (SPEC §8.5): every commit becomes a
 *    `VectorEditorOp` carrying `{ id, from, to }` pairs — `to: null` is a
 *    delete, `from: null` is a create — the same shape the cellular editor's
 *    `EditorOp` already uses (`map/tools.ts`), so it rides the existing
 *    generic `UndoStack<Op>` (`map/undo.ts`) unchanged.
 *  - Select-tool geometric edits (drag a floor vertex/edge, a wall endpoint, a
 *    door endpoint) mutate a cloned *working copy* of just the touched record
 *    — never the live subscribed arrays — so a drag-in-progress never fights
 *    the store subscription that owns those arrays.
 *
 * No Pixi, no DOM, no Firestore/RTDB wire types beyond what `CampaignStore`
 * already exposes — everything here is unit-testable in isolation.
 */
import {
  vectorMap,
  type CampaignStore,
  type FloorRegionCommit,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';

export type Point = vectorMap.Point;

// ---- undo/redo op model (SPEC §8.5) ----

export interface FloorRegionChange {
  id: string;
  from: VectorFloorRegion | null;
  to: VectorFloorRegion | null;
}

export interface WallSegmentChange {
  id: string;
  from: StoredVectorWall | null;
  to: StoredVectorWall | null;
}

export type VectorEditorOp =
  | { kind: 'floorRegionBatch'; changes: FloorRegionChange[] }
  | { kind: 'wallsBatch'; changes: WallSegmentChange[] }
  | { kind: 'door'; id: string; from: VectorDoor | null; to: VectorDoor | null };

export function isNoopVectorOp(op: VectorEditorOp): boolean {
  if (op.kind === 'door') return op.from === op.to;
  return op.changes.length === 0;
}

export function invertVectorOp(op: VectorEditorOp): VectorEditorOp {
  switch (op.kind) {
    case 'floorRegionBatch':
      return {
        kind: 'floorRegionBatch',
        changes: op.changes.map((c) => ({ id: c.id, from: c.to, to: c.from })),
      };
    case 'wallsBatch':
      return {
        kind: 'wallsBatch',
        changes: op.changes.map((c) => ({ id: c.id, from: c.to, to: c.from })),
      };
    case 'door':
      return { kind: 'door', id: op.id, from: op.to, to: op.from };
  }
}

/** Applies an op forward through the store — undo/redo both call this (undo
 * on `invertVectorOp(op)`, redo on `op` unchanged), mirroring the cellular
 * `commitOpForward`/`invertOp` pattern in `MapView.svelte`. */
export async function commitVectorOpForward(
  store: CampaignStore,
  roomId: string,
  mapId: string,
  op: VectorEditorOp,
): Promise<void> {
  switch (op.kind) {
    case 'floorRegionBatch': {
      const commit: FloorRegionCommit = {
        put: op.changes.filter((c) => c.to).map((c) => c.to!),
        delete: op.changes.filter((c) => !c.to).map((c) => c.id),
      };
      if (commit.put.length || commit.delete.length) await store.commitFloorRegions(roomId, mapId, commit);
      break;
    }
    case 'wallsBatch': {
      const put = op.changes.filter((c) => c.to).map((c) => c.to!);
      const del = op.changes.filter((c) => !c.to).map((c) => c.id);
      if (put.length) await store.setWalls(roomId, mapId, put);
      if (del.length) await store.removeWalls(roomId, mapId, del);
      break;
    }
    case 'door':
      if (op.to) await store.setDoor(roomId, mapId, op.to);
      else if (op.id) await store.removeDoor(roomId, mapId, op.id);
      break;
  }
}

let idCounter = 0;
/** New doc ids are assigned client-side (same convention as the cellular
 * editor's `sw-${Date.now()}`/`cw-${Date.now()}`) — a counter suffix keeps ids
 * unique within one multi-segment gesture landing in the same millisecond. */
export function nextVectorId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// ---- carve/hole commit → floorRegionBatch op (SPEC §5.5/§8.5) ----

/**
 * Turns a carve pipeline result into a `floorRegionBatch` op. Model A (baked
 * union, no retained identity — DECISIONS.md#model-a) means a stroke can't be
 * matched 1:1 against the region(s) it touched, so this rebuilds the
 * "put the survivor(s), delete the absorbed" batch from bbox overlap instead:
 * every *before* region whose bbox overlapped the stroke is deleted, and every
 * poly in the *after* floor whose bbox overlaps the stroke becomes a new
 * region. Regions untouched by the stroke never appear in the op — the
 * pipeline (`commitCarve`/`simplifyAffected`) already guarantees they pass
 * through byte-identical, so there is nothing to write for them.
 */
export function buildCarveOp(
  before: readonly VectorFloorRegion[],
  afterFloor: vectorMap.MultiPoly,
  strokeBBox: vectorMap.BBox | null,
  makeId: () => string = () => nextVectorId('region'),
): VectorEditorOp {
  const changes: FloorRegionChange[] = [];
  if (!strokeBBox) return { kind: 'floorRegionBatch', changes };
  for (const region of before) {
    if (vectorMap.bboxOverlaps(region.bbox, strokeBBox)) changes.push({ id: region.id, from: region, to: null });
  }
  for (const poly of afterFloor) {
    const bbox = vectorMap.polyBBox(poly);
    if (!bbox || !vectorMap.bboxOverlaps(bbox, strokeBBox)) continue;
    const id = makeId();
    changes.push({ id, from: null, to: { id, rings: poly, bbox } });
  }
  return { kind: 'floorRegionBatch', changes };
}

// ---- floor primitive stroke emission (SPEC §2.5) ----

export type FloorPrimitiveTool = 'room' | 'corridor' | 'path' | 'polygon' | 'ngon';

export interface FloorToolOptions {
  snap: vectorMap.VectorSnapMode;
  width: number;
  sides: number;
}

/** One shared point-stream → shape pipeline, five collectors (SPEC §2.5). Null
 * means "not enough input yet to emit a shape" (e.g. a Room before drag-end). */
export function buildFloorStroke(
  tool: FloorPrimitiveTool,
  opts: FloorToolOptions,
  dragStart: Point | null,
  dragCur: Point | null,
  collecting: readonly Point[],
  backend: vectorMap.BooleanBackend,
): vectorMap.MultiPoly | null {
  switch (tool) {
    case 'room': {
      if (!dragStart || !dragCur) return null;
      const p = vectorMap.rectPoly(dragStart, dragCur);
      return p ? [p] : null;
    }
    case 'corridor': {
      if (!dragStart || !dragCur) return null;
      const mp = vectorMap.corridorPoly(dragStart, dragCur, opts.width, backend, opts.snap !== 'free');
      return mp.length ? mp : null;
    }
    case 'ngon': {
      if (!dragStart || !dragCur) return null;
      const r = Math.hypot(dragCur.x - dragStart.x, dragCur.y - dragStart.y);
      const p = vectorMap.regularPoly(dragStart, r, opts.sides);
      return p ? [p] : null;
    }
    case 'path': {
      if (!collecting.length) return null;
      const pts = dragCur ? [...collecting, dragCur] : [...collecting];
      const mp = vectorMap.bufferPolyline(pts, opts.width, backend);
      return mp.length ? mp : null;
    }
    case 'polygon': {
      if (collecting.length < 2) return null;
      const pts = dragCur ? [...collecting, dragCur] : [...collecting];
      const p = vectorMap.polygonPoly(pts);
      return p ? [p] : null;
    }
  }
}

/** The stroke's bbox — the only area a carve commit can have changed. */
export function strokeBBoxOf(strokes: vectorMap.MultiPoly | null): vectorMap.BBox | null {
  if (!strokes || !strokes.length) return null;
  const boxes = strokes.map((poly) => vectorMap.polyBBox(poly)).filter((b): b is vectorMap.BBox => !!b);
  return vectorMap.unionBBox(boxes);
}

/**
 * Soft bounded-extent guard for the vector floor (D3,
 * `docs/VectorMapSystem_Decisions.md`). The old cellular grid-shrink guard
 * (`SessionActivity.svelte`'s `carvedBoundingBox`/`grid.w`/`grid.h` check)
 * assumed a bounded cell grid to shrink against; a vector floor is an
 * unbounded set of polygon regions with no such ceiling, so that guard is
 * replaced by a max bounding-box dimension on the floor's own union, checked
 * at carve-commit time. 2000 lattice units is a generous ceiling for a
 * dungeon map — SPEC §8.2 caps realistic maps at ~8 regions of a handful of
 * cells each (tens of lattice units), and FINDINGS.md's perf numbers were
 * measured well under this — so this is a safety backstop against a runaway
 * stroke/import, not a bound a normal map should ever approach.
 */
export const MAX_FLOOR_EXTENT = 2000;

/** True if `bbox`'s larger dimension exceeds `MAX_FLOOR_EXTENT` — the editor
 * blocks the commit and surfaces an error rather than silently truncating
 * (D3). `null` (empty floor) never exceeds it. */
export function exceedsMaxFloorExtent(bbox: vectorMap.BBox | null): boolean {
  if (!bbox) return false;
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  return Math.max(w, h) > MAX_FLOOR_EXTENT;
}

// ---- wall / door preview (SPEC §3.1/§3.2) ----

/** Live preview segments for the Wall tool's in-progress polyline. */
export function buildWallPreviewSegs(collecting: readonly Point[], dragCur: Point | null): vectorMap.Segment[] {
  if (!collecting.length) return [];
  const pts = dragCur ? [...collecting, dragCur] : [...collecting];
  const segs: vectorMap.Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({ a: pts[i]!, b: pts[i + 1]!, source: 'explicit', blocksSight: true, blocksMovement: true });
  }
  return segs;
}

/** Turns a finished Wall-tool polyline into a `wallsBatch` op (a full
 * drag-run lands as one gesture / one batch write). */
export function buildWallRunOp(points: readonly Point[]): VectorEditorOp {
  const changes: WallSegmentChange[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const id = nextVectorId('wall');
    changes.push({
      id,
      from: null,
      to: { id, a: points[i]!, b: points[i + 1]!, source: 'explicit', blocksSight: true, blocksMovement: true },
    });
  }
  return { kind: 'wallsBatch', changes };
}

/** Live preview segment for the Door tool's first-click→cursor span. */
export function buildDoorPreviewSeg(first: Point | null, dragCur: Point | null): vectorMap.Segment | null {
  if (!first || !dragCur) return null;
  return { a: first, b: dragCur, source: 'explicit', blocksSight: true, blocksMovement: true };
}

// ---- Select tool: handle picking + geometric edit (SPEC §9.1 "Select-tool
// identity finding" / DECISIONS.md#model-a) ----

export type HandleOwner =
  | { kind: 'region'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'door'; id: string };

type OwnerRecord = VectorFloorRegion | StoredVectorWall | VectorDoor;

export interface Handle {
  owner: HandleOwner;
  /** Render-space endpoints (a === b for a vertex handle). */
  a: Point;
  b: Point;
  /** Re-resolves this handle's live point(s) against a (typically cloned)
   * copy of the owner's record, so a drag can mutate a working copy instead
   * of the subscribed source-of-truth array. One point for a vertex handle,
   * two for an edge handle. */
  locate: (owner: OwnerRecord) => Point[];
}

export function findOwnerRecord(
  owner: HandleOwner,
  regions: readonly VectorFloorRegion[],
  walls: readonly StoredVectorWall[],
  doors: readonly VectorDoor[],
): OwnerRecord | null {
  if (owner.kind === 'region') return regions.find((r) => r.id === owner.id) ?? null;
  if (owner.kind === 'wall') return walls.find((w) => w.id === owner.id) ?? null;
  return doors.find((d) => d.id === owner.id) ?? null;
}

/** Doors → walls → floor priority (matches the POC — doors/walls are small,
 * precise targets that would otherwise be shadowed by the floor boundary
 * they sit on). */
export function vertexHandles(
  regions: readonly VectorFloorRegion[],
  walls: readonly StoredVectorWall[],
  doors: readonly VectorDoor[],
): Handle[] {
  const out: Handle[] = [];
  for (const d of doors) {
    out.push({ owner: { kind: 'door', id: d.id }, a: d.a, b: d.a, locate: (o) => [(o as VectorDoor).a] });
    out.push({ owner: { kind: 'door', id: d.id }, a: d.b, b: d.b, locate: (o) => [(o as VectorDoor).b] });
  }
  for (const w of walls) {
    out.push({ owner: { kind: 'wall', id: w.id }, a: w.a, b: w.a, locate: (o) => [(o as StoredVectorWall).a] });
    out.push({ owner: { kind: 'wall', id: w.id }, a: w.b, b: w.b, locate: (o) => [(o as StoredVectorWall).b] });
  }
  for (const region of regions) {
    region.rings.forEach((ring, ri) => {
      ring.forEach((p, pi) => {
        out.push({
          owner: { kind: 'region', id: region.id },
          a: p,
          b: p,
          locate: (o) => [(o as VectorFloorRegion).rings[ri]![pi]!],
        });
      });
    });
  }
  return out;
}

export function edgeHandles(
  regions: readonly VectorFloorRegion[],
  walls: readonly StoredVectorWall[],
  doors: readonly VectorDoor[],
): Handle[] {
  const out: Handle[] = [];
  for (const d of doors) {
    out.push({
      owner: { kind: 'door', id: d.id },
      a: d.a,
      b: d.b,
      locate: (o) => [(o as VectorDoor).a, (o as VectorDoor).b],
    });
  }
  for (const w of walls) {
    out.push({
      owner: { kind: 'wall', id: w.id },
      a: w.a,
      b: w.b,
      locate: (o) => [(o as StoredVectorWall).a, (o as StoredVectorWall).b],
    });
  }
  for (const region of regions) {
    region.rings.forEach((ring, ri) => {
      ring.forEach((a, pi) => {
        const bi = (pi + 1) % ring.length;
        const b = ring[bi]!;
        out.push({
          owner: { kind: 'region', id: region.id },
          a,
          b,
          locate: (o) => {
            const r = (o as VectorFloorRegion).rings[ri]!;
            return [r[pi]!, r[bi]!];
          },
        });
      });
    });
  }
  return out;
}

export function distToPoint(p: Point, a: Point): number {
  return Math.hypot(p.x - a.x, p.y - a.y);
}

export function distToSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pickVertexHandle(point: Point, handles: readonly Handle[], threshold: number): Handle | null {
  let best: Handle | null = null;
  let bestD = threshold;
  for (const h of handles) {
    const d = distToPoint(point, h.a);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

export function pickEdgeHandle(point: Point, handles: readonly Handle[], threshold: number): Handle | null {
  let best: Handle | null = null;
  let bestD = threshold;
  for (const h of handles) {
    const d = distToSeg(point, h.a, h.b);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** Recomputes a region's derived bbox after a geometric edit (§2.1 — "derived,
 * never hand-edited"). Falls back to the stale bbox for a degenerate ring
 * rather than producing an invalid one. */
export function recomputeRegionBBox(region: VectorFloorRegion): VectorFloorRegion {
  const bbox = vectorMap.polyBBox(region.rings) ?? region.bbox;
  return { ...region, bbox };
}

/** Builds the undo-able op for a finished Select-tool drag: `before` is the
 * pre-drag snapshot captured at pointerdown, `after` is the mutated working
 * copy at pointerup (region bboxes must already be recomputed — see
 * `recomputeRegionBBox`). */
export function buildDragOp(owner: HandleOwner, before: OwnerRecord, after: OwnerRecord): VectorEditorOp {
  if (owner.kind === 'region') {
    return {
      kind: 'floorRegionBatch',
      changes: [{ id: owner.id, from: before as VectorFloorRegion, to: after as VectorFloorRegion }],
    };
  }
  if (owner.kind === 'wall') {
    return {
      kind: 'wallsBatch',
      changes: [{ id: owner.id, from: before as StoredVectorWall, to: after as StoredVectorWall }],
    };
  }
  return { kind: 'door', id: owner.id, from: before as VectorDoor, to: after as VectorDoor };
}
