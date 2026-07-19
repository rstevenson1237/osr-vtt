/**
 * §8.1 offset spike (SPEC §5.2 / REVIEW M6). NOT part of the shipped library —
 * this is a measurement harness that answers one question: is a **true polygon
 * offset** (Clipper's `ClipperOffset`, round joins + caps) meaningfully better
 * than the `bufferPolyline` **stand-in** (a union of per-segment quads + round
 * caps) for buffering a freeform brush stroke?
 *
 * `clipper-lib` (pure-JS Clipper1) is a devDependency used only here; it stands
 * in for the spec-named Clipper2 for the *quality* axis (the offset math is the
 * same family) while staying trivially runnable in Node/vitest with no WASM. The
 * **bundle / cold-start** axis is measured separately (see OFFSET-SPIKE.md); the
 * three candidates are polygon-clipping (in use), clipper-lib (pure JS), and
 * clipper2-wasm (WASM).
 *
 * The offset is the ONLY thing polygon-clipping can't do (REVIEW M6); everything
 * else — boolean ops, holes, split-on-bisection, perf, doc-size — polygon-clipping
 * already won in the POC (FINDINGS §8.1–8.4). So this spike is deliberately
 * narrow.
 */
import ClipperLib, { type Paths } from 'clipper-lib';
import { polygonClippingBackend } from './backend.js';
import { bufferPolyline } from './primitives.js';
import { countVertices, simplifyMulti } from './simplify.js';
import type { MultiPoly, Point } from './types.js';

/** Clipper works in integers; scale lattice floats up and back. 1e4 → sub-
 * micro-cell precision, far finer than any render or simplify tolerance. */
const SCALE = 1e4;

/**
 * True polygon offset of an OPEN polyline via `ClipperOffset` — round joins,
 * round caps, the offset the stand-in approximates. Returns a `MultiPoly` in
 * lattice units. (A single open polyline offsets to one outer ring; we map each
 * solution path to its own poly, which is correct for the non-self-crossing
 * strokes this spike uses.)
 */
export function offsetPolylineClipper(points: Point[], width: number): MultiPoly {
  if (points.length === 0 || width <= 0) return [];
  const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE);
  const path = points.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
  co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  const solution: Paths = [];
  co.Execute(solution, (width / 2) * SCALE);
  return solution.map((p) => [p.map((pt) => ({ x: pt.X / SCALE, y: pt.Y / SCALE }))]);
}

/** Shoelace area of a floor union (abs, summed over outer rings minus holes). */
export function unionArea(mp: MultiPoly): number {
  let area = 0;
  mp.forEach((poly) => {
    poly.forEach((ring, ri) => {
      let a = 0;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]!;
        const q = ring[(i + 1) % ring.length]!;
        a += p.x * q.y - q.x * p.y;
      }
      area += (ri === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  });
  return area;
}

export interface OffsetRow {
  stroke: string;
  method: 'stand-in' | 'clipper';
  rawVerts: number;
  simpVerts: number;
  rings: number;
  area: number;
  ms: number;
}

/** Representative brush strokes (lattice units). */
export function spikeStrokes(): Record<string, Point[]> {
  const arc: Point[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * (Math.PI / 2);
    arc.push({ x: 5 + Math.cos(t) * 5, y: 5 + Math.sin(t) * 5 });
  }
  const zigzag: Point[] = [];
  for (let i = 0; i < 10; i++) zigzag.push({ x: i, y: i % 2 === 0 ? 0 : 1.2 });
  return {
    straight: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    arc,
    zigzag, // sharp concave turns — where the stand-in's per-segment quads overlap hardest
    hairpin: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 0.6 },
      { x: 0, y: 0.6 },
    ],
  };
}

/** Run both methods across the strokes and return one row per (stroke, method).
 * `iters` averages the timing. Tolerance matches the freeform `path` default. */
export function runOffsetSpike(width = 1, tol = 0.15, iters = 200): OffsetRow[] {
  const rows: OffsetRow[] = [];
  const strokes = spikeStrokes();
  for (const [name, pts] of Object.entries(strokes)) {
    for (const method of ['stand-in', 'clipper'] as const) {
      const run = () =>
        method === 'stand-in'
          ? bufferPolyline(pts, width, polygonClippingBackend)
          : offsetPolylineClipper(pts, width);
      const raw = run();
      let ms = 0;
      const t0 = performance.now();
      for (let i = 0; i < iters; i++) run();
      ms = (performance.now() - t0) / iters;
      const simp = simplifyMulti(raw, tol);
      rows.push({
        stroke: name,
        method,
        rawVerts: countVertices(raw),
        simpVerts: countVertices(simp),
        rings: raw.reduce((n, poly) => n + poly.length, 0),
        area: unionArea(raw),
        ms,
      });
    }
  }
  return rows;
}

/** Pretty-print the comparison as a table (called by the spike test). */
export function formatOffsetRows(rows: OffsetRow[]): string {
  const head = ['stroke', 'method', 'rawV', 'simpV', 'rings', 'area', 'ms'];
  const body = rows.map((r) => [
    r.stroke,
    r.method,
    String(r.rawVerts),
    String(r.simpVerts),
    String(r.rings),
    r.area.toFixed(2),
    r.ms.toFixed(4),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]!.length)));
  const line = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  return [line(head), ...body.map(line)].join('\n');
}
