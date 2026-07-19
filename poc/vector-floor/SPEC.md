# R9.1 Extension Spec: Vector Floor Unification (Full Unification Option)

> **This is the central governing document for the `poc/vector-floor/` scaffold.**
> All work items (WI-A … WI-D) in this POC trace back to this spec. It is
> reproduced here verbatim from the architectural-review draft. See
> [`REVIEW.md`](./REVIEW.md) for the conflict/gap findings that must be
> reconciled before any section below is treated as final, and
> [`README.md`](./README.md) for how the scaffold is organized.

**Status:** Draft for architectural review — NOT yet an approved work item.
**Supersedes (if adopted):** R9.1's "organic shapes are always rasterize-to-cells, never a vector model" clause.
**Depends on:** Master Plan v2 §2.2 (Cellular map model), `packages/shared/src/map/grid.ts`, `packages/shared/src/map/walls.ts`, `SightWall` (R9.2/uvtt import), `FloorChunk`/`fogChunks`.

---

## 0. Purpose
Allow floor geometry to be an arbitrary polygon (with holes), so grid-aligned rooms and freeform organic carves (caves, winding corridors) coexist in **one** floor representation instead of two. Grid-aligned authoring becomes a snap mode at edit time, not a different storage type.

This is a `schemaVersion`-major change. It is being scoped as a spec first so Claude Code can flag complexity/cost before any code is written — **do not begin implementation from this document alone; answer the open questions in §8 first.**

---

## 1. Non-negotiable invariants (carried forward, unchanged)
- Trust model: all room members can write; `gmPrivate/**` boundary unaffected.
- Write discipline: RTDB for in-progress stroke drafts, Firestore for settled commits. No behavior change to this rule — just what gets committed.
- No game mechanics: this is purely geometry/rendering; nothing here computes or validates game state.
- `.vttcamp` round-trip: an exported-then-imported map must be pixel-for-pixel equivalent (see §6 migration).
- Dice/session/encounter systems: untouched. Out of scope entirely.

---

## 2. Data model changes

### 2.1 Floor representation
Replace `FloorChunk` (bit-packed 16×16 chunks) as the *source of truth* with:

```ts
interface FloorRegion {
  id: string;
  /** Outer boundary + optional holes, in cell-lattice coordinates (same
   * coordinate space as wall Edge vertices — NOT pixel coordinates). */
  rings: Point[][]; // rings[0] = outer boundary, rings[1..] = holes
  /** Bounding cell range, maintained for chunk-key/query purposes only —
   * NOT authoritative geometry. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}
```

