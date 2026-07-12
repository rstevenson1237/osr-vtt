import * as THREE from 'three';

/**
 * Procedural die geometry (Master Plan v2, R3.2). Every die shape is generated
 * from a small vertex/face table — no imported meshes, no traced assets
 * (R3.5 license discipline: geometry and numbering are produced here, in our
 * own terms). For each shape we expose:
 *
 *  - a `THREE.BufferGeometry` grouped one material slot per die face, with
 *    flat-shaded facets (duplicated vertices) for a crisp bevelled look and
 *    per-face UVs that center a number texture on each face;
 *  - `locators`: one unit direction per face (the face-centroid direction),
 *    except d4 whose locators are its *vertices* — its value is read off the
 *    upward-pointing apex, not a face (R3.1 reading convention);
 *  - `hullPoints`: the vertex cloud a Rapier convex-hull collider is built
 *    from, so the physical die matches the rendered one.
 *
 * The landed face is found by `topFaceIndex()` — a single, pure mechanism for
 * every shape: rotate each locator by the die's orientation and take the one
 * most aligned with world-up. No per-shape normal tables, and it is unit
 * tested in isolation from Three's renderer / Rapier.
 */

export type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

/** How a die's faces carry numbers — d100 renders as two tinted d10s. */
export type FaceVariant = 'normal' | 'tens';

const PHI = (1 + Math.sqrt(5)) / 2;

/** Which physical die shape renders a rolled die of `sides` faces. d100 is a
 * pair of d10s (tens + units), so it is handled by the scene, not here. */
export function kindForSides(sides: number): DieKind {
  switch (sides) {
    case 4:
      return 'd4';
    case 6:
      return 'd6';
    case 8:
      return 'd8';
    case 12:
      return 'd12';
    case 20:
      return 'd20';
    case 10:
    case 100:
      return 'd10';
    default:
      // Any oddball NdM expression still rolls a real value; render it on the
      // nearest familiar solid so the tumble stays believable.
      if (sides <= 4) return 'd4';
      if (sides <= 6) return 'd6';
      if (sides <= 8) return 'd8';
      if (sides <= 12) return 'd12';
      return 'd20';
  }
}

/** A face polygon as an ordered list of indices into a vertex table. */
type Face = number[];

interface Polyhedron {
  vertices: THREE.Vector3[];
  faces: Face[];
}

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

function normalizeAll(verts: THREE.Vector3[]): THREE.Vector3[] {
  return verts.map((p) => p.clone().normalize());
}

// ---- shape tables -------------------------------------------------------

function tetrahedron(): Polyhedron {
  const vertices = normalizeAll([v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)]);
  // Each face omits one vertex.
  const faces: Face[] = [
    [1, 2, 3],
    [0, 3, 2],
    [0, 1, 3],
    [0, 2, 1],
  ];
  return { vertices, faces };
}

function octahedron(): Polyhedron {
  const vertices = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)];
  const faces: Face[] = [
    [0, 2, 4],
    [0, 4, 3],
    [0, 3, 5],
    [0, 5, 2],
    [1, 4, 2],
    [1, 3, 4],
    [1, 5, 3],
    [1, 2, 5],
  ];
  return { vertices, faces };
}

function icosahedron(): Polyhedron {
  const vertices = normalizeAll([
    v(-1, PHI, 0),
    v(1, PHI, 0),
    v(-1, -PHI, 0),
    v(1, -PHI, 0),
    v(0, -1, PHI),
    v(0, 1, PHI),
    v(0, -1, -PHI),
    v(0, 1, -PHI),
    v(PHI, 0, -1),
    v(PHI, 0, 1),
    v(-PHI, 0, -1),
    v(-PHI, 0, 1),
  ]);
  const faces: Face[] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  return { vertices, faces };
}

/** The dodecahedron is the dual of the icosahedron: its 12 pentagon faces sit
 * at the icosahedron's 12 vertices, and its 20 vertices are the icosahedron's
 * 20 face centroids. Deriving it this way (rather than hand-writing 12 pentagon
 * index lists) keeps the face ordering consistent and self-checking. */
