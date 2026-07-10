import { describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  FloorGrid,
  cellCenterPixel,
  cellToPixel,
  chunkCoordForCell,
  chunkId,
  corridorCells,
  countBits,
  emptyChunkBits,
  getBit,
  localCell,
  parseChunkId,
  pixelToCell,
  rectToCells,
  setBit,
  snapPixelToGrid,
} from './grid.js';

describe('chunk coordinates', () => {
  it('maps cells to their containing chunk', () => {
    expect(chunkCoordForCell({ x: 0, y: 0 })).toEqual({ cx: 0, cy: 0 });
    expect(chunkCoordForCell({ x: 15, y: 15 })).toEqual({ cx: 0, cy: 0 });
    expect(chunkCoordForCell({ x: 16, y: 0 })).toEqual({ cx: 1, cy: 0 });
    expect(chunkCoordForCell({ x: -1, y: 0 })).toEqual({ cx: -1, cy: 0 });
  });

  it('round-trips chunk ids', () => {
    expect(chunkId(3, -2)).toBe('3_-2');
    expect(parseChunkId('3_-2')).toEqual({ cx: 3, cy: -2 });
  });

  it('computes local cell coords within a chunk, including negatives', () => {
    expect(localCell({ x: 16, y: 16 })).toEqual({ lx: 0, ly: 0 });
    expect(localCell({ x: -1, y: -1 })).toEqual({ lx: CHUNK_SIZE - 1, ly: CHUNK_SIZE - 1 });
  });
});

describe('bit packing', () => {
  it('starts empty and sets/clears individual bits immutably', () => {
    const empty = emptyChunkBits();
    expect(getBit(empty, 5, 5)).toBe(false);

    const withBit = setBit(empty, 5, 5, true);
    expect(getBit(withBit, 5, 5)).toBe(true);
    expect(getBit(empty, 5, 5)).toBe(false); // original untouched

    const cleared = setBit(withBit, 5, 5, false);
    expect(getBit(cleared, 5, 5)).toBe(false);
  });

  it('counts set bits', () => {
    let bits = emptyChunkBits();
    bits = setBit(bits, 0, 0, true);
    bits = setBit(bits, 15, 15, true);
    bits = setBit(bits, 3, 4, true);
    expect(countBits(bits)).toBe(3);
  });
});

describe('FloorGrid', () => {
  it('is floor only where cells were carved, across chunk boundaries', () => {
    const empty = new FloorGrid();
    const { grid, touchedChunks } = empty.setCells(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      true,
    );
    expect(grid.isFloor({ x: 0, y: 0 })).toBe(true);
    expect(grid.isFloor({ x: 20, y: 0 })).toBe(true);
    expect(grid.isFloor({ x: 1, y: 0 })).toBe(false);
    expect(touchedChunks.sort()).toEqual(['0_0', '1_0']);
  });

  it('fill (setCells false) clears floor and reports touched chunks', () => {
    const { grid: carved } = new FloorGrid().setCells(rectToCells({ x: 0, y: 0 }, { x: 2, y: 2 }), true);
    const { grid: filled, touchedChunks } = carved.setCells([{ x: 1, y: 1 }], false);
    expect(filled.isFloor({ x: 1, y: 1 })).toBe(false);
    expect(filled.isFloor({ x: 0, y: 0 })).toBe(true);
    expect(touchedChunks).toEqual(['0_0']);
  });

  it('carving is idempotent — re-carving does no harm and touches nothing new', () => {
    const { grid: once } = new FloorGrid().setCells([{ x: 5, y: 5 }], true);
    const { touchedChunks } = once.setCells([{ x: 5, y: 5 }], true);
    expect(touchedChunks).toEqual([]);
  });

  it('listFloorCells enumerates every carved cell across chunks', () => {
    const { grid } = new FloorGrid().setCells(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      true,
    );
    expect(grid.listFloorCells().sort((a, b) => a.x - b.x)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });
});

describe('pixel <-> cell conversion', () => {
  const cellSize = 70;

  it('converts cell to pixel (top-left) and back', () => {
    expect(cellToPixel({ x: 2, y: 3 }, cellSize)).toEqual({ x: 140, y: 210 });
    expect(pixelToCell({ x: 145, y: 215 }, cellSize)).toEqual({ x: 2, y: 3 });
  });

  it('computes a cell center', () => {
    expect(cellCenterPixel({ x: 0, y: 0 }, cellSize)).toEqual({ x: 35, y: 35 });
  });

  it('snaps an arbitrary point to the enclosing cell corner', () => {
    expect(snapPixelToGrid({ x: 172, y: 3 }, cellSize)).toEqual({ x: 140, y: 0 });
  });
});

describe('carve shapes', () => {
  it('rectToCells covers an inclusive rectangle regardless of corner order', () => {
    const cells = rectToCells({ x: 2, y: 2 }, { x: 0, y: 0 });
    expect(cells).toHaveLength(9);
    expect(cells).toContainEqual({ x: 0, y: 0 });
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });

  it('corridorCells makes a 1-wide L path', () => {
    const cells = corridorCells({ x: 0, y: 0 }, { x: 2, y: 3 });
    // horizontal leg y=0 x=0..2, then vertical leg x=2 y=1..3
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ]);
  });
});
