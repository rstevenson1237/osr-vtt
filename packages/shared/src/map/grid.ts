/**
 * Cellular grid primitives (Map Tooling Spec §1, §7). The map is a grid of
 * cells, each solid (rock, default) or floor (carved). This module is pure
 * math — no Pixi, no Firebase — so it's usable from the editor engine, the
 * store's chunk-commit batching, and (Phase 4) line-of-sight.
 *
 * Floor state is stored per 16×16 "chunk" as an 8×uint32 bitmask (256 bits),
 * matching the Firestore doc shape at `floorChunks/{cx_cy}` (Spec §7) — a
 * carve writes a handful of chunk docs, never one write per cell.
 */

export const CHUNK_SIZE = 16;
const BITS_PER_WORD = 32;
export const WORDS_PER_CHUNK = (CHUNK_SIZE * CHUNK_SIZE) / BITS_PER_WORD;

export interface Cell {
  x: number;
  y: number;
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export function chunkCoordForCell(cell: Cell): ChunkCoord {
  return { cx: floorDiv(cell.x, CHUNK_SIZE), cy: floorDiv(cell.y, CHUNK_SIZE) };
}

export function chunkId(cx: number, cy: number): string {
  return `${cx}_${cy}`;
}

export function parseChunkId(id: string): ChunkCoord {
  const [cx, cy] = id.split('_').map(Number);
  return { cx: cx ?? 0, cy: cy ?? 0 };
}

export function localCell(cell: Cell): { lx: number; ly: number } {
  return { lx: mod(cell.x, CHUNK_SIZE), ly: mod(cell.y, CHUNK_SIZE) };
}

export function emptyChunkBits(): number[] {
  return new Array<number>(WORDS_PER_CHUNK).fill(0);
}

function bitPos(lx: number, ly: number): { word: number; bit: number } {
  const i = ly * CHUNK_SIZE + lx;
  return { word: i >> 5, bit: i & 31 };
}

export function getBit(bits: readonly number[], lx: number, ly: number): boolean {
  const { word, bit } = bitPos(lx, ly);
  return (((bits[word] ?? 0) >>> bit) & 1) === 1;
}

/** Pure — returns a new bits array with (lx,ly) set to `value`, or the exact
 * same array reference if the bit already held that value (so callers can
 * cheaply detect no-op writes, e.g. re-carving an already-floor cell). */
export function setBit(bits: readonly number[], lx: number, ly: number, value: boolean): number[] {
  if (getBit(bits, lx, ly) === value) return bits as number[];
  const next = bits.slice();
  const { word, bit } = bitPos(lx, ly);
  const current = next[word] ?? 0;
  next[word] = value ? (current | (1 << bit)) >>> 0 : (current & ~(1 << bit)) >>> 0;
  return next;
}

export function countBits(bits: readonly number[]): number {
  let total = 0;
  for (const word of bits) {
    let w = word >>> 0;
    while (w) {
      w &= w - 1;
      total++;
    }
  }
  return total;
}

/**
 * In-memory floor set spanning many chunks, used by the editor for local
 * preview and to compute which chunks a stroke touched (for batched
 * commit-on-release — Spec §7 write discipline). Immutable: every mutator
 * returns a new `FloorGrid`.
 */
export class FloorGrid {
  private readonly chunks: ReadonlyMap<string, readonly number[]>;

  constructor(chunks?: ReadonlyMap<string, readonly number[]>) {
    this.chunks = chunks ?? new Map();
  }

  static fromChunks(entries: Iterable<[string, readonly number[]]>): FloorGrid {
    return new FloorGrid(new Map(entries));
  }

  isFloor(cell: Cell): boolean {
    const { cx, cy } = chunkCoordForCell(cell);
    const bits = this.chunks.get(chunkId(cx, cy));
    if (!bits) return false;
    const { lx, ly } = localCell(cell);
    return getBit(bits, lx, ly);
  }

  getChunkBits(cx: number, cy: number): readonly number[] {
    return this.chunks.get(chunkId(cx, cy)) ?? emptyChunkBits();
  }

  /** Returns a new grid with `value` set at every cell, plus the set of
   * chunk ids that changed (for a Firestore commit batch). */
  setCells(cells: readonly Cell[], value: boolean): { grid: FloorGrid; touchedChunks: string[] } {
    const next = new Map(this.chunks);
    const touched = new Set<string>();
    for (const cell of cells) {
      const { cx, cy } = chunkCoordForCell(cell);
      const id = chunkId(cx, cy);
      const { lx, ly } = localCell(cell);
      const bits = next.get(id) ?? emptyChunkBits();
      const updated = setBit(bits, lx, ly, value);
      if (updated !== bits) {
        next.set(id, updated);
        touched.add(id);
      }
    }
    return { grid: new FloorGrid(next), touchedChunks: [...touched] };
  }

  /** Every carved cell across every chunk, for rendering/derived-wall
   * computation. Not cheap for huge maps — call once per render pass, not
   * per cell. */
  listFloorCells(): Cell[] {
    const cells: Cell[] = [];
    for (const [id, bits] of this.chunks) {
      const { cx, cy } = parseChunkId(id);
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (getBit(bits, lx, ly)) {
            cells.push({ x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly });
          }
        }
      }
    }
    return cells;
  }
}

