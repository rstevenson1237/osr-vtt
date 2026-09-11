# WI-122 — what the per-hex terrain clip costs

DEC-090 answered SPEC-047 §9 **(a) conditional on cost**: the 1.8× terrain overlay box is
approved only if masking each glyph to its own hex pays for itself, with **(b)** — the
largest box that still fits unclipped — pre-approved as the fallback. There is no
`Sprite.mask` anywhere else in `vector-engine.ts` to inherit a cost expectation from, so
this is the measurement that condition asked for.

**It does not pay for itself.** The fallback shipped.

## Method

`apps/web/bench/hex-overlay-cost.ts`, driven by `node apps/web/bench/run.mjs`. The page
rebuilds the layers `renderHexTiles` builds — one `Graphics` carrying every per-region hex
fill, one tinted `Sprite` per terrain overlay at `HEX_TERRAIN_OVERLAY_ALPHA`, one black
`Sprite` per contents icon on every third hex — over a square block of painted hexes at
`DEFAULT_HEX_GRID_CONFIG.size` (48), using real pack art. The masked variants add what the
engine would add: one `PIXI.Graphics` hexagon per painted tile, from the same `hexCorners`
as the fill underneath, set as that sprite's `mask`.

Each variant is timed twice: **at rest**, with the world transform untouched between
frames, and **under pan/zoom**, with position and scale changed every frame. Frames are
rendered back to back through `renderer.render()` rather than through
`requestAnimationFrame` (which would report the vsync interval for anything with
headroom), and each batch is bracketed by `gl.finish()` so the GPU work falls inside the
measured window.

**Environment, and what it is worth.** Headless Chromium 1194 at 1280×800 on WebGL via
**SwiftShader** — software rasterization, no GPU in the container. Absolute numbers are
therefore inflated and are not a frame budget. What the run is good for is the **ratio**
between variants measured under identical conditions, and for locating the cost, which the
isolating variants below do directly. The mechanism explains the ratio independently of
the renderer: Pixi's `StencilMaskPipe` calls `batch.break()` twice to push a mask and twice
to pop it, so one clipped sprite is four broken batches plus a mask render. At 400 painted
hexes that is ~1600 draw calls per frame where the unclipped layer is one or two — a driver
overhead no GPU removes.

## Figures

Milliseconds per frame. Run A: 60 frames per batch. Run B: 40 frames per batch, with the
isolating variants added.

### Run A — the question as DEC-090 posed it

| Variant         | Painted hexes | At rest | Under pan/zoom                                     |
| --------------- | ------------- | ------- | -------------------------------------------------- |
| 1.1× unmasked   | 64            | 0.04    | 0.09                                               |
| 1.4× unmasked   | 64            | 0.04    | 0.09                                               |
| **1.8× masked** | 64            | 3.21    | **43.74**                                          |
| 1.1× unmasked   | 400           | 0.01    | 0.82                                               |
| 1.4× unmasked   | 400           | 0.19    | 0.96                                               |
| **1.8× masked** | 400           | 76.31   | **525.34**                                         |
| 1.1× unmasked   | 900           | 0.44    | 1.36                                               |
| 1.4× unmasked   | 900           | 0.02    | 4.45                                               |
| **1.8× masked** | 900           | —       | **did not finish 48 frames in 15 min of GPU time** |

### Run B — isolating the stencil from the fill

| Variant           | Painted hexes | At rest | Under pan/zoom                                              |
| ----------------- | ------------- | ------- | ----------------------------------------------------------- |
| 1.1× unmasked     | 64            | 0.05    | 0.11                                                        |
| 1.22× unmasked    | 64            | 0.06    | 0.07                                                        |
| 1.8× unmasked     | 64            | 0.03    | 0.08                                                        |
| 1.1× **masked**   | 64            | 0.28    | **10.09**                                                   |
| 1.8× masked       | 64            | 26.16   | 8.03                                                        |
| 1.1× unmasked     | 400           | 0.40    | 0.33                                                        |
| 1.22× unmasked    | 400           | 0.07    | 0.36                                                        |
| **1.8× unmasked** | 400           | 0.01    | **0.20**                                                    |
| **1.1× masked**   | 400           | 52.47   | **376.60**                                                  |
| 1.8× masked       | 400           | —       | did not finish 40 frames in ~12 min (Run A's 525.34 stands) |

## What the figures say

1. **The big box is free.** 1.8× **unmasked** at 400 painted hexes costs 0.20 ms/frame
   under pan — no worse than the 1.1× box it would replace (0.33). The overlay is drawn
   at 55% alpha over a fill that is already there; the extra covered pixels do not
   register.
2. **The stencil is the entire cost.** 1.1× **masked** — the box that ships today, clipped
   — costs 376.60 ms/frame under the same pan at the same 400 hexes. Same fill as the
   0.33 ms case, 1100× the cost. The clip is what is expensive, not what it is clipping.
3. **It scales with painted hexes, not with zoom.** 64 hexes masked is already 10 ms/frame;
   900 could not be measured at all. A referee filling in a region makes it worse
   monotonically, which is the wrong direction for the one layer a hex crawl is mostly
   made of.
4. **At rest is not a refuge.** 52–76 ms/frame masked at 400 hexes with nothing moving.
   A stencil mask is re-rendered into the stencil buffer every frame either way.

Even discounting SwiftShader heavily, there is no reading of these numbers in which the
mask pays for itself. **DEC-090 (b) applies.**

## What shipped, and what is still open

`hexTerrainArtPx` is `size * 1.22`, unclipped, and the fit assertion in
`vector-engine-hex.test.ts` is kept rather than replaced.

Two things are worth recording against §9's own text:

- **The fallback is 1.2247×, not the "≈1.4×" §9 estimates.** A centred square fits a
  flat-top hex only while `box·√2/2 < size·√3/2`, i.e. `box < size·√(3/2) = 1.2247·size`.
  1.4× does not fit and never did. 1.22 is the largest stable decimal under the bound, and
  the test now pins the box within 1% of it from both sides.
- **So the fallback is close to a no-op, and §9's goal is not delivered.** 1.22× is 11%
  over the 1.1× it replaces, where WI-119 §9's study asked for 64% more so the glyph would
  read as the hex's texture rather than as a speck. The measurement rules out _this_
  mechanism, not the goal — and figure 1 above says the goal is cheap if something other
  than a stencil clips it: the hex as the drawn geometry (a textured polygon fill, or a
  mesh per tile) keeps the batch intact. Logged as **IN-118**; not folded in here
  (RULE-015).
