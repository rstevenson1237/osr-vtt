/**
 * Measurement ruler (Map Tooling Spec §3 "Ruler measures in squares/feet";
 * Master Plan v2, R9.3 makes the unit + per-square distance configurable per
 * room via `room.settings.measure`). Square-grid distance uses Chebyshev
 * (diagonal = 1 square), the common OSR convention — no 1-2-1 diagonal
 * stepping.
 */

/** Master Plan v2, R9.3 default — 10/feet, replacing the old implicit 5 ft
 * assumption (deliberate, per referee preference). */
export const DEFAULT_PER_SQUARE = 10;

export interface RulerMeasurement {
  squares: number;
  distance: number;
}

export function measureRuler(
  from: { x: number; y: number },
  to: { x: number; y: number },
  cellSize: number,
  perSquare: number = DEFAULT_PER_SQUARE,
): RulerMeasurement {
  const dx = Math.abs(to.x - from.x) / cellSize;
  const dy = Math.abs(to.y - from.y) / cellSize;
  const squares = Math.round(Math.max(dx, dy) * 10) / 10;
  return { squares, distance: squares * perSquare };
}