- A map's floor = the union of all `FloorRegion`s (regions may be stored separately for edit-locality, but rendering/LoS/occupancy treat them as one union — a stroke that bridges two regions merges them into one on commit).
- Storage path: `rooms/{roomId}/maps/{mapId}/floorRegions/{regionId}` — sparse documents, not fixed-size chunks (chunking made sense for bitmasks; polygons don't have a natural fixed grid size).
- `bbox` is denormalized for spatial queries (which regions are near the viewport / near a new stroke) — it is derived, never hand-edited, and must be recomputed on every commit.

### 2.2 What does NOT change
- `fogChunks` — stays exactly as-is, bit-packed, cell-based. See §4.
- `walls/{edgeId}` (explicit floor↔floor dividers) — stays as today for grid-aligned sub-regions. See §3 for how this interacts with polygon boundaries.
- `symbols`, `mapRooms`, `Drawing` (Annotate layer) — unaffected.
- Dice, encounter, session, account systems — unaffected.

### 2.3 schemaVersion
Bump to next major. No backwards compatibility — see §6. New maps (and likely new campaigns, depending on whether `schemaVersion` lives at the room or map level — confirm which before assuming) start fresh on the new schema; there is no dual-read path and no old-map support to preserve.

### 2.4 Interior rock-carve tool ("skinny path", uses holes)
Holes are not just a migration edge case — they are a first-class authoring tool. A GM can draw a **path** through an existing floor region where the *stroke itself* becomes rock (a hole ring), not floor. Use case: an interior wall/divider drawn as a freeform or snapped skinny corridor of rock cutting through open floor, rather than an edge-flag wall.

- Same buffer→boolean pipeline as carving (§5), but the boolean op is **difference** against the enclosing `FloorRegion` instead of union, and the result is a new interior ring (hole) on that region rather than a new region.
- If the stroke fully bisects the floor region (rock now touches the outer boundary on both sides), the difference operation naturally splits one `FloorRegion` into two — this is a normal, expected outcome of the boolean op, not a special case to detect separately.
- This tool is available as one of the drawing primitives in §2.5, not a separate mode bolted on top.

### 2.5 Universal snap/freeform toggle across all drawing primitives
Every carve primitive supports both a grid-snapped and a fully freeform variant of itself — snapping is a per-stroke input modifier, not a property of the shape type. Primitives:

| Primitive | Snapped behavior | Freeform behavior |
|---|---|---|
| **Room** (rectangle) | Corners snap to grid intersections | Corners follow raw pointer position |
| **Corridor** (L-shaped, single width) | Legs snap to axis/grid, single-cell width | Legs follow drag angle freely, width still fixed |
| **Path** (skinny interior carve, §2.4, or exterior corridor-of-rock/floor) | Each click-point snaps to grid | Each click-point is raw pointer position; multi-point, click to add point, double-click to complete |
| **Polygon** (irregular) | Vertices snap to grid | Vertices are raw pointer positions; click per vertex, double-click to close |
| **Regular polygon (n-sided)** | Center/radius snap to grid | Center/radius freeform; n=1 is the degenerate case = circle |

This means the carve-input layer needs one shared abstraction: **a vertex/point stream with a per-point snap decision**, feeding into the same polygon-emission → buffer → boolean-combine pipeline (§5) regardless of which primitive produced the points. The primitives differ only in *how points are collected* (drag-two-corners vs. click-per-vertex vs. click-to-add-point-then-double-click-to-close), not in what happens after point collection. Implementers should build the point-collection UI layer as pluggable input modes feeding one shared geometry pipeline, rather than five independent carve implementations.

---

## 3. Wall / LoS unification
- `derivePerimeterEdges` (bit-boundary walker) is retired **for maps on the new schema**. Perimeter is now: the `FloorRegion` polygon boundary itself, decomposed into segments and fed into the same consumer that already accepts `SightWall` (used today for `.uvtt` import and circle walls).
- This means: after unification, there is exactly one vector-wall consumer (LoS raycasting, rendering) instead of two parallel systems (derived-from-bits perimeter + imported `SightWall`). Perimeter-derived segments and imported/explicit segments both become `SightWall`-shaped records; the only difference is provenance (`source: 'perimeter' | 'uvtt' | 'explicit'`), not type.
- **Doors move to an overlay layer, decoupled from grid edges.** Rather than requiring a grid-aligned edge to host a door (the constraint the pre-clarification draft of this spec flagged as a problem), doors are promoted to the same overlay layer as annotation, symbols, and room labels — i.e. free-floating vector objects, not edge-attached records. A door becomes a vector shape whose two endpoints can be stretched between arbitrary points (not restricted to lattice corners), so it can sit on a fully organic boundary segment exactly as well as a grid-aligned one.
  - This means `walls/{edgeId}`'s door-flag (`door: {state, type}`) is retired as the door's home; doors get their own collection, e.g. `rooms/{roomId}/maps/{mapId}/doors/{doorId}`, storing `{a: Point, b: Point, type: DoorType, state, secret}` in the same lattice-coordinate space as everything else.
  - Doors still need to *interrupt* sight/passage at their location — on commit, a door's segment is excised from whatever `SightWall` segment(s) it overlaps (open door = gap in the sight-blocking boundary at that span; closed/secret = blocks as before), same consumer as §3's unified wall handling.
  - Explicit interior walls (dividers within one contiguous floor polygon that are *not* the rock-carve path tool from §2.4) follow the same pattern: freed from edge-attachment, they become vector segments on the overlay layer, placeable anywhere along or across a floor region regardless of grid alignment.
- Net effect: grid-alignment is now purely an *input-collection convenience* (§2.5), never a *structural requirement* for where a wall or door can exist. This removes the "can't place a door here because this boundary isn't grid-snapped" problem entirely, rather than needing a UI affordance to force local snapping.

---

## 4. Fog stays cellular (explicit decoupling)
Fog does **not** become vector. `fogChunks` remain bit-packed per-cell, exactly as today, for all three modes (`emergent`, `manual`, `dynamic`).

- `emergent` mode reveal-on-carve: a cell is "known" if its center falls inside the floor union (point-in-polygon test at *reveal time*, batched per-chunk on commit — not per-frame).
- `dynamic` mode raycasting: unaffected — it already rays against wall/`SightWall` segments, which now include perimeter-derived ones per §3.
- Rationale (carried from prior discussion): keeps point-in-polygon tests out of any per-frame hot path; fog answers "what does the player see on the grid," not "what is the true shape."

---

## 5. Carve operation pipeline
1. **Stroke capture.** Freeform brush stroke or grid-aligned shape (rect/corridor/ellipse/polygon, all existing) both terminate in the same shape: a polygon (grid shapes are just axis-aligned polygons; freeform strokes are buffered paths — see below).
2. **Buffering (freeform only).** Raw pointer path → offset polygon at brush radius. Requires a real computational-geometry library (Clipper2 or martinez-polygon-clipping — **not** hand-rolled; do not attempt custom polygon offsetting).
3. **Boolean combine.** New stroke polygon unioned (carve) or subtracted (fill/erase) against existing `FloorRegion`(s) whose `bbox` overlaps. Same library handles union/difference.
4. **Simplification.** Post-boolean-op, run Douglas-Peucker (or the chosen library's built-in simplify) at a fixed tolerance to bound vertex growth. This must run on every commit, not periodically — unbounded vertex count from repeated carves is the primary long-session performance risk.
5. **Commit.** Preview during drag rides RTDB (same pattern as chunk carve preview today); release commits the resulting `FloorRegion`(s) to Firestore. A stroke that merges two previously-separate regions writes one region and deletes the others (batched write).

---

## 6. No migration — clean break
Backwards compatibility is explicitly out of scope. Existing maps/campaigns are not migrated; this schema change ships as a breaking change, and any session that wants vector floor starts a **new map** (and likely new campaign, if `schemaVersion` is a room-level field rather than per-map — check which before assuming). Do not build chunk→polygon migration tooling, round-trip equivalence tests against old maps, or dual-schema read paths. This removes §6/§7's migration concerns from the original draft entirely and simplifies the `.vttcamp` story to "one schema, going forward" — no version-branching import logic needed.

---

## 7. Explicit non-goals
- No change to dice, encounter, session, account, or logging systems.
- No per-frame point-in-polygon anywhere (fog reveal is batched-on-commit, not per-frame; token collision/pathing, if it exists, is out of scope for this spec and should be raised separately if it currently depends on the cell bitmask).
- No attempt to keep bitmask and polygon representations simultaneously "live" for the same map — a map is on one schema or the other, migration is one-way per map.
- No custom polygon clipping/offsetting math — use a vetted library.

---

## 8. Flagged for architect-level review (do not resolve unilaterally — bring back findings, don't guess)
These require domain knowledge beyond "read the codebase" — library benchmarking, Firestore limits under real data, and geometry-library-specific behavior. Claude Code should treat these as **test/validation points to report on during the spike (§9 step 1)**, not open-ended design decisions to resolve solo. If an answer requires a judgment call with real tradeoffs, surface the tradeoff and stop rather than picking one.

1. **Library choice.** Clipper2 (WASM) vs. martinez-polygon-clipping (pure JS) — evaluate against: bundle size budget (Vite, static hosting), and correctness with multi-ring (hole-bearing) polygons specifically, since §2.4's interior rock-carve depends on holes working reliably, including the split-on-full-bisection case. Report benchmark numbers, don't just pick the "standard" choice.
2. **Vertex/document size ceiling.** Firestore's 1 MiB document limit — during the spike, run a synthetic stress test (many carve + interior-path operations on one map) and report actual worst-case vertex counts and resulting document sizes, with and without the simplification pass from §5 step 4. This determines whether regions ever need spatial splitting purely for size reasons, independent of topology.
3. **Simplification tolerance.** Test at 2-3 candidate tolerances (fixed in map-units) against both grid-aligned and organic test shapes; report visual degradation vs. vertex-count tradeoff at each, don't pick one without showing the comparison.
4. **Performance validation (the spike itself).** Confirmed as in-scope (see §9) — prototype stroke→buffer→union→simplify in isolation, benchmarked against a stress map, before any store/rendering integration begins.
5. **Undo/redo granularity.** Full before/after polygon snapshots vs. geometric delta — given regions can merge/split (§2.4), report on whether delta-based undo is even well-defined for a split/merge event, or whether snapshot-based undo is the only sane option regardless of write-size cost.

Bring findings back before locking in WI-A's implementation — these numbers should inform the sequencing in §9, not just the code.

---

## 9. Suggested sequencing (revised — schema follows the POC, not the other way around)
Because there's no migration constraint (§6) and no backwards-compat pressure, the sequencing inverts from the original draft: **don't lock the Firestore schema (`FloorRegion`, `doors/{doorId}`, etc.) until the drawing primitives have been proven out against something disposable.** The whole point of the POC is to let the schema in §2 change freely in response to what's learned, without paying a "we already wrote store/security-rules code against the old shape" cost.

1. **POC (human+agent), local-memory only, no Firestore, no store contract, no security rules.** A single-user sandbox — could be a bare Vite/PixiJS page or even a throwaway artifact-style harness — implementing all five primitives from §2.5 (room, corridor, path, polygon, regular n-gon) with the snap/freeform toggle, plus the interior rock-carve hole tool (§2.4) and the door-as-stretchable-overlay-object concept (§3), all backed by in-memory polygon state (no persistence beyond the browser session). Uses the real geometry library candidates from §8.1 — this IS the vehicle for answering §8's benchmark questions, not a separate exercise.
   - Gate: every primitive feels right in the GM's hand (this is a UX judgment call, not a technical one — expect to iterate on things like corner rounding, click-vs-drag feel, and double-click-to-close reliability before it's "done"). Report back §8's findings (library choice, vertex counts, simplification tolerance) from this same build.
2. **Schema lock.** With the POC's actual data shapes in hand (what the geometry library naturally outputs, what the primitives naturally need to store — e.g. does "regular polygon" need to persist `n` and `radius` separately for re-editing, or is a baked polygon sufficient once committed?), finalize `FloorRegion`, `doors/{doorId}`, and the interior-hole representation for real. This is where §2's data model gets amended based on what the POC revealed, not treated as already-final.
3. **WI-A:** Pure geometry functions in `packages/shared/src/map/`, ported from the POC's proven logic, fully unit-tested.
4. **WI-B:** Store contract (`CampaignStore`), security rules, RTDB draft/Firestore commit wiring for all primitives.
5. **WI-C:** Wall/LoS unification (perimeter-as-SightWall, door excision from sight segments per §3).
6. **WI-D:** Production editor UI — wiring the POC's proven interaction patterns into the real app shell, undo/redo, symbols/rooms/labels coexisting on the overlay layer with doors.

Each gated as usual — do not proceed to the next until the prior step's output (POC findings, passing tests, etc.) is confirmed.
