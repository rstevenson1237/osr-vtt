import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildDieGeometry,
  faceGlyphUp,
  kindForSides,
  topFaceIndex,
  type DieKind,
} from './geometry';

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

  it('makes the d10 shorter than it is wide', () => {
    // Playtest read: the old 1.15 half-height against a radius of 1 made the
    // die taller than wide, which looked like a spike rather than a d10.
    const g = buildDieGeometry('d10');
    g.geometry.computeBoundingBox();
    const box = g.geometry.boundingBox!;
    const height = box.max.y - box.min.y;
    const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    expect(height).toBeLessThan(width);
  });

  it("points every d10 numeral's top at its own kite's apex", () => {
    // The glyph's up-vector is the face's V axis, which the default rule
    // derives from a boundary edge — oblique to a kite's symmetry axis on all
    // ten faces. `Polyhedron.faceUp` overrides it; this pins the result, since
    // nothing else would notice the override quietly regressing.
    const g = buildDieGeometry('d10');
    const uv = g.geometry.getAttribute('uv');
    for (let f = 0; f < g.faceCount; f++) {
      // Vertex 0 of every d10 face is its apex (see `pentagonalTrapezohedron`'s
      // `[apex, ring[j], ring[j+1], ring[j+2]]` winding), and each face
      // fan-triangulates to 6 vertices. Read that apex's position in UV space:
      // if the numeral's up-vector points at the apex, the apex sits straight
      // above the centre of the number square with no sideways offset.
      const base = f * 6;
      const du = uv.getX(base) - 0.5;
      const dv = uv.getY(base) - 0.5;
      expect(Math.abs(du)).toBeLessThan(1e-6);
      expect(dv).toBeGreaterThan(0);
    }
  });

  /**
   * Recovers each face's corners, in winding order, from a built geometry.
   * Every face is fan-triangulated around its first corner — `[0,1,2]`,
   * `[0,2,3]`, … — so the distinct corners are the first triangle's three
   * vertices followed by the last vertex of each further triangle.
   */
  function facesOf(kind: DieKind): Array<{ pts: THREE.Vector3[]; normal: THREE.Vector3 }> {
    const g = buildDieGeometry(kind);
    const pos = g.geometry.getAttribute('position');
    const at = (i: number) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    return g.geometry.groups.map((group) => {
      const triCount = group.count / 3;
      const pts = [at(group.start), at(group.start + 1), at(group.start + 2)];
      for (let t = 1; t < triCount; t++) pts.push(at(group.start + t * 3 + 2));
      const centroid = new THREE.Vector3();
      for (const p of pts) centroid.add(p);
      return { pts, normal: centroid.divideScalar(pts.length).normalize() };
    });
  }

  // SPEC-045 §1's binding test. Which edge `pts[0]→pts[1]` was came from the
  // order a hand-written index table happened to carry, so rotating a face's
  // index list rotated its numeral. The axis-projection + symmetry-snap rule
  // depends on the face's geometry alone, and this is what says so.
  it.each(ALL_KINDS)('gives %s a glyph-up that survives rotating the face index list', (kind) => {
    for (const { pts, normal } of facesOf(kind)) {
      const reference = faceGlyphUp(pts, normal);
      for (let r = 1; r < pts.length; r++) {
        const rotated = pts.map((_, i) => pts[(i + r) % pts.length]!);
        const got = faceGlyphUp(rotated, normal);
        expect(got.distanceTo(reference)).toBeLessThan(1e-9);
      }
    }
  });

  it.each(['d8', 'd12', 'd20'] as DieKind[])(
    "points every %s numeral's top straight at one of its own corners",
    (kind) => {
      // The snap quantises glyph-up to a centroid→corner direction, so exactly
      // one corner sits above the centre of the number square with no sideways
      // offset — a numeral's apex at a corner, its baseline parallel to the
      // opposite edge.
      const g = buildDieGeometry(kind);
      const uv = g.geometry.getAttribute('uv');
      for (const group of g.geometry.groups) {
        const triCount = group.count / 3;
        const corners = [0, 1, 2].map((k) => group.start + k);
        for (let t = 1; t < triCount; t++) corners.push(group.start + t * 3 + 2);
        const above = corners.filter((i) => Math.abs(uv.getX(i) - 0.5) < 1e-6 && uv.getY(i) > 0.5);
        expect(above).toHaveLength(1);
      }
    },
  );

  // Every face of a shape resolves against the same die-local axis, so the
  // numerals read as one family rather than as an arbitrary set: no face's
  // glyph-up may lean *away* from that axis further than the face's own
  // symmetry forces it to (half the angle between adjacent candidates —
  // 60° for a triangle, 36° for a pentagon, 45° for a square).
  it.each([
    ['d6', 45],
    ['d8', 60],
    ['d12', 36],
    ['d20', 60],
  ] as Array<[DieKind, number]>)(
    'resolves every %s face against the same +Y reference (within %d°)',
    (kind, limit) => {
      for (const { pts, normal } of facesOf(kind)) {
        const glyphUp = faceGlyphUp(pts, normal);
        let up0 = UP.clone().sub(normal.clone().multiplyScalar(UP.dot(normal)));
        if (up0.length() < 1e-6) {
          const x = new THREE.Vector3(1, 0, 0);
          up0 = x.sub(normal.clone().multiplyScalar(x.dot(normal)));
        }
        const deg = THREE.MathUtils.radToDeg(glyphUp.angleTo(up0.normalize()));
        expect(deg).toBeLessThanOrEqual(limit + 1e-4); // a symmetric face sits exactly on the bound
      }
    },
  );

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
