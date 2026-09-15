/**
 * Token snapping (Master Plan v2, R9.7). Pure geometry: given a raw dropped
 * pixel position, the cell size, the token's size (in cells), and a snap mode,
 * return the settled position. No Pixi, no store — the same math the map view
 * uses on drop and any test can assert directly.
 *
 * Modes (R9.7, `hex` added by SPEC-047 §15):
 *  - `cell` (default on a square map): snap to full-cell placement — a 1×1
 *    lands on a cell center, a 2×2 lands on the corner between four cells so
 *    it covers whole cells (snapping honors token size).
 *  - `half`: snap to the half-grid, i.e. cell centers *and* edge/corner
 *    midpoints — the "force in-between" placement (desktop: hold Alt).
 *    Square maps only; a hex lattice has no analogous point (RULE-006).
 *  - `hex` (default on a hex map): snap to the centre of the hex under the
 *    pointer, for every token size — a token bigger than one hex overflows it
 *    and that is correct (DEC-094). `cell`/`half` quantize onto a lattice a
 *    hex map does not have and are not offered there.
 *  - `free`: no snapping, the raw pixel position (desktop: Alt+Shift).
 */

import { axialToPixel, pixelToAxial } from './hex/axial.js';

export type SnapMode = 'cell' | 'half' | 'hex' | 'free';

/**
 * Resolve the desktop drop modifiers into a snap mode (R9.7): plain drop snaps
 * to the base mode, `Alt` forces half-grid, `Alt+Shift` is free placement.
 * `base` is the mobile/tools snap-mode toggle used when no modifier is held.
 *
 * `Alt` is a square-map-only override (there is no half-grid on a hex map,
 * SPEC-047 §15), so it is ignored when `base` is `hex` and the drop falls
 * through to it instead — `Alt+Shift` still forces `free` either way.
 */
export function snapModeFromModifiers(
  alt: boolean,
  shift: boolean,
  base: SnapMode = 'cell',
): SnapMode {
  if (alt && shift) return 'free';
  if (alt && base !== 'hex') return 'half';
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
 * honors `size` so a 2×2 covers whole cells — except under `hex` (SPEC-047
 * §15), which always centers on the hex under the pointer regardless of size:
 * a hex lattice has no point where four hexes meet for a larger token to
 * center on, so the square map's size-aware rule has no analogue here.
 *
 * `hex` resolves through the render boundary it already crosses once
 * (RULE-006) — `pixelToAxial` then back through `axialToPixel` — using
 * `hexSize` (`GameMap.hex.size`, the render-time-only multiplier), not
 * `cellSize`. Every other mode is undefined on a hex map and never reaches
 * this branch.
 */
export function snapTokenPosition(
  pos: { x: number; y: number },
  cellSize: number,
  size: number,
  mode: SnapMode,
  hexSize?: number,
): { x: number; y: number } {
  if (mode === 'free') return { x: pos.x, y: pos.y };
  if (mode === 'hex') {
    return axialToPixel(pixelToAxial(pos, hexSize ?? cellSize), hexSize ?? cellSize);
  }
  const step = mode === 'half' ? cellSize / 2 : cellSize;
  return {
    x: snapCenter(pos.x, cellSize, size, step),
    y: snapCenter(pos.y, cellSize, size, step),
  };
}
