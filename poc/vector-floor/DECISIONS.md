# Decision Log — Vector Map System POC

Ratified decisions that resolve the findings in [`REVIEW.md`](./REVIEW.md) and are
folded into [`SPEC.md`](./SPEC.md). Each row states the ruling and its source
(**user** = product direction 2026-07-19; **rec** = Claude Code recommendation
accepted into the working spec pending objection).

## Framing decisions (user, 2026-07-19)
- **Full revamp/replacement**, not an extension. Clean implementation going
  forward beats preserving past decisions — nothing off the table in spec phase.
- **Migration = simple error handling.** No scaffold, no dual-read.
- **Runs are new-session-only.** The old-map path is never exercised in normal use.
- **Fog removed** from the POC entirely; revisit after POC.
- **Doors/walls:** Claude Code to recommend; see D-C5 / §3.

## Findings disposition

| ID | Finding (from REVIEW.md) | Disposition | By | Where |
|----|--------------------------|-------------|----|-------|
| **C1** | Coord-space mismatch (lattice vs pixel) | **Resolved:** one canonical space — **lattice units**, floats. Pixel conversion only at the render/LoS-build boundary. `.uvtt` converts on import. | rec | SPEC §2.0 |
| **C2** | "No migration" vs Master-Plan hard rule + `migrateRoom` throws | **Resolved:** clean break with **simple error handling** on schema mismatch; no scaffold. Master-Plan portability rule is superseded (this is a replacement system). | user | SPEC §2.3, §6 |
| **C3** | schemaVersion is room-level → strands campaigns | **Resolved / moot:** nothing migrates and runs are new-session-only, so room-vs-map scope no longer matters. | user | SPEC §2.3 |
| **C4** | Emergent fog loses zero-storage derivation | **Dropped:** fog removed from POC scope. | user | SPEC §4 |
| **C5** | Multiple door homes; "can't door an organic boundary" partly false | **Resolved (recommendation):** single `doors/{doorId}` overlay collection; `MapWall.door` / `SightWall.door` / `CircleWall.doors` all retired. Door↔wall resolved at **build time**, not commit time (see rationale in SPEC §3.3). | rec | SPEC §3.2, §3.3 |
| **M1** | `source` field introduced only in prose | **Resolved:** `source: 'perimeter'\|'explicit'\|'imported'` is a field on the `Segment` primitive. | rec | SPEC §3.1 |
| **M2** | `deleteRoom` must enumerate new collections | **Recommend now:** WI-B `deleteRoom` walks `floorRegions` / `walls` / `doors`. | rec | SPEC §9 (WI-B) |
| **M3** | `.vttcamp` portability unassigned | **Test point:** WI-B, new-schema round-trip only (no old-map equivalence). | rec | SPEC §9 (WI-B) |
| **M4** | bbox consumers (grid-shrink guard R4, PNG export R9.8) | **Test point:** WI-D. Repoint to union-of-`FloorRegion.bbox`; the grid-shrink guard may be obsolete under unbounded polygon floors — revisit at WI-D. | rec | SPEC §9 (WI-D) |
| **M5** | Token flood-fill / room detect depends on `isFloor` | **Resolved now:** WI-A exposes `pointInFloorUnion(point)` (needed by the carve pipeline anyway); app-side flood-fill/room-detect rewires to it. Not per-frame. | rec | SPEC §7, §9 (WI-A) |
| **M6** | Library offsetting gap (martinez has none) | **Resolved now:** "provides polygon offsetting" is a **hard pass/fail** gate in the §8.1 eval, not just boolean/hole correctness. | rec | SPEC §5.2, §8.1 |
| **M7** | RTDB preview payload shape/growth | **Test point:** WI-B (POC is in-memory, no RTDB). | rec | SPEC §5.5, §9 (WI-B) |
| **M8** | Passage model loses perimeter source | **Resolved now:** `blocksMovement` (separate from `blocksSight`) on the `Segment` primitive; perimeter defaults both true. | rec | SPEC §3.1 |
| **R1** | Undo granularity | **Resolved:** snapshot-based, batch-of-snapshots for merge/split (`floorRegionBatch` of `{id, from, to}`). Confirm feel in POC. | rec | SPEC §8.5 |
| **R2** | Schema level (room vs map) | **Moot** — see C3. | — | — |

