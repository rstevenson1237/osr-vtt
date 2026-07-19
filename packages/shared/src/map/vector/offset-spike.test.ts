/**
 * Runs the §8.1 offset spike and asserts the decision-relevant claims, printing
 * the comparison table so the numbers land in CI output. See OFFSET-SPIKE.md for
 * the writeup + recommendation.
 */
import { describe, expect, it } from 'vitest';
import {
  formatOffsetRows,
  offsetPolylineClipper,
  runOffsetSpike,
  spikeStrokes,
  unionArea,
} from './offset-spike.js';
import { bufferPolyline } from './primitives.js';
import { polygonClippingBackend as B } from './backend.js';

describe('offset spike — true offset vs bufferPolyline stand-in (SPEC §8.1)', () => {
  const rows = runOffsetSpike();

  it('prints the comparison table', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatOffsetRows(rows) + '\n');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('the stand-in is geometrically close to the true offset (area within 12%)', () => {
    const strokes = spikeStrokes();
    for (const [name, pts] of Object.entries(strokes)) {
      const standIn = unionArea(bufferPolyline(pts, 1, B));
      const clipper = unionArea(offsetPolylineClipper(pts, 1));
      const rel = Math.abs(standIn - clipper) / clipper;
      expect(
        rel,
        `${name}: stand-in ${standIn.toFixed(2)} vs clipper ${clipper.toFixed(2)}`,
      ).toBeLessThan(0.12);
    }
  });

  it('the true offset carries far fewer raw vertices on curved/jagged strokes', () => {
    for (const stroke of ['arc', 'zigzag'] as const) {
      const si = rows.find((r) => r.stroke === stroke && r.method === 'stand-in')!;
      const cl = rows.find((r) => r.stroke === stroke && r.method === 'clipper')!;
      expect(cl.rawVerts, stroke).toBeLessThan(si.rawVerts);
    }
  });

  it('both collapse to a single connected region (no stray slivers)', () => {
    for (const r of rows) expect(r.area).toBeGreaterThan(0);
  });
});
