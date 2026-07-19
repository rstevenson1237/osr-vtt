# POC Findings — Vector Map System §9.1 build

**Build:** [`sandbox/`](./sandbox/) · **Date:** 2026-07-19 · **Status:** POC gate
evidence. Answers what this first build can answer of [`SPEC.md`](./SPEC.md) §8;
flags what still needs a human/UX call.

Run it yourself: `cd sandbox && npm install && npm run dev` (or open the published
artifact). Verify: `npm run check` (typecheck + 11 geometry assertions),
`npm run smoke` (headless UI), `node dist/stress.mjs` (numbers below).

---

## What the POC demonstrates (WI-1 gate)

All proven against the real geometry library (polygon-clipping), in lattice
units, with pixels only at the render boundary (SPEC §2.0):

- **Five floor primitives** (Room, Corridor, Path, Polygon, Regular n-gon) with a
  per-point **snap / half / free** toggle (Alt = temporary freeform) — one shared
  point-stream → shape → pipeline path, five collectors (SPEC §2.5). ✅
- **Interior rock-carve holes** (SPEC §2.4): subtract mode cuts a hole; a full
  bisection **splits one region into two automatically** — verified, it falls out
  of the boolean op with no special-casing. ✅
- **Unified wall model** (SPEC §3.1): perimeter derived from the polygon boundary
  + explicit `Wall`-tool segments, all `blocksSight`/`blocksMovement` tagged. ✅
- **Doors as floating-layer overlay objects** (SPEC §3.2/§3.4) reconciled at
  **build time** (SPEC §3.3): open door clips a real gap in sight, closed door
  blocks — verified by segment-crossing through the doorway span. ✅
- **Snapshot undo/redo** across merge/split (SPEC §8.5 / REVIEW R1). ✅
- **Live LoS**: movable eye casts a visibility polygon; doors visibly gate it. ✅
- **Direct-manipulation Select tool** (Vertex / Edge) on the floor boundary,
  walls, and doors — reshape a vertex, push an edge (e.g. a room's north wall)
  out, or move a whole door. ✅

### Select-tool identity finding (feeds §9.2 schema lock)
Editing works directly on the **baked union boundary**, which resolves the common
cases cleanly: **Edge-drag on a rectangle keeps it rectangular** (both corners of
that side translate together), and **Vertex-drag reshapes freely** — exactly the
per-primitive feel requested, for free, because those behaviors are geometric.
What the baked union *cannot* do is the primitive-specific behaviors that need
retained identity: **regular-polygon "uniform scale on vertex drag"** (the shape
no longer knows it's an n-gon once merged), and **snapping a re-dragged rectangle
back to a perfect rectangle** after a free vertex move. This is the concrete form
of SPEC §9.2's open question — *does a committed primitive persist its type +
params (n, radius, …) for re-editing, or is a baked polygon sufficient?* The POC
says: **baked union is enough for reshape/move; per-primitive re-editing needs a
retained-identity layer.** Recommend deciding this at schema lock, not now.

Verification: **11/11 geometry assertions pass** (`verify.ts`) and **headless UI
smoke passes with zero console errors** (`smoke.mjs`).

---

## §8 answers (evidence-backed)

### §8.1 Library choice — *partial; benchmark seam in place*
- **polygon-clipping (pure JS)** handles union / difference / **holes** /
  **split-on-bisection** correctly (verified) at a **trivial bundle cost**: the
  entire app is **45 KB minified / 15 KB gzip**.
- ⚠️ **Confirmed REVIEW M6:** polygon-clipping has **no offsetting and no
  simplify**. The POC buffers polylines by unioning per-segment quads (robust,
  but not a true offset) and hand-rolls Douglas-Peucker. **A production build
  still needs a real offset routine** — this is the deciding factor, not boolean
  correctness.
- The backend is a one-file swap seam (`geometry/backend.ts`). **Still to do:**
  drop in Clipper2 (WASM, has ClipperOffset + SimplifyPaths) and martinez behind
  the same interface and record bundle-size + offset-quality deltas. The harness
  is ready for it; this is the next measurement, not a blocker for WI-1's gate.

### §8.2 Vertex / document-size ceiling — *answered: not a concern at realistic scale*
Stress: **300 random carve + interior-rock ops on one map** (deterministic RNG):

| simplify tol | regions | worst-case region verts | worst-case region bytes | avg op |
|---|---|---|---|---|
| 0.00 (off) | 8 | 724 | ~11.3 KiB | 1.14 ms |
| 0.10 | 8 | 528 | ~8.3 KiB | 0.77 ms |
| 0.25 | 7 | 456 | ~7.1 KiB | 0.64 ms |

**Worst-case single region ≈ 11 KiB even with simplification OFF — ~90× under
Firestore's 1 MiB limit.** Size-driven spatial splitting is **not needed** for
realistic maps; if regions are ever split it will be for topology/edit-locality,
not bytes. (Byte figure is a JSON-coordinate estimate; Firestore's own encoding
differs but stays in the same order of magnitude.)

### §8.3 Simplification tolerance — *harness ready; preliminary read*
Live slider (0–0.6 lattice units). Preliminary: **0.10–0.15** is visually clean on
both grid-aligned and organic shapes while cutting ~25–35% of vertices; 0.25
starts to visibly round grid corners. The 2–3-tolerance side-by-side the spec
asks for is a **UX judgment call** best made by a human dragging the slider — the
tool is built to do exactly that.

### §8.4 Performance — *answered: comfortable*
Single carve/boolean/simplify commit: **~0.6–1.1 ms** average across 300 ops at
these sizes. No per-frame point-in-polygon anywhere; LoS rebuilds once per render.
Not a bottleneck at POC scale.

### §8.5 Undo granularity — *answered: snapshot*
Snapshot-based undo (`structuredClone` of {floor, walls, doors}) handles
merge/split cleanly, confirming REVIEW R1. Delta undo is not well-defined across a
split; snapshots are the right model. Byte cost is negligible given §8.2 sizes.

---

## Open calls for the human (POC gate is a UX judgment — SPEC §9.1)
1. **Primitive feel:** corner rounding, click-vs-drag, double-click-to-close
   reliability — drive each tool and confirm it "feels right in the GM's hand."
2. **Simplification tolerance:** pick a default by eye using the slider (§8.3).
3. **Library shootout:** confirm whether to invest in the Clipper2/martinez
   backend comparison now, or lock polygon-clipping + a dedicated offset lib.

## Not in this POC (by scope)
Fog (removed, SPEC §4), Firestore/store/rules (WI-B), production editor shell and
app-consumer rewiring (WI-D). Nothing here is imported by `apps/` or `packages/`.
