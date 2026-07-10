import { describe, expect, it } from 'vitest';
import { FloorGrid, rectToCells } from './grid.js';
import { FogGrid, isCellRevealed } from './fog.js';

describe('emergent fog mode', () => {
  it('treats revealed as identical to floor — nothing to reveal separately', () => {
    const { grid: floor } = new FloorGrid().setCells([{ x: 0, y: 0 }], true);
    expect(isCellRevealed('emergent', (c) => floor.isFloor(c), () => false, { x: 0, y: 0 })).toBe(true);
    expect(isCellRevealed('emergent', (c) => floor.isFloor(c), () => false, { x: 1, y: 1 })).toBe(false);
  });
});

describe('manual fog mode (GM-prepped, FoW eraser)', () => {
  it('starts fully hidden even where floor is pre-carved', () => {
    const { grid: floor } = new FloorGrid().setCells(rectToCells({ x: 0, y: 0 }, { x: 5, y: 5 }), true);
    const fog = FogGrid.empty();
    expect(
      isCellRevealed('manual', (c) => floor.isFloor(c), (c) => fog.isRevealed(c), { x: 2, y: 2 }),
    ).toBe(false);
  });

  it('reveals only the cells the eraser touched, in a batched chunk commit', () => {
    const { grid: revealed, touchedChunks } = FogGrid.empty().reveal([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
    expect(revealed.isRevealed({ x: 2, y: 2 })).toBe(true);
    expect(revealed.isRevealed({ x: 3, y: 2 })).toBe(true);
    expect(revealed.isRevealed({ x: 4, y: 2 })).toBe(false);
    expect(touchedChunks).toEqual(['0_0']);
  });

  it('listRevealedCells enumerates every revealed cell', () => {
    const { grid } = FogGrid.empty().reveal([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
    expect(grid.listRevealedCells().sort((a, b) => a.x - b.x)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  it('reset clears all revealed cells back to hidden', () => {
    const { grid: revealed } = FogGrid.empty().reveal([{ x: 1, y: 1 }]);
    expect(revealed.isRevealed({ x: 1, y: 1 })).toBe(true);
    const reset = FogGrid.empty();
    expect(reset.isRevealed({ x: 1, y: 1 })).toBe(false);
  });
});
