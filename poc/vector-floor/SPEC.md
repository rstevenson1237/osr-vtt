# Vector Map System — Working Spec (POC phase)

> **Central governing document for the `poc/vector-floor/` scaffold.**
> This is a **full revamp/replacement** of the existing cellular map system, not
> an extension of it. It reads as the new system going forward; where it
> supersedes prior R9.1 decisions, it does so silently — preserving past
> decisions is explicitly *not* a goal.
>
> - Ratified decisions from architectural review live in
>   [`DECISIONS.md`](./DECISIONS.md) and are folded into the sections below.
> - The original review analysis (conflicts/gaps that produced those decisions)
>   is kept for audit in [`REVIEW.md`](./REVIEW.md).
> - Scaffold layout and gating: [`README.md`](./README.md).

**Status:** Working spec, POC phase. Schema is intentionally NOT locked — it
follows the POC (§9), it does not precede it.
**Scope note:** Clean-slate map system. Backwards compatibility, migration, and
fog are out of scope for the POC (see §4, §6).

---

## 0. Purpose
Floor geometry is an arbitrary polygon (with holes), so grid-aligned rooms and
freeform organic carves (caves, winding corridors) coexist in **one** floor
representation. Grid-aligned authoring is a snap mode at edit time, not a
different storage type.

The POC (§9 step 1) proves the drawing primitives and geometry pipeline against
a disposable in-memory harness **before** any schema, store, or rules code is
written. It is also the vehicle that answers the §8 benchmark questions.

---

## 1. Invariants (carried forward)
- **Trust model:** all room members can write; `gmPrivate/**` boundary unaffected.
- **Write discipline:** RTDB for in-progress stroke drafts, Firestore for settled
  commits.
- **No game mechanics:** purely geometry/rendering; nothing here computes or
  validates game state.
- **Dice / session / encounter / account / logging systems:** untouched, out of
  scope.

> Dropped from the prior draft: the fog invariant (fog is removed, §4) and the
> "pixel-for-pixel round-trip against *old* maps" invariant (clean break, §6).
> `.vttcamp` round-trip within the *new* schema is a WI-B concern, not a POC one.

---

## 2. Data model

### 2.0 Coordinate space (canonical — resolves REVIEW C1)
**One space for everything: cell-lattice (map) units, floats.** Floor regions,
walls, and doors are all stored and reasoned about in lattice units. `cellSize`
is a render-time concern only — the render / LoS-build boundary multiplies by
`cellSize` once, uniformly. No per-record coordinate-space tag, no pixel-space
storage. Imported geometry (e.g. `.uvtt`) is converted to lattice units **on
import**; that is the only conversion boundary.

```ts
interface Point { x: number; y: number } // lattice units
```

### 2.1 Floor representation
```ts
interface FloorRegion {
  id: string;
  /** Outer boundary + optional holes, in lattice units (§2.0). */
  rings: Point[][];              // rings[0] = outer boundary, rings[1..] = holes
  /** Derived bounding range for spatial queries — recomputed every commit,
   *  never authoritative, never hand-edited. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}
```

- A map's floor = the **union** of all `FloorRegion`s. Regions may be stored
  separately for edit-locality, but rendering / LoS / occupancy treat them as one
  union. A stroke that bridges two regions merges them into one on commit.
- Storage path: `rooms/{roomId}/maps/{mapId}/floorRegions/{regionId}` — sparse
  documents, not fixed-size chunks.
- `bbox` is denormalized for "which regions are near the viewport / near a new
  stroke" queries; derived, recomputed on every commit.
