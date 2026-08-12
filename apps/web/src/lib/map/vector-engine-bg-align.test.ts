import { describe, expect, it } from 'vitest';
import { alignmentGridLines } from './vector-engine';

describe('alignmentGridLines (SPEC-038 §4 overlay clipping)', () => {
  it('covers only the selected image, edges included', () => {
    expect(alignmentGridLines({ x: 2, y: 1, w: 3, h: 2 }, 1)).toEqual({
      xs: [2, 3, 4, 5],
      ys: [1, 2, 3],
    });
  });

  it('starts at the first line inside a rect that is off the grid', () => {
    const { xs } = alignmentGridLines({ x: 2.4, y: 0, w: 2.2, h: 1 }, 1);
    expect(xs).toEqual([3, 4]);
  });

  it('adds the half-grid lines at step 0.5', () => {
    const { ys } = alignmentGridLines({ x: 0, y: 0, w: 1, h: 1 }, 0.5);
    expect(ys).toEqual([0, 0.5, 1]);
  });

  it('keeps a flush edge line despite float drift', () => {
    // 0.1 * 3 is 0.30000000000000004 — an exact-edge test without slack
    // would drop the line the referee is actually aligning against.
    const { xs } = alignmentGridLines({ x: 0.1 * 3, y: 0, w: 1 - 0.1 * 3, h: 1 }, 1);
    expect(xs).toEqual([1]);
    const flush = alignmentGridLines({ x: 1, y: 0, w: 2, h: 1 }, 1);
    expect(flush.xs).toEqual([1, 2, 3]);
  });

  it('handles a negative extent the same as its positive twin', () => {
    expect(alignmentGridLines({ x: 5, y: 3, w: -3, h: -2 }, 1)).toEqual({
      xs: [2, 3, 4, 5],
      ys: [1, 2, 3],
    });
  });

  it('draws nothing for a non-positive step', () => {
    expect(alignmentGridLines({ x: 0, y: 0, w: 4, h: 4 }, 0)).toEqual({ xs: [], ys: [] });
  });
});
