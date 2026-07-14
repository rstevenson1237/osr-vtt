import { describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  FloorGrid,
  carvedBoundingBox,
  cellCenterPixel,
  cellToPixel,
  chunkCoordForCell,
  chunkId,
  corridorCells,
  countBits,
  ellipseToCells,
  emptyChunkBits,
  getBit,
  localCell,
  mapExportFrame,
  parseChunkId,
  pixelToCell,
  polygonToCells,
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

describe('carvedBoundingBox (Master Plan v2, R4 — grid-resize guard)', () => {
  it('returns null when nothing has been carved', () => {
    expect(carvedBoundingBox([])).toBeNull();
  });

  it('spans every carved cell across multiple chunks', () => {
    const { grid, touchedChunks } = new FloorGrid().setCells(
      [
        { x: 2, y: 3 },
        { x: 20, y: 30 },
      ],
      true,
    );
    const chunks = touchedChunks.map((id) => {
      const { cx, cy } = parseChunkId(id);
      return { id, bits: grid.getChunkBits(cx, cy) };
    });
    expect(carvedBoundingBox(chunks)).toEqual({ minX: 2, minY: 3, maxX: 20, maxY: 30 });
  });
});

describe('mapExportFrame (Master Plan v2, R9.8 — map PNG export)', () => {
  const cellSize = 70;

  it('falls back to a single cell at the origin when nothing is carved', () => {
    expect(mapExportFrame(null, cellSize)).toEqual({ x: 0, y: 0, width: 70, height: 70 });
  });

  it('pads the carved bbox by the margin on every side', () => {
    const bbox = { minX: 2, minY: 3, maxX: 4, maxY: 5 };
    // x: (2-1)*70=70, y: (3-1)*70=140; w: (4+1)-(2-1)+1=5 cells=350, h: (5+1)-(3-1)+1=5 cells=350
    expect(mapExportFrame(bbox, cellSize, 1)).toEqual({ x: 70, y: 140, width: 350, height: 350 });
  });

  it('clamps the margin so the frame never goes negative', () => {
    const bbox = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    expect(mapExportFrame(bbox, cellSize, 1)).toEqual({ x: 0, y: 0, width: 280, height: 280 });
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

  it('ellipseToCells fills solid for small boxes and rounds the corners at size 5', () => {
    // 3×3 box: every cell center is within the inscribed ellipse (corners at
    // distance √(8/9) < 1) — a solid block.
    expect(ellipseToCells({ x: 0, y: 0 }, { x: 2, y: 2 })).toHaveLength(9);

    // 5×5 box: the four corners fall outside, producing a rounded blob. Known
    // raster — top/bottom rows keep only the middle three columns.
    const e = ellipseToCells({ x: 0, y: 0 }, { x: 4, y: 4 });
    expect(e).toHaveLength(21);
    expect(e).not.toContainEqual({ x: 0, y: 0 }); // corner rounded off
    expect(e).not.toContainEqual({ x: 4, y: 4 });
    expect(e).toContainEqual({ x: 2, y: 0 }); // top-middle kept
    expect(e).toContainEqual({ x: 0, y: 2 }); // left-middle kept
  });

  it('ellipseToCells is order-independent in its corners (deterministic raster)', () => {
    const forward = ellipseToCells({ x: 0, y: 0 }, { x: 4, y: 4 });
    const reversed = ellipseToCells({ x: 4, y: 4 }, { x: 0, y: 0 });
    expect(reversed).toEqual(forward);
  });

  it('polygonToCells fills an axis-aligned square via even-odd at cell centers', () => {
    const cells = polygonToCells([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]);
    expect(cells).toHaveLength(9); // the 3×3 block of cells inside the square
    expect(cells).toContainEqual({ x: 0, y: 0 });
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });

  it('polygonToCells rasterizes a right triangle to its known cell raster', () => {
    // Right triangle with legs of 4 along the axes. A cell is kept when its
    // center (x+0.5, y+0.5) is under the hypotenuse x+y<4 → x+y≤2: a 3/2/1
    // staircase (6 cells).
    const cells = polygonToCells([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ]);
    expect(cells).toHaveLength(6);
    expect(cells).toContainEqual({ x: 2, y: 0 });
    expect(cells).toContainEqual({ x: 0, y: 2 });
    expect(cells).not.toContainEqual({ x: 3, y: 0 }); // center on the hypotenuse
    expect(cells).not.toContainEqual({ x: 3, y: 3 });
  });

  it('polygonToCells needs at least 3 vertices', () => {
    expect(polygonToCells([{ x: 0, y: 0 }, { x: 2, y: 2 }])).toEqual([]);
  });
});
