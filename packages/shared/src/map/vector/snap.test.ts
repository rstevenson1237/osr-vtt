import { describe, expect, it } from 'vitest';
import {
  snapAngle,
  snapCell,
  snapCellCenter,
  snapCellSize,
  snapPoint,
  snapScalar,
  snapSpan,
} from './snap.js';

describe('snapPoint (SPEC §2.5 per-point snap)', () => {
  it('free mode returns a fresh copy of the raw point', () => {
    const p = { x: 1.23, y: 4.56 };
    const out = snapPoint(p, 'free');
    expect(out).toEqual(p);
    expect(out).not.toBe(p);
  });
  it('full mode rounds to the nearest lattice intersection', () => {
    expect(snapPoint({ x: 1.4, y: 2.6 }, 'full')).toEqual({ x: 1, y: 3 });
  });
  it('half mode rounds to the nearest half-lattice', () => {
    expect(snapPoint({ x: 1.2, y: 2.8 }, 'half')).toEqual({ x: 1, y: 3 });
    expect(snapPoint({ x: 1.24, y: 2.6 }, 'half')).toEqual({ x: 1, y: 2.5 });
  });
});

describe('snapScalar', () => {
  it('snaps to full and half steps, identity when free', () => {
    expect(snapScalar(3.4, 'full')).toBe(3);
    expect(snapScalar(3.4, 'half')).toBe(3.5);
    expect(snapScalar(3.4, 'free')).toBe(3.4);
  });
});

describe('snapCell (cell interior, for labels)', () => {
  it('keeps the point in the cell it was clicked in, not the nearest vertex', () => {
    // Lower-right quadrant of cell (3,4): `snapPoint` would round up to the
    // (4,5) vertex; `snapCell` stays in (3,4).
    expect(snapCell({ x: 3.8, y: 4.9 }, 'full')).toEqual({ x: 3, y: 4 });
    expect(snapPoint({ x: 3.8, y: 4.9 }, 'full')).toEqual({ x: 4, y: 5 });
  });

  it('quantizes to half cells under half-snap', () => {
    expect(snapCell({ x: 3.8, y: 4.9 }, 'half')).toEqual({ x: 3.5, y: 4.5 });
    expect(snapCellSize('half')).toBe(0.5);
    expect(snapCellSize('full')).toBe(1);
  });

  it('handles negative coordinates without drifting a cell', () => {
    expect(snapCell({ x: -0.2, y: -1.9 }, 'full')).toEqual({ x: -1, y: -2 });
  });

  it('is identity in freeform', () => {
    expect(snapCell({ x: 3.8, y: 4.9 }, 'free')).toEqual({ x: 3.8, y: 4.9 });
  });
});

describe('snapCellCenter (cell-interior anchor for n-gons and corridors)', () => {
  it('centres in the cell the pointer is in, wherever in the cell that was', () => {
    // Every point inside cell (3,4) resolves to the same centre — which is the
    // whole difference from `snapPoint`, whose answer depends on the quadrant.
    expect(snapCellCenter({ x: 3.1, y: 4.1 }, 'full')).toEqual({ x: 3.5, y: 4.5 });
    expect(snapCellCenter({ x: 3.9, y: 4.9 }, 'full')).toEqual({ x: 3.5, y: 4.5 });
  });

  it('centres in the half-cell under half-snap', () => {
    expect(snapCellCenter({ x: 3.8, y: 4.9 }, 'half')).toEqual({ x: 3.75, y: 4.75 });
  });

  it('handles negative coordinates', () => {
    expect(snapCellCenter({ x: -0.2, y: -1.9 }, 'full')).toEqual({ x: -0.5, y: -1.5 });
  });

  it('is identity in freeform', () => {
    expect(snapCellCenter({ x: 3.8, y: 4.9 }, 'free')).toEqual({ x: 3.8, y: 4.9 });
  });
});

describe('snapAngle', () => {
  const deg = (d: number): number => (d * Math.PI) / 180;

  it('full mode snaps to the four cardinals', () => {
    expect(snapAngle(deg(20), 'full')).toBeCloseTo(0);
    expect(snapAngle(deg(70), 'full')).toBeCloseTo(deg(90));
    expect(snapAngle(deg(-100), 'full')).toBeCloseTo(deg(-90));
  });

  it('half mode adds the diagonals', () => {
    expect(snapAngle(deg(40), 'half')).toBeCloseTo(deg(45));
    expect(snapAngle(deg(20), 'half')).toBeCloseTo(deg(0));
    expect(snapAngle(deg(70), 'half')).toBeCloseTo(deg(90));
  });

  it('is identity in freeform', () => {
    expect(snapAngle(deg(37), 'free')).toBeCloseTo(deg(37));
  });
});

describe('snapSpan', () => {
  it('snaps to whole cells and half cells', () => {
    expect(snapSpan(3.4, 'full')).toBe(3);
    expect(snapSpan(3.4, 'half')).toBe(3.5);
  });

  it('never returns less than one step — a zero span is not a shape', () => {
    expect(snapSpan(0.1, 'full')).toBe(1);
    expect(snapSpan(0, 'full')).toBe(1);
    expect(snapSpan(0.1, 'half')).toBe(0.5);
    // `snapScalar` is a *position* quantizer and is free to answer zero; this
    // is the difference that keeps a click-with-no-drag from being degenerate.
    expect(snapScalar(0.1, 'full')).toBe(0);
  });

  it('is identity in freeform', () => {
    expect(snapSpan(3.4, 'free')).toBe(3.4);
  });
});
