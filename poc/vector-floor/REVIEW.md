# Review: Vector Floor Unification spec vs. current codebase

**Reviewer:** Claude Code · **Date:** 2026-07-19 · **Against:** [`SPEC.md`](./SPEC.md)
**Verified against:** `packages/shared/src/map/{grid,walls,los,fog,natural}.ts`,
`packages/shared/src/types.ts`, `packages/shared/src/migrations/index.ts`,
`packages/shared/src/converters.ts`, `apps/web/src/lib/components/MapView.svelte`,
`apps/web/src/lib/map/{tools,engine}.ts`, `docs/VTT_Master_Plan_v2.md`.

This is the "flag complexity/cost before code" pass the spec (§0, §8) asks for.
Findings are split into **Conflicts** (spec contradicts what's in the repo or the
Master Plan), **Missing** (integration points the spec doesn't account for), and
**Resolved** (open questions in §8 / §2.3 that the codebase already answers, so an
architect need not guess). Nothing here is implemented — per §0 and §9, the POC
gate comes first.

---

## A. Conflicts — must be reconciled before schema lock (§9 step 2)

### C1 — Coordinate-space mismatch: `FloorRegion` is lattice, `SightWall` is pixel
- **Spec:** §2.1 stores `rings` "in cell-lattice coordinates … NOT pixel." §3 then
  says the polygon boundary is "decomposed into segments and fed into the same
  consumer that already accepts `SightWall`."
- **Code:** `SightWall` (`types.ts:417-426`) stores `ax/ay/bx/by` in **pixel**
  space, and `sightSegments()` (`los.ts:114-117`) consumes them **unscaled**,
  while grid-edge segments go through `edgeSegment()` (`los.ts:64-71`) which
  multiplies by `cellSize`. So the two "same consumer" inputs are in different
  units *today*.
- **Impact:** "one vector-wall consumer" requires an explicit decision the spec
  skips: either (a) convert `FloorRegion` lattice rings → pixels (`×cellSize`)
  when emitting perimeter segments, or (b) give `SightWall` a coordinate-space
  tag and make `sightSegments()` scale per-record. Same unresolved units bite
  the new `doors/{doorId}` (§3 says lattice space) whose "excise from the
  overlapping `SightWall` segment" step must compare against pixel-space
  segments. **Pick a canonical space for the unified segment record and state
  it in §2.**

### C2 — "No migration / clean break" (§6) violates a Master Plan non-negotiable
- **Spec:** §6 "Do not build chunk→polygon migration tooling … or dual-schema
  read paths."
- **Master Plan v2:** line 49 — "Every schema change in this plan **must** ship a
  migration and a migration test"; line 122 repeats it and requires `.vttcamp`
  round-trip identity. These are listed as hard rules, not guidelines.
- **Code:** `migrateRoom()` (`migrations/index.ts:199-206`) **throws
  `MigrationError`** for any room whose `schemaVersion` < target with no
  registered step, and `converters.ts:67` runs *every* room read through it.
  Bumping `CURRENT_SCHEMA_VERSION` (currently **11**, `types.ts:14`) without
  registering at least a no-op migration step makes **every existing room throw
  on read** — not a clean break, a hard read failure.
- **Impact:** Even the "no data transform needed" path still requires a
  registered (possibly no-op) migration step, or the migration scaffold has to
  be exempted for the new version. Reconcile §6 with the Master Plan rule
  explicitly; at minimum the spec needs a "register a no-op/floor-dropping
  migration step" clause so old rooms stay *readable* even if their floor is
  intentionally abandoned.

### C3 — `schemaVersion` is **room-level** → a clean break strands whole campaigns
- **Resolves the spec's repeated open question** (§2.3, §6, §9.2: "room or map
  level? confirm before assuming"). It is **room-level**: `Room.schemaVersion`
  (`types.ts:41`), keyed on the room doc by the migration scaffold
  (`migrations/index.ts:20`, `migrateRoom`). Maps are a subcollection *under* the
  room; there is no per-map schema field.
- **Impact / conflict:** Because schema lives on the room, "new map = new schema"
  is impossible — it is "**new room / new campaign**." A breaking room-schema
  bump abandons the *entire* room, including `dice`, `session`, `encounter`,
  `tables`, `log`, `tokens`, `players` — all the subsystems §1 and §2.2 say are
  "untouched / unaffected." So §6's clean break directly costs the data §1
  promises to preserve. The spec's hedge ("likely new campaign") understates
  this: it's not "likely," it's mandatory, and it drops unrelated subsystem data
  with it. **Either scope schema to the map (new field + scaffold change) or
  accept and document that adopting vector floor = starting a fresh campaign.**

### C4 — `emergent` fog loses its zero-storage derivation
- **Spec:** §4 keeps `fogChunks` "exactly as today" and says emergent reveal is
  "point-in-polygon at reveal time, batched per-chunk on commit."
- **Code:** today emergent stores **nothing** — `isCellRevealed()`
  (`fog.ts:27-34`) returns `isFloor(cell)` directly; the floor bitmask *is* the
  reveal mask (`engine.ts:721-722` iterates `floor.listFloorCells()`). With no
  floor bitmask, that derivation is gone.
- **Impact:** emergent must now either (a) **persist a derived reveal bitmask**
  (behaving like `manual`, a new `fogChunks` write path it never had), or (b)
  rasterize the polygon union per-chunk on demand. §4 picks batched-on-commit but
  never says **where the rasterized result lives** or that emergent now issues
  `fogChunks` writes. "Fog unchanged" is not accurate for emergent mode — flag
  the new write path in §2/§4.

### C5 — "Can't place a door on an organic boundary" premise is partly false today
- **Spec:** §3 frames edge-attachment as *the* blocker for organic-boundary doors.
- **Code:** `SightWall.door` (`types.ts:423`) **already** lets a door ride any
  pixel-space vector segment (organic or diagonal), and `doorPassesSight()`
  (`los.ts:73-82`) already gates LoS on it. The genuine gap is only the *grid*
  `MapWall.door` (`types.ts:390`). There are currently **three** door homes:
  `MapWall.door`, `SightWall.door`, and reserved `CircleWall.doors`
  (`types.ts:474`).
- **Impact:** The new `doors/{doorId}` overlay collection is reasonable, but §3
  only mentions retiring `walls/{edgeId}`'s door flag. It must also say what
  happens to `SightWall.door` and `CircleWall.doors` (consolidate into the
  overlay collection, or leave them?). As written, the spec would create a
  *fourth* door home rather than unifying to one.

---

## B. Missing — integration points the spec doesn't account for

### M1 — `source` field is a schema addition introduced only in prose
§3 adds `source: 'perimeter' | 'uvtt' | 'explicit'` to the unified wall record,
but `SightWall` (`types.ts:417-426`) has no such field (only `visible?`,
`style?`). List it under §2 data-model changes, and note perimeter records are
ephemeral/derived (never persisted) vs. `uvtt`/`explicit` which are stored.

### M2 — `deleteRoom` subcollection walk needs the two new collections
Master Plan line 305 enumerates the subcollections recursive-delete iterates
(`… walls, symbols, mapRooms, floorChunks, fogChunks, sightWalls, lights …`).
The new `floorRegions/{regionId}` and `doors/{doorId}` collections must be added
there or they **orphan on room delete**. Not mentioned in the spec.

### M3 — `.vttcamp` portability is unassigned
§1 keeps the pixel-for-pixel round-trip invariant, but `portability/vttcamp.ts`
is `floorChunks`-based today and **no WI in §9 owns updating it** (WI-D is
"editor UI"). Export/import of `FloorRegion` (+ `doors`) needs an explicit owner,
and the round-trip test the Master Plan mandates needs a home.

### M4 — Two live consumers of `carvedBoundingBox(floorChunks)` must be repointed
- Session Config **grid-shrink guard** (R4): `SessionActivity.svelte:214` →
  `carvedBoundingBox(floorChunks)`.
- **PNG export frame** (R9.8): `MapView.svelte:880` → same.
Both must switch to union-of-`FloorRegion.bbox`. §2.1 says the bbox exists but
doesn't call out that these consumers depend on the *chunk-derived* one.

### M5 — Token flood-fill / room detection depends on `isFloor` — §7's non-goal is LIVE
§7 says token collision/pathing "if it exists … should be raised separately if it
currently depends on the cell bitmask." **It exists and it depends on it:**
- `floodFillRoom()` (`MapView.svelte:1640-1661`) BFS's over `grid.isFloor(n)` —
  used for room auto-detection.
- Interaction gating at `MapView.svelte:1384` (`if (!floorGrid.isFloor(cell))
  return;`).
Per the spec's own instruction, **raising it:** these need a
point-in-`FloorRegion` replacement, or they break on new-schema maps. Not
per-frame, so batched PIP is fine, but the replacement is real work nobody owns
in §9.

### M6 — Library capability gap: §8.1's candidates are NOT equivalent for buffering
§5 step 2 requires polygon **offsetting** (pointer path → brush-radius offset
polygon). The two §8.1 candidates differ on this:
- **Clipper2** ships `ClipperOffset` (offsetting) *and* `SimplifyPaths` (§5 step
  4 Douglas-Peucker).
- **martinez-polygon-clipping** does **boolean ops only** — **no offsetting, no
  simplify**. Choosing martinez means §5 step 2 has no implementation and needs a
  *third* library (e.g. `polygon-offset`, `polyclip`) plus `simplify-js`, which
  changes the bundle-size math §8.1 is trying to compare.
**Add "provides polygon offsetting" as a hard requirement to the §8.1 eval, not
just boolean/hole correctness** — otherwise the comparison is apples-to-oranges.

### M7 — RTDB preview payload shape/growth is unspecified
§5 step 5 says preview "rides RTDB (same pattern as chunk carve preview today)."
But chunk preview streams fixed-size bitmasks; a polygon preview streams a
**growing, unsimplified vertex list** (simplify only runs on commit, §5 step 4).
The draft payload shape and its per-pointer-move size growth aren't specified —
a long freeform drag could push large RTDB writes every frame. Define the draft
shape and whether interim simplification/throttling applies to the *preview*.

### M8 — Passage/blocking model (not just sight) loses its perimeter source
`isEdgeBlocked()` (`walls.ts:89-99`) combines derived perimeter + explicit walls
for **passage** (distinct from LoS). §3 retires `derivePerimeterEdges` and
re-homes *sight* on the polygon boundary, but doesn't say how passage/blocking is
answered on new-schema maps. If anything depends on `isEdgeBlocked` for movement,
it needs a polygon-boundary equivalent. (Ties into M5.)

---

## C. Resolved from the codebase — architect need not guess

### R1 — §8.5 Undo/redo granularity: snapshot-based, by existing precedent
Every non-cell entity op in `EditorOp` (`tools.ts:46-68`) is already
**snapshot-based** — `from: T | null → to: T | null` (wall, sightWall,
circleWall, symbol, mapRoom, drawing). Multi-doc gestures use a
**batch-of-snapshots** (`wallBatch`, `mapRoomBatch`, `tools.ts:53,66`), and
`invertOp()` (`tools.ts:70-101`) just swaps `from`/`to`. A region **merge/split**
maps exactly onto that: a `floorRegionBatch` of `{ id, from, to }` where deleted
regions have `to: null` and the merged/new region has `from: null`.
**Delta-based entity undo is used nowhere in this codebase.** So §8.5's "is delta
even well-defined for split/merge?" → **no need to invent it; use snapshots,
consistent with the five existing precedents.** Only floor/fog use cell-patch
deltas today because cells are individually cheap — polygons are not, so they
follow the entity-snapshot precedent, not the cell-patch one.

### R2 — §2.3 / §9.2 "room or map level?": room-level (see C3)
Confirmed: `Room.schemaVersion` (`types.ts:41`). No per-map field exists. This is
not an open question — it's decided by the current data model, and its
consequence is C3.

---

## D. Low-risk / spec got it right (brief)
- **Fog staying cellular (§4)** is consistent with the render hot path — no
  per-frame PIP, matching the existing `visibleCells()` cell-center probe
  (`los.ts:136-154`). Good call, aside from the emergent-storage gap (C4).
- **`sightSegments()` is already the single sight consumer** (`los.ts:103-124`) —
  feeding perimeter in as segments is a genuinely small change *once C1's units
  are settled*.
- **Snapshot undo already exists** (R1) — WI-D's undo/redo is mostly a new
  `EditorOp` variant, not new machinery.
- **POC-before-schema-lock sequencing (§9)** is sound and matches §0's "answer §8
  first" — the scaffold is structured to honor it (see [`README.md`](./README.md)).

---

## E. Recommended spec amendments before WI-A
1. State the **canonical coordinate space** for the unified segment record and
   the door collection (C1).
2. Add a **migration-scaffold clause** (register a no-op/floor-dropping step so
   old rooms stay readable) and reconcile with Master Plan line 49/122 (C2).
3. Decide and document **schema scope** — per-map field vs. accept
   new-campaign-per-adoption (C3).
4. Specify **emergent-fog storage** under the new model (C4).
5. Fold `SightWall.door` / `CircleWall.doors` into the **door-home
   consolidation** story (C5), and add `source` to §2 (M1).
6. Assign owners for **`deleteRoom` list (M2), `.vttcamp` (M3),
   bbox consumers (M4), token flood-fill/passage (M5/M8)** — or explicitly defer
   them with a tracking note.
7. Make **"provides offsetting"** a hard §8.1 library requirement (M6) and define
   the **RTDB preview payload** (M7).