- **Floor is a baked union, not a construction history (Model A — ratified
  2026-07-19).** A committed `FloorRegion` stores only the resulting boundary
  rings; the primitive that produced it (rect / n-gon / brush path) is **not**
  persisted and carries no retained type or params. This keeps storage bounded
  and self-pruning (an erased shape leaves nothing behind), makes the union the
  direct source of truth for LoS/occupancy, and keeps edits local. Editing a
  committed region is **geometric** (drag its boundary vertices/edges), not
  parametric. Rationale and the rejected retained-identity model (Model B) are in
  [`DECISIONS.md`](./DECISIONS.md#model-a) and [`FINDINGS.md`](./FINDINGS.md).
  Identity that game/authoring rules actually need lives on the **object layer**
  (walls, doors, `mapRooms`, labels — each with its own id), never on floor.

### 2.2 What is unchanged elsewhere
- `symbols`, `mapRooms`, `Drawing` (Annotate layer) — unaffected.
- Dice, encounter, session, account systems — unaffected.

### 2.3 Schema versioning — error, don't migrate (resolves REVIEW C2/C3)
The map carries a schema tag. **User runs are assumed to occur only in newly
created sessions**, so there is no dual-read path, no migration scaffold, and no
old-map support. A map whose schema tag does not match the current system is
handled with **simple error handling** — surface a clear "unsupported map
schema" error and stop; do not attempt to read or transform it. (The prior
system's `schemaVersion` was a room-level field; that coupling is irrelevant here
because nothing migrates.)

### 2.4 Interior rock-carve tool ("skinny path", uses holes)
Holes are a first-class authoring tool. A GM draws a **path** through an existing
floor region where the *stroke itself* becomes rock (a hole ring), not floor.
Use case: an interior divider drawn as a freeform or snapped skinny corridor of
rock cutting through open floor, instead of an explicit wall.

- Same buffer→boolean pipeline as carving (§5), but the boolean op is
  **difference** against the enclosing `FloorRegion` instead of union, producing
  a new interior ring (hole) on that region.
- If the stroke fully bisects the region (rock touches the outer boundary on both
  sides), the difference op **naturally splits** one region into two — a normal
  boolean outcome, not a special case to detect.
- Available as one of the §2.5 primitives, not a bolted-on mode.

### 2.5 Universal snap/freeform toggle across all drawing primitives
Snapping is a per-stroke input modifier, not a property of the shape type.

| Primitive | Snapped | Freeform |
|---|---|---|
| **Room** (rectangle) | Corners snap to grid intersections | Corners follow raw pointer |
| **Corridor** (L-shaped, single width) | Legs snap to axis/grid, single-cell width | Legs follow drag angle, width fixed |
| **Path** (skinny interior carve §2.4, or exterior corridor) | Each click-point snaps to grid | Raw pointer per point; click to add, double-click to complete |
| **Polygon** (irregular) | Vertices snap to grid | Raw pointer per vertex; double-click to close |
| **Regular polygon (n-sided)** | Center/radius snap to grid | Center/radius freeform; **n=1 degenerate = circle** |

One shared abstraction: **a vertex/point stream with a per-point snap decision**,
feeding the same polygon-emission → buffer → boolean-combine → simplify pipeline
(§5) regardless of primitive. Primitives differ only in *how points are
collected*, not in what happens after. Build point-collection as pluggable input
modes over one geometry pipeline — not five carve implementations.

---

## 3. Wall / door / LoS model (unified — resolves REVIEW C5, M1, M8)

Clean-slate model: **one segment primitive, one door collection, one build-time
consumer.** This replaces the old split of `walls/{edgeId}` (edge-attached grid
walls) + `sightWalls/{id}` (pixel vector walls) + `circleWalls/{id}`, and the
three separate door homes.

### 3.1 The `Segment` — the only wall primitive
```ts
interface Segment {
  a: Point; b: Point;                         // lattice units (§2.0)
  source: 'perimeter' | 'explicit' | 'imported';
  blocksSight: boolean;                       // decoupled from…
  blocksMovement: boolean;                    // …passage
  style?: WallStyle; visible?: boolean;       // render-only
}
```
Provenance:
- **perimeter** — derived from a `FloorRegion` boundary at build time; **never
  stored**. Defaults `blocksSight` and `blocksMovement` both true.
