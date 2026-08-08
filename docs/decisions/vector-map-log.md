## Vector Map System — decision log (condensed)

Verbatim from Master Plan Part V §2. Ratified during the POC and the WI-A–WI-D build
(**user** = product direction; **rec** = Claude Code recommendation accepted).

**Framing (user, 2026-07-19):** full revamp, not an extension — a clean implementation
going forward beats preserving past decisions. Migration = simple error handling, no
scaffold, no dual-read. Runs are new-session-only. Fog removed from the POC entirely
(later rebuilt, see D6).

**Review conflicts and their dispositions:**

| ID  | Finding                                           | Disposition                                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| C1  | Coord-space mismatch (lattice vs pixel)           | One canonical space — **lattice units**, floats. Pixel conversion only at the render/LoS-build boundary            |
| C2  | "No migration" vs the portability hard rule       | Clean break with simple error handling; the portability rule is superseded _for this replacement_                  |
| C3  | `schemaVersion` is room-level → strands campaigns | Moot: nothing migrates, runs are new-session-only                                                                  |
| C4  | Emergent fog loses zero-storage derivation        | Dropped at the time (fog removed); superseded by the D6 rebuild                                                    |
| C5  | Multiple door homes                               | Single `doors/{doorId}` overlay collection; door↔wall resolved at **build time**                                   |
| M1  | `source` field only in prose                      | `source: 'perimeter'\|'explicit'\|'imported'` is a real field on `Segment`                                         |
| M2  | `deleteRoom` must enumerate new collections       | It walks `floorRegions` / `walls` / `doors`                                                                        |
| M3  | `.vttcamp` portability unassigned                 | New-schema round-trip test in WI-B                                                                                 |
| M4  | bbox consumers (grid-shrink guard, PNG export)    | Repointed to union-of-`FloorRegion.bbox`; the grid-shrink guard proved obsolete and was removed (D3)               |
| M5  | Token flood-fill depends on `isFloor`             | `pointInFloorUnion(point)`, called at interaction time — never per-frame                                           |
| M6  | Library offsetting gap                            | "Provides polygon offsetting" was a hard pass/fail gate; `polygon-clipping` failed it, hence `bufferPolyline` + DP |
| M7  | RTDB preview payload shape                        | Raw centerline ring only; never the offset polygon over the wire                                                   |
| M8  | Passage model loses perimeter source              | `blocksMovement` separate from `blocksSight`; perimeter defaults both true                                         |
| R1  | Undo granularity                                  | Snapshot-based, batch-of-snapshots for merge/split                                                                 |

**Model A (floor storage), user, 2026-07-19.** Floor is stored as a baked union of
boundary polygons; a committed shape does **not** retain its primitive type or params.
Model B (construction history / op list) is rejected.

| Axis            | Model A (chosen)                                             | Model B (rejected)                                            |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Source of truth | the union polygon itself                                     | an op list; the union re-folded on every load/edit            |
| Storage         | bounded ~11 KiB worst-case, **self-pruning** (erased = gone) | op list **grows unbounded**, freeform paths unsimplifiable    |
| Merge/split     | free from the boolean op                                     | dissolves the stored-region concept entirely                  |
| Edit locality   | local                                                        | early-op edits re-fold everything after → non-local surprises |
| Load cost       | union already stored                                         | re-fold whole history each open                               |
| Re-edit         | geometric (drag boundary vertices/edges)                     | parametric (n-gon remembers n + radius)                       |

Floor is a **field (union), not a set of objects** — the moment shapes touch, per-shape
identity fights the union model. The identity rules genuinely need already lives on the
object layer. Knowingly given up: n-gon "uniform scale on vertex drag" and rectangle
re-snap, both of which needed retained identity.

**WI-B calls (user).** Governing premise: if the POC is accepted, Firebase is wiped and
the pure vector system rolls out at WI-D — so there is no stored data to preserve and
every coexistence mechanism is a temporary _code_ crutch to delete at WI-D.

- **B1** `wallSegments` through WI-C to avoid colliding with the cellular `walls`
  collection, renamed to `walls` at WI-D. ✅ Done.
- **B2** **No `mapModel` discriminator.** A per-doc flag only earns its keep if both
  models coexist in one live deployment, which the wipe rules out. Cutover is a
  deploy-time event; during dev the two paths were gated by one build flag, never a
  per-map field. ⚠️ **Product ack:** safe only because no old cellular map need be
  openable after launch.
- **B3** `VTTCAMP_FORMAT_VERSION` bumped 1→2 at WI-D; `readManifest`/import reject
  pre-vector archives with an "unsupported" error rather than silently importing an
  unrenderable map. ⚠️ **Product ack:** users lose in-app access to old exported
  campaigns; archives are user-held, so this is a visible break.
