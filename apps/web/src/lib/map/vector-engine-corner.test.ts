import { describe, expect, it } from 'vitest';
import { adaptiveCornerRadius, roundedPolyPath, type PolyPathTarget } from './vector-engine';

/** Records path commands without a real Pixi/WebGL context, so
 * `roundedPolyPath`'s vertex-tracing behavior can be asserted directly. */
function recordingPath(): PolyPathTarget & { commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    poly(points) {
      commands.push(`poly:${points.length}`);
    },
    moveTo(x, y) {
      commands.push(`move:${x},${y}`);
    },
    lineTo(x, y) {
      commands.push(`line:${x},${y}`);
    },
    quadraticCurveTo(cx, cy, x, y) {
      commands.push(`curve:${cx},${cy}->${x},${y}`);
    },
    closePath() {
      commands.push('close');
    },
  };
}

/** A regular n-gon's vertices, matching `vectorMap.regularPoly`'s sampling
 * (`packages/shared/src/map/vector/primitives.ts`) — used to check the fillet
 * radius at a shallow, curve-like turn. */
function ngonPoint(n: number, i: number, r: number): { x: number; y: number } {
  const t = (i / n) * Math.PI * 2;
  return { x: Math.cos(t) * r, y: Math.sin(t) * r };
}

describe('adaptiveCornerRadius (render-only fillet math)', () => {
  it('keeps a 90-degree room corner crisp (small, edge-fraction-capped)', () => {
    const prev = { x: 0, y: 0 };
    const cur = { x: 10, y: 0 };
    const next = { x: 10, y: 10 };
    const radius = adaptiveCornerRadius(prev, cur, next);
    // Old fixed behavior was capped at 4px (or 0.4 * edge length, whichever
    // is smaller) — a sharp corner must stay in that same small range.
    expect(radius).toBeLessThanOrEqual(4.01);
    expect(radius).toBeGreaterThan(0);
  });

  it('gives a 64-gon circle vertex (~5.6deg/vertex) a large, near-half-edge radius', () => {
    const n = 64;
    const r = 100;
    const prev = ngonPoint(n, 9, r);
    const cur = ngonPoint(n, 10, r);
    const next = ngonPoint(n, 11, r);
    const edgeLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const radius = adaptiveCornerRadius(prev, cur, next);
    // Should be a large fraction of the (tiny) edge, not clamped to 4px —
    // that's what lets neighboring fillets meet and read as a smooth curve.
    expect(radius).toBeGreaterThan(edgeLen * 0.4);
    expect(radius).toBeLessThanOrEqual(edgeLen * 0.5 + 1e-9);
  });

  it('blends monotonically between shallow and sharp turns, no hard jump', () => {
    // Fixed edge length (10 on both sides of the corner), only the turn angle
    // varies — SHALLOW..SHARP is 12deg..40deg, so the fillet radius should
    // shrink as the turn sharpens, not snap between two fixed values.
    const cornerAt = (turnDeg: number) => {
      const rad = (turnDeg * Math.PI) / 180;
      const cur = { x: 0, y: 0 };
      const prev = { x: -10, y: 0 };
      const next = { x: 10 * Math.cos(rad), y: 10 * Math.sin(rad) };
      return adaptiveCornerRadius(prev, cur, next);
    };
    const shallow = cornerAt(6); // below SHALLOW_TURN_DEG — fully smooth
    const mid = cornerAt(26); // inside the blend zone
    const sharp = cornerAt(90); // well above SHARP_TURN_DEG — fully crisp
    expect(shallow).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(sharp);
  });

  it('returns 0 for a degenerate zero-length adjacent edge', () => {
    const cur = { x: 5, y: 5 };
    expect(adaptiveCornerRadius(cur, cur, { x: 6, y: 5 })).toBe(0);
    expect(adaptiveCornerRadius({ x: 4, y: 5 }, cur, cur)).toBe(0);
  });
});

describe('roundedPolyPath (render-only path tracing)', () => {
  it('emits every vertex of a plain rectangle', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const path = recordingPath();
    roundedPolyPath(path, rect);
    const drawn = path.commands.filter((c) => c.startsWith('move:') || c.startsWith('line:'));
    expect(drawn).toHaveLength(rect.length);
    expect(path.commands.at(-1)).toBe('close');
  });

  it('does not drop corners around a duplicate/collinear vertex (carve-seam artifact)', () => {
    // A boolean-op carve result with a duplicate point at (10,0), as can
    // happen when a grid-snapped carve corner lands exactly on an existing
    // floor vertex. Before the fix, the degenerate-edge guard skipped
    // emitting both the duplicate AND its neighbor from the path, collapsing
    // this rectangle down to a triangle on screen.
    const rectWithSeam = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 }, // duplicate vertex
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const path = recordingPath();
    roundedPolyPath(path, rectWithSeam);
    const drawn = path.commands.filter((c) => c.startsWith('move:') || c.startsWith('line:'));
    // Every input vertex — including the degenerate one — must still produce
    // a path command; none may be silently dropped.
    expect(drawn).toHaveLength(rectWithSeam.length);
  });
});
