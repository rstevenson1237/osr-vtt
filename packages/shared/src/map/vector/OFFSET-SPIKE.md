# §8.1 Offset spike — findings & recommendation

**Question (SPEC §8.1 / REVIEW M6):** polygon-clipping does boolean ops only, no
polygon offsetting. The POC buffers freeform brush strokes with a **stand-in** —
`bufferPolyline`, a union of per-segment quads + round caps. Is a **true polygon
offset** (Clipper's `ClipperOffset`) enough better to justify adding a library?

**Method:** `offset-spike.ts` / `offset-spike.test.ts` run both methods over four
representative brush strokes. `clipper-lib` (pure-JS Clipper1) supplies the true
offset for the *quality* axis — same offset-algorithm family as the spec-named
Clipper2, but trivially runnable in Node/vitest with no WASM. Bundle/cold-start
is measured separately (below). Reproduce: `pnpm test:unit src/map/vector/offset-spike --disableConsoleIntercept`.

## Quality + perf (measured)

`width = 1`, simplify tol `0.15` (the freeform `path` default), 200 iters for timing:

| stroke   | method   | raw verts | simplified | area  | ms/op  |
|----------|----------|-----------|------------|-------|--------|
| straight | stand-in | 15        | 8          | 10.75 | 0.253  |
| straight | clipper  | 6         | 6          | 10.50 | 0.041  |
| arc      | stand-in | 98        | 14         | 8.59  | 2.347  |
| arc      | clipper  | 51        | 14         | 8.35  | 0.171  |
| zigzag   | stand-in | 85        | 23         | 14.08 | 0.596  |
| zigzag   | clipper  | 30        | 30         | 13.14 | 0.075  |
| hairpin  | stand-in | 20        | 9          | 14.12 | 0.229  |
| hairpin  | clipper  | 9         | 9          | 13.81 | 0.023  |

**Reading it:**
- **Quality is a wash.** The stand-in's area is within **2–7%** of the true offset
  everywhere (it runs slightly *fat* — a round cap at every vertex). Both are
  valid single connected regions. After Douglas-Peucker the vertex counts
  **converge** (arc 14=14, hairpin 9=9) and on the zigzag the stand-in is even
  *leaner* (23 vs 30) because DP eats its redundant collinear points while
  clipper's round joins are all real curvature. There is no visible-quality case
  for switching.
- **The stand-in's real cost is perf, and it scales with point count.** It does
  one boolean union per segment, so a 17-point arc already costs **2.3 ms** vs
  clipper's 0.17 ms. A long freeform drag (hundreds of samples) would get
  expensive per preview frame.

## Bundle / cold-start (measured, gzipped)

| candidate | offset? | gzip | notes |
|---|---|---|---|
| **polygon-clipping** (in use) | ❌ | **9.3 KB** (min) | booleans only; what we ship today |
| **clipper-lib** (pure JS) | ✅ | ~44 KB (unmin) / est. ~25–30 KB min | added *on top of* polygon-clipping for offset |
| **clipper2-wasm** | ✅ | ~150–250 KB + WASM | 1.23 MB unpacked; adds WASM instantiate cold-start |

## Recommendation — keep polygon-clipping + stand-in; do **not** adopt WASM

1. **Quality doesn't justify a switch** — the stand-in is geometrically faithful
   and converges with the true offset after simplify.
2. **The one weakness (per-stroke perf) is fixed without a library.** Brush input
   is decimated to `width / 4` before buffering (`decimatePolyline`, now wired
   into `bufferPolyline`), capping the union count regardless of pointer sample
   rate. That removes the scaling risk far more cheaply than a WASM dependency on
   a static-hosted app.
3. **martinez stays eliminated** (REVIEW M6 — no offset either).
4. **If a true offset is ever wanted** (e.g. exact caps/joins matter for a feature
   we don't have yet), the far better swap is **clipper-lib (pure JS, ~+30 KB
   gz)**, not clipper2-wasm — and the offset seam makes it a drop-in. clipper2-wasm's
   bundle + cold-start cost isn't warranted for one buffering feature.

**Net:** lock `polygon-clipping` as the boolean backend, keep `bufferPolyline`
(now decimation-guarded) as the offset, and hold `clipper-lib` as the ready
fallback. The "M6 offset stand-in" caveat downgrades from *risk* to *documented,
measured, mitigated choice*.

### Caveat on the measurement
The quality numbers use clipper-lib (Clipper1) as the offset proxy; Clipper2's
offset is the same algorithm family, so the quality conclusion carries. The
clipper2-wasm bundle/cold-start figures are from published package metadata, not
a built bundle — if we ever seriously consider it, build a real bundle first.
