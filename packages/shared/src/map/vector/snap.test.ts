import { describe, expect, it } from 'vitest';
import { snapPoint, snapScalar } from './snap.js';

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