- **explicit** — user-drawn free vector segment (or closed loop), placeable
  anywhere, **not** edge-attached. Stored at
  `rooms/{roomId}/maps/{mapId}/walls/{wallId}`. Drawn with a dedicated **Wall
  tool** (polyline; snap/freeform per §2.5's per-point toggle). The *same* tool
  and storage serve two use-cases — the difference is only where you draw:
  - an **interior divider** within one floor region, and
  - a **standalone vision/movement blocker** with floor on both sides or neither
    (cliff edge, hedge, free-standing pillar) — no separate primitive needed.
- **imported** — from `.uvtt` etc., converted to lattice on import; stored.

`blocksSight`/`blocksMovement` decouple LoS from passage (the old system implied
"perimeter blocks both"): a force-field blocks sight not movement; a low rail
blocks movement not sight. This is the replacement for the retired
`isEdgeBlocked` passage path (REVIEW M8). **POC scope:** both fields exist in the
model from day one but default to `true` (block-both); the per-wall toggle UI is
deferred to WI-D, so no schema change is needed to add it later.

**Circle walls are retired as a storage type.** A circular room/pillar is a
`FloorRegion` (circular outer ring, or a circular hole). A standalone circular
vision-blocker is an `explicit` closed loop of segments sampled from the §2.5
regular-polygon primitive. The ring→segment sampling helper is kept as a
draw-time utility; the `circleWalls/{id}` collection is dropped.

### 3.2 Doors — one geometry-anchored overlay collection
```ts
interface Door {
  id: string;
  a: Point; b: Point;                         // lattice units — free endpoints
  type: DoorType;                             // single|double|secret|trapped|oneWay|barred
  state: DoorState;                           // open|closed
  facing?: DoorFacing;                        // oneWay only
}
```
Storage: `rooms/{roomId}/maps/{mapId}/doors/{doorId}`. This is the **single** door
home — the old `MapWall.door`, `SightWall.door`, and reserved `CircleWall.doors`
are all gone. A door is a free-floating overlay object (like symbols / labels),
its endpoints stretchable between arbitrary points, so it sits on a fully organic
boundary exactly as well as a grid-aligned one.

### 3.3 Door ↔ wall interaction — resolved at BUILD time, not commit time
Doors never mutate stored wall geometry. The LoS/segment builder reconciles them
once per render pass (build-once, probe-many — no per-frame-per-cell cost):

1. Emit all wall segments (perimeter-derived + explicit + imported).
2. For each door:
   - **blocking** (closed / secret / barred / trapped-closed): add the door's own
     segment as a blocker.
   - **passing** (open): **clip** the door's span out of any wall segment that is
     collinear-and-overlapping with it (a 1-D interval subtraction along the
     segment) → a real gap in the boundary.

Consequences: moving a door, or a wall/region changing, needs **no re-excision** —
the next build reconciles. This generalizes the old `doorPassesSight()` edge-flag
rule to free geometry with the same open-passes / closed-blocks semantics.

> **Rationale (build-time vs. commit-time excision):** the earlier draft excised
> the door span from stored wall geometry *on commit*. That couples doors to walls
> at write time and forces a re-excision whenever either moves — and perimeter
> walls aren't even stored, so there's nothing durable to excise. Resolving at
> build time keeps doors as pure, independent overlay objects and removes that
> coupling. **Settled (2026-07-19):** doors live on the floating overlay layer
> (§3.4), so there is **no durable door↔wall binding** — a door owns its own
> geometry and the builder reconciles overlaps each pass.

### 3.4 Layer model (canonical — ratified user 2026-07-20)
Conceptually there are **two logical layers** — *structure* and *floating
overlay* — but the production renderer (`apps/web/src/lib/map/vector-engine.ts`)
realizes them as **five Pixi containers**, all children of one pan/zoomed
`world` container that carries the shared lattice coordinate space (§2.0; all
geometry is drawn at `lattice × cellSize`, pixel-space). This five-layer stack
is the canonical map-view layer model. Z-order, bottom → top:

| # | Layer (`layers.*`) | Renders | Source data | Logical role |
|---|--------------------|---------|-------------|--------------|
| 1 | `background` | Background image sprite | `GameMap.background` (or the starter ref) | backdrop (below the model) |
| 2 | `floor` | `FloorRegion` fills (holes cut) + all walls / sight segments (perimeter-derived + `explicit`, door-reconciled) | `FloorRegion[]`, `walls` → `VectorScene` | **Map layer — structure** |
| 3 | `overlay` | **Doors** (open=dashed / closed=solid, colored by type) + `symbols` glyphs + `mapRoom` labels | `doors`, `symbols`, `mapRooms` | **Floating overlay — annotation / interactive** |
| 4 | `tokens` | Token sprites, status rings, collapsed-group count badges; drag→snap→`moveToken(s)` | `tokens`, `groups`, `encounter`, `isGM` | play surface |
| 5 | `tools` | In-progress stroke ghost, Select-tool handles, Eye-tool LoS polygon, peers' live carve drafts | ephemeral / per-frame | transient editor chrome |

- **Structure vs. overlay** is the §3.4 conceptual split: `floor` is the "world"
  geometry (floor + the segments that bound or divide it); `overlay` holds movable
  objects drawn above it. The `background` (below), `tokens` (the play surface),
  and `tools` (ephemeral ghosts) layers are the renderer's realization around
  those two.
- **Doors** render on `overlay` but their `{a, b}` geometry is what the §3.3
  build-time reconciliation reads against `floor`-layer walls — render layer and
  geometry reconciliation are orthogonal, so there is no tension between "door is
  an overlay object" and "door interrupts a wall." Walls stay on `floor` because
  they *are* structure (perimeter walls are literally the floor boundary); a door
  is the deliberate exception that moved up, because it is a movable object that
  *modifies* structure rather than being structure.
- **Z-order intent:** tokens read *above* the map/overlay but *below* `tools`, so
  tokens sit on top of the map while a live carve/handle preview still reads on
  top of tokens during editing.

> **Fog is not a layer.** Fog of war was removed in the vector cutover (§4); there
> is no fog mask container. "Unexplored = rock" is emergent from the `floor` layer
> itself (the floor *is* what has been carved), not a separate masking layer.
> Per-token `[Map]`-visibility (`visibleTokenIds`) still gates individual token
> rendering on the `tokens` layer — that is token visibility, not fog.

---

## 4. Fog — removed
Fog of war is **removed** from this system. No `fogChunks`, no reveal-on-carve,
no dynamic LoS fog. (LoS raycasting itself — §3's segment consumer — stays,
because walls/doors need it; what's removed is fog *visibility masking* on top
of it.) As of the 2026-07-20 cutover this is not just out of scope but
**executed**: the inert `GameMap.fog` config field (and `FogModeSchema` /
`RoomFogSchema`) were deleted from the schema, migrations, `.vttcamp`
round-trip, and stores — nothing reads or persists a fog mode any more.

A future fog feature, if wanted, is a **fresh vector-native build**, not this
field: reuse the Eye tool's `visibilityPolygon(eye, sight, maxDist)` to compute
each viewer's visible region from their token positions against the scene's
sight segments, and mask the `floor`/`overlay`/`tokens` layers (§3.4) with it —
no `fogChunks` grid. Until then, "unexplored = rock" is emergent from the floor
union itself (§3.4).

---

## 5. Carve operation pipeline
1. **Stroke capture.** Freeform brush stroke or grid-aligned shape both terminate
   in the same shape: a polygon (grid shapes are axis-aligned polygons; freeform
   strokes are buffered paths — see step 2).
2. **Buffering (freeform only).** Raw pointer path → offset polygon at brush
   radius. **Requires a real geometry library with polygon offsetting** — do not
   hand-roll. ⚠️ See §8.1 / REVIEW M6: offsetting is a *hard* library requirement,
   and the candidate libraries are not equivalent on it.
3. **Boolean combine.** New stroke polygon unioned (carve) or subtracted
   (fill/erase, §2.4 holes) against existing `FloorRegion`(s) whose `bbox`
   overlaps.
4. **Simplification.** Post-boolean, run Douglas-Peucker (or the library's
   built-in simplify) at a fixed tolerance to bound vertex growth. **Every
   commit**, not periodically — unbounded vertex count is the primary long-session
   perf risk.
5. **Commit.** Preview during drag rides RTDB (same discipline as before); release
   commits the resulting `FloorRegion`(s) to Firestore. A merge writes one region
   and deletes the others (batched write). ⚠️ POC is in-memory (§9.1); the RTDB
   preview payload shape is a WI-B test point (REVIEW M7).

---

## 6. No migration — clean break with simple error handling
Backwards compatibility is out of scope. Existing maps are not migrated; there is
no chunk→polygon tooling, no dual-schema read path. A map not on the current
schema is rejected with **simple error handling** (§2.3). Runs are assumed to
start in newly created sessions, so the old-map path is never exercised in normal
use.

---

## 7. Explicit non-goals
- No change to dice, encounter, session, account, or logging systems.
- No fog (§4).
- No per-frame point-in-polygon in any hot path. Occupancy / "is this point on
  floor?" is answered by a `pointInFloorUnion(point)` geometry function (WI-A) and
  called at interaction time or batched — never per-frame-per-cell (REVIEW M5).
- No dual-live bitmask+polygon representation — the bitmask model is gone.
- No custom polygon clipping/offsetting math — use a vetted library.

---

## 8. Benchmark questions for the POC to answer (§9 step 1)
Report findings from the POC build; surface tradeoffs rather than picking silently.

1. **Library choice.** Clipper2 (WASM) vs. martinez-polygon-clipping (pure JS) —
   evaluate on: **polygon offsetting support (HARD requirement — see below)**,
   bundle size (Vite, static hosting), and multi-ring/hole correctness including
   §2.4's split-on-full-bisection. Report benchmark numbers.
   > ⚠️ **REVIEW M6:** the two candidates are **not** equivalent. Clipper2 ships
   > `ClipperOffset` (offsetting) and `SimplifyPaths` (§5.4). **martinez does
   > boolean ops only — no offsetting, no simplify** — so choosing it means
   > adding a third library (offset) + `simplify-js`, which changes the bundle
   > math. "Provides offsetting" is a pass/fail gate, not a nice-to-have.
2. **Vertex/document size ceiling.** Firestore 1 MiB limit — stress-test many
   carve + interior-path ops on one map; report worst-case vertex counts and doc
   sizes, with and without §5.4 simplification. Determines whether regions ever
   need spatial splitting purely for size.
3. **Simplification tolerance.** Test 2–3 tolerances (fixed in map-units) against
   grid-aligned and organic shapes; report visual degradation vs. vertex-count.
4. **Performance.** Prototype stroke→buffer→union→simplify in isolation,
   benchmarked against a stress map, before any store/render integration.
5. **Undo/redo granularity — resolved, confirm in POC.** Snapshot-based, following
   the batch-of-snapshots precedent (REVIEW R1): a merge/split is a
   `floorRegionBatch` of `{ id, from, to }` where deleted regions are `to: null`
   and the merged/new region is `from: null`. Confirm this feels right for
   merge/split before WI-D commits; delta-based entity undo is not used.

---

## 9. Sequencing — schema follows the POC
1. **POC (human+agent), in-memory only.** No Firestore, no store contract, no
   rules. A disposable single-user sandbox (bare Vite/PixiJS or artifact-style
   harness) implementing all five §2.5 primitives with the snap/freeform toggle,
   the §2.4 interior-hole tool, and the §3 door-as-overlay concept — all on
   in-memory polygon state. Uses the real §8.1 library candidates; **this is the
   vehicle that answers §8**.
   - **Gate:** every primitive feels right in the GM's hand (UX judgment — expect
     to iterate on corner rounding, click-vs-drag feel, double-click-to-close).
     Report §8 findings from this build.
