## SPEC-060 — The map seam controller protocol

**Status: Active** — its execution route awaits DEC-126.

_(New with IN-197, the prerequisite WI-171 §2.1 named for the `VectorMapView` extractions
IN-199 – IN-205. No `R`-number predecessor.)_

### §1 — What WI-193 already delivered

IN-197 asked for two things: an explicit input object for the render pass, and one
`requestRender()` funnel in place of 42 direct `renderAll()` calls. WI-193 (SPEC-057 §4.2,
2026-09-30) built both, for its own reasons: each layer pass is now a pure `*Inputs()`
composer plus a draw (`gridInputs`/`floorInputs`/`overlayInputs`/`fogInputs`/
`toolsInputs`), each layer has one tracking `$effect`, and every redraw goes through
`renderer.invalidate(...layers)` (`map/map-renderer.ts`). `renderAll()` survives only as a
one-line alias for "invalidate every layer". What WI-193 did not do is say how a seam that
leaves the component plugs into that machinery. This spec is that protocol; nothing in it
changes what any layer draws or the order they stack in (RULE-006).

### §2 — A seam is a controller

An extracted seam is a class in `apps/web/src/lib/map/<seam>.svelte.ts` — the
`MapToolController` shape (WI-171 §3, shape 2). Its mutable state is `$state` fields on the
class. The component constructs it once and calls its `destroy()` from `onDestroy`.

**What it is handed** (`map/map-seam.ts`, a `MapSeamDeps` type):

- `invalidate(...layers: RenderLayer[])` — the renderer's own funnel. A seam never draws,
  and never calls `renderAll`.
- Only the coordinate conversions its map kind declares (RULE-006): a square-lattice seam
  is handed `toLatticeRaw`/`toLatticeSnapped`; a hex seam is handed `hexAt`/
  `pixelToHexPoint`. A seam is never handed both, so a square-lattice consumer cannot be
  reached from a hex map by construction rather than by a branch.
- The store, `roomId`, `mapId` and the engine handles it actually uses — no wider.

### §3 — Render inputs stay composed in the component

The `*Inputs()` composers stay in `VectorMapView` (WI-171 §5: `renderAll`'s composition is
the composition root, not a seam). A composer reads a seam's state as plain field reads —
`labels.editingId` in place of the free variable `editingLabelId`. Because the fields are
`$state`, the layer's tracking `$effect` tracks them with no further wiring, and the seam
module never imports the component, so the cycle WI-171 §2.1 warned of cannot form.

Two constraints carry over unchanged and bind every seam:

1. Nothing an `*Inputs()` composer reads may write reactive state — a getter on a seam is
   pure. Assigning there re-invalidates the tracking effects every frame
   (`effect_update_depth_exceeded`).
2. The `strokeMeasureText_`/`snapCellText_`/`snapBandText_` readout mirrors are assigned
   only on the pointer path, never from a composer or a draw.

### §4 — Pointer events

A seam that takes stage input implements
`pointerDown/pointerMove/pointerUp(worldPx): boolean` — `true` when it consumed the event,
`false` leaving it untouched for the next seam. This is the shape
`handleNoteDotPointerDown`/`handleCollabPointerDown`/`handleHexPointerDown` already use.
Each seam receives raw world pixels and converts with the functions §2 handed it; the
component no longer pre-converts for it.

The dispatch order stays in `wireStagePointerEvents`, branch for branch, until IN-204 turns
the ladder into a loop over the controllers. Extracting a seam replaces its branch's call
with a call to the controller; it never moves the branch.

### §5 — What this does not change

No `data-testid` moves (all are in the markup, which stays). No store, schema, rules, layer
or coordinate-space meaning changes. Every extraction under this protocol is an
identical-outputs refactor, with the existing Playwright suite as its oracle, plus unit
tests that construct the controller with a fake `invalidate` and drive it without a
browser — which is the point of extracting at all (WI-171 §6).
