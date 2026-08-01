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
  type Drawing,
  type FloorRegionCommit,
  type MapRoom,
  type MapSymbol,
  type RoomMeasure,
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
  // Fog of war's revealed geometry (SPEC §4). Identical change shape to
  // `floorRegionBatch` — reveal/hide is the carve pipeline pointed at
  // `fogRegions` — so it rides the same undo stack with no new machinery.
  | { kind: 'fogRegionBatch'; changes: FloorRegionChange[] }
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
    case 'fogRegionBatch':
      return {
        kind: 'fogRegionBatch',
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
      if (commit.put.length || commit.delete.length)
        await store.commitFloorRegions(roomId, mapId, commit);
      break;
    }
    case 'fogRegionBatch': {
      const commit: FloorRegionCommit = {
        put: op.changes.filter((c) => c.to).map((c) => c.to!),
        delete: op.changes.filter((c) => !c.to).map((c) => c.id),
      };
      if (commit.put.length || commit.delete.length)
        await store.commitFogRegions(roomId, mapId, commit);
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
  return {
    kind: 'floorRegionBatch',
    changes: carveChanges(before, afterFloor, strokeBBox, makeId),
  };
}

/**
 * The same construction against the fog layer's revealed geometry (SPEC §4).
 * Reveal/hide strokes run through the identical `commitCarve` pipeline, so the
 * "delete every before-region the stroke touched, write every after-poly it
 * produced" reconstruction is literally the same — only the op kind (and hence
 * the target collection) differs.
 */
export function buildFogCarveOp(
  before: readonly VectorFloorRegion[],
  afterFog: vectorMap.MultiPoly,
  strokeBBox: vectorMap.BBox | null,
  makeId: () => string = () => nextVectorId('fog'),
): VectorEditorOp {
  return { kind: 'fogRegionBatch', changes: carveChanges(before, afterFog, strokeBBox, makeId) };
}

function carveChanges(
  before: readonly VectorFloorRegion[],
  after: vectorMap.MultiPoly,
  strokeBBox: vectorMap.BBox | null,
  makeId: () => string,
): FloorRegionChange[] {
  const changes: FloorRegionChange[] = [];
  if (!strokeBBox) return changes;
  for (const region of before) {
    if (vectorMap.bboxOverlaps(region.bbox, strokeBBox))
      changes.push({ id: region.id, from: region, to: null });
  }
  for (const poly of after) {
    const bbox = vectorMap.polyBBox(poly);
    if (!bbox || !vectorMap.bboxOverlaps(bbox, strokeBBox)) continue;
    const id = makeId();
    changes.push({ id, from: null, to: { id, rings: poly, bbox } });
  }
  return changes;
}

// ---- floor primitive stroke emission (SPEC §2.5) ----

export type FloorPrimitiveTool = 'room' | 'corridor' | 'path' | 'polygon' | 'ngon' | 'carve';

export interface FloorToolOptions {
  snap: vectorMap.VectorSnapMode;
  /** Path and Carve brush width, free-form. The Corridor has its own, because
   * it offers a fixed set of cell-sized runs rather than an arbitrary ribbon. */
  width: number;
  corridorWidth: number;
  sides: number;
}

/**
 * The tools whose points arrive **raw**, in lattice units, with no snapping
 * applied by the caller (SPEC-028). They anchor to cells rather than to lattice
 * vertices, so they need to know which cell the pointer was in — information
 * `snapPoint` has already thrown away by the time it returns a vertex. Every
 * other tool keeps taking pre-snapped points.
 */
export const CELL_ANCHORED_TOOLS: readonly FloorPrimitiveTool[] = ['room', 'corridor', 'ngon'];

export function isCellAnchoredTool(tool: string): tool is FloorPrimitiveTool {
  return (CELL_ANCHORED_TOOLS as readonly string[]).includes(tool);
}

