import { describe, expect, it } from 'vitest';
import { snapCell, snapCellSize, snapPoint, snapScalar } from './snap.js';

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
