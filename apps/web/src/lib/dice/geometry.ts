import * as THREE from 'three';

/**
 * Procedural die geometry (Master Plan v2, R3.2). Every die shape is generated
 * from a small vertex/face table — no imported meshes, no traced assets
 * (R3.5 license discipline: geometry and numbering are produced here, in our
 * own terms). For each shape we expose:
 *
 *  - a `THREE.BufferGeometry` grouped one material slot per die face, with
 *    flat-shaded facets (duplicated vertices) and per-face UVs that center a
 *    number texture on each face, plus **one further group past the value
 *    range** (`bodyGroupIndex`) holding all the bevel geometry — every edge
 *    strip and corner patch — so real dice's rounded edges exist without
 *    disturbing the `faceIndex → value` 1:1 relation (SPEC-045 §4, DEC-079);
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
  /**
   * Optional per-face "up" direction for the numeral, one entry per face — the
   * declared **override** on SPEC-045 §1's rule.
   *
   * By default `buildDieGeometry` calls `faceGlyphUp`: the die-local +Y axis
   * projected into the face plane and snapped to one of the orientations the
   * face's own symmetry admits. A direction supplied here is used instead,
   * **without** the snap, for a shape whose faces have an axis worth pointing
   * at that the family rule cannot name. The d10 is that shape: none of a
   * kite's edges — and none of its corners — answers to the family rule, so it
   * names its own symmetry axis, apex-ward.
   */
  faceUp?: THREE.Vector3[];
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
    const around = ico.faces.map((f, fi) => ({ fi, f })).filter((x) => x.f.includes(vi));
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
  const u = ref
    .clone()
    .sub(n.clone().multiplyScalar(ref.dot(n)))
    .normalize();
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
 * height and rotated 36° apart, capped by two apexes.
 *
 * Each kite face is the quadrilateral {apex, ring[j], ring[j+1], ring[j+2]}.
 * Those four points are only coplanar — a flat kite, rather than a warped
 * quad that folds along its diagonal and reads as a crease pushing inward —
 * when the ring's zig-zag height and the apex height satisfy a fixed ratio.
 * Setting `ringZ` independently of `apexZ` (as a previous version did)
 * breaks that ratio and produces exactly that visible fold on every face.
 * Deriving `ringZ` from `apexZ` here keeps them locked to the planar value:
 * for an n-gonal trapezohedron, coplanarity requires
 * `ringZ / apexZ === tan²(π / (2n))` (derived from the face's triple product
 * vanishing — see `geometry.test.ts` for the direct planarity check).
 *
 * `apexZ` is the aspect knob, and it is the *only* one that may move: at
 * `ringR = 1` the solid is `2·apexZ` tall and 2 wide, so `apexZ` reads directly
 * as height ÷ width. It was 1.15 — taller than wide, which read as a spike
 * rather than a die — and is now 0.85, shorter than it is wide. Widening via
 * `ringR` instead would also work (the planarity root is `ringR`-independent),
 * but it grows the bounding sphere; changing `apexZ` and then re-matching the
 * on-screen size with `SCALE.d10` keeps the die's footprint under control.
 *
 * Two things follow from a flatter kite, both wanted: the apex stops dominating
 * the bounding sphere (the ring vertices do), and the apex→centroid distance
 * that sets the numeral square's `fill` shrinks, so the glyph sits larger and
 * closer to the kite's visual middle. */
function pentagonalTrapezohedron(): Polyhedron {
  const n = 5;
  const ringR = 1;
  const apexZ = 0.85;
  const ringZ = apexZ * Math.tan(Math.PI / (2 * n)) ** 2; // planar-face ratio
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
  // Each numeral's "up" points along its own kite's symmetry axis, from the
  // far ring vertex toward the apex — i.e. toward the north vertex on the five
  // top faces and the south vertex on the five bottom ones, the way a physical
  // d10's numbers are cut. The family rule (SPEC-045 §1) snaps to a corner or
  // an edge midpoint, and the kite offers neither on that axis — its two
  // off-axis corners sit either side of it — so the shape declares the answer
  // instead; hence `faceUp`, applied without the snap.
  const faceUp: THREE.Vector3[] = [];
  for (let j = 0; j < 2 * n; j++) {
    const apex = j % 2 === 0 ? topApex : botApex;
    faces.push([apex, j % (2 * n), (j + 1) % (2 * n), (j + 2) % (2 * n)]);
    faceUp.push(raw[apex]!.clone().sub(raw[(j + 1) % (2 * n)]!));
  }
  // Model is built z-up; rotate to y-up to match the rest.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const vertices = raw.map((p) => p.clone().applyQuaternion(q));
  return {
    vertices,
    faces,
    faceUp: faceUp.map((d) => d.applyQuaternion(q)),
  };
}