- **B4** RTDB carve preview keeps the raw ring
  (`{ uid, tool, mode, points, ts }`). Freeform buffering is a commit-time op that must
  not run per-frame per-peer. If width fidelity is later wanted, add an optional
  `brushRadius?` and stroke a fixed-width line client-side — never ship the offset
  polygon over the wire.
- **B5** `commitFloorRegions` is a **single atomic batch**; "≤500 ops per floor commit"
  is an invariant. Chunking is allowed only for a future non-atomic bulk op (e.g. "clear
  floor"), never for merge/split.
- **B6** Ring-wrap at the Firestore boundary (nested arrays are forbidden). **Permanent
  constraint, not a crutch.**

**WI-C calls (rec).** The store↔geometry bridge lives at `store/vector-los.ts`, not in
the store-free `map/vector/`. `subscribeVectorScene` does no debouncing. No adapter was
built between the vector and cellular LoS consumers — that would have been exactly the
compatibility scaffolding B2 rules out.

**WI-D calls (user, ratified and executed as one hard, scorched-earth cutover).**

- **D1** Pure-rollout cutover executed: `wallSegments`→`walls`; every cellular store
  method/converter/schema/collection (`FloorChunk`, `FogChunk`, `MapWall`, `SightWall`,
  `CircleWall`, `MapLight`, the cellular carve-preview channel) and the now-dead
  pure-geometry files deleted; `VTTCAMP_FORMAT_VERSION` bumped. No discriminator.
- **D2** Hard swap: `VITE_VECTOR_MAP_EDITOR` removed, `RoomShell` mounts
  `VectorMapView` unconditionally, cellular `MapView`/`tools.ts`/`engine.ts` deleted. The
  token/encounter layer the swap initially dropped was ported onto the vector engine in
  the same review pass.
- **D3** Soft bounded floor size with a visible error: `MAX_FLOOR_EXTENT = 2000`. The old
  `carvedBoundingBox` grid-shrink guard was removed — a vector floor has no cell-grid
  ceiling to shrink against; grid resize now only validates ≥1×1.
- **D4** Symbol/mapRoom label authoring reuses the existing tools inside the vector
  editor; doors stay vector-native; one shared overlay layer. The freehand `Drawing`
  layer gap this surfaced was closed the same day (`renderAnnotations` + the Pen tool).
- **D5** Secret/trapped door visibility: no-op. Every vector door renders identically to
  every viewer.
- **D6 (2026-07-27) Fog of war rebuilt** as a fresh vector-native layer, not a revival of
  the removed field. **Reveal is referee-authored, not derived from token LoS** — the
  user's framing was a rendering one ("a new layer, underneath tokens and the grid, over
  the majority of other drawing layers… black to players, lightly translucent grey to the
  referee"), so the reveal _model_ was chosen to match how a referee actually runs a
  table. Auto-reveal from token LoS was considered and deferred: it adds per-move
  geometry writes and an O(rays × segs) sweep per token, and the storage shape accepts it
  later without a migration. Two user-ratified z-order sub-decisions: the grid stays
  **below** fog (hoisting it above would put grid lines across door/symbol art
  everywhere), and fog sits **below `tokens`** (so tokens in revealed area still read;
  tokens in fog are dropped from a player's render set entirely).

**POC evidence (historical).** Proven against `polygon-clipping`, in lattice units:
five floor primitives with per-point snap/half/free; interior rock-carve holes with
automatic split on full bisection; the unified wall model; doors as build-time-reconciled
overlay objects; snapshot undo/redo across merge/split; live LoS; a direct-manipulation
Select tool. 11/11 geometry assertions passed; headless UI smoke passed with zero console
errors.

- **Library.** `polygon-clipping` (45 KB min / 15 KB gzip) handles union / difference /
  holes / split-on-bisection correctly but has **no offsetting and no simplify** —
  confirmed the gap that drove `bufferPolyline` + Douglas-Peucker.
- **Doc size.** 300 random carve + interior-rock ops on one map: worst-case single region
  ≈ 11 KiB even with simplification off — ~90× under Firestore's 1 MiB limit.
  Size-driven spatial splitting is not needed at realistic scale.
- **Simplification tolerance.** 0.10–0.15 lattice units reads visually clean on both
  grid-aligned and organic shapes while cutting ~25–35% of vertices; 0.25 started visibly
  rounding grid corners.
- **Performance.** ~0.6–1.1 ms average per carve/boolean/simplify commit across 300 ops.
- **Undo.** Snapshot-based undo (`structuredClone` of `{floor, walls, doors}`) handled
  merge/split cleanly; delta undo isn't well-defined across a split.
- **Select-tool identity finding** (which fed Model A): editing directly on the baked
  union boundary resolves the common cases cleanly — edge-drag on a rectangle keeps it
  rectangular, vertex-drag reshapes freely. What a baked union cannot do is
  primitive-specific behaviour needing retained identity.