2. **Schema lock.** With the POC's actual data shapes in hand, finalize
   `FloorRegion`, `walls/{wallId}`, `doors/{doorId}`, and the interior-hole
   representation. §2/§3 get amended from what the POC revealed — they are not
   final until here. **Resolved at lock:** floor persists as a **baked union**
   (Model A, §2.1) — a committed regular polygon does **not** persist `n`/radius,
   a baked polygon is sufficient; no construction-history/op-list model.
3. **WI-A:** Pure geometry in `packages/shared/src/map/` (carve pipeline, boolean
   ops wrapper, `pointInFloorUnion`, perimeter-segment derivation, simplify),
   fully unit-tested.
4. **WI-B:** Store contract (`CampaignStore`), security rules, RTDB draft /
   Firestore commit for all primitives. Includes: `deleteRoom` enumerating the new
   `floorRegions` / `walls` / `doors` collections (REVIEW M2); `.vttcamp`
   round-trip on the new schema (REVIEW M3); RTDB preview payload shape (M7).
5. **WI-C:** Wall/door/LoS unification wiring (perimeter-as-segment, build-time
   door reconciliation per §3.3).
6. **WI-D:** Production editor UI — proven POC interactions into the app shell,
   snapshot undo/redo, overlay-layer coexistence (symbols/rooms/labels + doors),
   and re-pointing app consumers of the old bitmask bbox (REVIEW M4).

Each gated: do not proceed until the prior step's output (POC findings, passing
tests) is confirmed.