// ---- numeral orientation (SPEC-045 §1) ----------------------------------

/**
 * The die-local reference axis the rule projects onto each face. `+Y` is the
 * same axis `topFaceIndex` scans, so a die has one reference direction rather
 * than two; `+X` stands in on a face whose normal is parallel to `+Y`.
 */
const GLYPH_REF_AXIS = new THREE.Vector3(0, 1, 0);
const GLYPH_REF_AXIS_FALLBACK = new THREE.Vector3(1, 0, 0);
const GLYPH_EPS = 1e-9;

/**
 * The direction a numeral's top points on one face — SPEC-045 §1's
 * axis-projection + symmetry-snap rule, replacing the first-edge rule of
 * SPEC-020 §5.
 *
 * `pts` are the face's corners in winding order and `normal` its unit normal.
 * The result is a unit vector in the face plane, and it is **independent of the
 * order the corners arrived in**: rotating `pts` (`[a,b,c]` → `[b,c,a]`, and
 * the pentagon and quad equivalents) returns the same vector. That is the
 * property the edge rule failed — its answer came from whichever vertex a
 * hand-written index table happened to list first.
 */
export function faceGlyphUp(pts: THREE.Vector3[], normal: THREE.Vector3): THREE.Vector3 {
  const centroid = new THREE.Vector3();
  for (const p of pts) centroid.add(p);
  centroid.divideScalar(pts.length);

  // 1. The reference axis, projected into the face plane.
  const project = (axis: THREE.Vector3) =>
    axis.clone().sub(normal.clone().multiplyScalar(axis.dot(normal)));
  let up0 = project(GLYPH_REF_AXIS);
  if (up0.length() < 1e-6) up0 = project(GLYPH_REF_AXIS_FALLBACK);
  up0.normalize();
  const right = new THREE.Vector3().crossVectors(normal, up0).normalize();

  // 2. The orientations this face actually admits. A numeral's apex points at a
  //    corner, so its baseline lies parallel to the opposite edge — what a
  //    machined die does. A square face has no corner opposite an edge, so its
  //    numerals square up to an edge midpoint instead. (The d6 is the only
  //    shape here with quadrilateral faces that reach this rule; the d10's
  //    kites take the `faceUp` override.)
  const candidates =
    pts.length === 4
      ? pts.map((p, i) =>
          p
            .clone()
            .add(pts[(i + 1) % pts.length]!)
            .multiplyScalar(0.5)
            .sub(centroid),
        )
      : pts.map((p) => p.clone().sub(centroid));

  // 3. Snap to the best-aligned candidate. Quantising to one of the three,
  //    four or five directions the face admits is what makes step 1 need only
  //    be roughly right. A face symmetric about `up0` produces an exact tie;
  //    breaking it on `right` keeps the answer independent of corner order.
  let best = up0;
  let bestDot = -Infinity;
  let bestSide = -Infinity;
  for (const c of candidates) {
    const dir = project(c).normalize();
    const dot = dir.dot(up0);
    const side = dir.dot(right);
    if (dot > bestDot + GLYPH_EPS || (Math.abs(dot - bestDot) <= GLYPH_EPS && side > bestSide)) {
      best = dir;
      bestDot = dot;
      bestSide = side;
    }
  }
  return best;
}

// ---- bevelled edges (SPEC-045 §4) --------------------------------------

/**
 * Bevel width in **world** units — i.e. after `SCALE`, the space the renderer
 * and the collider both work in. Stated there rather than in a shape's own
 * unit-vertex space because that space is not shared: the cube's face is 2×2
 * while the icosahedron's triangle spans about 1, so a single unit-space width
 * would give the d6 a hairline and the d20 a chamfer half its face. Each shape
 * divides by its own `scale` to get back to unit space.
 *
 * Real dice are chamfered a few percent of their width; at these radii
 * (~0.44–0.58) 0.022 lands the bevel between 8% (d6) and 13% (d20) of a face's
 * inradius — wide enough to break the silhouette that SPEC-045 §3's normal map
 * cannot touch, narrow enough that the flat facet still dominates the face.
 */
