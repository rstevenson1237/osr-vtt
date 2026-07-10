/**
 * Measurement ruler (Map Tooling Spec §3 "Ruler measures in squares/feet").
 * Square-grid distance uses Chebyshev (diagonal = 1 square), the common OSR
 * convention — no 1-2-1 diagonal stepping.
 */

export const DEFAULT_FEET_PER_SQUARE = 5;

export interface RulerMeasurement {
  squares: number;
  feet: number;
}

export function measureRuler(
  from: { x: number; y: number },
  to: { x: number; y: number },
  cellSize: number,
  feetPerSquare: number = DEFAULT_FEET_PER_SQUARE,
): RulerMeasurement {
  const dx = Math.abs(to.x - from.x) / cellSize;
  const dy = Math.abs(to.y - from.y) / cellSize;
  const squares = Math.round(Math.max(dx, dy) * 10) / 10;
  return { squares, feet: squares * feetPerSquare };
}
