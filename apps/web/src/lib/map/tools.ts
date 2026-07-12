import {
  type Cell,
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
  | 'wall'
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
  | { kind: 'symbol'; id: string; from: MapSymbol | null; to: MapSymbol | null }
  | { kind: 'mapRoom'; id: string; from: MapRoom | null; to: MapRoom | null }
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
    case 'symbol':
      return { kind: 'symbol', id: op.id, from: op.to, to: op.from };
    case 'mapRoom':
      return { kind: 'mapRoom', id: op.id, from: op.to, to: op.from };
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
  if (op.kind === 'wallBatch') return op.changes.length === 0;
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