const BEVEL = 0.022;
/**
 * A hard ceiling on the bevel as a fraction of the face's own inradius, so no
 * future `SCALE` or `BEVEL` change can inset a face past its own centre and
 * collapse the value facet. No current shape comes close (the d20, the tightest,
 * sits at ~0.13).
 */
const BEVEL_MAX_FRACTION = 0.22;

/**
 * The plane a face actually lies in, oriented to agree with `outward`.
 *
 * Not the same vector as the face's locator: a locator is the **centroid
 * direction**, and for a face that is not centro-symmetric — the d10's kites —
 * the centroid is not the foot of the perpendicular from the die's centre, so
 * the two differ by a fraction of a degree. The locator keeps its definition
 * (it is what `topFaceIndex` scans, and what the UV basis is built against);
 * the inset below needs the true plane, or a bevelled kite stops being flat and
 * the coplanarity check in `geometry.test.ts` catches it.
 *
 * Newell's method rather than one edge cross product: it averages over the whole
 * boundary, so a quad that is coplanar only to floating-point tolerance still
 * gets a stable normal.
 */
function facePlaneNormal(pts: THREE.Vector3[], outward: THREE.Vector3): THREE.Vector3 {
  const n = new THREE.Vector3();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[(k + 1) % pts.length]!;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  n.normalize();
  return n.dot(outward) < 0 ? n.negate() : n;
}

/**
 * The in-plane inward normal of each boundary edge of a convex face, indexed so
 * that entry `k` belongs to the edge `pts[k] → pts[k+1]`.
 *
 * The sign is settled against the face centroid rather than against the winding
 * order, because the winding is **not** consistent across these shape tables:
 * the tetrahedron's four faces wind inward, the trapezohedron's ten alternate,
 * the rest wind outward. Nothing downstream ever depended on that (the
 * materials are `DoubleSide` and `computeVertexNormals` follows whatever
 * winding it is handed), and the bevel must not start depending on it either.
 */
function edgeInwardNormals(
  pts: THREE.Vector3[],
  plane: THREE.Vector3,
  centroid: THREE.Vector3,
): THREE.Vector3[] {
  return pts.map((a, k) => {
    const b = pts[(k + 1) % pts.length]!;
    const edge = b.clone().sub(a).normalize();
    const inward = new THREE.Vector3().crossVectors(plane, edge).normalize();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    return inward.dot(centroid.clone().sub(mid)) < 0 ? inward.negate() : inward;
  });
}

/**
 * Insets a convex face by `width`, **in its own plane**, by offsetting every
 * boundary edge inward by exactly `width` and taking the corners where adjacent
 * offset edges meet. The result is the visible value facet; the band between it
 * and the original boundary is what the bevel strips and corner patches fill.
 *
 * Offsetting edges, rather than scaling the polygon toward its centroid, is what
 * makes the bevel a **constant width** all the way round. On a regular polygon
 * the two agree; on the d10's kite a centroid scale would run from a hairline
 * along the short edges to several times that along the long ones.
 *
 * The corner solve: writing the new corner as `p + α·n_prev + β·n_next`, both
 * offset conditions read `α + β·(n_prev·n_next) = width`, so by symmetry
 * `α = β = width / (1 + n_prev·n_next)`. The denominator only vanishes for a
 * degenerate 180° corner, which a convex face table cannot produce.
 */
function insetFace(
  pts: THREE.Vector3[],
  plane: THREE.Vector3,
  centroid: THREE.Vector3,
  width: number,
): THREE.Vector3[] {
  const inward = edgeInwardNormals(pts, plane, centroid);
  return pts.map((p, k) => {
    const prev = inward[(k - 1 + pts.length) % pts.length]!;
    const next = inward[k]!;
    const step = width / (1 + prev.dot(next));
    return p.clone().add(prev.clone().add(next).multiplyScalar(step));
  });
}

/** The largest circle centred on the face centroid that fits inside the face —
 * the quantity `BEVEL_MAX_FRACTION` is a fraction of. */
function faceInradius(pts: THREE.Vector3[], plane: THREE.Vector3, centroid: THREE.Vector3): number {
  const inward = edgeInwardNormals(pts, plane, centroid);
  return Math.min(
    ...inward.map((n, k) => {
      const mid = pts[k]!.clone()
        .add(pts[(k + 1) % pts.length]!)
        .multiplyScalar(0.5);
      return n.dot(centroid.clone().sub(mid));
    }),
  );
}

