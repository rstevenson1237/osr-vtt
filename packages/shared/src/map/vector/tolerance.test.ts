import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { commitCarve } from './pipeline.js';
import { rectPoly, regularPoly } from './primitives.js';
import { pointInFloorUnionRegions } from './point-in-floor.js';
import { toFloorRegions } from './region.js';
import { countVertices } from './simplify.js';
import { DEFAULT_TOOL_TOLERANCE, toolTolerance } from './tolerance.js';
import type { MultiPoly } from './types.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;
const circle = (cx: number, cy: number, r: number) => regularPoly({ x: cx, y: cy }, r, 1)!;

/** Vertices of the region containing `p` (the circle vs. a distant room). */
function regionVertsAt(floor: MultiPoly, p: { x: number; y: number }): number {
  const regions = toFloorRegions(floor, (i) => String(i));
  const hit = regions.find((r) => pointInFloorUnionRegions(p, [r]));
  return hit ? countVertices([hit.rings]) : 0;
}

describe('toolTolerance policy (SPEC §8.3)', () => {
  it('keeps curved/parametric tools crisp and freeform tools tolerant', () => {
    expect(toolTolerance('regular')).toBe(0);
    expect(toolTolerance('polygon')).toBe(0);
    expect(toolTolerance('room')).toBe(0);
    expect(toolTolerance('path')).toBeGreaterThan(0);
    expect(DEFAULT_TOOL_TOLERANCE.corridor).toBeGreaterThan(0);
  });

  it('honors an explicit override (e.g. a live slider)', () => {
    expect(toolTolerance('regular', 0.3)).toBe(0.3);
    expect(toolTolerance('path', 0)).toBe(0);
  });
});

describe('bbox-gated simplify keeps per-tool tolerance stable', () => {
  it('a crisp circle is NOT re-rounded by a coarse carve elsewhere', () => {
    // Commit a circle crisp (regular → tolerance 0).
    let floor = commitCarve([], [circle(5, 5, 4)], 'add', toolTolerance('regular'), B).floor;
    const circleVertsBefore = regionVertsAt(floor, { x: 5, y: 5 });
    expect(circleVertsBefore).toBeGreaterThan(30); // ~64-gon, untouched

    // A coarse, DISTANT carve (path tolerance) must not touch the circle's ring.
    floor = commitCarve(floor, [rect(40, 40, 60, 41)], 'add', toolTolerance('path'), B).floor;
    const circleVertsAfter = regionVertsAt(floor, { x: 5, y: 5 });
    expect(circleVertsAfter).toBe(circleVertsBefore);
  });

  it('still simplifies the region the stroke actually touches', () => {
    // A jaggy organic blob committed at a coarse tolerance should shrink.
    const blob = circle(0, 0, 8); // 64-gon
    const raw = countVertices([blob]);
    const floor = commitCarve([], [blob], 'add', 0.2, B).floor;
    expect(countVertices(floor)).toBeLessThan(raw);
  });

  it('a carve that overlaps the circle DOES fold it in at the new tolerance', () => {
    let floor = commitCarve([], [circle(5, 5, 4)], 'add', toolTolerance('regular'), B).floor;
    const before = regionVertsAt(floor, { x: 5, y: 5 });
    // Overlapping coarse carve merges with the circle → its ring may be pruned.
    floor = commitCarve(floor, [rect(4, 4, 30, 6)], 'add', 0.3, B).floor;
    const after = regionVertsAt(floor, { x: 5, y: 5 });
    expect(after).toBeLessThanOrEqual(before + 4); // folded in, not left untouched-and-growing
  });
});
