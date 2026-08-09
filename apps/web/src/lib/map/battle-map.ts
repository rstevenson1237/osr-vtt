import type { GameMap } from '@osr-vtt/shared';
import type { CameraBounds } from './pan-zoom';

/**
 * The render-time differences a battle map takes on (SPEC-029 §4).
 *
 * All three are **derived from `GameMap.battle` at render time**, not stored.
 * The captured rect is already held in the *source* map's lattice units
 * (RULE-006), so a battle map shares that lattice space — and a stored grid
 * step or per-square value expressed in some other space would immediately
 * contradict it. One stored space, one place the differences come from.
 *
 * Pure — no Pixi, no Svelte — so each rule is unit-testable on its own.
 */

/**
 * Grid squares per lattice cell on a battle map. Two: the source grid is not
 * drawn, and a fresh one is drawn at half the cell size, so a 10′ main map
 * reads as 5′ squares.
 *
 * Whole cells is why the capture tool ignores the snap mode (SPEC-029 §1) —
 * a rect ending mid-cell would not divide evenly into the doubled grid.
 */
export const BATTLE_GRID_SUBDIVISION = 2;

/** Whether this map is a battle map — the one flag all three rules key on. */
export function isBattleMap(map: Pick<GameMap, 'battle'> | null | undefined): boolean {
  return !!map?.battle;
}

/** Grid squares per lattice cell: doubled on a battle map, 1 everywhere else. */
export function gridSquaresPerCell(map: Pick<GameMap, 'battle'> | null | undefined): number {
  return isBattleMap(map) ? BATTLE_GRID_SUBDIVISION : 1;
}

/**
 * The spacing to draw grid lines at, in world pixels — what `renderGrid`
 * takes. A battle map halves it; every other map draws at `cellSize`, exactly
 * as before.
 */
export function gridStepPx(
  map: Pick<GameMap, 'battle'> | null | undefined,
  cellSize: number,
): number {
  return cellSize / gridSquaresPerCell(map);
}

/**
 * What one drawn grid square is worth, for display. `RoomMeasure.perSquare` is
 * game units *per grid square*, and on a battle map a grid square is half a
 * lattice cell — so the number halves to match.
 *
 * Measured **distances** are unaffected and deliberately not routed through
 * here: `measureSpanText`/`strokeMeasureText` multiply a span in lattice cells
 * by the stored `perSquare`, which is the true distance either way. Halving
 * the per-square value while doubling the square count leaves the product
 * alone — the fight is at a finer grid, not in a smaller world.
 */
export function displayPerSquare(map: Pick<GameMap, 'battle' | 'measure'>): number {
  return map.measure.perSquare / gridSquaresPerCell(map);
}

/**
 * The camera's bound, in world pixels, or `null` for the unbounded infinite
 * map every non-battle map is. The captured rect is in the source map's
 * lattice units; `cellSize` is the render-time multiplier that takes it to the
 * space `world`'s children are drawn in (RULE-006).
 */
export function battleCameraBounds(
  map: Pick<GameMap, 'battle'> | null | undefined,
  cellSize: number,
): CameraBounds | null {
  const rect = map?.battle?.rect;
  if (!rect) return null;
  return {
    minX: rect.minX * cellSize,
    minY: rect.minY * cellSize,
    maxX: rect.maxX * cellSize,
    maxY: rect.maxY * cellSize,
  };
}