// ---- geometry assembly --------------------------------------------------

export interface DieGeometry {
  kind: DieKind;
  faceCount: number;
  geometry: THREE.BufferGeometry;
  /** Unit directions used to detect the landed face (face centroids; for d4,
   * the vertices). `topFaceIndex` returns an index into this array. */
  locators: THREE.Vector3[];
  /**
   * The material slot carrying the die **body** — every bevel strip and corner
   * patch, in one group, one untextured material (SPEC-045 §4, DEC-079).
   *
   * It is always `faceCount`: the value faces keep slots `0 … faceCount-1`,
   * still 1:1 with values, so every consumer that iterates the value range —
   * `locators[faceIndex]`, the face→value remap RULE-013 rests on, the d100
   * tens tint, the d4's composed corners — is correct as written. The field
   * exists so the convention is **stated in the type** rather than re-derived
   * by arithmetic at each call site.
   */
  bodyGroupIndex: number;
  /**
   * Points a convex-hull collider is built from (die-local, pre-scale).
   *
   * Deliberately the **un-bevelled** vertex cloud, so the collider is a hair
   * larger than the mesh it stands for — the safe direction, since a collider
   * inside its mesh lets a corner visibly interpenetrate instead.
   *
   * SPEC-045 §4 held this open until §5 landed and dice actually struck one
   * another, because an oversized hull shows as a gap at the moment of contact.
   * It was then measured and looked at, and it stays: the bevel recesses a
   * corner by at most 9.4% of the die's own radius (the d4's apex, the sharpest
   * corner in the set; under 6% for every other shape, and `geometry.test.ts`
   * pins that bound). A **face**-first contact — the resting case — has no gap
   * at all, since the inset happens in the face's own plane and never moves it.
   * The exposure is a corner-first contact, worth about four pixels on a die
   * ninety across at the renderer's camera, and an apex-down die is not a
   * resting state.
   */
  hullPoints: THREE.Vector3[];
  /** Uniform scale applied so every die reads at a similar on-screen size. */
  scale: number;
  /** d4 only: per-face corner data (which vertex sits at each corner and its
   * UV), so the scene can compose the three apex numbers on each face. */
  faceCorners?: Array<Array<{ vertex: number; uv: [number, number] }>>;
}

/**
 * SPEC-045 §2: `SCALE` multiplies each shape's own circumradius (1 for every
 * normalized vertex table, √3 for the cube's corner-to-centre distance, ~1.004
 * for the d10's ring vertices), so a shared entry does not mean a shared
 * on-screen size — `d4: 0.56` and `d20: 0.56` gave a tetrahedron and an
 * icosahedron the same bounding sphere, and left the cube's actual (unequal)
 * circumradius unaccounted for entirely, both read against the target
 * ordering `geometry.test.ts` pins: `d4 ≤ d6 < d8 < d10 ≈ d12 < d20`. These
 * values are tuned so real circumradius (`scale × unit-shape radius`) follows
 * that ordering: ~0.44, ~0.47, 0.50, ~0.535, 0.545, 0.58.
 */
const SCALE: Record<DieKind, number> = {
  d4: 0.44,
  // The cube's corners sit at radius √3, not 1 — the one shape here whose
  // vertices aren't unit-normalized (see `cube()`). 0.271 × √3 ≈ 0.47.
  d6: 0.271,
  d8: 0.5,
  // The d10's circumradius comes from its ring vertices (`pentagonalTrapezohedron`),
  // at ~1.004 rather than 1 — the apex sits inside that at the current `apexZ`.
  // 0.533 × 1.004 ≈ 0.535, close beside `d12`.
  d10: 0.533,
  d12: 0.545,
  d20: 0.58,
};

