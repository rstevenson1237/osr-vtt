/**
 * SPEC-055 §4 — one entry point for "run this raw point through its snap
 * mode," in place of a caller needing to already know which of two
 * separately-named functions to reach for. `kind` picks the system; `mode`
 * keeps exactly the vocabulary it always had — `SnapMode` for `'token'`
 * (`./snap.js`, world-pixel space) or `VectorSnapMode` for `'tool'`
 * (`./vector/snap.js`, lattice-unit space) — and this module changes nothing
 * about either, including which unit space `point` is in for a given `kind`
 * (RULE-006). It dispatches to the existing functions rather than
 * re-implementing their math, so the two can never drift: `snap-for.test.ts`
 * still asserts identical output for every mode on a square and a hex map,
 * the contract this was built to keep before any caller switched over.
 */
import { snapTokenPosition, type SnapMode } from './snap.js';
import { snapPoint, type VectorSnapMode, type VertexAttraction } from './vector/snap.js';
import type { Point } from './vector/types.js';

export type SnapKind = 'token' | 'tool';

/** The pixel-space multipliers token snapping needs beside the point and
 * mode — exactly `snapTokenPosition`'s own parameters, named instead of
 * positional. */
export interface SnapForTokenOptions {
  cellSize: number;
  size: number;
  hexSize?: number;
}

/** Tool snapping needs nothing but the optional vertex-attraction radius
 * (`snapPoint`'s own `attract`, SPEC-028 §12). */
export interface SnapForToolOptions {
  attract?: VertexAttraction;
}

export function snapFor(
  kind: 'token',
  mode: SnapMode,
  point: Point,
  options: SnapForTokenOptions,
): Point;
export function snapFor(kind: 'tool', mode: VectorSnapMode, point: Point, options?: SnapForToolOptions): Point;
export function snapFor(
  kind: SnapKind,
  mode: SnapMode | VectorSnapMode,
  point: Point,
  options?: SnapForTokenOptions | SnapForToolOptions,
): Point {
  if (kind === 'token') {
    const { cellSize, size, hexSize } = options as SnapForTokenOptions;
    return snapTokenPosition(point, cellSize, size, mode as SnapMode, hexSize);
  }
  const { attract } = (options as SnapForToolOptions | undefined) ?? {};
  return snapPoint(point, mode as VectorSnapMode, attract);
}
