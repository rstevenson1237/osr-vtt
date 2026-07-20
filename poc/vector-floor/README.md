# POC Scaffold — Vector Floor Unification (R9.1 Extension)

This folder is the **isolated proof-of-concept scaffold** for the Vector Floor
Unification spec. It is deliberately self-contained and touches no production
code under `apps/` or `packages/` — so the whole POC can be rolled back by
deleting `poc/` with zero blast radius on the shipping app.

This is a **full replacement** of the existing cellular map system, not an
extension. Clean-going-forward is the priority; past decisions are not preserved
for their own sake. Migration, backwards compat, and fog are out of POC scope.

## The spec is the center of gravity

**[`SPEC.md`](./SPEC.md) is the single governing document for this POC and for
every future work item (WI-A … WI-D).** Anything built in this scaffold traces
back to a section of that spec. It is *not yet an approved work item* — per its
own §0 and §9, the POC gate (§9 step 1) and the §8 benchmark questions must be
answered before the schema (`FloorRegion`, `walls/{wallId}`, `doors/{doorId}`) is
locked and before WI-A writes any code in `packages/shared/`.

## Read order

1. **[`SPEC.md`](./SPEC.md)** — the working spec (ratified decisions folded in).
2. **[`DECISIONS.md`](./DECISIONS.md)** — the decision log: every REVIEW finding
   mapped to its ruling (user direction vs. recommendation), plus the doors/walls
   recommendation and the resolved design questions.
3. **[`FINDINGS.md`](./FINDINGS.md)** — POC results and evidence-backed §8 answers
   from the built sandbox.
4. **[`sandbox/`](./sandbox/)** — the §9.1 in-memory drawing showcase (**built**);
   `npm run dev` to drive it, `npm run check` to verify. See `sandbox/README.md`.
5. **[`REVIEW.md`](./REVIEW.md)** — the original codebase-grounded analysis that
   produced the decisions (historical; `DECISIONS.md` is the current view).

## Status

