/**
 * Token snapping (Master Plan v2, R9.7). Pure geometry: given a raw dropped
 * pixel position, the cell size, the token's size (in cells), and a snap mode,
 * return the settled position. No Pixi, no store — the same math the map view
 * uses on drop and any test can assert directly.
 *
 * Modes (R9.7):
 *  - `cell` (default): snap to full-cell placement — a 1×1 lands on a cell
 *    center, a 2×2 lands on the corner between four cells so it covers whole
 *    cells (snapping honors token size).
 *  - `half`: snap to the half-grid, i.e. cell centers *and* edge/corner
 *    midpoints — the "force in-between" placement (desktop: hold Alt).
 *  - `free`: no snapping, the raw pixel position (desktop: Alt+Shift).
 */

export type SnapMode = 'cell' | 'half' | 'free';

/**
 * Resolve the desktop drop modifiers into a snap mode (R9.7): plain drop snaps
 * to the cell grid, `Alt` forces half-grid, `Alt+Shift` is free placement.
 * `base` is the mobile/tools snap-mode toggle used when no modifier is held.
 */
export function snapModeFromModifiers(alt: boolean, shift: boolean, base: SnapMode = 'cell'): SnapMode {
  if (alt && shift) return 'free';
  if (alt) return 'half';
  return base;
}

/** Snap a single center coordinate so a token of `size` cells lands on a
 * `step`-spaced lattice while staying centered: the token's leading edge
 * (`center - size*cellSize/2`) is what lands on the lattice, so odd sizes
 * center on cells and even sizes center on grid lines. */
function snapCenter(center: number, cellSize: number, size: number, step: number): number {
  const half = (size * cellSize) / 2;
  const k = Math.round((center - half) / step);
  return k * step + half;
}

/**
 * Settle a dropped token position (R9.7). The input/output are the token's
 * center in world pixels (tokens render anchored at their center). Snapping
 * honors `size` so a 2×2 covers whole cells.
 */
export function snapTokenPosition(
  pos: { x: number; y: number },
  cellSize: number,
  size: number,
  mode: SnapMode,
): { x: number; y: number } {
  if (mode === 'free') return { x: pos.x, y: pos.y };
  const step = mode === 'half' ? cellSize / 2 : cellSize;
  return {
    x: snapCenter(pos.x, cellSize, size, step),
    y: snapCenter(pos.y, cellSize, size, step),
  };
}
