import { describe, expect, it } from 'vitest';
import type { GameMap } from '@osr-vtt/shared';
import {
  battleCameraBounds,
  displayPerSquare,
  gridSquaresPerCell,
  gridStepPx,
  isBattleMap,
} from './battle-map';

/** The `GameMap` fields these rules read, and nothing else. */
type MapLike = Pick<GameMap, 'battle' | 'measure'>;

const MEASURE = { perSquare: 10, unit: 'feet' };
const ordinary: MapLike = { measure: MEASURE };
const battle: MapLike = {
  measure: MEASURE,
  battle: { sourceMapId: 'source', rect: { minX: 4, minY: 6, maxX: 20, maxY: 18 } },
};

describe('isBattleMap / gridSquaresPerCell', () => {
  it('keys off `GameMap.battle` alone', () => {
    expect(isBattleMap(ordinary)).toBe(false);
    expect(isBattleMap(battle)).toBe(true);
    expect(isBattleMap(null)).toBe(false);
    expect(isBattleMap(undefined)).toBe(false);
  });

  it('doubles the squares per cell on a battle map only', () => {
    expect(gridSquaresPerCell(ordinary)).toBe(1);
    expect(gridSquaresPerCell(battle)).toBe(2);
    expect(gridSquaresPerCell(null)).toBe(1);
  });
});

describe('gridStepPx', () => {
  it('draws an ordinary map at its own cell size, unchanged', () => {
    expect(gridStepPx(ordinary, 40)).toBe(40);
  });

  it('draws a battle map at half the cell size (SPEC-029 §4)', () => {
    expect(gridStepPx(battle, 40)).toBe(20);
  });
});

describe('displayPerSquare', () => {
  it('leaves an ordinary map reading its stored value', () => {
    expect(displayPerSquare(ordinary)).toBe(10);
  });

  it('halves it on a battle map, so a 10ft main map reads as 5ft squares', () => {
    expect(displayPerSquare(battle)).toBe(5);
  });

  it('leaves the true distance of a span alone', () => {
    // The Measure tool multiplies a span in *lattice cells* by the stored
    // `perSquare`; the display value halves because a drawn square halves, and
    // the product — the actual ground covered — is what must not move.
    const latticeSpan = 3;
    const squares = latticeSpan * gridSquaresPerCell(battle);
    expect(squares * displayPerSquare(battle)).toBe(latticeSpan * MEASURE.perSquare);
  });
});

describe('battleCameraBounds', () => {
  it('is null for an ordinary map — the vector floor is unbounded', () => {
    expect(battleCameraBounds(ordinary, 40)).toBeNull();
    expect(battleCameraBounds(null, 40)).toBeNull();
  });

  it('takes the captured rect from lattice units to world pixels (RULE-006)', () => {
    expect(battleCameraBounds(battle, 40)).toEqual({
      minX: 160,
      minY: 240,
      maxX: 800,
      maxY: 720,
    });
  });

  it('scales with cellSize, since the rect is stored in lattice units only', () => {
    const a = battleCameraBounds(battle, 20)!;
    const b = battleCameraBounds(battle, 40)!;
    expect(b.maxX - b.minX).toBe(2 * (a.maxX - a.minX));
  });
});