/**
 * The cell (or half-cell) the targeted-cell indicator should highlight, in
 * lattice units, or null when there is nothing to highlight (SPEC-028).
 *
 * Room and Corridor only. Those are the tools whose committed shape *is* "the
 * cells you pointed at", so the highlight tells the whole truth. The N-gon
 * anchors to a cell too, but its shape extends well past it — highlighting its
 * centre cell would advertise the wrong extent, and its live ghost already
 * shows the real one.
 */
export function targetedCellFor(
  tool: string,
  snap: vectorMap.VectorSnapMode,
  at: Point | null,
): { x: number; y: number; size: number } | null {
  if (tool !== 'room' && tool !== 'corridor') return null;
  if (snap === 'free' || !at) return null;
  const cell = vectorMap.snapCell(at, snap);
  return { x: cell.x, y: cell.y, size: vectorMap.snapCellSize(snap) };
}

/** One shared point-stream → shape pipeline, six collectors (SPEC §2.5 plus the
 * freehand brush). Null means "not enough input yet to emit a shape" (e.g. a
 * Room before drag-end). */
export function buildFloorStroke(
  tool: FloorPrimitiveTool,
  opts: FloorToolOptions,
  dragStart: Point | null,
  dragCur: Point | null,
  collecting: readonly Point[],
  backend: vectorMap.BooleanBackend,
): vectorMap.MultiPoly | null {
  switch (tool) {
    case 'carve':
      return buildBrushStroke(opts, dragCur ? [...collecting, dragCur] : [...collecting], backend);
    case 'room': {
      if (!dragStart || !dragCur) return null;
      const p = vectorMap.cellRectPoly(dragStart, dragCur, opts.snap);
      return p ? [p] : null;
    }
    case 'corridor': {
      if (!dragStart || !dragCur) return null;
      const mp = vectorMap.corridorPoly(dragStart, dragCur, opts.corridorWidth, backend, opts.snap);
      return mp.length ? mp : null;
    }
    case 'ngon': {
      if (!dragStart || !dragCur) return null;
      // Drag start is the centre, and the drag *vector* carries both the size
      // and the orientation: its length is the radius across the flats, its
      // direction is where a flat face points.
      const dx = dragCur.x - dragStart.x;
      const dy = dragCur.y - dragStart.y;
      const p = vectorMap.ngonPoly({
        center: vectorMap.snapCellCenter(dragStart, opts.snap),
        acrossFlats: vectorMap.snapSpan(2 * Math.hypot(dx, dy), opts.snap),
        sides: opts.sides,
        faceAngle: vectorMap.snapAngle(Math.atan2(dy, dx), opts.snap),
      });
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

/**
 * Hard ceiling on how many lattice cells one snapped brush stroke may paint.
 * A snapped brush iterates the cells inside its stroke's bbox, so a very wide
 * brush dragged across a big map is the one input that could blow up that
 * loop. `MAX_FLOOR_EXTENT` guards the committed *floor*, not the stroke, so
 * this is the stroke-side equivalent: past the cap the stroke simply stops
 * growing rather than locking the tab.
 */
export const MAX_BRUSH_CELLS = 20000;

/**
 * The freehand carve brush's stroke. The snap level picks the *shape*, which
 * is the whole point of the tool:
 *
 *  - `free` buffers the sampled polyline into a smooth ribbon — the same
 *    `bufferPolyline` offset the Path tool uses, so a freehand carve reads as
 *    one continuous organic passage.
 *  - `full` / `half` paint whole lattice cells: every cell whose centre falls
 *    within the brush radius of the stroke, unioned. A snapped brush therefore
 *    produces grid-true blocky geometry rather than a rounded blob, which is
 *    what a snapped tool is for.
 *
 * The radius has a `step / 2` floor so a brush narrower than one cell still
 * paints the cell it is dragged through instead of emitting nothing.
 */
function buildBrushStroke(
  opts: FloorToolOptions,
  points: readonly Point[],
  backend: vectorMap.BooleanBackend,
): vectorMap.MultiPoly | null {
  if (!points.length) return null;

  if (opts.snap === 'free') {
    const mp = vectorMap.bufferPolyline([...points], opts.width, backend);
    return mp.length ? mp : null;
  }

  const step = vectorMap.snapCellSize(opts.snap);
  const radius = Math.max(opts.width / 2, step / 2);

  // Only the cells inside the stroke's inflated bbox can possibly be painted.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const x0 = Math.floor((minX - radius) / step) * step;
  const y0 = Math.floor((minY - radius) / step) * step;
  const x1 = Math.ceil((maxX + radius) / step) * step;
  const y1 = Math.ceil((maxY + radius) / step) * step;

  const squares: vectorMap.Poly[] = [];
  for (let y = y0; y < y1 && squares.length < MAX_BRUSH_CELLS; y += step) {
    for (let x = x0; x < x1 && squares.length < MAX_BRUSH_CELLS; x += step) {
      const cx = x + step / 2;
      const cy = y + step / 2;
      if (!withinBrush({ x: cx, y: cy }, points, radius)) continue;
      const square = vectorMap.rectPoly({ x, y }, { x: x + step, y: y + step });
      if (square) squares.push(square);
    }
  }
  if (!squares.length) return null;
  const mp = backend.union([], squares);
  return mp.length ? mp : null;
}

/** True when `p` is within `radius` of the brush's sampled polyline. A
 * single-sample stroke (a click without a drag) degenerates to a point test. */
function withinBrush(p: Point, points: readonly Point[], radius: number): boolean {
  if (points.length === 1) return distToPoint(p, points[0]!) <= radius;
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSeg(p, points[i]!, points[i + 1]!) <= radius) return true;
  }
  return false;
}

// ---- live dimension readout (drawing feedback) ----

/** Where and what to print next to an in-progress stroke. */
export interface StrokeMeasure {
  text: string;
  /** Lattice-space anchor; the renderer offsets it in screen pixels. */
  at: Point;
}

/**
 * The "how big is this going to be" overlay shown *while* a click-and-drag
 * shape is being dragged. Room and Corridor report their bounding box as
 * `w × h`; N-gon reports `radius:` (its drag is a radius, not a box). The
 * multipoint and brush tools have no single meaningful dimension, so they get
 * nothing.
 *
 * `measure` is the map's `RoomMeasure` ({@link RoomMeasure}, e.g. 10 feet per
 * square), so the referee reads the size in the units their table actually
 * uses rather than in raw lattice cells; passing `null` falls back to cells.
 * Returns `null` for a degenerate (zero-size) drag so the chip doesn't flash
 * a "0 × 0" on pointer-down.
 */
export function strokeMeasureText(
  tool: FloorPrimitiveTool,
  dragStart: Point | null,
  dragCur: Point | null,
  measure: RoomMeasure | null,
  snap: vectorMap.VectorSnapMode = 'free',
): StrokeMeasure | null {
  if (!dragStart || !dragCur) return null;
  const at = { x: (dragStart.x + dragCur.x) / 2, y: (dragStart.y + dragCur.y) / 2 };

  if (tool === 'room' || tool === 'corridor') {
    // The readout has to describe the shape that will commit, not the distance
    // the hand travelled. Under cell anchoring those differ: a drag from one
    // cell to the next covers two cells, and a click that never moves still
    // covers one.
    const span = (a: number, b: number): number => {
      if (snap === 'free') return Math.abs(b - a);
      const step = vectorMap.snapCellSize(snap);
      const lo = vectorMap.snapCell({ x: Math.min(a, b), y: 0 }, snap).x;
      const hi = vectorMap.snapCell({ x: Math.max(a, b), y: 0 }, snap).x + step;
      return hi - lo;
    };
    const w = span(dragStart.x, dragCur.x);
    const h = span(dragStart.y, dragCur.y);
    if (w < MEASURE_EPSILON && h < MEASURE_EPSILON) return null;
    return { text: `${formatSpan(w, measure)} × ${formatSpan(h, measure, true)}`, at };
  }
  if (tool === 'ngon') {
    // Diameter, not radius: the N-gon is authored and snapped across its flats
    // (SPEC-028), so the radius is no longer the number the referee is steering.
    const d = vectorMap.snapSpan(
      2 * Math.hypot(dragCur.x - dragStart.x, dragCur.y - dragStart.y),
      snap,
    );
    if (d < MEASURE_EPSILON) return null;
    return { text: `⌀ ${formatSpan(d, measure, true)}`, at };
  }
  return null;
}

/**
 * The Measure tool's readout: the straight-line distance between two points,
 * in the same units and with the same rounding as the drag dimension chip
 * above, so the two never disagree about how big a span is. Returns `null` for
 * a zero-length drag so the chip doesn't flash a "0" on pointer-down.
 */
export function measureSpanText(
  a: Point | null,
  b: Point | null,
  measure: RoomMeasure | null,
): StrokeMeasure | null {
  if (!a || !b) return null;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < MEASURE_EPSILON) return null;
  return {
    text: formatSpan(d, measure, true),
    at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

const MEASURE_EPSILON = 1e-6;

/** One span in game units, with the unit name appended only once per readout
 * (`20 × 30 feet`, not `20 feet × 30 feet`). */
function formatSpan(cells: number, measure: RoomMeasure | null, withUnit = false): string {
  const value = measure ? cells * measure.perSquare : cells;
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return withUnit && measure ? `${text} ${measure.unit}` : text;
}

/** The stroke's bbox — the only area a carve commit can have changed. */
export function strokeBBoxOf(strokes: vectorMap.MultiPoly | null): vectorMap.BBox | null {
  if (!strokes || !strokes.length) return null;
  const boxes = strokes
    .map((poly) => vectorMap.polyBBox(poly))
    .filter((b): b is vectorMap.BBox => !!b);
  return vectorMap.unionBBox(boxes);
}

/**
 * Soft bounded-extent guard for the vector floor (D3,
 * `docs/VTT_Master_Plan.md` Part V §2). The old cellular grid-shrink guard
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
export function buildWallPreviewSegs(
  collecting: readonly Point[],
  dragCur: Point | null,
): vectorMap.Segment[] {
  if (!collecting.length) return [];
  const pts = dragCur ? [...collecting, dragCur] : [...collecting];
  const segs: vectorMap.Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({
      a: pts[i]!,
      b: pts[i + 1]!,
      source: 'explicit',
      blocksSight: true,
      blocksMovement: true,
    });
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
      to: {
        id,
        a: points[i]!,
        b: points[i + 1]!,
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      },
    });
  }
  return { kind: 'wallsBatch', changes };
}

/** Live preview segment for the Door tool's first-click→cursor span. */
export function buildDoorPreviewSeg(
  first: Point | null,
  dragCur: Point | null,
): vectorMap.Segment | null {
  if (!first || !dragCur) return null;
  return { a: first, b: dragCur, source: 'explicit', blocksSight: true, blocksMovement: true };
}

// ---- Select tool: handle picking + geometric edit (SPEC §9.1 "Select-tool
// identity finding" / DECISIONS.md#model-a) ----

export type HandleOwner =
  { kind: 'region'; id: string } | { kind: 'wall'; id: string } | { kind: 'door'; id: string };

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
    out.push({
      owner: { kind: 'door', id: d.id },
      a: d.a,
      b: d.a,
      locate: (o) => [(o as VectorDoor).a],
    });
    out.push({
      owner: { kind: 'door', id: d.id },
      a: d.b,
      b: d.b,
      locate: (o) => [(o as VectorDoor).b],
    });
  }
  for (const w of walls) {
    out.push({
      owner: { kind: 'wall', id: w.id },
      a: w.a,
      b: w.a,
      locate: (o) => [(o as StoredVectorWall).a],
    });
    out.push({
      owner: { kind: 'wall', id: w.id },
      a: w.b,
      b: w.b,
      locate: (o) => [(o as StoredVectorWall).b],
    });
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

export function pickVertexHandle(
  point: Point,
  handles: readonly Handle[],
  threshold: number,
): Handle | null {
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

export function pickEdgeHandle(
  point: Point,
  handles: readonly Handle[],
  threshold: number,
): Handle | null {
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

// ---- Select tool "Object" mode: whole-object pick for symbols/labels/
// doors/annotations (distinct from the vertex/edge geometric-edit handles
// above, which only ever touch floor/wall/door endpoints). ----

export type ObjectKind = 'symbol' | 'mapRoom' | 'door' | 'drawing';
export interface ObjectSelection {
  kind: ObjectKind;
  id: string;
}

/**
 * The room label under a lattice-space point, or null.
 *
 * A label occupies its anchor cell's *interior* (the renderer draws it at
 * `labelAnchor + 0.5`), so this hit-tests that cell — the same shape as the
 * symbol test in `pickObject`. An earlier vertex-centred distance test sat half
 * a cell up-left of the label the user could actually see.
 *
 * Shared by `pickObject` (Select → Object) and the map's label hover tooltip,
 * so a label you can click is exactly a label you can hover.
 */
export function pickMapRoomAt(point: Point, mapRooms: readonly MapRoom[]): MapRoom | null {
  for (const r of mapRooms) {
    if (
      point.x >= r.labelAnchor.x &&
      point.x <= r.labelAnchor.x + 1 &&
      point.y >= r.labelAnchor.y &&
      point.y <= r.labelAnchor.y + 1
    ) {
      return r;
    }
  }
  return null;
}

/** `point` is lattice-space (like every other pick helper here); `Drawing.points`
 * are pixel-space (a pre-existing inconsistency carried over from the cellular
 * annotation model — not something this picker changes), so drawings are
 * matched by converting `point` to pixel space via `cellSize` instead.
 * Priority: symbols → labels → doors → drawings (small precise targets
 * first, mirroring `vertexHandles`'/`edgeHandles`' doors-first ordering). */
export function pickObject(
  point: Point,
  cellSize: number,
  data: {
    symbols: readonly MapSymbol[];
    mapRooms: readonly MapRoom[];
    doors: readonly VectorDoor[];
    drawings: readonly Drawing[];
  },
  latticeThreshold: number,
): ObjectSelection | null {
  for (const s of data.symbols) {
    const span = s.cellSpan ?? { w: 1, h: 1 };
    if (
      point.x >= s.cell.x &&
      point.x <= s.cell.x + span.w &&
      point.y >= s.cell.y &&
      point.y <= s.cell.y + span.h
    ) {
      return { kind: 'symbol', id: s.id };
    }
  }
  const room = pickMapRoomAt(point, data.mapRooms);
  if (room) return { kind: 'mapRoom', id: room.id };
  for (const d of data.doors) {
    if (distToSeg(point, d.a, d.b) < latticeThreshold) {
      return { kind: 'door', id: d.id };
    }
  }
  const px = { x: point.x * cellSize, y: point.y * cellSize };
  const pad = latticeThreshold * cellSize;
  for (const dr of data.drawings) {
    if (!dr.points.length) continue;
    const xs = dr.points.map((p) => p.x);
    const ys = dr.points.map((p) => p.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    if (px.x >= minX && px.x <= maxX && px.y >= minY && px.y <= maxY) {
      return { kind: 'drawing', id: dr.id };
    }
  }
  return null;
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
export function buildDragOp(
  owner: HandleOwner,
  before: OwnerRecord,
  after: OwnerRecord,
): VectorEditorOp {
  if (owner.kind === 'region') {
    return {
      kind: 'floorRegionBatch',
      changes: [
        { id: owner.id, from: before as VectorFloorRegion, to: after as VectorFloorRegion },
      ],
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
