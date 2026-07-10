import {
  CHUNK_SIZE,
  type Cell,
  chunkCoordForCell,
  chunkId,
  emptyChunkBits,
  getBit,
  localCell,
  parseChunkId,
  setBit,
} from './grid.js';

/**
 * Fog of War (Map Tooling Spec §6). Two v1 modes:
 *  - `emergent` (mapper mode, default): unexplored = uncarved = rock. There
 *    is nothing to reveal — the floor mask *is* the revealed mask.
 *  - `manual`: a GM-prepped map where floor is pre-carved and the GM reveals
 *    cells by hand (the FoW eraser). Revealed state is its own chunked
 *    bitmask at `fogChunks/{cx_cy}`, same shape as floor chunks.
 */

export type FogMode = 'emergent' | 'manual';

export function isCellRevealed(
  mode: FogMode,
  isFloor: (cell: Cell) => boolean,
  isRevealedManually: (cell: Cell) => boolean,
  cell: Cell,
): boolean {
  return mode === 'emergent' ? isFloor(cell) : isRevealedManually(cell);
}

/** In-memory manual-reveal mask, mirroring `FloorGrid`'s chunk shape. */
export class FogGrid {
  private readonly chunks: ReadonlyMap<string, readonly number[]>;

  constructor(chunks?: ReadonlyMap<string, readonly number[]>) {
    this.chunks = chunks ?? new Map();
  }

  static fromChunks(entries: Iterable<[string, readonly number[]]>): FogGrid {
    return new FogGrid(new Map(entries));
  }

  isRevealed(cell: Cell): boolean {
    const { cx, cy } = chunkCoordForCell(cell);
    const bits = this.chunks.get(chunkId(cx, cy));
    if (!bits) return false;
    const { lx, ly } = localCell(cell);
    return getBit(bits, lx, ly);
  }

  getChunkBits(cx: number, cy: number): readonly number[] {
    return this.chunks.get(chunkId(cx, cy)) ?? emptyChunkBits();
  }

  /** Reveal (or hide) a set of cells; returns the new grid and the touched
   * chunk ids for a batched Firestore commit (never one write per cell). */
  reveal(cells: readonly Cell[], value = true): { grid: FogGrid; touchedChunks: string[] } {
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
    return { grid: new FogGrid(next), touchedChunks: [...touched] };
  }

  /** Reset: an empty grid (all hidden again). */
  static empty(): FogGrid {
    return new FogGrid();
  }

  /** Every revealed cell across every chunk, for rendering the FoW mask. */
  listRevealedCells(): Cell[] {
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