/**
 * Builds a die geometry: one material group per value face, plus one further
 * group — `bodyGroupIndex`, always `faceCount` — carrying the bevel
 * (SPEC-045 §4). Vertices are duplicated per triangle, and the `normal`
 * attribute is written here rather than by `computeVertexNormals`, because the
 * two halves want different shading and a per-material `flatShading` flag can
 * only deliver it if the normals cooperate:
 *
 *  - **value facets** get their own triangle's normal, three times over —
 *    exactly what `computeVertexNormals` produced before, so the crisp facet
 *    the flat-shaded face material draws is unchanged;
 *  - **bevel geometry** gets, at each of its corners, the normal of the value
 *    face that corner was inset from. An edge strip therefore interpolates from
 *    one face's normal to its neighbour's across its width, and a corner patch
 *    across its span, so the smooth-shaded body material reads as a rounding
 *    rather than as a third and fourth flat facet per edge.
 *
 * The authored normal always agrees in sign with its triangle's winding, which
 * is the invariant `DoubleSide` needs: a fragment seen from the far side is lit
 * with the normal negated, so "normal = winding normal" is what makes both a
 * face that winds outward and one that winds inward light correctly. The shape
 * tables disagree about winding (see `edgeInwardNormals`) and this keeps that
 * disagreement harmless.
 *
 * For d4 the value is read at a vertex, so its locators are the four vertices;
 * for every other shape they are the face centroids.
 */
