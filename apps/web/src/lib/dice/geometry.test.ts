import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDieGeometry, kindForSides, topFaceIndex, type DieKind } from './geometry';

/**
 * Face-detection math (Master Plan v2, R3.1 / Gate 4). `topFaceIndex` is the
 * single mechanism that reads every landed die — given an orientation, the
 * locator scan must return the face pointing up. These are pure: no renderer,
 * no physics.
 */

const UP = new THREE.Vector3(0, 1, 0);

describe('topFaceIndex', () => {
  it('returns the locator already pointing up under identity orientation', () => {
    const locators = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    ];
    expect(topFaceIndex(locators, new THREE.Quaternion())).toBe(0);
  });

  it('follows the orientation: a 180° flip about X makes the -Y locator read up', () => {
    const locators = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    expect(topFaceIndex(locators, flip)).toBe(1);
  });

  it('picks the +X face after a −90° rotation about Z brings it up', () => {
    const locators = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    // +X rotated +90° about Z → +Y (up).
    expect(topFaceIndex(locators, q)).toBe(0);
  });
});

const ALL_KINDS: DieKind[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const EXPECTED_FACES: Record<DieKind, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

describe('buildDieGeometry', () => {
  it.each(ALL_KINDS)('builds %s with the right face + locator count', (kind) => {
    const g = buildDieGeometry(kind);
    expect(g.faceCount).toBe(EXPECTED_FACES[kind]);
    expect(g.locators).toHaveLength(EXPECTED_FACES[kind]);
    // Every material group maps to exactly one locator/face.
    expect(g.geometry.groups).toHaveLength(EXPECTED_FACES[kind]);
  });

  it('gives d4 vertex locators and per-face corner data', () => {
    const g = buildDieGeometry('d4');
    expect(g.locators).toHaveLength(4); // vertices, not faces
    expect(g.faceCorners).toHaveLength(4);
    for (const corners of g.faceCorners!) expect(corners).toHaveLength(3);
  });

  it('has unit-length locators (directions from the die centre)', () => {
    for (const kind of ALL_KINDS) {
      for (const loc of buildDieGeometry(kind).locators) {
        expect(loc.length()).toBeCloseTo(1, 5);
      }
    }
  });

  it('maps d6 faces with an edge-aligned UV square (numerals parallel to edges)', () => {
    // R19.5: the per-face UV basis derives its U axis from a face *edge*, so a
    // square (d6) face projects to an axis-aligned square in UV space — its
    // four corners share exactly two distinct U values and two distinct V
    // values. The old centroid→corner basis rotated this 45° (a diamond, with
    // three distinct U and V values), leaving numerals canted toward a corner.
    const g = buildDieGeometry('d6');
    const uv = g.geometry.getAttribute('uv');
    const round = (n: number) => Math.round(n * 1000) / 1000;
    // Each quad face fan-triangulates to 6 vertices; take the first face.
    const us = new Set<number>();
    const vs = new Set<number>();
    for (let i = 0; i < 6; i++) {
      us.add(round(uv.getX(i)));
      vs.add(round(uv.getY(i)));
    }
    expect(us.size).toBe(2);
    expect(vs.size).toBe(2);
    // …and the square is centered on the face (symmetric about 0.5).
    const uArr = [...us].sort((a, b) => a - b);
    const vArr = [...vs].sort((a, b) => a - b);
    expect(uArr[0]! + uArr[1]!).toBeCloseTo(1, 5);
    expect(vArr[0]! + vArr[1]!).toBeCloseTo(1, 5);
  });

  it('keeps every d4 corner glyph inboard of the triangle (all three read on-face)', () => {
    // R19.6: corner glyph UVs are pulled toward the face centroid (0.5,0.5) so
    // the three numbers sit within the visible triangle rather than crowding
    // the tetrahedron's points. Each corner's offset from center must be
    // strictly smaller than the geometry's own corner offset.
    const g = buildDieGeometry('d4');
    for (const corners of g.faceCorners!) {
      for (const { uv } of corners) {
        const r = Math.hypot(uv[0] - 0.5, uv[1] - 0.5);
        expect(r).toBeLessThan(0.46); // inboard of the full-fill corner radius
      }
    }
  });

  it("keeps every d10 kite face flat — no diagonal fold/crease (each face's 4 corners are coplanar)", () => {
    // A pentagonal-trapezohedron face is a quadrilateral (apex + 3 ring
    // points); if those 4 points aren't coplanar, the fan-triangulated face
    // folds along its diagonal, reading as a visible crease that "pushes
    // inward" at an angle instead of a flat kite.
    const g = buildDieGeometry('d10');
    const pos = g.geometry.getAttribute('position');
    // Each face fan-triangulates to 2 triangles = 6 vertices; a quad's 4
    // distinct corners are triangle-0's 3 verts plus triangle-1's last vert.
    for (let f = 0; f < g.faceCount; f++) {
      const base = f * 6;
      const p0 = new THREE.Vector3(pos.getX(base), pos.getY(base), pos.getZ(base));
      const p1 = new THREE.Vector3(pos.getX(base + 1), pos.getY(base + 1), pos.getZ(base + 1));
      const p2 = new THREE.Vector3(pos.getX(base + 2), pos.getY(base + 2), pos.getZ(base + 2));
      const p3 = new THREE.Vector3(pos.getX(base + 5), pos.getY(base + 5), pos.getZ(base + 5));
      const a = p1.clone().sub(p0);
      const b = p2.clone().sub(p0);
      const c = p3.clone().sub(p0);
      const triple = a.dot(b.clone().cross(c));
      expect(Math.abs(triple)).toBeLessThan(1e-6);
    }
  });

  it('detects a distinct face for every axis-up orientation of a d20', () => {
    const g = buildDieGeometry('d20');
    // For each locator, rotate the die so that locator points up, then confirm
    // the scan reads that same locator back — the round-trip R3.1 relies on.
    g.locators.forEach((loc, i) => {
      const q = new THREE.Quaternion().setFromUnitVectors(loc.clone().normalize(), UP);
      expect(topFaceIndex(g.locators, q)).toBe(i);
    });
  });
});

describe('kindForSides', () => {
  it('maps standard sizes to their shapes', () => {
    expect(kindForSides(4)).toBe('d4');
    expect(kindForSides(6)).toBe('d6');
    expect(kindForSides(8)).toBe('d8');
    expect(kindForSides(10)).toBe('d10');
    expect(kindForSides(12)).toBe('d12');
    expect(kindForSides(20)).toBe('d20');
    expect(kindForSides(100)).toBe('d10'); // rendered as a pair by the scene
  });
});