## Doors & walls — the recommendation in one paragraph
Collapse three wall types (`walls/{edgeId}`, `sightWalls/{id}`, `circleWalls/{id}`)
into **one `Segment` primitive** carrying `source`, `blocksSight`, and
`blocksMovement`; perimeter segments are derived-not-stored, explicit dividers and
imports are stored. Collapse three door homes into **one `doors/{doorId}` overlay
collection** of free-endpoint vector doors. Resolve door↔wall interaction at
**LoS build time** (open door clips a gap out of overlapping segments; closed door
adds its own blocker) so doors stay independent overlay objects that never mutate
wall geometry. Circles stop being a storage type — a circular room is a
`FloorRegion`, a standalone circular blocker is an explicit segment loop.

## Layer model (user + rec, 2026-07-19)
Two render layers over one lattice space:
- **Map layer (structure):** `FloorRegion` fills + all walls (perimeter + explicit).
- **Floating overlay layer:** **doors** (user decision), `symbols`, room labels.

Doors render on the floating layer; their `{a,b}` geometry still feeds the §3.3
build-time reconciliation against map-layer walls (render layer ⊥ geometry).

## Previously-open questions — now resolved

| # | Question | Resolution | By |
|---|----------|-----------|----|
| 1 | Durable door↔wall binding? | **No.** Doors are floating-layer objects that own their geometry; the builder reconciles overlaps each pass. No permanent binding. | user (doors on floating layer) |
| 2 | Standalone vision blockers | **`explicit` segments cover them — no separate primitive.** Add one **Wall tool** (polyline, snap/freeform) that emits `explicit` segments; it serves both interior dividers and standalone blockers. Include in the POC (only way to exercise door-on-non-perimeter reconciliation). | rec |
| 3 | `blocksSight`/`blocksMovement` toggle in POC | **Keep both fields (default `true`/block-both); no toggle UI in the POC.** Toggle UI → WI-D; fields present from day one means no later schema change. | rec |

See SPEC §3.1 (Wall tool, defaulted block fields) and §3.4 (layer model).

<a name="model-a"></a>
## Floor storage model — Model A, baked union (user, 2026-07-19)

**Decision: floor is stored as a baked union of boundary polygons (Model A). A
committed shape does NOT retain its primitive type or params — no
construction-history / op-list model (Model B is rejected).** This resolves the
identity half of SPEC §9.2.