function dodecahedron(): Polyhedron {
  const ico = icosahedron();
  // Dodecahedron vertices = normalized centroids of the icosahedron faces.
  const vertices = ico.faces.map((f) => {
    const c = new THREE.Vector3();
    for (const idx of f) c.add(ico.vertices[idx]!);
    return c.divideScalar(f.length).normalize();
  });
  // One pentagon per icosahedron vertex: the 5 ico-faces touching it, ordered
  // around that vertex direction.
  const faces: Face[] = ico.vertices.map((vert, vi) => {
    const around = ico.faces
      .map((f, fi) => ({ fi, f }))
      .filter((x) => x.f.includes(vi));
    return orderRing(
      around.map((x) => x.fi),
      around.map((x) => vertices[x.fi]!),
      vert,
    );
  });
  return { vertices, faces };
}

/** Order a ring of vertex indices counter-clockwise around `axis` (used to
 * turn the unordered set of a pentagon's corners into a proper polygon). */
function orderRing(indices: number[], points: THREE.Vector3[], axis: THREE.Vector3): number[] {
  const n = axis.clone().normalize();
  // Build an in-plane basis.
  const ref = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = ref.clone().sub(n.clone().multiplyScalar(ref.dot(n))).normalize();
  const w = new THREE.Vector3().crossVectors(n, u);
  return indices
    .map((idx, i) => {
      const p = points[i]!;
      return { idx, angle: Math.atan2(p.dot(w), p.dot(u)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map((x) => x.idx);
}

/** Pentagonal trapezohedron — the classic d10 solid (R3.2, "custom vertex
 * data"). Ten congruent kite faces built from two 5-point rings offset in
 * height and rotated 36° apart, capped by two apexes. */
function pentagonalTrapezohedron(): Polyhedron {
  const n = 5;
  const ringR = 1;
  const ringZ = 0.25; // zig-zag height of the equatorial ring
  const apexZ = 1.15;
  const ring: THREE.Vector3[] = [];
  for (let j = 0; j < 2 * n; j++) {
    const a = (j * Math.PI) / n; // 36° steps
    const z = j % 2 === 0 ? ringZ : -ringZ;
    ring.push(v(ringR * Math.cos(a), ringR * Math.sin(a), z));
  }
  const topApex = ring.length; // index 10
  const botApex = ring.length + 1; // index 11
  const raw = [...ring, v(0, 0, apexZ), v(0, 0, -apexZ)];
  // Ten kite faces: apex + three consecutive ring points. Even faces cap the
  // top apex, odd faces the bottom.
  const faces: Face[] = [];
  for (let j = 0; j < 2 * n; j++) {
    const apex = j % 2 === 0 ? topApex : botApex;
    faces.push([apex, j % (2 * n), (j + 1) % (2 * n), (j + 2) % (2 * n)]);
  }
  // Model is built z-up; rotate to y-up to match the rest.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const vertices = raw.map((p) => p.clone().applyQuaternion(q));
  return { vertices, faces };
}

// ---- geometry assembly --------------------------------------------------

export interface DieGeometry {
  kind: DieKind;
  faceCount: number;
  geometry: THREE.BufferGeometry;
  /** Unit directions used to detect the landed face (face centroids; for d4,
   * the vertices). `topFaceIndex` returns an index into this array. */
  locators: THREE.Vector3[];
  /** Points a convex-hull collider is built from (die-local, pre-scale). */
  hullPoints: THREE.Vector3[];
  /** Uniform scale applied so every die reads at a similar on-screen size. */
  scale: number;
  /** d4 only: per-face corner data (which vertex sits at each corner and its
   * UV), so the scene can compose the three apex numbers on each face. */
  faceCorners?: Array<Array<{ vertex: number; uv: [number, number] }>>;
}

const SCALE: Record<DieKind, number> = {
  d4: 0.62,
  d6: 0.5,
  d8: 0.58,
  d10: 0.55,
  d12: 0.62,
  d20: 0.62,
};

/**
 * Builds a die geometry with one material group per face and per-face UVs that
 * center a number square on each face. Vertices are duplicated per face so the
 * facets are flat-shaded (the "bevel look" of R3.3). For d4 the value is read
 * at a vertex, so its locators are the four vertices; for every other shape
 * they are the face centroids.
 */
export function buildDieGeometry(kind: DieKind): DieGeometry {
  const poly = polyhedronFor(kind);
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const locators: THREE.Vector3[] = [];
  const faceCorners: Array<Array<{ vertex: number; uv: [number, number] }>> = [];
  let vertexCursor = 0;

  poly.faces.forEach((face, faceIndex) => {
    const pts = face.map((i) => poly.vertices[i]!);
    const centroid = new THREE.Vector3();
    for (const p of pts) centroid.add(p);
    centroid.divideScalar(pts.length);
    const normal = centroid.clone().normalize();
    if (kind !== 'd4') locators[faceIndex] = normal.clone();

    // In-plane basis to project this face's corners into UV space, scaled so
    // the polygon sits centered within the number square with a margin.
    const uAxis = pts[0]!.clone().sub(centroid).normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
    let maxR = 0;
    const proj = pts.map((p) => {
      const d = p.clone().sub(centroid);
      const pu = d.dot(uAxis);
      const pv = d.dot(vAxis);
      maxR = Math.max(maxR, Math.hypot(pu, pv));
      return [pu, pv] as const;
    });
    const fill = 0.46 / (maxR || 1); // corners land near the square's edge

    if (kind === 'd4') {
      faceCorners[faceIndex] = face.map((vertexIdx, k) => ({
        vertex: vertexIdx,
        uv: [0.5 + proj[k]![0] * fill, 0.5 + proj[k]![1] * fill] as [number, number],
      }));
    }

    // Fan-triangulate the polygon around its first corner.
    for (let t = 1; t < pts.length - 1; t++) {
      for (const k of [0, t, t + 1]) {
        const p = pts[k]!;
        positions.push(p.x, p.y, p.z);
        uvs.push(0.5 + proj[k]![0] * fill, 0.5 + proj[k]![1] * fill);
      }
    }
    const triCount = (pts.length - 2) * 3;
    geometry.addGroup(vertexCursor, triCount, faceIndex);
    vertexCursor += triCount;
  });

  if (kind === 'd4') {
    for (const vert of poly.vertices) locators.push(vert.clone().normalize());
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const scale = SCALE[kind];
  geometry.scale(scale, scale, scale);

  return {
    kind,
    faceCount: poly.faces.length,
    geometry,
    locators,
    hullPoints: poly.vertices.map((p) => p.clone().multiplyScalar(scale)),
    scale,
    faceCorners: kind === 'd4' ? faceCorners : undefined,
  };
}

function polyhedronFor(kind: DieKind): Polyhedron {
  switch (kind) {
    case 'd4':
      return tetrahedron();
    case 'd6':
      return cube();
    case 'd8':
      return octahedron();
    case 'd10':
      return pentagonalTrapezohedron();
    case 'd12':
      return dodecahedron();
    case 'd20':
      return icosahedron();
  }
}

/** A cube as an explicit 6-face polyhedron (rather than BoxGeometry) so it
 * flows through the same grouping/UV/locator path as every other shape. */
function cube(): Polyhedron {
  const s = 1;
  const vertices = [
    v(-s, -s, -s),
    v(s, -s, -s),
    v(s, s, -s),
    v(-s, s, -s),
    v(-s, -s, s),
    v(s, -s, s),
    v(s, s, s),
    v(-s, s, s),
  ];
  const faces: Face[] = [
    [1, 2, 6, 5], // +x
    [0, 4, 7, 3], // -x
    [3, 7, 6, 2], // +y
    [0, 1, 5, 4], // -y
    [4, 5, 6, 7], // +z
    [0, 3, 2, 1], // -z
  ];
  return { vertices, faces };
}

// ---- landed-face detection (pure, unit-tested) --------------------------

/**
 * Given a die's face `locators` (in die-local space) and its world
 * `orientation`, returns the index of the face pointing most nearly straight
 * up. This is the single mechanism R3.1 uses to read every landed die: no
 * per-shape tables, no physics — just the highest dot product against
 * world-up. Pure and deterministic, so it is unit tested directly.
 */
export function topFaceIndex(
  locators: THREE.Vector3[],
  orientation: THREE.Quaternion,
): number {
  let best = -Infinity;
  let bestIndex = 0;
  for (let i = 0; i < locators.length; i++) {
    const worldY = locators[i]!.clone().applyQuaternion(orientation).y;
    if (worldY > best) {
      best = worldY;
      bestIndex = i;
    }
  }
  return bestIndex;
}