/** The smallest cell rectangle enclosing every carved (floor) cell across a
 * room's floor chunks, or `null` if nothing has been carved yet. Used by the
 * Session Config grid-resize guard (Master Plan v2, R4): shrinking `grid.w`/
 * `grid.h` below this bbox would silently orphan carved chunks outside the
 * new bounds, so the UI blocks the shrink instead. Scans chunk bits directly
 * rather than materializing a cell list — cheap even for large maps. */
export function carvedBoundingBox(
  chunks: Iterable<{ id: string; bits: readonly number[] }>,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { id, bits } of chunks) {
    const { cx, cy } = parseChunkId(id);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (!getBit(bits, lx, ly)) continue;
        const x = cx * CHUNK_SIZE + lx;
        const y = cy * CHUNK_SIZE + ly;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

/** Pixel-space capture rectangle for the "Download map as PNG" export (Master
 * Plan v2, R9.8): the carved bounding box padded by `marginCells` on every
 * side, clamped so the frame never reaches into negative world space. `bbox
 * null` (nothing carved yet) falls back to a single cell at the origin so the
 * export always has a nonzero-area frame to extract. */
export function mapExportFrame(
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null,
  cellSize: number,
  marginCells = 1,
): { x: number; y: number; width: number; height: number } {
  if (!bbox) return { x: 0, y: 0, width: cellSize, height: cellSize };
  const minX = Math.max(0, bbox.minX - marginCells);
  const minY = Math.max(0, bbox.minY - marginCells);
  const maxX = bbox.maxX + marginCells;
  const maxY = bbox.maxY + marginCells;
  return {
    x: minX * cellSize,
    y: minY * cellSize,
    width: (maxX - minX + 1) * cellSize,
    height: (maxY - minY + 1) * cellSize,
  };
}

// ---- pixel <-> cell conversion & snapping (Spec §2, §5 — always-on snap) ----

export function cellToPixel(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: cell.x * cellSize, y: cell.y * cellSize };
}

export function cellCenterPixel(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: (cell.x + 0.5) * cellSize, y: (cell.y + 0.5) * cellSize };
}

export function pixelToCell(point: { x: number; y: number }, cellSize: number): Cell {
  return { x: Math.floor(point.x / cellSize), y: Math.floor(point.y / cellSize) };
}

/** Snaps a raw pixel point to the nearest cell's top-left corner. */
export function snapPixelToGrid(point: { x: number; y: number }, cellSize: number): { x: number; y: number } {
  return cellToPixel(pixelToCell(point, cellSize), cellSize);
}

// ---- carve/fill shapes (Spec §3: rectangle drag/typed W×H, corridor) ----

/** Inclusive rectangle of cells between two (possibly unordered) corners. */
export function rectToCells(a: Cell, b: Cell): Cell[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cells: Cell[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}

/** A 1-cell-wide L-shaped corridor: horizontal run from `a`, then vertical
 * run to `b` (Spec §3 "corridor mode"). */
export function corridorCells(a: Cell, b: Cell): Cell[] {
  const cells: Cell[] = [];
  const stepX = a.x <= b.x ? 1 : -1;
  for (let x = a.x; x !== b.x + stepX; x += stepX) {
    cells.push({ x, y: a.y });
  }
  const stepY = a.y <= b.y ? 1 : -1;
  for (let y = a.y + stepY; y !== b.y + stepY; y += stepY) {
    cells.push({ x: b.x, y });
  }
  return cells;
}

/**
 * Filled-ellipse rasterizer (Master Plan v2, WI-5b): the ellipse inscribed in
 * the inclusive bounding box between two drag corners, rasterized to whole
 * cells (R9.1 — organic shapes are always rasterize-to-cells, never a vector
 * model). A cell is included when its *center* falls inside the ellipse, so
 * the result is symmetric and deterministic — pure math, unit-tested against
 * known rasters. Small boxes (≤3 across) fill solid; from ~5 across the corners
 * round off into a cave-like blob.
 */
export function ellipseToCells(a: Cell, b: Cell): Cell[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cells: Cell[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Cell center in bbox-normalized coords: (2*index + 1 - span) / span maps
      // the center of index 0..span-1 to (-1, 1), zero at the middle cell.
      const nx = (2 * (x - minX) + 1 - w) / w;
      const ny = (2 * (y - minY) + 1 - h) / h;
      if (nx * nx + ny * ny <= 1) cells.push({ x, y });
    }
  }
  return cells;
}

/** True if the cell center `(cx, cy)` lies inside the polygon (even-odd rule).
 * Vertices are in cell-lattice coordinates (a vertex `{x, y}` is the corner
 * where cells meet), so a cell `(i, j)` is tested at its center `(i+0.5,
 * j+0.5)`. */
function pointInPolygon(cx: number, cy: number, poly: readonly Cell[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersects =
      pi.y > cy !== pj.y > cy && cx < ((pj.x - pi.x) * (cy - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Filled-polygon rasterizer (Master Plan v2, WI-5b): rasterizes the closed
 * polygon whose vertices are grid-lattice points to whole cells via the
 * even-odd rule at each cell center (R9.1 — rasterize-to-cells). Pure and
 * deterministic; unit-tested against known rasters. Fewer than 3 vertices
 * enclose no area and yield no cells.
 */
export function polygonToCells(points: readonly Cell[]): Cell[] {
  if (points.length < 3) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cells: Cell[] = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) cells.push({ x, y });
    }
  }
  return cells;
}