| Gate | State |
|---|---|
| Spec adopted as POC center of gravity | ✅ this scaffold |
| Review / conflict pass (§0, §8 "flag cost first") | ✅ [`REVIEW.md`](./REVIEW.md) |
| Framing + doors/walls + integration decisions ratified | ✅ [`DECISIONS.md`](./DECISIONS.md) |
| Fog removed from POC scope | ✅ SPEC §4 |
| **§9.1 sandbox — 5 primitives + hole tool + wall + door overlay + LoS** | ✅ [`sandbox/`](./sandbox/) (11/11 geom + UI smoke pass) |
| §8 answers (doc-size ceiling, perf, undo) | ✅ [`FINDINGS.md`](./FINDINGS.md) |
| Floor storage model (Model A — baked union, no retained identity) | ✅ [`DECISIONS.md`](./DECISIONS.md#model-a) |
| §8.1 offset library measured (offset stand-in vs true Clipper offset) | ✅ [`OFFSET-SPIKE.md`](../../packages/shared/src/map/vector/OFFSET-SPIKE.md) — keep polygon-clipping + decimation-guarded stand-in |
| §9.2 schema lock (`FloorRegion`, `walls`, `doors`) | ✅ types locked in `packages/shared/src/map/vector/types.ts` (Model A) |
| **WI-A — pure geometry graduated to `packages/shared`** | ✅ [`packages/shared/src/map/vector/`](../../packages/shared/src/map/vector/) (71 unit tests) |
| **WI-B — store contract, security rules, RTDB draft / Firestore commit** | ✅ `CampaignStore` methods + both impls + rules + contract suite (see [work-item map](#work-item-map-from-spec-9)) |
| **WI-C — wall/door/LoS store wiring** | ✅ [`packages/shared/src/store/vector-los.ts`](../../packages/shared/src/store/vector-los.ts) — see [work-item map](#work-item-map-from-spec-9) |
| **WI-D — production editor UI + pure-rollout cutover** | ✅ [`VectorMapView.svelte`](../../apps/web/src/lib/components/VectorMapView.svelte) is now the only map view — the cellular `MapView`/`VITE_VECTOR_MAP_EDITOR` flag are gone, the cellular store/schema/rules/collections were deleted, and symbol/label authoring is wired into the shared `MapToolbar`/`ToolsRail` (D1/D2/D4, ratified 2026-07-20). See [`DECISIONS.md`](./DECISIONS.md#wi-d-technical-decisions--ratified-and-executed-user-2026-07-20). |

**Open design questions for the user** (non-blocking, in
[`DECISIONS.md`](./DECISIONS.md)): durable door↔wall binding, standalone vision
blockers, whether the POC editor exposes sight≠movement wall toggles.

## Work-item map (from SPEC §9)

- **POC (§9.1)** — `sandbox/`, in-memory only, no Firestore/store/rules. Answers §8.
- **Schema lock (§9.2)** — amend SPEC §2 from what the POC revealed.
- **WI-A** ✅ — pure geometry graduated to
  [`packages/shared/src/map/vector/`](../../packages/shared/src/map/vector/),
  unit-tested. Namespaced as `vectorMap.*` off the package root so its
  `Point`/`Segment`/`Door` types don't collide with the cellular system. Ships
  the carve pipeline, boolean-op backend seam, `pointInFloorUnion` (SPEC §7 /
  REVIEW M5 — the `isFloor` replacement, new in WI-A), perimeter-segment
  derivation, build-time door reconciliation, and Douglas-Peucker simplify.
  **Open follow-ups (unchanged from the POC):** `bufferPolyline` is still the M6
  union-of-quads offset stand-in (a true offset rides the §8.1 library lock), and
  the Clipper2/martinez shootout is still to run behind the `backend.ts` seam.
- **WI-B** ✅ — store contract for all three vector primitives, landed in
  `packages/shared/src/store/` + `converters.ts` + `schemas.ts` + the Firebase
  rules. Ships: `CampaignStore` methods `subscribe/commitFloorRegions`,
  `subscribe/set/removeWalls`, `subscribe/set/removeDoors`, and the
  RTDB `publish/subscribe/clearVectorMapDraft` (the M7 preview payload —
  `VectorMapDraft`, a single lattice-point ring, cleared on commit); Zod
  schemas + Firestore converters for each doc; the three collections folded into
  `VECTOR_MAP_COLLECTIONS`/`EXPORTED_MAP_COLLECTIONS` so `deleteRoom`/`deleteMap`
  (REVIEW M2) and `.vttcamp` export/import (REVIEW M3) cover them generically;
  `MemoryStore` + `FirebaseStore` implementations; Firestore + RTDB security
  rules; and a contract-suite block that runs against both stores.
  **Decisions ratified (see [`DECISIONS.md`](./DECISIONS.md#wi-b-technical-decisions--ratified-user-2026-07-19))
  and since executed at the WI-D cutover:** `wallSegments` is now `walls`, the
  cellular collections are deleted (no per-map discriminator), and `.vttcamp`
  gates to vector-only. See the pure-rollout cleanup checklist there (now ✅).
- **WI-C** ✅ — store wiring for the SPEC §3.3 build-time consumer, landed in
  [`packages/shared/src/store/vector-los.ts`](../../packages/shared/src/store/vector-los.ts).
  WI-B shipped `subscribeFloorRegions`/`subscribeWalls`/`subscribeDoors`
  as three independent `CampaignStore` collections but left them unconnected
  (see the "WI-C/WI-D wire them into the app" note on `CampaignStore`); WI-C is
  that connection. Ships `buildVectorScene` (pure combinator: `FloorRegion[]` →
  `MultiPoly` via `regionsToMultiPoly`, then WI-A's `buildSightSegments`/
  `buildMovementSegments`) and `subscribeVectorScene` (composes the three live
  subscriptions into one recomputed `VectorScene`, rebuilt on every change to
  any of the three — no per-frame cost, since drag-in-progress previews ride
  the separate `VectorMapDraft` RTDB channel, not these collections). Tested
  against `MemoryStore` end-to-end: committing a region, adding a
  sight/movement-decoupled wall, and opening/closing a door each drive a
  correctly-reconciled scene through the live subscription.
  **Deliberately not built:** a bridge from vector `Segment`s into the old
  cellular `SightWall` type. WI-B's governing premise (Firebase wiped, pure
  vector rollout at WI-D) already rejects that kind of permanent compatibility
  scaffolding — the two systems stay independent until the WI-D cutover.
  **Open, not yet ratified by the user** (see
  [`DECISIONS.md`](./DECISIONS.md#wi-c-technical-decisions--recommendation-claude-code-2026-07-20)):
  the no-debounce recompute cadence, and confirming the bridge belongs in
  `store/` rather than `map/vector/`.
- **WI-D** ✅ — production editor UI landed at
  [`apps/web/src/lib/components/VectorMapView.svelte`](../../apps/web/src/lib/components/VectorMapView.svelte),
  wired to the real `CampaignStore` (not a sandbox) via
  [`apps/web/src/lib/map/vector-tools.ts`](../../apps/web/src/lib/map/vector-tools.ts)
  (op model, snapshot-batch undo/redo, Select-tool handle picking) and
  [`vector-engine.ts`](../../apps/web/src/lib/map/vector-engine.ts) (Pixi
  renderer). Ships: all five §2.5 primitives + the §2.4 hole/rock tool, the
  Wall tool, the Door tool (place + toggle + build-time reconciliation
  visibly rendering), the Select tool (vertex/edge drag, SPEC §9.2 "geometric
  not parametric" per Model A), an Eye/LoS preview, snapshot-batch undo/redo
  (`{ id, from, to }`, SPEC §8.5) riding the existing `UndoStack<Op>`, a live
  RTDB carve-preview channel, and read-only symbol/mapRoom-label coexistence
  on the floating overlay layer alongside doors (SPEC §3.4).
  **The pure-rollout cutover (D1/D2, ratified 2026-07-20) is done:**
  `VectorMapView` is now the *only* map view — `RoomShell.svelte` mounts it
  unconditionally, `VITE_VECTOR_MAP_EDITOR` and the cellular `MapView.svelte`/
  `map/tools.ts`/`map/engine.ts` are deleted. `wallSegments` renamed to
  `walls`; every cellular store method/converter/schema/collection/security
  rule deleted (no discriminator); `VTTCAMP_FORMAT_VERSION` bumped 1→2 with
  pre-vector archives rejected on import. The grid-shrink guard (M4/D3) was
  replaced with a vector-appropriate `MAX_FLOOR_EXTENT` soft cap enforced at
  carve-commit time. See
  [`DECISIONS.md`](./DECISIONS.md#wi-d-technical-decisions--ratified-and-executed-user-2026-07-20)
  for the full D1–D5 disposition. Symbol/label authoring (D4) now reuses the
  existing `MapToolController`/`MapToolbar`/`ToolsRail` (trimmed to a
  `symbol`/`label`-only tool set) wired into `VectorMapView` via context;
  doors, symbols, and room labels share the vector engine's `overlay` layer.
  The **token/encounter layer** the hard swap dropped was **ported back onto
  the vector engine in the post-cutover review pass** — a new `tokens` layer
  in `vector-engine.ts` plus sprite/ring/collapsed-badge rendering and
  drag→snap→`moveToken(s)` in `VectorMapView`, with `tokens`/`groups`/
  `encounter`/`isGM` plumbed from `RoomShell`. The **freehand annotation
  layer** (render + `annotate` tool, on the shared overlay), **live peer
  cursors/pings** (render + subscribe + throttled publish + `ping` tool), and
  the **fog removal** have since landed too. Remaining follow-ups (ordered
  action plan in [`DECISIONS.md`](./DECISIONS.md#remaining-follow-ups-after-the-review-pass-2026-07-20)):
  **stale e2e specs** and **undo/export button-state sync** — neither blocks
  the vector editor being the sole view.
  GM-only secret/trapped
  door glyph hiding (D5, cellular parity R11.3) was confirmed as
  intentionally not needed — doors render identically to every viewer, same
  as the cellular model.

## Non-negotiable boundary for this scaffold

Nothing in `poc/` may be imported by `apps/` or `packages/` production code.
The scaffold consumes the real geometry-library *candidates* (SPEC §8.1) so its
benchmarks are meaningful, but its data lives in browser memory only (SPEC §9.1).
When a proven primitive graduates, it is **re-implemented** in
`packages/shared/src/map/` under WI-A with its own tests — not imported from here.
