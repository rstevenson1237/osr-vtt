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
