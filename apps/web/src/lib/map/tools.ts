import {
  type Cell,
  type CircleWall,
  type Drawing,
  FloorGrid,
  FogGrid,
  type MapRoom,
  type MapSymbol,
  type MapWall,
  type SightWall,
} from '@osr-vtt/shared';

/**
 * Tool catalog (Map Tooling Spec §3). Pan/Zoom/Ruler/Ping live directly in
 * the engine/MapView pointer handling; every other tool goes through the op
 * builders below so every mutation is undoable and syncs the same way
 * whether it's applied locally or via undo/redo.
 */
export type ToolId =
  | 'pan'
  | 'carve'
  | 'fill'
  | 'corridor'
  | 'ellipse'
  | 'polygon'
  | 'wall'
  | 'wallCircle'
  | 'door'
  | 'symbol'
  | 'label'
  | 'select'
  | 'ruler'
  | 'ping'
  | 'fogEraser'
  | 'annotate';

export interface CellPatch {
  cell: Cell;
  from: boolean;
  to: boolean;
}

/** A reversible unit of editor history. Each variant carries enough of the
 * "before" state to build its own inverse (Spec §5: "carving/filling are
 * idempotent and forgiving... re-doing does no harm"). */
export type EditorOp =
  | { kind: 'floor'; patches: CellPatch[] }
  | { kind: 'fog'; patches: CellPatch[] }
  | { kind: 'wall'; edgeId: string; from: MapWall | null; to: MapWall | null }
  /** A wall drag-run's batch commit (Master Plan v2, R9.2) — every edge in
   * one gesture undoes/redoes as a single step, and replays through exactly
   * one `setWalls`/`removeWalls` batch call (never one write per edge). */
  | { kind: 'wallBatch'; changes: { edgeId: string; from: MapWall | null; to: MapWall | null }[] }
  /** A diagonal vector wall placed by the Wall tool (Master Plan v2, R9.2). */
  | { kind: 'sightWall'; id: string; from: SightWall | null; to: SightWall | null }
  /** A circular wall placed/edited by the `wallCircle` tool (Master Plan v2,
   * R10.5). A "cut a gap" edit is a `from`/`to` replace of the same doc, so it
   * undoes/redoes as one step through the same `setCircleWall` upsert. */
  | { kind: 'circleWall'; id: string; from: CircleWall | null; to: CircleWall | null }
  | { kind: 'symbol'; id: string; from: MapSymbol | null; to: MapSymbol | null }
  | { kind: 'mapRoom'; id: string; from: MapRoom | null; to: MapRoom | null }
  /** A renumber/reorder that rewrites several map rooms' keys at once (Master
   * Plan v2, R13.3 / WI-20). Every changed room is an upsert (`to` is always
   * non-null), so it replays through one pass and undoes/redoes as a single
   * history step, mirroring `wallBatch`. */
  | { kind: 'mapRoomBatch'; changes: { id: string; from: MapRoom; to: MapRoom }[] }
  | { kind: 'tokenSize'; tokenId: string; from: number; to: number }
  | { kind: 'drawing'; id: string; from: Drawing | null; to: Drawing | null };

export function invertOp(op: EditorOp): EditorOp {
  switch (op.kind) {
    case 'floor':
      return { kind: 'floor', patches: op.patches.map((p) => ({ cell: p.cell, from: p.to, to: p.from })) };
    case 'fog':
      return { kind: 'fog', patches: op.patches.map((p) => ({ cell: p.cell, from: p.to, to: p.from })) };
    case 'wall':
      return { kind: 'wall', edgeId: op.edgeId, from: op.to, to: op.from };
    case 'wallBatch':
      return {
        kind: 'wallBatch',
        changes: op.changes.map((c) => ({ edgeId: c.edgeId, from: c.to, to: c.from })),
      };
    case 'sightWall':
      return { kind: 'sightWall', id: op.id, from: op.to, to: op.from };
    case 'circleWall':
      return { kind: 'circleWall', id: op.id, from: op.to, to: op.from };
    case 'symbol':
      return { kind: 'symbol', id: op.id, from: op.to, to: op.from };
    case 'mapRoom':
      return { kind: 'mapRoom', id: op.id, from: op.to, to: op.from };
    case 'mapRoomBatch':
      return {
        kind: 'mapRoomBatch',
        changes: op.changes.map((c) => ({ id: c.id, from: c.to, to: c.from })),
      };
    case 'tokenSize':
      return { kind: 'tokenSize', tokenId: op.tokenId, from: op.to, to: op.from };
    case 'drawing':
      return { kind: 'drawing', id: op.id, from: op.to, to: op.from };
  }
}

/** True if applying this op would be a no-op (e.g. re-carving cells that are
 * already floor) — callers should skip pushing these onto undo history. */
export function isNoopOp(op: EditorOp): boolean {
  if (op.kind === 'floor' || op.kind === 'fog') return op.patches.length === 0;
  if (op.kind === 'wallBatch' || op.kind === 'mapRoomBatch') return op.changes.length === 0;
  return false;
}

/** Carve (value=true) or Fill (value=false) a set of cells against the
 * grid's current state, producing both the next grid and the undoable op. */
