/**
 * Geometry verification for the POC (drives the spec-critical behaviors, not
 * just typecheck). DOM-free, so it runs in Node. Bundled + executed by
 * `npm run verify`. Asserts the claims WI-1's gate depends on:
 *   - union merges, disjoint stays separate
 *   - full bisection SPLITS a region in two (SPEC §2.4 — the load-bearing claim)
 *   - interior subtraction makes a hole
 *   - perimeter derives from the polygon boundary (SPEC §3.1)
 *   - door reconciliation opens a real gap in sight (SPEC §3.3)
 *   - simplify bounds vertex growth (SPEC §5.4)
 */
import { polygonClippingBackend as B } from './src/geometry/backend.js';
import { commitCarve } from './src/geometry/pipeline.js';
import { corridorPoly, rectPoly, regularPoly } from './src/geometry/primitives.js';
import { buildSightSegments, perimeterSegments, visibilityPolygon } from './src/geometry/los.js';
import { countVertices } from './src/geometry/simplify.js';
import type { Door, MultiPoly } from './src/geometry/types.js';

type Vec = { x: number; y: number };

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

const TOL = 0;

// 1. union of two overlapping rooms → one region
{
  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 5, y: 5 })], 'add', TOL, B).floor;
  f = commitCarve(f, [rectPoly({ x: 3, y: 3 }, { x: 8, y: 8 })], 'add', TOL, B).floor;
  check('overlapping carves merge to 1 region', f.length === 1, `got ${f.length}`);
}

// 2. two disjoint rooms → two regions
{
  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 3, y: 3 })], 'add', TOL, B).floor;
  f = commitCarve(f, [rectPoly({ x: 6, y: 6 }, { x: 9, y: 9 })], 'add', TOL, B).floor;
  check('disjoint carves stay 2 regions', f.length === 2, `got ${f.length}`);
}

// 3. full bisection SPLITS one region into two (the core §2.4 claim)
{
  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 10, y: 4 })], 'add', TOL, B).floor;
  const before = f.length;
  f = commitCarve(f, [rectPoly({ x: 4, y: -1 }, { x: 6, y: 5 })], 'subtract', TOL, B).floor;
  check('rock-carve bisection splits 1 → 2 regions', before === 1 && f.length === 2, `before ${before}, after ${f.length}`);
}

// 4. interior subtraction (not touching boundary) → one region with a hole
{
  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 10, y: 10 })], 'add', TOL, B).floor;
  f = commitCarve(f, [rectPoly({ x: 4, y: 4 }, { x: 6, y: 6 })], 'subtract', TOL, B).floor;
  const holes = f[0] ? f[0].length - 1 : 0;
  check('interior rock-carve makes 1 region + 1 hole', f.length === 1 && holes === 1, `regions ${f.length}, holes ${holes}`);
}

// 5. perimeter derives from the polygon boundary
{
  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 4, y: 4 })], 'add', TOL, B).floor;
  const segs = perimeterSegments(f);
  check('rectangle perimeter = 4 segments', segs.length === 4, `got ${segs.length}`);
  check('perimeter segments tagged source=perimeter', segs.every((s) => s.source === 'perimeter'));
}

// 6. door reconciliation opens a real gap in sight (§3.3)
{
  // Proper segment crossing (matches los.ts's raycast semantics: bare endpoint
  // touches / collinear grazes don't count).
  const orient = (a: Vec, b: Vec, c: Vec) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const cross = (p1: Vec, p2: Vec, p3: Vec, p4: Vec) =>
    orient(p3, p4, p1) * orient(p3, p4, p2) < 0 && orient(p1, p2, p3) * orient(p1, p2, p4) < 0;
  const blocked = (eye: Vec, target: Vec, segs: { a: Vec; b: Vec }[]) => segs.some((s) => cross(eye, target, s.a, s.b));

  let f: MultiPoly = [];
  f = commitCarve(f, [rectPoly({ x: 0, y: 0 }, { x: 10, y: 6 })], 'add', TOL, B).floor;
  const eye = { x: 5, y: 3 };
  const target = { x: 5, y: 9 }; // straight up through the doorway span, out of the room

  const closed: Door = { id: 'd', a: { x: 4, y: 6 }, b: { x: 6, y: 6 }, type: 'single', state: 'closed' };
  const open: Door = { ...closed, state: 'open' };

  const segsClosed = buildSightSegments(f, [], [closed]);
  const segsOpen = buildSightSegments(f, [], [open]);
  check('closed door blocks sight through the wall', blocked(eye, target, segsClosed));
  check('open door opens a real gap in sight', !blocked(eye, target, segsOpen));
  // sanity: a target above a SOLID part of the wall stays blocked even when open
  check('open door only opens its own span', blocked(eye, { x: 1, y: 9 }, segsOpen));
  check('visibility polygon builds from the segment set', visibilityPolygon(eye, segsOpen, 50).length > 3);
}

// 7. simplify bounds vertex growth on an organic shape
{
  const circle = regularPoly({ x: 0, y: 0 }, 8, 1); // 64-gon
  const rawVerts = circle ? circle[0]!.length : 0;
  let f = commitCarve([], circle ? [circle] : [], 'add', 0.05, B).floor;
  const simpVerts = countVertices(f);
  check('simplify reduces circle vertex count', simpVerts < rawVerts, `raw ${rawVerts} → simpl ${simpVerts}`);
}

// 8. corridor: flat/square (axis-aligned) and grid-aligned walls when snapped
{
  const allAxisAligned = (mp: MultiPoly) =>
    mp.every((poly) =>
      poly.every((ring) =>
        ring.every((p, i) => {
          const q = ring[(i + 1) % ring.length]!;
          return Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.y - q.y) < 1e-9;
        }),
      ),
    );
  const allInteger = (mp: MultiPoly) =>
    mp.every((poly) => poly.every((ring) => ring.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))));

  const snapped = corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, true);
  check('corridor legs are axis-aligned (flat ends, 90° corner)', allAxisAligned(snapped));
  check('snapped corridor (odd width) walls land on grid lines', allInteger(snapped), JSON.stringify(snapped[0]?.[0]));

  const free = corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, false);
  check('freeform corridor is still cardinal/axis-aligned', allAxisAligned(free));
  check('freeform corridor centers the band (not grid-forced)', !allInteger(free));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