export function buildDieGeometry(kind: DieKind): DieGeometry {
  const poly = polyhedronFor(kind);
  const scale = SCALE[kind];
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const locators: THREE.Vector3[] = [];
  const faceCorners: Array<Array<{ vertex: number; uv: [number, number] }>> = [];
  /** Per value face, in `poly.faces` order: its true plane normal (outward) and
   * its inset corners, parallel to that face's vertex-index list. */
  const planeNormals: THREE.Vector3[] = [];
  const insetCorners: THREE.Vector3[][] = [];

  const pushVertex = (p: THREE.Vector3, n: THREE.Vector3, u: number, v: number) => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    uvs.push(u, v);
  };

  // Pass 1 — planes and inset corners. Both are needed per face before any
  // bevel triangle can be emitted, since every strip and patch reads the inset
  // corners of two or more faces at once.
  poly.faces.forEach((face, faceIndex) => {
    const pts = face.map((i) => poly.vertices[i]!);
    const centroid = new THREE.Vector3();
    for (const p of pts) centroid.add(p);
    centroid.divideScalar(pts.length);
    const plane = facePlaneNormal(pts, centroid);
    planeNormals[faceIndex] = plane;
    const width = Math.min(BEVEL / scale, faceInradius(pts, plane, centroid) * BEVEL_MAX_FRACTION);
    insetCorners[faceIndex] = insetFace(pts, plane, centroid, width);
  });

  // Pass 2 — the value faces, one material group each, ids 0 … faceCount-1.
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
    //
    // SPEC-045 §1: the glyph's up-vector is `faceGlyphUp` — one die-local axis
    // projected onto this face and snapped to the face's own symmetry — so
    // every face of a shape resolves against the same reference and the
    // numerals read as one family. A shape may instead name the direction the
    // numeral's *top* should point (`Polyhedron.faceUp`), which is used as
    // given, without the snap; the d10 does.
    //
    // The rule is asked about the **original** face, not the inset one, so a
    // change in bevel width can never rotate a numeral. Only the projection
    // below moves to the inset corners, and only so the glyph keeps the same
    // margin inside the facet that is actually drawn.
    const override = poly.faceUp?.[faceIndex];
    const vAxis = override
      ? override
          .clone()
          .sub(normal.clone().multiplyScalar(override.dot(normal)))
          .normalize()
      : faceGlyphUp(pts, normal);
    const uAxis = new THREE.Vector3().crossVectors(vAxis, normal).normalize();
    const facet = insetCorners[faceIndex]!;
    const facetCentroid = new THREE.Vector3();
    for (const p of facet) facetCentroid.add(p);
    facetCentroid.divideScalar(facet.length);
    let maxR = 0;
    const proj = facet.map((p) => {
      const d = p.clone().sub(facetCentroid);
      const pu = d.dot(uAxis);
      const pv = d.dot(vAxis);
      maxR = Math.max(maxR, Math.hypot(pu, pv));
      return [pu, pv] as const;
    });
    const fill = 0.46 / (maxR || 1); // corners land near the square's edge

    if (kind === 'd4') {
      // R19.6: re-anchor the three corner glyphs inboard (bias toward the face
      // centroid) so all three sit within the visible triangle and read upright
      // per face, rather than crowding the tetrahedron's points. The mesh UVs
      // below keep the full `fill` — only the number placement is pulled in.
      const INBOARD = 0.58;
      faceCorners[faceIndex] = face.map((vertexIdx, k) => ({
        vertex: vertexIdx,
        uv: [0.5 + proj[k]![0] * fill * INBOARD, 0.5 + proj[k]![1] * fill * INBOARD] as [
          number,
          number,
        ],
      }));
    }

    // The facet is planar and fan-triangulated in the order its corners arrived,
    // so one winding normal serves every triangle of the face.
    const winding = new THREE.Vector3()
      .crossVectors(facet[1]!.clone().sub(facet[0]!), facet[2]!.clone().sub(facet[1]!))
      .normalize();
    for (let t = 1; t < facet.length - 1; t++) {
      for (const k of [0, t, t + 1]) {
        pushVertex(facet[k]!, winding, 0.5 + proj[k]![0] * fill, 0.5 + proj[k]![1] * fill);
      }
    }
    const triCount = (facet.length - 2) * 3;
    geometry.addGroup(vertexCursor, triCount, faceIndex);
    vertexCursor += triCount;
  });

  // Pass 3 — the body: every edge strip and corner patch, in one group.
  const bodyGroupIndex = poly.faces.length;
  const bodyStart = vertexCursor;
  /** Where face `f` put the corner it inset from original vertex `vi`. */
  const insetAt = poly.faces.map(
    (face, f) => new Map(face.map((vi, k) => [vi, insetCorners[f]![k]!])),
  );
  const pushBodyTri = (
    a: { p: THREE.Vector3; n: THREE.Vector3 },
    b: { p: THREE.Vector3; n: THREE.Vector3 },
    c: { p: THREE.Vector3; n: THREE.Vector3 },
  ) => {
    const wind = new THREE.Vector3().crossVectors(b.p.clone().sub(a.p), c.p.clone().sub(a.p));
    const centre = a.p.clone().add(b.p).add(c.p).divideScalar(3);
    // Emit outward-wound, matching the outward corner normals above: with
    // `DoubleSide`, normal and winding must agree in sign or the body lights
    // inside-out where it meets a face.
    const tri = wind.dot(centre) >= 0 ? [a, b, c] : [a, c, b];
    for (const vtx of tri) pushVertex(vtx.p, vtx.n, 0.5, 0.5);
    vertexCursor += 3;
  };

  // Edge strips: the quad between what two adjacent faces each inset from the
  // shared edge's two endpoints.
  const edges = new Map<string, { a: number; b: number; faces: number[] }>();
  poly.faces.forEach((face, f) => {
    for (let k = 0; k < face.length; k++) {
      const a = face[k]!;
      const b = face[(k + 1) % face.length]!;
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      const rec = edges.get(key) ?? { a: Math.min(a, b), b: Math.max(a, b), faces: [] };
      rec.faces.push(f);
      edges.set(key, rec);
    }
  });
  for (const { a, b, faces } of edges.values()) {
    const [f, g] = faces;
    if (f === undefined || g === undefined) continue; // a closed solid has none
    const fa = { p: insetAt[f]!.get(a)!, n: planeNormals[f]! };
    const fb = { p: insetAt[f]!.get(b)!, n: planeNormals[f]! };
    const ga = { p: insetAt[g]!.get(a)!, n: planeNormals[g]! };
    const gb = { p: insetAt[g]!.get(b)!, n: planeNormals[g]! };
    pushBodyTri(fa, fb, gb);
    pushBodyTri(fa, gb, ga);
  }

  // Corner patches: the polygon through what every face meeting an original
  // vertex inset from it, ordered around that vertex's own direction.
  const vertexFaces: number[][] = poly.vertices.map(() => []);
  poly.faces.forEach((face, f) => {
    for (const vi of face) vertexFaces[vi]!.push(f);
  });
  vertexFaces.forEach((faces, vi) => {
    if (faces.length < 3) return;
    const ring = orderRing(
      faces,
      faces.map((f) => insetAt[f]!.get(vi)!),
      poly.vertices[vi]!,
    ).map((f) => ({ p: insetAt[f]!.get(vi)!, n: planeNormals[f]! }));
    for (let t = 1; t < ring.length - 1; t++) {
      pushBodyTri(ring[0]!, ring[t]!, ring[t + 1]!);
    }
  });
  geometry.addGroup(bodyStart, vertexCursor - bodyStart, bodyGroupIndex);

  if (kind === 'd4') {
    for (const vert of poly.vertices) locators.push(vert.clone().normalize());
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.scale(scale, scale, scale);

  return {
    kind,
    faceCount: poly.faces.length,
    geometry,
    locators,
    bodyGroupIndex,
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
export function topFaceIndex(locators: THREE.Vector3[], orientation: THREE.Quaternion): number {
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