export function buildFloorOp(
  grid: FloorGrid,
  cells: readonly Cell[],
  value: boolean,
): { op: EditorOp; grid: FloorGrid; touchedChunks: string[] } {
  const patches: CellPatch[] = cells
    .map((cell) => ({ cell, from: grid.isFloor(cell), to: value }))
    .filter((p) => p.from !== p.to);
  const { grid: nextGrid, touchedChunks } = grid.setCells(cells, value);
  return { op: { kind: 'floor', patches }, grid: nextGrid, touchedChunks };
}

/** FoW eraser reveal — only meaningful in `manual` fog mode. */
export function buildFogOp(
  grid: FogGrid,
  cells: readonly Cell[],
  value = true,
): { op: EditorOp; grid: FogGrid; touchedChunks: string[] } {
  const patches: CellPatch[] = cells
    .map((cell) => ({ cell, from: grid.isRevealed(cell), to: value }))
    .filter((p) => p.from !== p.to);
  const { grid: nextGrid, touchedChunks } = grid.reveal(cells, value);
  return { op: { kind: 'fog', patches }, grid: nextGrid, touchedChunks };
}

/** Applies a floor op's patches onto a grid — used to replay both undo
 * (inverted op) and redo (original op) through the same code path. */
export function applyFloorOp(grid: FloorGrid, op: EditorOp & { kind: 'floor' }): FloorGrid {
  const toCarve = op.patches.filter((p) => p.to).map((p) => p.cell);
  const toFill = op.patches.filter((p) => !p.to).map((p) => p.cell);
  let next = grid;
  if (toCarve.length) next = next.setCells(toCarve, true).grid;
  if (toFill.length) next = next.setCells(toFill, false).grid;
  return next;
}

export function applyFogOp(grid: FogGrid, op: EditorOp & { kind: 'fog' }): FogGrid {
  const toReveal = op.patches.filter((p) => p.to).map((p) => p.cell);
  const toHide = op.patches.filter((p) => !p.to).map((p) => p.cell);
  let next = grid;
  if (toReveal.length) next = next.reveal(toReveal, true).grid;
  if (toHide.length) next = next.reveal(toHide, false).grid;
  return next;
}

/** Next auto-incrementing map-room key given existing keys (Spec §3 "Label /
 * Key... auto-incrementing key (1, 2, 3, 2a…)"). Only produces the plain
 * numeric series — sub-lettering (2a) is a manual rename, not automated. */
export function nextMapRoomKey(existingKeys: readonly string[]): string {
  const numeric = existingKeys
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n));
  const max = numeric.length ? Math.max(...numeric) : 0;
  return String(max + 1);
}

// ---- Rooms manager helpers (Master Plan v2, R17.2 / R13.3 / WI-20) ----

/** The cell count shown per room in the Rooms manager. A `MapRoom` persists a
 * flood-filled region only as its bounding `bbox` (the exact cell set isn't
 * stored — see the `label` tool), so the manager reports the bbox area, which
 * is what the mockup's "CELLS" column reads against. */
export function mapRoomCellCount(room: Pick<MapRoom, 'bbox'>): number {
  return Math.max(0, room.bbox.w) * Math.max(0, room.bbox.h);
}

/** Orders map rooms for the manager list. Plain-numeric keys sort numerically
 * (so `10` follows `9`, not `1`); a sub-lettered key (`2a`) sorts just after
 * its numeric stem; anything non-numeric falls back to a locale compare. */
export function compareMapRoomKeys(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum && na !== nb) return na - nb;
  if (aNum && bNum) return a.localeCompare(b); // same stem: "2" before "2a"
  if (aNum !== bNum) return aNum ? -1 : 1; // numeric keys ahead of pure text
  return a.localeCompare(b);
}

/** Rooms sorted for display in the manager (by key; stable ties by name). */
export function sortMapRoomsByKey(rooms: readonly MapRoom[]): MapRoom[] {
  return [...rooms].sort((a, b) => compareMapRoomKeys(a.key, b.key) || a.name.localeCompare(b.name));
}

/** True when `key` is free to assign to `exceptId` — i.e. no *other* room
 * already holds it. Blank keys are never valid. */
export function isMapRoomKeyUnique(
  key: string,
  rooms: readonly MapRoom[],
  exceptId: string,
): boolean {
  if (!key.trim()) return false;
  return !rooms.some((r) => r.id !== exceptId && r.key === key);
}

/** Given rooms in a desired display order, reassign the sequential numeric
 * keys `"1".."n"` following that order and return only the rooms whose key
 * actually changes, as `mapRoomBatch` change entries. Keys stay globally
 * unique by construction (`1..n`), so a reorder can never collide. */
export function renumberMapRoomsByOrder(
  ordered: readonly MapRoom[],
): { id: string; from: MapRoom; to: MapRoom }[] {
  const changes: { id: string; from: MapRoom; to: MapRoom }[] = [];
  ordered.forEach((room, i) => {
    const key = String(i + 1);
    if (room.key !== key) changes.push({ id: room.id, from: room, to: { ...room, key } });
  });
  return changes;
}
