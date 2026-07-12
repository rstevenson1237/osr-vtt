/**
 * Organic "natural" wall rendering geometry (Master Plan v2, R9.4).
 *
 * The cellular model is unchanged (R9.1): walls are still grid edges, LoS still
 * uses the true edges. This module only produces the *point list* the renderer
 * draws so a `wallStyle:'natural'` run reads as a rough-hewn cave wall instead
 * of a dashed line:
 *
 *   chain contiguous natural edges into polylines (`chainWallEdges`)
 *     → subdivide + displace intermediate points with seeded value noise,
 *       clamped to ≤0.25 cell so the art never visibly disagrees with the true
 *       geometry (`naturalizePolyline`)
 *     → the renderer draws that as a smoothed quadratic curve.
 *
 * Everything here is pure and deterministic: the same inputs (including the
 * seed) always yield the identical point list, so every client renders a run
 * identically and a re-render is stable (Gate 5b — "identically on two
 * clients"). The seed is derived from stable, shared data (`hashSeed`).
 */

import { canonicalizeEdge, type Edge } from './walls.js';

export interface Point {
  x: number;
  y: number;
}

/** FNV-1a 32-bit string hash — small, fast, dependency-free, and identical on
 * every client. Used to seed a run's noise from `roomId + runKey` (R9.4). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic scalar hash of an integer given a seed — an xorshift mix,
 * returning a float in [0, 1). Pure: same (seed, i) ⇒ same output. */
function hashInt(seed: number, i: number): number {
  let x = (seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return (x >>> 0) / 4294967296;
}

/** Smoothed 1-D value noise in [-1, 1]: interpolate between per-integer random
 * values with a smoothstep so the displacement varies gently along the run
 * (rough, not jagged). */
function valueNoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hashInt(seed, i);
  const b = hashInt(seed, i + 1);
  const s = f * f * (3 - 2 * f);
  return (a + (b - a) * s) * 2 - 1;
}

export interface NaturalizeOptions {
  /** Noise seed — derive via `hashSeed(roomId + runKey)` for cross-client
   * stability (R9.4). */
  seed: number;
  cellSize: number;
  /** Extra points inserted between each pair of polyline vertices (default 3).
   * More = smoother curve, denser point list. */
  subdivisions?: number;
  /** Max perpendicular displacement, in cells — clamped to ≤0.25 by R9.4 so
   * geometry/LoS never visibly disagrees with the art (default 0.22). */
  maxDisplaceCells?: number;
  /** Noise sampling frequency in cycles per cell (default 0.6). */
  frequency?: number;
}

/**
 * Displace a polyline's interior subdivision points with seeded value noise to
 * make an organic wall curve (R9.4). Original polyline vertices and the two
 * global endpoints stay exactly on the true geometry — so a run still meets its
 * neighbours/doors cleanly and hugs the real edges — while inserted points bow
 * outward/inward by a clamped, seeded amount.
 *
 * Deterministic: identical inputs ⇒ identical output point list.
 */
export function naturalizePolyline(points: readonly Point[], opts: NaturalizeOptions): Point[] {
  const n = points.length;
  if (n < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const sub = Math.max(0, Math.floor(opts.subdivisions ?? 3));
  const clamp = Math.min(0.25, opts.maxDisplaceCells ?? 0.22);
  const maxD = clamp * opts.cellSize;
  const freq = (opts.frequency ?? 0.6) / opts.cellSize;

  const out: Point[] = [];
  let arc = 0;
  for (let s = 0; s < n - 1; s++) {
    const p = points[s]!;
    const q = points[s + 1]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    // Perpendicular unit vector to displace along.
    const px = len ? -dy / len : 0;
    const py = len ? dx / len : 0;
    const steps = sub + 1;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const bx = p.x + dx * t;
      const by = p.y + dy * t;
      if (k === 0) {
        // A true polyline vertex — keep it on the real geometry.
        out.push({ x: bx, y: by });
      } else {
        const d = valueNoise(opts.seed, (arc + len * t) * freq) * maxD;
        out.push({ x: bx + px * d, y: by + py * d });
      }
    }
    arc += len;
  }
  // The final endpoint stays exact.
  out.push({ x: points[n - 1]!.x, y: points[n - 1]!.y });
  return out;
}

/** The two lattice-intersection endpoints of a (canonicalized) grid edge. A
 * canonical `N` edge at `(x, y)` runs `(x,y)→(x+1,y)`; a `W` edge runs
 * `(x,y)→(x,y+1)`. */
function edgeEndpoints(edge: Edge): [Point, Point] {
  const c = canonicalizeEdge(edge);
  return c.side === 'N'
    ? [
        { x: c.x, y: c.y },
        { x: c.x + 1, y: c.y },
      ]
    : [
        { x: c.x, y: c.y },
        { x: c.x, y: c.y + 1 },
      ];
}

const ptKey = (p: Point): string => `${p.x},${p.y}`;
function parsePtKey(k: string): Point {
  const [x, y] = k.split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

/**
 * Chain a set of grid edges into contiguous polylines of lattice-intersection
 * points (R9.4 "chain contiguous natural-style edges into polylines"). Walks
 * open chains from their odd-degree endpoints first, then any remaining closed
 * loops, consuming each edge exactly once. Deterministic: nodes and their
 * incident edges are visited in sorted order, so every client produces the same
 * polylines (and the same seed inputs) for the same edge set.
 */
export function chainWallEdges(edges: readonly Edge[]): Point[][] {
  const segments = edges.map(edgeEndpoints);
  // node key -> incident segment indices
  const adjacency = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i]!;
    for (const p of [a, b]) {
      const k = ptKey(p);
      const list = adjacency.get(k);
      if (list) list.push(i);
      else adjacency.set(k, [i]);
    }
  }

  const used = new Array<boolean>(segments.length).fill(false);
  const otherEnd = (segIdx: number, fromKey: string): Point => {
    const [a, b] = segments[segIdx]!;
    return ptKey(a) === fromKey ? b : a;
  };
  const walk = (startKey: string): Point[] => {
    const chain: Point[] = [parsePtKey(startKey)];
    let curKey = startKey;
    for (;;) {
      const next = (adjacency.get(curKey) ?? []).find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = true;
      const np = otherEnd(next, curKey);
      chain.push(np);
      curKey = ptKey(np);
    }
    return chain;
  };

  const nodeKeys = [...adjacency.keys()].sort();
  const polylines: Point[][] = [];
  // Open chains first — start at odd-degree nodes so a path isn't split
  // mid-run into two half-chains.
  for (const k of nodeKeys) {
    if ((adjacency.get(k)!.length & 1) === 1) {
      while ((adjacency.get(k) ?? []).some((i) => !used[i])) {
        const chain = walk(k);
        if (chain.length > 1) polylines.push(chain);
        else break;
      }
    }
  }
  // Any remaining edges form closed loops.
  for (const k of nodeKeys) {
    while ((adjacency.get(k) ?? []).some((i) => !used[i])) {
      const chain = walk(k);
      if (chain.length > 1) polylines.push(chain);
      else break;
    }
  }
  return polylines;
}
