import { describe, expect, it } from 'vitest';
import { gridLineBounds } from './vector-engine';

describe('gridLineBounds (PNG export grid coverage)', () => {
  it('snaps outward to whole cells and adds a one-cell margin', () => {
    const bounds = gridLineBounds({ x: 3, y: 3, width: 10, height: 10 }, 5);
    // rect spans 3..13; margin is one cell (5) on each side => -2..18,
    // snapped outward to multiples of 5 => -5..20.
    expect(bounds).toEqual({ minX: -5, maxX: 20, minY: -5, maxY: 20 });
  });

  it('covers a large export frame, not just a small on-screen viewport', () => {
    // The bug this guards: exportPng's frame is the full floor-bbox union,
    // which is typically much larger than whatever was on screen. The grid
    // bounds must scale with the given rect, not some fixed viewport size.
    const viewport = gridLineBounds({ x: 0, y: 0, width: 800, height: 600 }, 40);
    const exportFrame = gridLineBounds({ x: -200, y: -200, width: 4000, height: 3000 }, 40);
    expect(exportFrame.maxX - exportFrame.minX).toBeGreaterThan(viewport.maxX - viewport.minX);
    expect(exportFrame.maxY - exportFrame.minY).toBeGreaterThan(viewport.maxY - viewport.minY);
    // And the export bounds must actually contain the whole export frame.
    expect(exportFrame.minX).toBeLessThanOrEqual(-200);
    expect(exportFrame.maxX).toBeGreaterThanOrEqual(-200 + 4000);
    expect(exportFrame.minY).toBeLessThanOrEqual(-200);
    expect(exportFrame.maxY).toBeGreaterThanOrEqual(-200 + 3000);
  });

  it('handles a rect with negative width/height (either corner order)', () => {
    const a = gridLineBounds({ x: 10, y: 10, width: -10, height: -10 }, 5);
    const b = gridLineBounds({ x: 0, y: 0, width: 10, height: 10 }, 5);
    expect(a).toEqual(b);
  });
});
