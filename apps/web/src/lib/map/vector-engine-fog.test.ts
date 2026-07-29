import { describe, expect, it } from 'vitest';
import { fogCoverRect } from './vector-engine';
import { layerIncludedInExport, MAP_EXPORT_LAYERS } from './export-layers';

/** One lattice-unit square from (x0,y0) to (x1,y1). */
function rect(x0: number, y0: number, x1: number, y1: number) {
  return [
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  ];
}

describe('fogCoverRect (fog must not depend on the viewport)', () => {
  const cellSize = 10;

  it('covers the viewport plus one cell of slack when nothing is revealed', () => {
    expect(fogCoverRect({ x: 0, y: 0, width: 100, height: 80 }, [], cellSize)).toEqual({
      x: -10,
      y: -10,
      width: 120,
      height: 100,
    });
  });

  it('expands to contain revealed geometry that has been zoomed off screen', () => {
    // Revealed 0..20 lattice = 0..200px, viewport only shows 0..100px.
    const cover = fogCoverRect({ x: 0, y: 0, width: 100, height: 100 }, [rect(0, 0, 20, 20)], 10);
    expect(cover.x + cover.width).toBeGreaterThanOrEqual(200);
    expect(cover.y + cover.height).toBeGreaterThanOrEqual(200);
  });

  it('expands in the negative direction too, and never shrinks below the viewport', () => {
    const viewport = { x: 0, y: 0, width: 100, height: 100 };
    const cover = fogCoverRect(viewport, [rect(-30, -5, -10, 5)], 10);
    expect(cover.x).toBeLessThanOrEqual(-300);
    expect(cover.y).toBeLessThanOrEqual(-10);
    expect(cover.x + cover.width).toBeGreaterThanOrEqual(viewport.width);
  });

  it('contains every revealed vertex with margin — the property the cut depends on', () => {
    const revealed = [rect(-4, 12, 40, 33), rect(60, -20, 62, -18)];
    const cover = fogCoverRect({ x: 5, y: 5, width: 30, height: 30 }, revealed, 8);
    for (const poly of revealed) {
      for (const ring of poly) {
        for (const p of ring) {
          expect(p.x * 8).toBeGreaterThan(cover.x);
          expect(p.y * 8).toBeGreaterThan(cover.y);
          expect(p.x * 8).toBeLessThan(cover.x + cover.width);
          expect(p.y * 8).toBeLessThan(cover.y + cover.height);
        }
      }
    }
  });
});

describe('layerIncludedInExport (PNG "up to layer" cutoff)', () => {
  it('includes everything at or below the cutoff', () => {
    expect(layerIncludedInExport('background', 'overlay')).toBe(true);
    expect(layerIncludedInExport('floor', 'overlay')).toBe(true);
    expect(layerIncludedInExport('overlay', 'overlay')).toBe(true);
  });

  it('excludes everything above it', () => {
    expect(layerIncludedInExport('fog', 'overlay')).toBe(false);
    expect(layerIncludedInExport('tokens', 'floor')).toBe(false);
  });

  it('includes the whole stack at the top layer', () => {
    for (const layer of MAP_EXPORT_LAYERS) {
      expect(layerIncludedInExport(layer, 'tokens')).toBe(true);
    }
  });
});