Why (full analysis in [`FINDINGS.md`](./FINDINGS.md) "Select-tool identity
finding"):

| Axis | Model A (chosen) | Model B (rejected) |
|---|---|---|
| Source of truth | the union polygon itself | an op list; the union is re-folded on every load/edit |
| Storage | bounded ~11 KiB worst-case, **self-pruning** (erased = gone) | op list **grows unbounded**, freeform paths unsimplifiable |
| Merge/split | free from the boolean op (the spec's thesis) | dissolves the stored-region concept entirely |
| Edit locality | local | early-op edits re-fold everything after → non-local surprises |
| Load cost | union already stored | re-fold whole history each open |
| Re-edit | geometric (drag boundary vertices/edges) | parametric (n-gon remembers n+radius) |

Key reasons: floor is a **field (union), not a set of objects** — the moment
shapes touch, per-shape identity fights the union model. The identity that rules
genuinely need already lives on the **object layer** (walls, doors, `mapRooms`,
labels), which Model A leaves untouched. Model B's only real win (parametric
re-edit of isolated shapes) is narrow and does not justify unbounded history +
non-local edits + recompute-on-load.

Consequences:
- `FloorRegion` stores only `rings` + derived `bbox` (SPEC §2.1) — no `type`/`n`/
  `radius`/source-primitive fields.
- The Select tool edits floor **geometrically** (vertex/edge drag on the union
  boundary); walls/doors remain editable **objects**. Edge-drag already keeps a
  rectangle rectangular (geometric), so most desired "shape rules" need no
  identity.
- Not carried forward: n-gon "uniform scale on vertex drag" and rectangle
  re-snap — those needed retained identity and are out.

## WI-B technical decisions — ratified (user, 2026-07-19)

WI-B landed the store contract, converters, security rules, and RTDB draft for
the three vector primitives. The five calls below are **ratified** and unblock
WI-C.

**Governing premise (user):** *if the POC is accepted, Firebase is wiped and the
pure vector system rolls out at WI-D.* There is therefore **no stored data to
preserve and no dual-deployment**, so the correct answer to every "should we add
compatibility scaffolding?" is **no** — each coexistence mechanism below is a
temporary *code* crutch to be deleted at WI-D, not a durable feature. WI-B was
deliberately built to keep that wipe clean: it touches no cellular code and adds
no `GameMap` field, so every crutch is a removable/renamable constant or an
additive collection.

| # | Decision | Ruling | WI-D action (pure rollout) |
|---|----------|--------|----------------------------|
| **B1** | **Vector-wall collection name.** SPEC §3.1 stores explicit walls at `maps/{mapId}/walls/{wallId}`, colliding with the cellular `MapWall` collection at that path. | **Keep `wallSegments` through WI-C.** The collision is real even under a wipe because cellular *code* runs until WI-D (`mapWallConverter` and `vectorWallSegmentConverter` would both bind `walls` and choke on each other's docs). `floorRegions`/`doors` keep the spec names. | **Rename `wallSegments` → `walls`** everywhere. Single source of truth is `VECTOR_MAP_COLLECTIONS`; the rules file is the one hard-coded duplicate to audit. |
| **B2** | **Per-map model discriminator.** Should `GameMap` carry `mapModel: 'cellular' \| 'vector'`? | **No discriminator.** A per-doc flag only earns its keep if both models coexist in one live deployment, which the wipe rules out; adding it re-imports the migration/dual-read scaffolding SPEC §2.3 / C2–C3 already rejected, as *permanent* debt. Cutover is a **deploy-time event**, gated by the room-level `schemaVersion` bump (pre-wipe rooms trip the §2.3 "unsupported schema" error). During WI-C/WI-D dev, gate the two code paths with **one build/config feature flag**, never a per-map field. | **Delete the cellular store methods, converters, schemas, rules, and collections outright** — no dormant code (dormant cellular code is exactly what would force a discriminator back). ⚠️ **Product ack:** safe *only* because no old cellular map need be openable after launch. If that changes, B2 flips → discriminator + dual-read. |
| **B3** | **`.vttcamp` archive version.** The one artifact that survives a Firebase wipe (user-held on disk). A pre-vector archive carries cellular collections and no vector data. | **v1 additive now** (correct during coexistence — both shapes valid). At WI-D, **bump `VTTCAMP_FORMAT_VERSION` and reject pre-vector archives** in `readManifest`/import with the §2.3-style "unsupported" error, rather than silently importing a cellular archive into an unrenderable map (§6 clean break). No in-app converter. | Bump format version + gate import to reject archives whose manifest predates the vector schema. ⚠️ **Product ack:** users lose in-app access to old exported campaigns; archives are user-held and can't be wiped by us, so this is a visible break. |
| **B4** | **RTDB carve-preview payload (REVIEW M7).** | **Keep the raw ring.** `VectorMapDraft = { uid, tool, mode, points: Point[], ts }` — smallest per-frame payload, and freeform buffering is a commit-time op (§5.2) that must not run per-frame per-peer; a thin centerline ghost is a standard live-draw preview. **If width fidelity is later wanted**, add an optional `brushRadius?: number` and stroke a fixed-width line client-side (`ctx.lineWidth`) — never ship the offset polygon over the wire. Ephemeral data ⇒ no compat/migration surface. | None (optionally add `brushRadius`). |
| **B5** | **`commitFloorRegions` batch size.** | **Single atomic batch; treat "≤500 ops per floor commit" as an invariant** (guaranteed by §8.2's ~8-region cap; bytes fine too — 500 × ~11 KiB ≈ 5.5 MiB < ~10 MiB batch cap). Single-batch is *required* for atomicity: a partially-committed merge/split would corrupt the floor, so chunking merge/split is disallowed. Chunk to `FIRESTORE_BATCH_LIMIT` **only** for a future *non-atomic bulk* op (e.g. "clear floor"), never for merge/split. | None. |
| **B6** | **`FloorRegion.rings` storage encoding.** Firestore forbids **nested arrays** (an array directly containing an array), so the model's `rings: Point[][]` can't be written as-is (found by CI, not MemoryStore — the in-memory store has no such limit). | **Ring-wrap at the Firestore boundary:** the converter stores `rings` as an array of `{ points: Point[] }` maps (`VectorStoredFloorRegionSchema`) and unwraps on read. The WI-A `FloorRegion` type, the RTDB draft, and `MemoryStore` all keep the model `Point[][]` shape — only the Firestore converter wraps. | **None — this is a permanent Firestore constraint, not a coexistence crutch.** It carries into the pure WI-D system unchanged. |

## WI-C technical decisions — recommendation (Claude Code, 2026-07-20)

WI-C wires the WI-B store collections (`floorRegions`/`wallSegments`/`doors`)
into the WI-A build-time LoS/movement consumer via
`packages/shared/src/store/vector-los.ts`. Three calls below are **Claude Code
recommendations, not yet ratified by the user** — flag if any should go the
other way.

| # | Decision | Ruling | Rationale |
|---|----------|--------|-----------|
| **C1** | Where does the store↔geometry bridge live? | `packages/shared/src/store/vector-los.ts`, not `map/vector/`. | `map/vector/` is explicitly store-free by design (its own docblock: "no store, rules, render, or app dependencies"). The bridge needs both `CampaignStore` types and vector geometry, so it belongs beside the store it depends on, not inside the pure-geometry package. |
| **C2** | Recompute cadence for `subscribeVectorScene` | **No debouncing.** Every change to any of the three collections — including each one's own initial snapshot — triggers an immediate full rebuild of sight + movement segments. | Per-frame drag preview already rides the separate `VectorMapDraft` RTDB channel (SPEC §5.5); these three collections only change on a committed carve, a wall-tool release, or a door toggle — infrequent enough that SPEC §3.3's "build-once, probe-many" needs no coalescing layer yet. WI-D's renderer can add batching (e.g. a `requestAnimationFrame` gate) once real UI is driving it, if it turns out to matter. |
| **C3** | Bridge into the old cellular `SightWall`/`sightSegments()` consumer (`map/los.ts`)? | **Not built.** The vector and cellular LoS consumers stay fully independent through WI-C. | Reshaping vector `Segment`s into the legacy `SightWall` type would be exactly the "compatibility scaffolding" the WI-B decisions above (governing premise: Firebase wiped, pure vector rollout at WI-D) already rule out as permanent debt. If a room needs to render with the old engine before WI-D, that's the B2 build/config feature flag choosing which store data to read — not a type-level adapter between the two segment models. |

### Pure-rollout cleanup checklist (WI-D, post-wipe)

Everything WI-B added is removable/renamable — the load-bearing item is #2.
**Status: done** — executed as the hard cutover, see WI-D D1 below.

1. **Rename** `wallSegments` → `walls` (B1). ✅ Done.
2. **Delete** the cellular store methods / converters / schemas / rules /
   collections entirely; no discriminator, no dormant code (B2). ✅ Done.
3. **Bump** `VTTCAMP_FORMAT_VERSION` and reject pre-vector archives (B3). ✅
   Done — `VTTCAMP_FORMAT_VERSION = 2`, `readManifest` rejects pre-vector
   archives with an "unsupported" SPEC §2.3-style error.
4. No action: B4 (optionally add `brushRadius`), B5 (keep single atomic batch).

## WI-D technical decisions — ratified and executed (user, 2026-07-20)

WI-D landed the production editor
([`VectorMapView.svelte`](../../apps/web/src/lib/components/VectorMapView.svelte)
+ [`vector-tools.ts`](../../apps/web/src/lib/map/vector-tools.ts) +
[`vector-engine.ts`](../../apps/web/src/lib/map/vector-engine.ts)), wired to
the real store and manually verified against the Firebase emulator. D1–D5
below were originally flagged as irreversible whole-system decisions for
product sign-off; the user has since ratified all five (product direction,
2026-07-20) and they were executed as a single hard, scorched-earth cutover —
no backwards compatibility, no dual-read, no dormant cellular code.

| # | Decision | Ruling | What shipped |
|---|----------|--------|---------------|
| **D1** | **Execute the pure-rollout cutover** (rename `wallSegments`→`walls`, delete the cellular store/converters/schemas/rules/collections, bump `VTTCAMP_FORMAT_VERSION`). | **Approved — executed.** | `wallSegments` renamed to `walls` throughout (types, `VECTOR_MAP_COLLECTIONS`, converters, schemas, Firestore/RTDB rules). Every cellular store method/converter/schema/collection (`FloorChunk`, `FogChunk`, `MapWall`, `SightWall`, `CircleWall`, `MapLight`, the cellular `MapDraft`/carve-preview channel) deleted from `packages/shared` and the Firebase rules files; the now-dead pure-geometry files (`map/grid.ts`, `map/walls.ts`, `map/fog.ts`, `map/circle.ts`, `map/los.ts`, `map/uvtt.ts`, `map/natural.ts`) removed. `VTTCAMP_FORMAT_VERSION` bumped 1→2; `readManifest`/import reject pre-vector archives with an "unsupported schema" error (SPEC §2.3 style). No `mapModel` discriminator was added — there is exactly one system now. |
| **D2** | **Cutover mechanism**: replace `MapView` outright vs. keep both behind a flag. | **Approved — hard swap now.** | `VITE_VECTOR_MAP_EDITOR` removed entirely; `RoomShell.svelte` mounts `VectorMapView` unconditionally. The cellular `MapView.svelte`, `map/tools.ts`, and `map/engine.ts` deleted outright. ✅ **Regression closed (review pass, 2026-07-20):** the token/encounter layer the hard swap dropped has been ported onto the vector engine — `vector-engine.ts` gained a `tokens` layer (above overlay, below tool ghosts) and `VectorMapView` now renders token sprites/rings/collapsed-group badges + drag→snap→`moveToken(s)` + RTDB `publishDrag`, with `tokens`/`groups`/`encounter`/`isGM` plumbed from `RoomShell`. All token helpers (`snapTokenPosition`, `tokens/labels`, `visibleTokenIds`/`currentActorTokenIds`, `collapsedDragUpdates`) survived the cutover, so this was a clean port. Dynamic-LoS token hiding (old fog `dynamic` mode) is deliberately not ported — fog/LoS rendering was removed (SPEC §4); see action-plan item 5. |
| **D3** | **M4 bbox consumers under an unbounded vector floor** — the grid-shrink guard and PNG export assumed a bounded cell grid. | **Approved — soft bounded size with error/warning.** | The old `carvedBoundingBox`/`grid.w`/`grid.h` shrink guard in `SessionActivity.svelte` was removed (a vector floor has no cell-grid ceiling to shrink against); grid resize now only validates ≥1×1. A new `MAX_FLOOR_EXTENT = 2000` lattice-unit soft cap (`apps/web/src/lib/map/vector-tools.ts`'s `exceedsMaxFloorExtent`) blocks a carve commit that would push the floor union's bbox past it, surfacing a visible error in `VectorMapView.svelte` (`data-testid="vector-floor-extent-error"`) rather than silently truncating. |
| **D4** | **Symbol/mapRoom label authoring inside the vector editor** — reuse the existing tools, doors stay vector-native, one shared overlay layer. | **Approved — executed.** | `MapToolController`/`MapToolbar` were trimmed to a `symbol`/`label`-only `MapToolId` (the cellular carve/fill/wall/door/fog/uvtt fields and TOOLS entries were removed, not reused as-is). `VectorMapView` reads the shared controller from context (`MAP_TOOL_KEY`) and its `handleMapToolClick` places a `MapSymbol`/upserts a `MapRoom` directly against the unchanged store collections (SPEC §2.2) when the rail's tool is active, taking priority over the editor's own floor/wall/door tools on the same click. Doors stay authored via the vector-native door tool. `vector-engine.ts`'s `overlay` layer stacks doors + symbols/room labels together. **Known gap:** freehand `Drawing` annotations (the "Annotate" layer D4 also calls out) are not yet rendered or authorable inside `VectorMapView` at all — that overlay never existed in the vector editor before this cutover and building it was out of scope for this pass; flagged as a manual follow-up. |
| **D5** | **Secret/trapped door visibility** (cellular parity, R11.3). | **Approved, no-op — confirmed as-is.** | No GM-gating needed. Every vector door already renders identically to every viewer (no `isGM`-gated branch in `vector-engine.ts`'s `renderDoors`); confirmed unchanged, nothing built. |

D1, D2, D3, and D5 are fully executed. D4's symbol/label tool-rail wiring and
door/symbol/label overlay sharing are done. The token/encounter overlay gap
that D2's hard swap surfaced has since been closed (see D2's "What shipped").

### Remaining follow-ups after the review pass (2026-07-20)

The cutover + review together leave these open, tracked as an ordered action
plan (none block the vector editor from being the sole map view):

1. **Freehand `Drawing`/annotation layer** — not yet rendered or authorable in
   `VectorMapView`. The one piece of D4's "shared overlay layer" not built;
   this overlay never existed in the vector editor pre-cutover.
2. **Peer cursors + pings** — the cellular `MapView` rendered live peer cursors
   (`renderCursors`) and ping markers; `VectorMapView` does not subscribe to
   `subscribeCursors`/`subscribePings` yet. (Peer *token-drag* frames are at
   parity — `subscribeDrag` had no consumer in the old view either.)
3. **e2e specs** — `referee-engine`, `combat-modes`, `session-config`,
   `rooms-manager`, `mobile` reference deleted cellular map testids/flows and
   need rewriting against vector testids.
4. **Undo/export button-state sync** between `VectorMapView`'s inline UI and the
   shared `MapToolbar` (cosmetic; buttons may show stale enabled/disabled).
5. ~~**Fog `dynamic` mode is now inert**~~ ✅ **Resolved (user-approved,
   2026-07-20) — field removed.** The inert `GameMap.fog` field plus
   `FogModeSchema`/`RoomFogSchema` were deleted from the schema, the v1→v2
   migration, the `.vttcamp` import/export adoption, both store seeds, and the
   contract/migration/schema/rules tests. Nothing reads or persists a fog mode.
   A future fog feature is a fresh vector-native build on the Eye tool's
   `visibilityPolygon` (see SPEC §4), not a revival of this field.
