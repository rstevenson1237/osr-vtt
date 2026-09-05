# INTAKE

Triage and intake ledger for request classification.

Every request enters here for triage (RULE-015).
See `PLAN.md` for active and upcoming work items.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 1. Intake triage

Classified, not necessarily scheduled. Classification is itself an approval gate:
nothing advances out of this table until the user approves the classifications.

The tables below are the **index**, split by status; each item's request, rationale and
disposition are the sections that follow, grouped by the batch they arrived in — that
prose record is never moved or trimmed, only the two index tables above it change as an
item's status changes. §1.1 holds every item still Open or Scheduled — this is the "what
is waiting" table. §1.2 is the closed-intake index: items whose disposition's work
item(s) have landed in §3. Retirement moves a row from §1.1 to §1.2 in the same pull
request that closes the work item; per RULE-019 no `IN-` id is ever deleted, reused or
renumbered by the move, only its table.

> **Reading the older rationales.** Items IN-001 – IN-021 were classified under the
> pre-WI-044 wording of the Deceptive triggers, which read _touches X_ rather than
> _changes the contract of X_. Their rationales are preserved as written. Where one says
> "touches", read it against the trigger list in force at the time; the classifications
> themselves were reviewed and stand.

### 1.1 Open and scheduled

| IN     | Item                                                          | Classification        | Status        | Disposition         |
| ------ | ------------------------------------------------------------- | --------------------- | ------------- | ------------------- |
| IN-044 | `SPEC.md` indexes SPEC-028 as Active; its body says Completed | **Simple**            | **Scheduled** | WI-071              |
| IN-045 | `DECISIONS.md` still records the hex grid as Deferred         | **Simple** (answered) | **Scheduled** | WI-071              |
| IN-046 | IN-041 never moved to §1.2 after WI-060 landed                | **Simple**            | **Scheduled** | WI-071              |
| IN-051 | Remove the starter map as a new map's default background      | **Simple**            | **Scheduled** | WI-073              |
| IN-055 | Profile Template defaults → HP, To Hit, Initiative            | **Simple**            | **Scheduled** | WI-073              |
| IN-057 | Snap selector on the Label and Symbol tools                   | **Simple**            | **Scheduled** | SPEC-028 §1, WI-075 |
| IN-067 | A second GM removing a background crashes the first GM's drag | **Deceptive** (proposed) | **Open**   | Awaiting triage      |
| IN-068 | `applyBackgrounds` — all-or-nothing texture load, no drag guard | **Deceptive** (proposed) | **Open**  | Awaiting triage      |
| IN-069 | Backgrounds are placeable on hex maps in an undefined space    | **Deceptive** (proposed) | **Open**  | Awaiting triage      |
| IN-070 | Ship the packaged local release — launcher, README, tag workflow | **Simple** (proposed)  | **Open**   | Awaiting triage      |
| IN-071 | CI mechanical check — grep `build:local` output for Firebase hits | **Simple** (proposed) | **Open**  | Awaiting triage      |
| IN-072 | No guard against opening a `.vttcamp` newer than the running build | **Deceptive** (proposed) | **Open** | Awaiting triage      |
| IN-073 | No build/version identifier; `package.json` version stuck at `0.0.0` | **Simple** (proposed) | **Open** | Awaiting triage    |
| IN-076 | `room-uploads.emulator.test.ts` still times out on CI at a 30s budget (third occurrence) | **Simple** (proposed) | **Open** | Awaiting triage |
| IN-078 | `ATTRIBUTION.md` is cited by SPEC-003 §5 but does not exist | **Simple** (proposed) | **Open** | Awaiting triage |
| IN-084 | `snap = grid` — a fourth mode centring content on the grid lines, for every snapping tool | **Deceptive** | ⏸ **Postponed** | Postponed — user, 2026-09-02. DEC-080 narrows to its hex half. |
| IN-087 | Eye and Ping can be aimed at a token or object, which becomes the focus | **Deceptive** (proposed) | **Open** | Awaiting triage — DEC-084, SPEC-046 §2 |
| IN-091 | Hex terrain tool — colour + symbol, hex-union under Hex snap, circular brush under Free | **Deceptive** | **Open** | Blocked on DEC-082 — postponed pending WI-100 |
| IN-099 | Symbol and Label show the Snap selector but draw neither a snap dot nor a cell highlight | **Simple** | **Scheduled** | WI-108 |
| IN-102 | "A click with no drag" has five different answers under Free; only Room's is cited | **Deceptive** | **Open** | Blocked on DEC-085 — answer before WI-104/WI-105 |
| IN-105 | Like-terrain hexes have no drawn boundary, and `HexTerrainEntry` has no border colour | **Simple** (proposed) | **Open** | Awaiting triage — from WI-100 |
| IN-106 | Per-hex seeded scatter as the terrain texture, in place of the single centred overlay | **Deceptive** (proposed) | **Open** | Awaiting triage — from WI-100 |
| IN-107 | `switchToEditMode`'s conditional click is a race — an e2e spec can run its whole body in view mode | **Simple** (proposed) | **Open** | Awaiting triage — from WI-103's verification |
| IN-108 | Implement DEC-085's answer for square-grid tools: `corridorPoly`'s Free zero-length case becomes a `bandWidth` square, plus IN-095's matching Free-indicator fix | **Deceptive** (proposed) | **Open** | Awaiting triage — from DEC-085's closure ahead of WI-104 |

### 1.2 Closed intake

| IN     | Item                                                                           | Classification                    | Closed via                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IN-095 | Corridor's Free-snap indicator is a circle, but the Corridor never draws a round cap | **Simple** | **Closed** — WI-107 (2026-09-05), SPEC-028 §6: `targetedBandFor` now special-cases the Free-snap circle to Path only; Corridor keeps the width×width square (`targetedBandRect`/`bandLo`) under Free too. See `docs/completed/WI-107.md`. |
| IN-096 | SPEC-028 §7/§6 attribute the flat-vs-round cap change to Corridor as well as Path | **Simple** | **Closed** — WI-107 (2026-09-05): §6's WI-052 amendment corrected in place. See `docs/completed/WI-107.md`. |
| IN-097 | The snapped Carve dab is a Euclidean disc of cells — width 2 gives a plus, not a block | **Simple** (answered — keep the disc, document it) | **Closed** — WI-107 (2026-09-05), SPEC-028 §2: the WI-042 note now documents the disc instead of calling it "a block". See `docs/completed/WI-107.md`. |
| IN-098 | Carve widths 0.5 and 1.0 are the same stroke under Cell snap (the `step/2` radius floor) | **Simple** | **Closed** — WI-107 (2026-09-05), SPEC-028 §2 and README: the collapse is now documented as the floor's known cost. See `docs/completed/WI-107.md`. |
| IN-100 | Under Free, Symbol and Label store an unquantized `cell`/`labelAnchor` float | **Simple** | **Closed** — WI-107 (2026-09-05): `anchorCellFor`'s doc comment and README note the Free-mode float explicitly. See `docs/completed/WI-107.md`. |
| IN-101 | SPEC-028 §6's dot rule contradicts itself; the code follows the second half | **Simple** | **Closed** — WI-107 (2026-09-05), SPEC-028 §6: the WI-048 amendment's superseded sentence is struck and annotated in place. See `docs/completed/WI-107.md`. |
| IN-103 | §12 excludes Symbol and Label by omission — write the reason down and pin it | **Simple** | **Closed** — WI-107 (2026-09-05), SPEC-028 §12: the exclusion is now stated with its rationale, and `attractsToVertex('symbol'|'label')` is pinned in `vector-tools.test.ts`. See `docs/completed/WI-107.md`. |
| IN-104 | SPEC-028 §2 describes two anchor families; the code has three (vertex / cell-centre / cell-corner) | **Simple** | **Closed** — WI-107 (2026-09-05), SPEC-028 §2: rewritten around the three-family table (vertex/`snapPoint`, centre/`snapCellCenter`, corner/`snapCell`), with `CELL_ANCHORED_TOOLS`'s merge of the last two noted explicitly. See `docs/completed/WI-107.md`. |
| IN-093 | Hex label tool — detail tied to a hex address | **Deceptive** | **Closed** — WI-106 (2026-09-04), SPEC-047 §5: the `hexLabel` tool resolves the pointer to a hex (`hexAt`, the same `pixelToAxial` Select's own click uses) and publishes it as `MapToolController.selectedHex`, opening the same `HexTile.note` field the hex-tile sheet already edits. No new schema, no new collection, no migration. SPEC-030 §§1 and 5 are annotated in place. See `docs/completed/WI-106.md`. |
| IN-089 | Hex symbol/terrain art upgrade — the supplied 37-file pack becomes the palette | **Deceptive** | **Closed** — WI-101 (2026-09-04), SPEC-047 §6: the 37 files land re-authored white at `apps/web/public/assets/hex/{terrain,contents}/*.svg`, wired into `HEX_TERRAIN_CATALOG`/`HEX_CONTENTS_CATALOG`. 10 supersede an existing kind's `ref` under an unchanged `kind` string; the other 27 are new kinds. Provenance recorded in `ATTRIBUTION.md`. See `docs/completed/WI-101.md`. |
| IN-088 | Hex maps get their own tool palette, not a subset of the square one | **Deceptive** | **Closed** — WI-104 (2026-09-04), SPEC-047 §3: `HEX_TOOL_IDS` is now a plain authored array instead of a filter over the square map's `TOOL_GROUPS`; content unchanged today (`select`, `pan`, `eye`, `measure`, `ping`), but it can now grow to hold SPEC-047 §4's hex-only tools without a square-palette group inventing a home for them. See `docs/completed/WI-104.md`. |
| IN-092 | Hex symbol tool — places a symbol, unsnapped under Free | **Deceptive** | **Closed** — WI-105 (2026-09-04), SPEC-047 §4: the `hexSymbol` tool, its own `HEX_TOOL_IDS`/`MapToolbar` row, resolves through `hexMap.pixelToAxial`/`axialToHexPoint` under Hex snap and raw `pixelToHexPoint` under Free, and calls `store.placeHexSymbol`. See `docs/completed/WI-105.md`. |
| IN-094 | Hex road and river tools — three shades, three widths, mitred vs round joins | **Deceptive** | **Closed** — WI-105 (2026-09-04), SPEC-047 §4: the `road`/`river` tools reuse the Wall/Path/Polygon click-to-click gesture, each vertex resolved through `snapHexPoint` under Hex snap, and commit via `store.addHexLine` on a double-click (or Enter) once ≥2 points have been collected. See `docs/completed/WI-105.md`. |
| IN-090 | Hex maps offer exactly two snap modes: Hex and Free | **Deceptive** | **Closed** — WI-104 (2026-09-04), SPEC-047 §3: `VectorSnapMode` grows `'hex'`, and `MapToolbar`'s `SNAP_MODES` is a function of grid kind — Hex/Free for a hex map, Cell/Half/Free otherwise. No visible change yet: no current hex tool shows the Snap selector. See `docs/completed/WI-104.md`. |
| IN-086 | Eye and Ping both expire on a countdown rather than cluttering the map | **Simple** | **Closed** — WI-099 (2026-09-03), SPEC-046 §1: the ping's ring shrinks and fades over its unchanged 3s RTDB lifetime; the eye gets a 4s client-local lifetime of its own, pausing while `canRevealFromEye` is true so the fog-reveal action is never stranded mid-decision. See `docs/completed/WI-099.md`. |
| IN-085 | Snap audit — does every mode draw the same shape class, and is Free's vertex attraction universal? | **Investigation** | **Closed** — WI-098 (2026-09-03). Findings only, no code changes (DEC-027). Ten tools × three modes tabulated from the code: **three** anchor families (vertex / cell-centre / cell-corner), and **only two** tools change shape class with the mode — Path's caps (SPEC-028 §7) and Carve's brush (DEC-032), both cited. Nine uncited differences found, logged as IN-095 – IN-103. Symbol and Label should **not** join the vertex-attracting set. See `docs/completed/WI-098.md`. |
| IN-079 | Numeral orientation is arbitrary per face — the edge rule reads face-table winding | **Deceptive** | **Closed** — WI-093 (2026-09-02), SPEC-045 §1 per DEC-078: the edge rule is replaced by axis-projection + symmetry-snap, and the binding test (rotating a face's index list must not change its glyph-up) makes the defect class unable to return. See `docs/completed/WI-093.md`. |
| IN-080 | Die sizing and aspect — circumradius parity makes the d4 read oversized | **Simple** | **Closed** — WI-094 (2026-09-02), SPEC-045 §2: `SCALE` is retuned so each die's real circumradius (`hullPoints`' farthest vertex from centre, not the raw table entry) follows `d4 ≤ d6 < d8 < d10 ≈ d12 < d20`, pinned by a new test; `apexZ` left unchanged at 0.85. See `docs/completed/WI-094.md`. |
| IN-081 | Material pass on the generated dice — PBR tuning, normal-mapped incised numerals | **Simple** | **Closed** — WI-095 (2026-09-02), SPEC-045 §3: `textures.ts`'s canvas emboss pass is replaced by a generated normal map per numeral label, the material is retuned (roughness 0.34, metalness 0.09, `envMapIntensity` 0.6), and `scene.ts` bakes a PMREM `RoomEnvironment` onto `scene.environment` once per mount. See `docs/completed/WI-095.md`. |
| IN-082 | Bevelled die edges — real dice have no sharp corners | **Deceptive** | **Closed** — WI-097 (2026-09-03), SPEC-045 §4 per DEC-079: every value face is inset in its own plane and the band that opens up is filled with edge strips and corner patches, all in **one** material group past the value range (`DieGeometry.bodyGroupIndex`, always `faceCount`), so the `faceIndex → value` 1:1 relation every consumer assumes is untouched. `flatShading` splits per material (faces `true`, body `false`) over an authored `normal` attribute. Both judgements §4 deferred were made by looking: the seam is clean, and `hullPoints` stays un-bevelled (worst-case recession 9.4%, the d4's apex). See `docs/completed/WI-097.md`. |
| IN-083 | Dice in one roll rarely touch — the throw disperses them | **Simple** | **Closed** — WI-096 (2026-09-02), SPEC-045 §5: `simulate()`'s spawn is retuned (shared per-roll arc, tighter ring, stronger inward launch) so dice in a multi-die roll visibly strike one another; `MAX_STEPS` raised 300 → 360; a stacked die is documented as an accepted outcome. See `docs/completed/WI-096.md`. |
| IN-077 | Selectable 3D die models — imported meshes beside the procedural set           | **Complex (Shape A)**             | **Denied** (user, 2026-09-02) — DEC-077 answered (c). No `WI-` id was ever reserved, so none is retired; the effort goes to the generated set instead, as IN-079 – IN-083. |
| IN-001 | Refactor the planning and instruction documentation                            | **Complex (Shape A)**             | WI-028                                                                                                                                                                         |
| IN-002 | App Check: monitoring → enforcement                                            | **Deceptive**                     | WI-029 `[HUMAN]`                                                                                                                                                               |
| IN-003 | N-gon dropdown, drag orientation, cell-centred sizing                          | **Deceptive**                     | WI-030 / SPEC-028                                                                                                                                                              |
| IN-004 | Corridor width dropdown, cell-centred band                                     | **Deceptive**                     | WI-030 / SPEC-028                                                                                                                                                              |
| IN-005 | Room carve snaps to cells, 1×1 minimum                                         | **Deceptive**                     | WI-030 / SPEC-028                                                                                                                                                              |
| IN-006 | Snap indicator: highlight the targeted cell                                    | **Deceptive**                     | WI-030 / SPEC-028                                                                                                                                                              |
| IN-007 | Evaluate the other carving tools for inconsistencies                           | **Investigation**                 | Run inside WI-030                                                                                                                                                              |
| IN-008 | URL-derived token does not display on the map                                  | **Simple**                        | WI-032                                                                                                                                                                         |
| IN-009 | Move Token scale to the Character quick sheet                                  | **Simple**                        | WI-031                                                                                                                                                                         |
| IN-011 | Hex Crawl map type                                                             | **Complex (Shape A)**             | SPEC-030 (Completed), WI-037 – WI-041 (WI-037 – WI-039 closed 2026-08-13; WI-040, WI-041 2026-08-14)                                                                           |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap                         | **Deceptive**                     | WI-042                                                                                                                                                                         |
| IN-013 | Snapped Carve stroke centres on an intersection                                | **Deceptive**                     | WI-042                                                                                                                                                                         |
| IN-015 | "Deceptive" stopped discriminating                                             | **Deceptive**                     | WI-044                                                                                                                                                                         |
| IN-016 | A classification was invented mid-run                                          | **Simple**                        | WI-044                                                                                                                                                                         |
| IN-017 | RULE-018's ordering clause is unenforceable                                    | **Deceptive**                     | WI-043                                                                                                                                                                         |
| IN-018 | The Model column was lost in the WI-028 split                                  | **Simple**                        | WI-044                                                                                                                                                                         |
| IN-019 | The completion summary is written before verification                          | **Simple**                        | WI-044                                                                                                                                                                         |
| IN-020 | Nothing prompts the `PLAN.md` status write-back                                | **Deceptive**                     | WI-045                                                                                                                                                                         |
| IN-021 | Intake rows have outgrown the table                                            | **Simple**                        | WI-044                                                                                                                                                                         |
| IN-022 | Scheduled/completed intake rows are never retired                              | **Simple**                        | WI-049                                                                                                                                                                         |
| IN-023 | Token scale overflows the quick sheet's bounding box                           | **Simple**                        | WI-046                                                                                                                                                                         |
| IN-024 | Quick sheet header reads "Character", not the name                             | **Simple** (borderline)           | WI-046                                                                                                                                                                         |
| IN-025 | Remove the Clear button from quick-sheet colour                                | **Deceptive**                     | WI-050 / SPEC-031                                                                                                                                                              |
| IN-026 | Encounter group: a "+" card that adds a creature to it                         | **Simple**                        | WI-047                                                                                                                                                                         |
| IN-028 | Path tool adopts the Corridor's snapped behaviour                              | **Deceptive** (reversal)          | WI-051, WI-052 / SPEC-028                                                                                                                                                      |
| IN-029 | Superseded point snap-dots are still drawn under the cell                      | **Simple**                        | WI-048                                                                                                                                                                         |
| IN-031 | Edit/View toggle beside undo/redo — a soft carve lock                          | **Simple**                        | WI-053                                                                                                                                                                         |
| IN-030 | Creature cards are inert — selection is keyed to a seat                        | **Complex (Shape A)**             | WI-054–057 / SPEC-032                                                                                                                                                          |
| IN-014 | The Symbol tool ignores the snap mode                                          | **Simple**                        | WI-068                                                                                                                                                                         |
| IN-033 | Mobile viewport clipping, map `touch-action`, safe areas                       | **Simple**                        | WI-058 / SPEC-033 §§1–3                                                                                                                                                        |
| IN-039 | Path simplification destroys sub-half widths                                   | **Simple**                        | WI-059 / SPEC-028 §10                                                                                                                                                          |
| IN-038 | Corridor/Path bands overshoot at every bend                                    | **Deceptive**                     | WI-061 / SPEC-028 §9                                                                                                                                                           |
| IN-040 | The corridor's bend axis is hard-coded horizontal-first                        | **Deceptive**                     | WI-062 / SPEC-028 §11                                                                                                                                                          |
| IN-036 | The mobile breakpoint fires on any coarse pointer                              | **Deceptive**                     | WI-067 / SPEC-033 §7                                                                                                                                                           |
| IN-037 | Blaze upload containment — limits enforceable on our side                      | **Deceptive**                     | SPEC-034 (Completed), WI-065 (RULE-010 amendment) + WI-066 (§§2–4), both 2026-08-14. The `[HUMAN]` console half is `docs/runbooks/blaze-billing.md`.                           |
| IN-042 | Documentation context loading optimization (Planning vs Execution split)       | **Deceptive**                     | WI-069                                                                                                                                                                         |
| IN-034 | Hover-only affordances are unreachable on touch                                | **Deceptive**                     | WI-063 / SPEC-033 §4                                                                                                                                                           |
| IN-035 | Full-screen view and the installed/standalone app view                         | **Deceptive**                     | WI-064 / SPEC-033 §5                                                                                                                                                           |
| IN-043 | Un-quarantine and refactor portability.spec.ts e2e test                        | **Deceptive**                     | WI-070 / SPEC-036                                                                                                                                                              |
| IN-010 | Battle Map quick sheet                                                         | **Complex (Shape A)**             | WI-033–036 / SPEC-029                                                                                                                                                          |
| IN-041 | Lobby credits, and the symbol pack's provenance                                | **Simple**                        | WI-060 / SPEC-033 §6                                                                                                                                                           |
| IN-032 | Toolbar-added creatures are invisible to players                               | **Unclear**                       | Closed, no work item — user (2026-08-11): working as designed                                                                                                                  |
| IN-052 | Serve asset storage from a GitHub Pages subfolder                              | **Unclear**                       | Withdrawn, no work item — user (2026-08-11): premise didn't hold (404 KB total assets); the Saved-URL path covers it                                                           |
| IN-047 | `PLAN-COMPLETED.md` §3 carries duplicated WI ids                               | **Investigation**                 | WI-072 — repaired the WI-058/WI-059/WI-068 duplicate rows; each pair described one real change, not two, so no fresh id was needed                                             |
| IN-048 | SPEC-029 §2 is cited by no Battle Map work item                                | **Deceptive** (verify then close) | WI-072 — verified: rect-not-raster, background/floor/overlay clipped with no source grid, `exportPng` stays wired with `backgroundColor` compositing all shipped; no gap found |
| IN-056 | Encounter Template default → Initiative only                                   | **Deceptive**                     | WI-074 / DEC-065                                                                                                                                                               |
| IN-058 | Edit/View becomes one binary button, default View                              | **Deceptive** (reversal)          | WI-076 / DEC-064                                                                                                                                                               |
| IN-059 | Capture tool moves to the battle-map quick sheet                               | **Deceptive**                     | WI-077 / DEC-066 / SPEC-029 §1                                                                                                                                                 |
| IN-049 | Lasso — vertex/object multi-select, Backspace deletes, loop-preserving removal | **Deceptive**                     | WI-078 / DEC-060 / SPEC-037                                                                                                                                                    |
| IN-050 | Free snap also snaps to an existing vertex                                     | **Deceptive**                     | WI-079 / DEC-061 / SPEC-028 §12                                                                                                                                                |
| IN-053 | Multiple background assets — move/resize, ratio locked, alignment grid         | **Deceptive**                     | WI-080 + WI-081 / SPEC-038                                                                                                                                                     |
| IN-054 | Move background management into the Assets activity                            | **Deceptive**                     | WI-081 / SPEC-038 §5                                                                                                                                                           |
| IN-027 | Expanding a group re-lays tokens out in a grid                                 | **Deceptive**                     | WI-082 / DEC-067 — a separate "Tidy" action; expand keeps restoring the stored formation                                                                                       |
| IN-060 | Background move/resize — uncover the runtime errors                            | **Investigation**                 | WI-083 — findings logged as IN-067 – IN-069                                                                                                                                    |
| IN-061 | Backgrounds are marked locked or unlocked, from the Assets page                  | **Deceptive**                     | WI-084 / SPEC-039 §1                                                                                                                                                           |
| IN-062 | Select picks up, moves and resizes an unlocked background                       | **Deceptive**                     | WI-085 / DEC-070 / SPEC-039 §2                                                                                                                                                 |
| IN-063 | Corners keep the ratio, edges free it                                            | **Deceptive** (rev.)              | WI-086 / SPEC-039 §3                                                                                                                                                            |
| IN-064 | Creatures get real names and A–Z symbols                                        | **Deceptive**                     | WI-087 / DEC-072 / SPEC-040 — schema v28; §5's "map token's label" annotated in place (no on-map name label exists to agree with)                                              |
| IN-065 | Local-only mode — the `.vttcamp` is the live document                            | **Complex (Shape A)**             | WI-088 (RULE-009 amendment, RULE-017) + WI-089 / DEC-073 – DEC-075 / SPEC-041 (Completed) — `LocalStore`, the `local-build` Vite mode, the single-user scoping and the local lobby; packaging is IN-066/WI-090 |
| IN-066 | Packaging and distributing a local build                                          | **Investigation**                 | WI-090 — findings logged as IN-070 – IN-073                                                                                                                                                    |
| IN-074 | Redraw the icon set under a stated depiction rule                                 | **Simple**                        | WI-091 / SPEC-043 / DEC-076                                                                                                                                                                    |
| IN-075 | No focus state on any shell icon control                                          | **Simple**                        | WI-092 / SPEC-044                                                                                                                                                                              |

#### IN-001 — Refactor the planning and instruction documentation

**Request.** "Refactor this repository's planning and instruction documentation." (Phases
0–4: baseline, split the Master Plan into five files, write CLAUDE.md, apply decided
configuration, reconcile.)

**Classification.** **Complex (Shape A)** — Large refactor spanning every planning
document, plus new harness configuration (hooks, slash command, settings). Not a playtest
item, so Simple/Deceptive triage does not apply; it arrived already discussed and
multi-phase.

**Disposition.** → **WI-028**. Phases 1–3 executed; Phase 4 reconciliation gates deletion
of the source document.

#### IN-002 — App Check: monitoring → enforcement

**Request.** Carried from the WI-025 ledger: "the remaining step is watching metrics
through at least one full real session and then flipping to **enforcement**."

**Classification.** **Deceptive** — Touches **auth** — a Deceptive trigger by name.
SPEC-025 §2 states outright that enforcing early "will lock out legitimate clients". Zero
code changes, but the failure mode is a total outage for every player, and there is no
in-app reversal path.

**Disposition.** → **WI-029**, `[HUMAN]`. Its multi-phase plan already exists as SPEC-025
§2's monitoring-first rollout; the gate is your explicit go-ahead after reviewing console
metrics.

**Note on the classification.** Triage says Deceptive items "do not get scheduled; they
stop and become a conversation with the user, then a multi-phase plan with its own specs."
That conversation and that plan already happened — SPEC-025 §2 _is_ the multi-phase plan,
and monitoring mode is phase one, already live. WI-029 is phase two. It is listed in §2
rather than withheld because withholding it would lose the only record that the rollout is
half-finished.

### Map-tools playtest batch (2026-08-01)

A nine-item batch: four restatements of one geometry problem, an investigation, two
small fixes, and two large new map types. `IN-003` was the next unused id (RULE-019).

#### IN-003 — N-gon dropdown, drag orientation, cell-centred sizing

**Request.** "Ngon drop down — select between: circle, 3, 4, 5, 6, 7, 8. Direction of the
drag changes the orientation… snap the flat face… Snap diameter… Default to circle. Center
the ngon in the middle of the selected cell."

**Classification.** **Deceptive** — Touches the **carve pipeline and lattice coordinates**
— a RULE-006 trigger by name. Changes what "snap" means for an existing tool, which is a
reversal, not an addition.

**Disposition.** → **WI-030**, under new **SPEC-028**.

#### IN-004 — Corridor width dropdown, cell-centred band

**Request.** "Corridor drop down — select between: ½, 1, 2. Default to ½ when snap = half
and 1 when snap = cell or free. Center the corridor in the selected cell or half cell."

**Classification.** **Deceptive** — Same trigger: `corridorPoly`'s band quantization is
carve-pipeline geometry, and the width control is shared with two other tools.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-005 — Room carve snaps to cells, 1×1 minimum

**Request.** "Room carve should snap to the cell (or half cell) when in snap mode,
starting with a 1x1 carve and then grow as the user moves the mouse."

**Classification.** **Deceptive** — Same trigger. Also turns a currently-degenerate case (a
click that never moves) into a committing one.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-006 — Snap indicator: highlight the targeted cell

**Request.** "Snap indicator for room and corridor tool when in cell snap should be the
highlighted cell that is targeted (and half cell when in half)."

**Classification.** **Deceptive** — A new draw call on the Pixi `tools` layer — **the layer
stack** is a named trigger.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-007 — Evaluate the other carving tools for inconsistencies

**Request.** "Evaluate other carving tools for inconsistencies."

**Classification.** **Investigation** — Not a change at all. It produces findings, not
edits, so Simple/Deceptive does not apply.

**Disposition.** Audited inside **WI-030**; findings logged as IN-012 – IN-014 below
(DEC-027).

#### IN-008 — URL-derived token does not display on the map

**Request.** "When a url derived token is used, click dragging from the character sheet
does not display the token on the map."

**Classification.** **Simple** — The change is contained to texture loading inside
`VectorMapView`; it adds no store method, no schema field, no rules change, and moves no
`data-testid`.

**Disposition.** → **WI-032**.

#### IN-009 — Move Token scale to the Character quick sheet

**Request.** "Move token scale from map tools to character quick sheet, underneath map
defaults."

**Classification.** **Simple** — The control, its three testids and its callback move
verbatim between two components that both already hold `MapToolController` in context;
nothing about the underlying `resizeToken` call changes.

**Disposition.** → **WI-031**.

#### IN-010 — Battle Map quick sheet

**Request.** "Battle Map quick sheet…" (full text in SPEC-029).

**Classification.** **Complex (Shape A)** — A new map type ⇒ `GameMap` schema change ⇒
migration (RULE-007), new store methods (RULE-001), toolbar filtering, a new quick sheet, a
bounded camera.

**Disposition.** → **SPEC-029**, phased **WI-033 – WI-036**.

#### IN-011 — Hex Crawl map type

**Request.** "Hex Crawl Map Type…" (full text in SPEC-030).

**Classification.** **Complex (Shape A)** — Replaces the square lattice with a hex one —
**a second coordinate space, which RULE-006 forbids** — plus a terrain model the renderer
has no concept of. Needs a rule amendment before it can start.

**Disposition.** → **SPEC-030**, phased **WI-037 – WI-041**.

### Findings from the IN-007 carve-tool audit

Reported, not fixed (DEC-027). All three were verified against the code, and the first
two were reproduced by probing `buildFloorStroke` directly.

#### IN-012 — A single Carve dab paints nothing at widths ≤ 1 under cell snap

**Finding.** The brush is handed _vertex_-snapped points, then paints every cell whose
**centre** is within `radius = max(width/2, step/2)` of them. A cell centre is always
`0.707` from the nearest vertex, so at radius `0.5` no cell qualifies and the stroke
commits nothing. Verified: widths 0.5 and 1 → nothing; 1.5, 2 and 3 → a 2×2 block.

**Classification.** **Deceptive** — Carve pipeline (RULE-006). The fix is to feed the brush
raw points like the other cell-anchored tools, which changes every snapped brush stroke,
not just the failing case.

**Disposition.** → **WI-042** (approved 2026-08-01).

#### IN-013 — A snapped Carve stroke is centred on a grid intersection, not on the cell under the pointer

**Finding.** Same root cause as IN-012: clicking at `(3.9, 5.1)` — well inside cell
`(3,5)` — paints cells `(3,4)`, `(4,4)`, `(3,5)`, `(4,5)`, a block symmetric about the
corner rather than about the cell aimed at.

**Classification.** **Deceptive** — Same trigger and same fix as IN-012; they should land
together.

**Disposition.** → **WI-042**, with IN-012 (approved 2026-08-01).

#### IN-014 — The Symbol tool ignores the snap mode

**Finding.** `anchorCellFor` (`symbol-catalog.ts:207`) hardcodes `Math.floor`, so a symbol
always lands on a whole cell even under Half or Free snap — the only tool whose snap
control does nothing.

**Classification.** **Simple** — One pure function plus its call site; no schema, no store,
no rules, no testid move. But it changes stored `MapSymbol.cell` values from integers to
halves, so it wants its own gate.

**Disposition.** → **WI-068**, closed 2026-08-03.

**Not findings, deliberately.** Wall, Door and Polygon keep vertex snapping: a wall runs
_between_ intersections and a polygon's gesture is placing corners, so a vertex is the
right anchor for all three. The Path tool keeps its free-form ribbon — it is the organic
counterpart to the Corridor, and cell-aligning it would remove the only tool that is not
grid-true. The Label tool already floors to the clicked cell (`snapCell`), matching the
new rule.

> **The Path clause is under reversal (2026-08-02).** IN-028 asks for exactly the
> cell-alignment this paragraph declined. The disposition is **named and superseded by
> DEC-032**, which is Open — it is annotated here rather than rewritten (RULE-019), and
> stands until that decision is answered.

### Workflow feedback from the first run under the new layout (2026-08-01)

Seven findings from executing WI-030 — the first work item to go through the WI-028
five-document layout end to end. All seven were approved by the user on the same day.
Three are defects in the layout itself rather than improvements to it.

#### IN-015 — "Deceptive" stopped discriminating

**Finding.** Six of twelve items in the map-tools batch classified Deceptive, all for the
same reason: RULE-006 names the Pixi layer stack, the carve pipeline and lattice
coordinates as triggers, and any real map work touches one. What actually predicted
difficulty was _changing the contract of_ those things, not _touching_ them — IN-003–006
redefined what "snap" means, while IN-014 merely touches the same files and is genuinely
small.

**Classification.** **Deceptive** — Changes the triage rule itself, so it changes how every
future item is classified. No clean reversal once items have been classified under new
wording.

**Disposition.** → **WI-044**.

#### IN-016 — A classification was invented mid-run

**Finding.** IN-007 ("evaluate other carving tools") is neither Simple, Deceptive nor
Unclear — it produces findings, not edits. It was labelled **Investigation** and the
vocabulary was extended without flagging it.

**Classification.** **Simple** — One list in `CLAUDE.md` gains a named fourth category; no
code, no schema, no rule text, reversible in a single commit.

**Disposition.** → **WI-044**.

#### IN-017 — RULE-018's ordering clause is unenforceable

**Finding.** "Documentation is updated before implementation, never after" — WI-030
implemented first and wrote SPEC-028 afterward. The PR carried both, satisfying the second
sentence, which is the checkable one. No hook or CI job can observe the ordering.

**Classification.** **Deceptive** — Amends `RULES.md`. Requires the stop-flag-approve-amend
ceremony and a standalone `RULE-AMENDMENT:` commit (RULE-017).

**Disposition.** → **WI-043**.

#### IN-018 — The Model column was lost in the WI-028 split

**Finding.** `CLAUDE.md` still requires each work item to name a model target; both
`PLAN.md` tables carry Agent and Effort and no Model. The archives
(`PLAN-COMPLETED-addendum-c.md`, `-access-lifecycle.md`) do carry it, so this is a
**regression introduced by the new layout**. Twelve WI rows were added under it without a
model target and nothing caught it. The pinned IDs in `CLAUDE.md` (`claude-opus-4-8`,
`claude-sonnet-4-6`) are also both stale.

**Classification.** **Simple** — Restores a column the archives already use and updates one
paragraph of `CLAUDE.md`; no code, no rule text, reversible in a single commit.

**Disposition.** → **WI-044**.

#### IN-019 — The completion summary is written before verification, so it is a prediction

**Finding.** WI-030's summary claimed strokes "move by up to half a cell" — true of the
anchor, false of the extent, since a Room grows by up to a full cell per axis. A failing
e2e fixture caught it, not review. Step 7 follows step 6 but nothing requires the suite to
have passed first.

**Classification.** **Simple** — One clause in `CLAUDE.md` step 7; no code, no rule text.

**Disposition.** → **WI-044**.

#### IN-020 — Nothing prompts the `PLAN.md` status write-back

**Finding.** `CLAUDE.md` asks for one before any long-running operation. WI-030 ran a
27-minute suite twice without one. Good advice with no trigger attached.

**Classification.** **Deceptive** — The obvious fix is a third `PreToolUse` hook, and
**DEC-016 fixed the count at exactly two**, saying no more without a work item and a
`DECISIONS.md` entry. So this touches a closed decision and the harness.

**Disposition.** → **WI-045**.

#### IN-021 — Intake rows have outgrown the table

**Finding.** IN-012's row is a full paragraph inside a five-column markdown table —
unreadable raw, awkward rendered.

**Classification.** **Simple** — Reformats one section of `PLAN.md` into the
section-plus-index shape §3 already uses; no content change.

**Disposition.** → **WI-044**.

### Quick-sheet / encounter / path-tool playtest batch (2026-08-02)

Eight items plus two questions. The two questions are answered in place — a question
produces an answer, not an edit, so only the one that asked for a **behaviour change**
(IN-022) became an intake item. `IN-022` was the next unused id (RULE-019).

**The character-ownership question, answered.** Asked: can a player own multiple
characters, can the referee, and who owns a character when its player disconnects?

- **A player can act as many characters.** Ownership is a property of the **group**, not
  the token (`packages/shared/src/encounter/ownership.ts`). A seat listed in
  `Group.memberSeatIds` may act as _every_ character in that group — open its sheet, edit
  its profile, roll its fields. `PlayerSeat.currentCharacterSeatId` is the pointer to
  which one they are currently playing; they switch freely, and they write that pointer
  themselves.
- **The referee owns every character.** GM membership is _derived_ from `Room.gmUid` in
  `canSeatActAs`, never stored, so transferring GM moves that membership across every
  group at once with no writes.
- **Disconnecting changes ownership not at all.** Presence is ephemeral (an RTDB node
  removed by `onDisconnect`); the durable seat, its group memberships and its profile all
  survive. The only visible effect is that the token dims (`AWAY_ALPHA`, SPEC-027). The
  referee still owns the character, as they always did, and any other seat in the same
  group can still act as it. A seat is only actually reclaimed by the GM-confirmed prune
  at `ABANDONED_SEAT_DAYS = 30`.

  **Worth naming:** if a lone player owns a group by themselves and drops, no _player_
  can act as those characters until they return — the referee is the only fallback. That
  is the current design, not a defect, but if you want a hand-off on disconnect it is a
  new intake item.

#### IN-022 — Scheduled or completed intake rows are never retired

**Request.** "Intake items not removed from `PLAN.md` as scheduled or completed, should we
update this behavior?"

**Finding.** Confirmed. All 21 existing intake items sit in §1 permanently; IN-001's
disposition still reads "→ WI-028" although WI-028 closed on 2026-08-01, and WI-029's
completion summary says outright that "index rows are not rewritten on completion". §1 is
described as "classified, not yet scheduled", which is now false of most of its contents,
so the one table that should answer "what is waiting" answers "everything that ever
arrived". RULE-019 forbids deleting or reusing the ids, so the fix is a **status column
plus a closed-intake archive**, not deletion.

**Classification.** **Simple** — Reformats `PLAN.md` §1 and adds one paragraph to
`CLAUDE.md` step 1. No code, no schema, no rule text, no `RULES.md` edit; reversible in a
single commit. It changes no item's classification or disposition, only where a retired
row is displayed.

**Disposition.** → **WI-049**.

#### IN-023 — Token scale overflows the quick sheet's bounding box

**Request.** "In character quick sheet, token scale goes past the bounding of the sheet,
move down below."

**Classification.** **Simple** — A layout fix in one component
(`CharacterDock.svelte`'s `.map-defaults` block, added by WI-031). It moves no
`data-testid` out of the component, touches no store method, no schema and no rules.

**Disposition.** → **WI-046**, with IN-024 (same component, same area).

#### IN-024 — The quick sheet header reads "Character", not the character's name

**Request.** "Next to the token image we display 'Character' instead of the current name
associated with that token. Update to the Character name. Allow double click to edit and
change the name. Enter or clicking outside the bounding box of the edit to complete or esc
to cancel."

**Classification.** **Simple**, and **flagged as borderline** — see below.

`CharacterDock.svelte:265` hardcodes `<h2>Character</h2>`. The name to show is
`PlayerSeat.displayName` for the sheet's seat, which is already the established answer:
`EncounterBoard.cardName()` resolves a card's title exactly that way, with the comment
"Never a game value". It cannot be a profile field — RULE-002 and the component's own
header comment forbid per-field-id logic, and the template is referee-defined so there may
be no `name` field at all. The edit writes through the existing `renamePlayer` store
method; `firestore.rules` already permits `players/{uid}` writes from that uid or the GM,
so no rules change is needed.

Why it does not trip a Deceptive trigger: no store method is added or re-signed, no stored
field changes type or meaning, `firestore.rules` is untouched, no coordinate or layer
semantics move, and no existing `data-testid` is moved, renamed or removed (the inline
editor adds new ones).

**Why it is flagged.** `renamePlayer`'s doc comment says "GM renames a seat's display
name", and under group ownership a player can have another character's sheet open and
editable — but the rules deny them writing that seat's `players/{uid}` doc. The affordance
is therefore gated to own-seat-or-GM (**DEC-030**). That is a UI gate over an existing
rule, not a change to one, which is why this stays Simple — but it is close enough to the
line to name explicitly at the gate.

**Disposition.** → **WI-046**, with IN-023.

#### IN-025 — Remove the Clear button from the quick-sheet colour picker

**Request.** "Remove the 'clear' button from color selection - not needed."

**Classification.** **Deceptive** — two triggers, one of them substantive.

1. `token-color-clear` is a `data-testid` a Playwright spec depends on
   (`dice-overlay.spec.ts:171`) — removed, which is a named trigger.
2. More seriously, **Clear is the only path back to no colour.** `ProfileInstance.color`
   and `Token.color` are both `color?`, and absent means something specific: the die
   renders one theme-wide neutral (`--dice-face`) rather than a per-seat value, and a
   letter token keeps its auto-assigned `gen:disc:` fill. Neither swatch nor
   `<input type="color">` can produce `undefined`. Deleting the button makes the absent
   state unreachable once any colour has been set — a one-way door for every character,
   with no reversal path in the UI.

**Disposition.** → **WI-050**, under new **SPEC-031**. **Resolved by the user,
2026-08-02** (DEC-033): "we can just always assign a color, at random if necessary. There
should be no case where a roll does not have a color associated." That removes the
objection by removing the unset state itself — but it makes this the larger half of the
item, not the smaller: an absent `color` stops meaning "no custom colour chosen" and
starts meaning "written before this rule, needs backfill", which is a stored-field
meaning change under RULE-007 and ships a migration, a migration test and a `.vttcamp`
round-trip test. Removing the button is the last step, not the work.

#### IN-026 — An empty "+" card on each encounter group adds a creature to it

**Request.** "In encounter activity, each group displays at the far right an empty card,
containing only a plus sign. Click on this to add a new creature to the group."

**Classification.** **Simple** — It is a new card rendered at the end of each group's card
row in `EncounterBoard.svelte`, reusing machinery that all already exists: the
`dialogs.pickToken` creature picker, `store.createToken`, and `store.updateGroup(...,
{ memberTokenIds })`. No store method is added or re-signed, no schema field changes, no
rules change, no coordinate or layer semantics move, and it only _adds_ `data-testid`s.
The equivalent flow already ships in `VectorMapView.addCreature`.

**Open sub-question, defaulted:** the board has no map camera, so a creature created there
needs a spawn position. Defaulted to the same `STARTER_DROP_POS` staircase
`VectorMapView.addCreature` already uses (**DEC-031**), and the card is GM-gated to match
the existing `add-creature` control.

**Disposition.** → **WI-047**.

#### IN-027 — Expanding a group re-lays its tokens out in a grid

**Request.** "If a group is collapsed and then expanded, do not retain the original
relative position, instead arrange the tokens in the order they are included in the group,
when 4 or more are included, move to a new row (grid layout)."

**Classification.** **Deceptive** — It changes the meaning of a stored field.
`Group.memberOffsets` exists for exactly one purpose: `collapseGroupPatch` records each
member's offset from the anchor so `collapsedDragUpdates` can restore the formation, and
the code comment states the intent as "keeps the stored formation … so the formation
survives a collapsed drag and expand". Re-laying out on expand makes that field either
dead or half-dead — it is still needed _during_ a collapsed drag but must be discarded
_at_ expand — and that is a schema-meaning change under RULE-007, not a rendering tweak.

It is also a **write to every member token's position on every expand**, which the token
layer has no undo for. A referee who collapses a group to drag it, then expands it, loses
the arrangement they built, with no way back.

**Disposition.** ~~Not scheduled.~~ **Answered (user, 2026-08-11, DEC-067): a separate
explicit "Tidy" action.** Collapse/expand keep restoring the formation unchanged;
`Group.memberOffsets` keeps its one stated meaning. **Scheduled → WI-082.** The grid's
spacing, its origin, and whether it applies to board card order are left to WI-082's own
execution-time decisions per DEC-067.

#### IN-028 — The Path tool adopts the Corridor's snapped behaviour

**Request.** "Path tool, adjust to match the behavior of the corridor tool. When snap is
cell or half, snap icon should be a full or half tile. When snap is free, the snap display
should be a circle of the desired width. Change width selection to a drop down (⅛, ¼, ½,
1, 2). Default width is ½ when snap = half and 2 when snap = cell or free. When snap = cell
or half, path termination points should be 90°, not rounded (ie if player draws a path
between right angle points, behavior should be identical to corridor tool)."

**Classification.** **Deceptive**, and it is additionally a **reversal** — it must name and
supersede the decision it overturns before it can be planned.

- **It reverses a recorded disposition.** `PLAN.md` §1, "Not findings, deliberately"
  (WI-030, IN-007 audit) states: "The Path tool keeps its free-form ribbon — it is the
  organic counterpart to the Corridor, and cell-aligning it would remove the only tool that
  is not grid-true." That reasoning is now being overturned deliberately, which is fine,
  but it is a Shape A move: the entry is named and superseded by **DEC-032**, never
  silently overwritten.
- **It splits a shared contract.** `FloorToolOptions.width` is documented as "Path and
  Carve brush width, free-form", and `MapToolbar`'s `showWidth` renders one control for
  both tools. Giving Path a fixed option set either changes Carve's brush at the same time
  or splits the field — the same surgery `corridorWidth` needed (DEC-023), which was itself
  classified Deceptive.
- **It changes what "snap" means for a fourth tool**, adds Path to `CELL_ANCHORED_TOOLS`
  and to `targetedCellFor` (whose doc comment currently restricts it to Room and Corridor
  on stated grounds), and changes the carve pipeline's output: squared line caps mean
  `bufferPolyline` — shared with Carve — grows a cap-style parameter.
- **The ⅛ and ¼ widths are new territory.** Every existing snapped width is a whole or half
  cell; sub-half widths interact with `snapSpan`'s one-step floor and with the "full or half
  tile" snap icon the same request asks for, which cannot show a ⅛ width truthfully.

**Disposition.** → **WI-051** and **WI-052**, amending **SPEC-028**. **Ratified by the
user, 2026-08-02** (DEC-032), wholesale and with two extensions that resolve the two
objections above:

- **The Corridor adopts the same ⅛/¼/½/1/2 set**, so the two tools share one width
  vocabulary. This supersedes DEC-023's corridor half.
- **When `width` is below the snap step, the carved band is centred inside the snapped
  tile** — so `width = ½ · snap = cell` (a ¼-cell inset on each side of a full tile) is
  deliberately _distinct_ from `width = ½ · snap = half` (fills a half-tile exactly). The
  snap indicator then shows the band actually being carved rather than the tile it sits
  in, which is what makes a ⅛ width representable at all.

Carve keeps its free-form width and becomes the only organic floor tool — knowingly.

**Verified while planning:** the centring rule is a _simplification_ of `bandLo`, not an
addition. It currently quantizes to `min(step, width)`; the ratified rule is plain
`cellCenter - width/2`. Every expectation `bandLo`'s doc comment claims survives the
simpler form, and the quantization is exactly what was collapsing `width = ½ · snap =
cell` onto a half-cell line instead of centring it.

#### IN-029 — Superseded point snap-dots are still drawn under the cell indicator

**Request.** "For any tools that used to have a point snap indicator that was superseded by
a tile or shape snap indicator, make sure we are not also overlaying the point."

**Finding.** Confirmed, and it is exactly one case. `vector-engine.ts:1134` draws the
`cursorCell` highlight and then `:1150` draws `cursorSnap` — the dot — unconditionally on
top, with the comment "Drawn last so it always reads on top". `VectorMapView` supplies both
for Room and Corridor under Cell or Half snap, so those two tools show a dot in the middle
of the tile they already highlight. N-gon and Carve show only the dot (they have no cell
highlight, deliberately — `targetedCellFor` returns null for them), and Wall/Door/Polygon
legitimately snap to a point, so none of those change.

**Classification.** **Simple** — One conditional in `VectorMapView.snapCursorPoint()` (or,
equivalently, one `else` in `renderToolPreview`). It removes a draw call; no store method,
no schema, no rules, no coordinate semantics, and no `data-testid` moves — `snap-cell-readout`
and `snap-cursor` keep reporting what they report today.

**Disposition.** → **WI-048**.

### Creature selection and the edit lock (2026-08-02)

Two requests, plus a third item split out of the first because the investigation showed
the request's two halves have different causes. `IN-030` was the next unused id.

#### IN-030 — Creature cards are inert, because selection is keyed to a seat

**Request.** "In map or encounter activity view, creature cards are not selectable which
means we cannot click and drag to reposition on the map. I believe we should be able to
select any card (player or creature) that belongs to a group we are a member of, which for
a referee is all of them."

**Finding — the board half is confirmed, and the cause is structural.**
`EncounterBoard.selectCard()` is `if (token.ownerSeatId) onSelectActor(token.ownerSeatId)`
— a no-op for a token with no owning seat. `class:selectable`, `role="button"` and
`tabindex` are all gated on `Boolean(token.ownerSeatId)` too, so a creature card is not
merely unresponsive, it is not focusable and does not advertise itself as clickable.
Creatures never have a seat: `VectorMapView.addCreature` calls `createToken` with
`pos`/`size`/`layer`/`imageRef` only.

The cause is not a missing branch, it is the **key**. The whole selection spine is
seat-keyed end to end: `onSelectActor(seatId)` → `RoomShell.selectActor(seatId)` →
`selectedSeatId` → `canSeatActAs(..., targetSeatId, ...)` → `store.setCurrentCharacter`,
and `CharacterDock` then resolves a _profile_ from that seat. A creature has no seat and
no profile, so it cannot enter that model at all. Making creature cards selectable means
re-keying selection from "a seat" to "a token, which may or may not have a seat", and
deciding what the quick sheet shows when there is no profile behind the selection.

**The map half of the request does not reproduce.** Token drag on the map is **not**
ownership-gated: `syncSprites` sets `eventMode = 'static'` and calls `attachDragHandlers`
for _every_ token it renders, and `attachDragHandlers` has no seat or group check. A
referee can already click and drag any creature token on the map. What can hide one from a
_player_ is visibility, not selection — see IN-032, which is why that half is split out.

**Classification.** **Complex (Shape A)** — Reclassified from Deceptive on 2026-08-02,
once the user's three answers made the scope explicit. Creatures gaining profiles
(DEC-034) is a `ProfileInstance` schema change with a migration, so this is no longer a
single gated item — it is a phased body of work with its own spec.

It changes the contract of the selection callback shared by `EncounterBoard`,
`VectorMapView` and `RoomShell` (`onSelectActor(seatId)`), and the meaning of
`PlayerSeat.currentCharacterSeatId`, which is defined as "the seat whose character this
player is currently playing" and has no reading for a seatless creature. It also reaches
`CharacterDock`, whose every control — profile fields, colour, portrait, and the rename
affordance added in WI-046 — assumes a seat behind the selection.

**The three questions, answered by the user (2026-08-02).**

1. **What does selecting a creature open?** → **A real profile.** "Lets go ahead and add
   the profiles, will be needed eventually anyways" (**DEC-034**). Profiles are re-keyed
   from a seat id to an **actor id** — a seat id for a character, a token id for a
   creature — reusing the room's existing `profileTemplate`. Two findings from planning:
   `deleteToken` cleans up nothing today, so a token-keyed profile would leak on every
   creature deletion and `deleteToken` must enumerate it; and `firestore.rules` needs **no
   change**, because `profiles/{seatId}` is already member-writable rather than
   own-seat-only.
2. **Is the ownership rule new?** → **New, and one step shorter** (**DEC-035**). The
   motivating case is an NPC travelling with the party: in the group, owned by no one
   player. `canSeatActAs` resolves a seat by finding a group that lists me _and_ holds a
   token whose `ownerSeatId` is the target — an inner test a seatless creature can never
   pass. For a creature the rule is simply **is this token in a group I own**, with the
   referee's membership still derived from `Room.gmUid`.
3. **Should map drag be gated?** → **Yes** (**DEC-036**), the user's instruction being to
   gate it only if straightforward. It is: the check goes inside the `pointerdown`
   handler, which closes over live `tokens`/`groups` state and so re-evaluates on every
   press with no sprite-cache invalidation when membership changes. One policy gap is
   defaulted rather than asked: a token with **no group and no seat** — scenery, and the
   single creature `addCreature` deliberately leaves ungrouped — matches no ownership rule
   and becomes **referee-only**. That is a capability removal, since map drag is ungated
   today, and it is reversible in one predicate.

**Disposition.** → **SPEC-032**, phased **WI-054 – WI-057**.

#### IN-031 — An Edit/View toggle beside undo/redo: a soft lock on carving

**Request.** "We should add a edit/view toggle near undo/redo in map tools. This is a soft
lock on carving functions or editing functions. No permissions change, just a quick toggle
to prevent accidental edits when not intended."

**Classification.** **Simple** — Client-local, per-viewer UI state (a boolean on
`map-tool-controller.svelte.ts`) plus a toolbar control and a disabled/inert state for the
carve and edit tools while it is off. It adds no store method, writes nothing to Firestore
or RTDB, changes no schema field, touches no security rule, and moves no `data-testid` —
it only adds one. It redefines no coordinate, layer or pipeline stage: the tools it gates
keep meaning exactly what they mean, they just do not receive input.

**Explicitly not a permissions change**, per the request — which also means **it does not
resolve DEC-001** (whether the vector toolbar should be GM-gated at all). That decision
stays Open; this is a latch the holder can flip for themselves, not a boundary.

**Disposition.** → **WI-053**.

#### IN-032 — A creature added from the map toolbar is invisible to every player

**Finding, from the IN-030 investigation.** `VectorMapView.addCreature` creates its group
with `showMap: false, showBoard: false`. `visibleTokenIds` hides a token whose every group
has the surface flag off, and `renderableTokens` applies that to all non-GM viewers —
`isGM ? tokens : tokens.filter(...)`. So a batch of creatures added from the toolbar
renders for the referee and for nobody else until the referee flips `[Map]` on the group
card.

This may well be deliberate — staging a monster group unseen and revealing it on the
referee's cue is exactly how an ambush should work, and the `[Map]`/`[Board]` toggles exist
to do it. It is recorded because it is a plausible second cause of "we cannot reposition
creatures on the map" as observed from a _player's_ seat, and because a single creature
added alone gets **no group at all** (`addCreature` only calls `createGroup` when
`newTokenIds.length > 1`), so it is visible to everyone immediately — the two paths
disagree, which is harder to defend than either rule on its own.

**Classification.** **Unclear** — Whether this is a defect depends on intent, which the
code does not record and I should not guess.

**Disposition.** ~~Awaiting the user.~~ **Answered (user, 2026-08-11): (a) working as
designed — closed, no work item.** Staging a batch unseen and revealing it on the
referee's cue is the intent; the single-creature path's immediate visibility is accepted
as-is despite the two paths disagreeing.

---

### Mobile, Blaze prep, carve artifacts and credits (2026-08-03)

A four-part investigation request rather than a playtest list: the user asked for findings
on each area **before** any plan was formed. Each finding below is logged as its own
intake item (Shape B, one row per item), and the classification table was approved by the
user on 2026-08-03 before anything advanced.

#### IN-033 — Mobile viewport clipping, the map's missing `touch-action`, and safe areas

**Finding.** Three separate causes behind "toolbars are often not visible under Safari"
and "click-and-drag is inconsistent on mobile":

1. **The viewport.** `.mshell` correctly uses `height: 100vh; height: 100dvh`
   (`RoomShell.svelte:1113`), but its ancestor `App.svelte:46` is `min-height: 100vh` —
   the **large** viewport. The document is therefore taller than the visible small
   viewport, the page scrolls, and `mrail-chips` + `mrail-bottom` ride out from under
   Safari's collapsing URL bar. `.shell` (the desktop frame, `RoomShell.svelte:914`) has
   the same `100vh` with no `dvh` fallback.
2. **`touch-action`.** It appears in exactly two places in the whole app
   (`RoomShell.svelte:968`, the rail drag handle; `QuickSheetCard.svelte:205`). The Pixi
   map host `.vf-canvas-wrap` has **none**, so the browser's native pan/pinch competes
   with the map's own pan/zoom and with token drag. `map/pan-zoom.ts:124` already carries
   a comment relying on a `touch-action: none` that is never set on the map host.
3. **Safe areas.** `apps/web/index.html` has no `viewport-fit=cover`, and
   `env(safe-area-inset-*)` appears nowhere in the codebase, so the mobile bottom bar
   sits under the iPhone home indicator.

**Classification.** **Simple.** CSS plus one `<meta>` attribute. It touches no
`CampaignStore`/`AssetStore` method, no `GameMap`/`Room`/`PlayerSeat` field, neither rules
file, no lattice/layer/pipeline semantics, no auth or join path, no store routing, and no
existing `SPEC-nnn`'s stated behaviour. It moves and renames no `data-testid` — the mobile
frame's `app-shell-mobile`, `mobile-activity-bar`, `shell-stage` and `vector-map-canvas`
all stay exactly where they are.

**Disposition.** WI-058, against SPEC-033 §§1–3. Closed 2026-08-04.

#### IN-034 — Hover-only affordances are unreachable on touch

**Finding.** `@media (hover: hover)` appears **zero** times in the codebase. Three
affordances are hover-gated with no touch equivalent: the map's room-label tooltip
(`VectorMapView`'s `showHoverLabel` / `hoverLabel`, driven from `pointermove`), the Select
tool's `hoverHandle` highlight, and every plain `:hover` rule — which on iOS latches after
a tap and stays lit until the next tap elsewhere.

**Classification.** **Deceptive.** The fix is not a media query: it has to decide what
each affordance _becomes_ on a coarse pointer, and the label tooltip in particular has no
obvious touch gesture that does not collide with the tools already bound to tap and drag
on that canvas. That is a change to what an existing interaction means.

**Disposition.** WI-063, against SPEC-033 §4. Sequenced after WI-058, which establishes
the touch-input baseline it builds on. **The conversation this Deceptive item was waiting
for happened in WI-063's planning session (2026-08-08) and is recorded as DEC-059:** a
coarse pointer gets a target, not a gesture — a note dot for the tooltip, size rather than
a highlight for the Select handles, `@media (hover: hover)` for the rest. SPEC-033 §4 now
states the resolved rule; WI-063's gate is presented and awaiting approval.

#### IN-035 — Full-screen view, and the installed/standalone app view

**Finding.** Neither exists. There is no `requestFullscreen` call anywhere in
`apps/web/src`; there is no web app manifest under `apps/web/public/`, and no
`apple-mobile-web-app-*` meta in `index.html`. So "full screen view for desktop and
mobile" and "mobile app view" are not defects — they are unimplemented.

**Classification.** **Deceptive.** A new control surface with real interaction: full-screen
changes the viewport under a live Pixi stage that sizes itself from its host, standalone
mode removes the URL bar and changes the viewport height a third way, and both interact
directly with IN-033's frame work and with IN-036's breakpoint question.

**Disposition.** WI-064, against SPEC-033 §5. Sequenced after WI-058. **Closed 2026-08-08**
— see `docs/completed/WI-064.md`.

#### IN-036 — The mobile breakpoint fires on any coarse pointer

**Finding.** `MOBILE_MEDIA_QUERY = '(max-width: 899px), (pointer: coarse)'`
(`shell/layout.svelte.ts:8`). A touchscreen laptop at 1920 px, and an iPad Pro in
landscape, both get the phone shell — single stage, chip rail, no docked sheet column —
regardless of how much room they have.

**Classification.** Raised as **Unclear** — whether this was a defect depended on intent,
and the code does not record which of the two concerns the clause was for. **Reclassified
**Deceptive** once the user ruled** (2026-08-03): the answer splits one boolean into two
independent signals, and `isMobile` is a contract shared by `RoomShell.svelte` and
`shell-state.svelte.ts`'s `isSheetOpen`/`toggleSheet`/`expandSheet`, so the change reaches
the quick-sheet state machine rather than stopping at CSS.

**Disposition.** **User, 2026-08-03: (b)** — split the two concerns. Width alone picks the
layout; a coarse pointer alone widens hit targets. SPEC-033 §7, DEC-052, **WI-067**, which
lands **before WI-063**: while one boolean answers both questions, §4's hover equivalents
and §5's full-screen affordance cannot be specified for one without silently binding the
other. Still a layout change on hardware I cannot test from here, so it wants the same
real-device check WI-058 does.

#### IN-037 — Blaze upload containment: what is actually enforceable on our side

**Finding.** There is no `firebase/storage.rules` and no `storage` block in
`firebase.json`; `AssetStore.upload?` is a declared-but-unimplemented interface slot.

What Security Rules **can** enforce with no trusted writer: per-file size
(`request.resource.size`), a `contentType` allowlist, a path shape binding an object to a
room and an uploader uid, and room membership via a cross-service `firestore.get()`.
What they **cannot** enforce: any aggregate per-room or per-user byte quota, and any rate
limit — both need state that only a trusted writer can maintain, and RULE-010 forbids
Cloud Functions.

**The blocker, and it is a rule conflict.** RULE-010's stated premise is that "on Spark,
quota exhaustion **denies requests rather than generating a bill** — the downside of abuse
is an outage for the group, not a charge. Tune for availability and containment, not
cryptographic guarantees." Blaze inverts that premise exactly, and the user's stated
concern — a malicious outsider rather than the actual players — is the case the rule
assumed away. No work item here can clear a gate until RULE-010 is amended, and RULE-017
makes that amendment a standalone change of its own.

**Classification.** **Deceptive**, and additionally **Blocked**. It adds a rules file
(RULE-004 trigger: rule changes ship with rule tests), it depends on auth and on the
membership predicate (RULE-011), and it changes the trust model's stated economics
(RULE-008, RULE-010).

**Disposition.** **DEC-049 answered (c)** — user, 2026-08-03: RULE-010's no-Cloud-Functions
clause stands, only its economic premise is replaced. The ruling accepts that a Cloud
Billing budget alerts rather than caps, so containment is per-write plus early warning, not
a guarantee; a hard ceiling was reachable only through Cloud Functions and that door is now
closed rather than left ajar. SPEC-034, then WI-065 (the standalone `RULE-AMENDMENT:`) and
WI-066 (the implementation). **Scheduled last** — after the Battle Map and Hex Crawl
series, with everything else in this batch ahead of it.

#### IN-038 — Corridor and Path bands overshoot at every bend

**Finding, verified against `primitives.ts` by hand.** `bandSpan`
(`packages/shared/src/map/vector/primitives.ts:248`) makes **every** leg span whole cells,
both end cells inclusive. That is right for a straight run's two terminal ends and wrong
at a bend, where each leg then overshoots the other by `(step − width) / 2`.

Worked example — snap = cell, width = ⅛, drag `(0.3, 0.3) → (3.6, 3.6)`:

| Leg        | Extent                              |
| ---------- | ----------------------------------- |
| horizontal | `x ∈ [0, 4] × y ∈ [0.4375, 0.5625]` |
| vertical   | `x ∈ [3.4375, 3.5625] × y ∈ [0, 4]` |

The horizontal leg runs 0.4375 past the vertical band's outer edge and the vertical leg
runs 0.4375 below the horizontal band — a plus, not an L, which is precisely the reported
"the two paths overlap into all 4 cardinal directions instead of a single bend". The user's
proposed fix is the correct one: legs run **cell-centre to cell-centre**, extended half a
step only at the two **terminal** ends of the gesture.

Because `pathPoly` builds its axis-aligned legs with the same `bandRect`, one change fixes
both tools — and it is also what delivers the second half of the report, "we should meet
the connecting inside and outside corner in a single vertices": with the overshoot gone,
leg ∪ leg ∪ `cornerBlock` unions to a clean six-vertex L. It is additionally consistent
with what `pathPoly` **already** does for diagonal runs, where `cappedQuad` caps the two
terminal ends and leaves interior ends flush (DEC-038).

**Classification.** **Deceptive.** It reverses the stated behaviour of SPEC-028 §7 ("the
length covers whole cells, both ends inclusive"), which was ratified in DEC-032 and
elaborated in DEC-038 — an existing spec's stated behaviour is a named Deceptive trigger,
and a reversal must name and supersede the original decision rather than overwrite it.

**Disposition.** SPEC-028 §9, WI-061. DEC-046 records the reversal. **Closed 2026-08-04.**

#### IN-039 — Path simplification destroys sub-half widths

**Finding.** `DEFAULT_TOOL_TOLERANCE.path = 0.15` lattice units
(`packages/shared/src/map/vector/tolerance.ts:41`), while `BAND_WIDTH_OPTIONS` offers
**0.125** and 0.25 (`primitives.ts:212`). Douglas-Peucker with a tolerance wider than the
shape itself keeps only each side's two endpoints, so a long thin band collapses toward a
sliver — the reported "the shape becomes almost triangular from one end of the path to the
other". The user's own diagnosis is correct, and the effect worsens with length, because a
longer chain gives DP more to discard between the pinned endpoints.

This is fallout from WI-051, which gave Path the shared ⅛/¼/½/1/2 set. The tolerance
values predate it and were tuned for a free-form organic ribbon, which is the only thing
Path used to be.

**Classification.** **Simple.** It changes one policy function whose values are already
documented as tunable and which already takes a caller override
(`toolTolerance(tool, override?)`). No store method, no schema, neither rules file, no
coordinate/layer/pipeline **meaning** — the pipeline stage's inputs and outputs are
unchanged, only how aggressively it prunes — no auth, no testid, and no existing spec's
stated behaviour: SPEC-028 §7 states what the band _is_, and this is about not destroying
it afterwards.

**Disposition.** SPEC-028 §10, WI-059. **Closed 2026-08-04.**

#### IN-040 — The corridor's bend axis is hard-coded horizontal-first

**Finding.** `corridorPoly` builds its corner as `const corner: Point = { x: b.x, y: a.y }`
(`primitives.ts:307`) — unconditionally horizontal leg first, then vertical. So the bend's
position relative to the gesture depends entirely on which way the user happened to drag,
which is the reported asymmetry between drawing horizontally and drawing vertically. The
user's proposed fix — wait for the drag to declare a dominant direction, then latch that
axis for the rest of the gesture — is the right shape.

**Classification.** **Deceptive.** It needs a new argument on a shared geometry primitive
(the same surgery DEC-023 and DEC-032 each did to the width controls), new per-gesture
drag state in `VectorMapView` that must survive the whole stroke, and it changes what a
corridor gesture _means_ — the same shape now depends on gesture history, not only on its
two endpoints. It also has to answer what a diagonal-ish drag with no clear dominant axis
does before the latch engages.

**Disposition.** SPEC-028 §11, WI-062. Sequenced after WI-061, which rewrites the leg
geometry it latches onto. **Closed 2026-08-04.**

#### IN-041 — Lobby credits, and the symbol pack's provenance

**Finding.** The lobby has no credits section. Separately,
`apps/web/public/assets/ATTRIBUTION.md` carries a standing TODO against the same asset
pack: 73 dungeon-map symbol icons and 13 door variants, "supplied by the project owner as
a pre-made SVG pack ('Classic Dungeon Map Symbols')… **TODO: source/license not yet
recorded** — the archive carried no license file or provenance metadata… fill in this
section (author, source URL, license) before any public release/distribution build."

The link the user supplied is that pack's provenance, so the credits section and the
attribution file are the same fact recorded in two places and are filled in together.
**Licence: CC0 1.0 Universal** (user, 2026-08-03,
`https://creativecommons.org/publicdomain/zero/1.0`); author **Mark Gosbell**; source
`https://markgosbell.itch.io/classic-dungeon-map-symbols`.

**Classification.** **Simple.** Additive markup in one component plus one documentation
file. No store method, no schema, neither rules file, no coordinate/layer/pipeline
semantics, no auth or join path, no store routing. It **adds** `data-testid`s rather than
moving or renaming any, which the Deceptive carve-out names explicitly as not a trigger.

**Disposition.** SPEC-033 §6, WI-060.

---

#### IN-042 — Documentation context loading optimization (Planning vs Execution split)

**Request.** User requested optimization of documentation context loading during work item execution to reduce API token costs.

**Classification.** **Deceptive**. Changes the workflow instructions in `CLAUDE.md` and context loading rules for `@DECISIONS.md`, `SPEC.md`, and `PLAN.md`.

**Justification.** Redefines how agents load system specs and rules. Simple carve-out does not apply.

**Disposition.** → **WI-069**.

---

#### IN-043 — Un-quarantine and refactor portability.spec.ts e2e test

**Request.** Audit test suite against specs to un-quarantine flaky e2e tests (`portability.spec.ts`).

**Classification.** **Deceptive**. Touches Playwright e2e specs, `.vttcamp` export/import verification, and multi-context browser sync.

**Justification.** Refactors existing Playwright test contract. Simple carve-out does not apply.

**Disposition.** → **SPEC-036**, **WI-070**. **Closed 2026-08-09** — see
`docs/completed/WI-070.md`.

---

### Ledger audit against the specs (2026-08-09)

Raised by the user immediately after WI-070: compare every scheduled plan against every
provided spec and find what else is missing. Six discrepancies surfaced, all in the
ledgers rather than the code. The first was WI-070's own RULE-018 obligation
(`DECISIONS.md` still described `portability.spec.ts` as quarantined) and was fixed in
that work item's PR. The remaining five are logged here.

#### IN-044 — `SPEC.md` indexes SPEC-028 as Active; its body says Completed

**Request.** `docs/spec/SPEC-028.md`'s status line reads **Completed** — it records the
reopening by IN-038 – IN-040 and then closes it: "§10 shipped at WI-059, §9 at WI-061 and
§11 at WI-062 (all 2026-08-04), which closes the reopening." `SPEC.md`'s index row still
shows **Active**. All three work items are in `PLAN-COMPLETED.md` §3, and no upcoming item
cites SPEC-028.

**Classification.** **Simple**. A single index cell, brought into line with the spec body
that already governs. It changes no contract, no schema and no stated behaviour — the
spec's own text is the source of truth here and is already correct.

**Justification.** The Deceptive carve-out applies: this touches a document that indexes
specs without redefining any of them.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-071** (2026-08-11). Overtaken in
part by SPEC-028's own third reopening (IN-050) during the same planning session, which
re-set the spec body to **Active** — so the fix is now "index and body agree," not
"index catches up to a settled Completed."

#### IN-045 — `DECISIONS.md` still records the hex grid as Deferred

**Request.** Two entries — the locked-defaults row `Hex grid | Deferred` and the Postponed
bullet `**Hex grid.** Deferred.` — contradict the current plan, where SPEC-030 (Hex Crawl
map type) is **Active**, IN-011 is **Scheduled**, and WI-037 – WI-041 all carry cleared
gates.

**Classification.** **Unclear**. The likely reading is that both entries are simply stale
and were left behind when IN-011 was scheduled. But a locked default is normative, and
"Deferred" surviving a scheduling decision could equally mean the hex work was parked
without the entries being revisited. Only the user can say which.

**Justification.** Classified Unclear rather than Simple because the two readings lead to
opposite actions — delete the entries, or unschedule WI-037 – WI-041. Guessing is exactly
what the Unclear class exists to prevent.

**Disposition.** ~~Open, awaiting the user.~~ **Answered (user, 2026-08-11): stale — clear
them.** Reclassified **Simple** now that the reading is settled. **Scheduled → WI-071.**
Both entries are annotated in place per RULE-019 (`DECISIONS.md`'s locked-defaults row and
Postponed bullet), not deleted.

#### IN-046 — IN-041 never moved to §1.2 after WI-060 landed

**Request.** §1.1 still lists IN-041 (Lobby credits, and the symbol pack's provenance) as
**Scheduled** → WI-060, but WI-060 closed 2026-08-04 and is in `PLAN-COMPLETED.md` §3. The
row should have moved to §1.2 with `Closed via WI-060 / SPEC-033 §6`. It is the only §1.1
row pointing at a landed work item — IN-010, IN-011 and IN-037 are all correctly open.

**Classification.** **Simple**. Moving one row between two tables in one document.

**Justification.** Bookkeeping. Nothing depends on the row's position except the reader.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-071.**

#### IN-047 — `PLAN-COMPLETED.md` §3 carries duplicated WI ids

**Request.** Three ids appear twice in the completed ledger:

- **WI-058** — the same item written two ways, with different effort (`low` vs `medium`).
- **WI-059** — the same item written two ways, with different model (`haiku` vs `sonnet`).
- **WI-068** — two rows describing **different changes**: "Symbol tool ignores snap mode
  (resets to free on tool select)" (spec `SPEC-028 §1`) and "`anchorCellFor` honours snap
  mode instead of hardcoding whole-cell `Math.floor`" (spec `—`).
  `docs/completed/WI-068.md` covers only the second.

**Classification.** **Investigation**. The WI-058/WI-059 pairs are plainly duplicate rows,
but WI-068 needs the history read before anything is deleted: if the two rows were two
real changes, one id was used twice and RULE-019 was breached, which is repaired by giving
the second a fresh id and its own completion file — not by deleting a row. If they were
one change described twice, the stale row goes.

**Justification.** The remedy differs by which case holds, and the wrong one destroys a
record. Investigate first, then schedule the fix.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-072.** The investigation runs at
execution time; its findings license the WI-058/WI-059 duplicate-row cleanup outright, and
either a fresh id for WI-068's second change (if the history shows two real changes) or a
stale-row removal (if it shows one change described twice) — per RULE-019, whichever the
investigation finds.

#### IN-048 — SPEC-029 §2 is cited by no Battle Map work item

**Request.** The four scheduled Battle Map items cite SPEC-029 §3 (WI-033), §1 (WI-034),
§4 (WI-035) and §5 (WI-036). **§2 — "What is captured"** is cited by none of them, and it
is not descriptive prose: it fixes the rect-not-raster decision (DEC-025), specifies that
the battle map renders the source map's background, floor and overlay layers clipped to
the rect but not the source grid, requires the `exportPng` path to stay wired for a future
Blaze upgrade, and records that a solid background _colour_ lives on the renderer clear
colour rather than in `layers.background` and must be composited separately. It is the
only section of an Active spec with no work item attached. (SPEC-034 §5 is also uncited,
correctly — it is the "Out of scope" section.)

**Classification.** **Deceptive**. Attaching §2 changes what WI-034 and WI-035 must
honour, and their gates were cleared against scopes that did not include it — so their
approvals no longer cover what would be built.

**Justification.** The carve-out does not apply: this is not "touches the same file", it
is a change to the agreed scope of already-gated work. Whether §2 folds into WI-034 and
WI-035 or becomes its own item is a gate question, not an execution detail.

**Disposition.** ~~Open, not scheduled. Must be resolved before WI-034 starts.~~ **The
precondition was overtaken by events**: WI-034, WI-035 and WI-036 have all landed and
SPEC-029 is (was, until the 2026-08-11 reopening) Completed — so "before WI-034 starts" no
longer applies to anything. **Scheduled → WI-072** as a verification pass: confirm each §2
clause actually shipped (clipped background/floor/overlay render, no source grid,
`exportPng` stays wired, colour composited separately), then close IN-048 if clean, or log
any gap found as a fresh intake item.

---

### Map-tools / backgrounds playtest batch (2026-08-11)

Raised after the Battle Map series landed (SPEC-029 Completed). Eleven change requests
plus a directive to sweep the entire unscheduled backlog. All classifications and every
decision below were reviewed and answered by the user in the same planning session;
see `PLAN.md` WI-071 – WI-082 and `docs/decisions/DEC-060.md` – `DEC-067.md`.

#### IN-049 — Lasso tool for vertices and objects; Backspace deletes; vertex removal preserves the loop

**Request.** "Lasso tool for vertices and object selection - backspace removes from the
map, vertices should preserve the loop when possible."

**Classification.** **Deceptive.** A new geometric edit on a committed `FloorRegion` ring
needs an op + inverse for undo — Model A floor stores no construction history to replay
(`README.md` → Data model), so "remove a vertex, keep the loop" is new stored-geometry
logic, not a rendering tweak. Discussed with the user, the item grew into consolidating
Select into one tool and retiring `selectEdge` (DEC-060), which changes the engine's
`ToolPreviewInput.selectMode` contract outright.

**Justification.** Not a carve-out case: this redefines what a `MapToolId` in the select
group does and what removing a stored vertex means, both squarely inside RULE-001's
sibling concerns for the vector map (the tool contract) and RULE-007's schema-meaning
trigger.

**Disposition.** Scheduled → SPEC-037, WI-078. Backspace already deletes a selected object
today (`VectorMapView.onKeyDown` → `deleteSelectedObject`) — this extends that binding to
a multi-selection rather than inventing a new one.

#### IN-050 — Free snap also snaps to an existing vertex

**Request.** "Free snap selection, also snaps to an existing vertex, makes it easier to
connect existing free snap work."

**Classification.** **Deceptive.** `snapPoint(p, mode)` (`map/vector/snap.ts`) documents
Free as pure identity; SPEC-028 states Free's behaviour as such throughout. Making Free
consult map geometry redefines the per-point snap abstraction every floor tool routes
through.

**Justification.** Touches the shared snap function every tool calls, but the trigger is
redefinition of Free's stated meaning (SPEC-028), not mere proximity to a shared file.

**Disposition.** Scheduled → SPEC-028 §12, WI-079 (DEC-061). Applies to Wall/Door/Polygon
and the new lasso's vertex handles; explicitly not the cell-anchored tools, per SPEC-028
§2's standing constraint.

#### IN-051 — Remove the starter map as a new map's default background

**Request.** "Remove the default background map as a settings default."

**Classification.** **Simple.** `DEFAULT_BACKGROUND` / `createDefaultGameMap`
(`packages/shared/src/types.ts`) seed a value for a freshly created map. The field, its
type (`{ ref } | { color } | null`), its meaning, and every `CampaignStore` method touching
it are unchanged; no existing map's stored background is touched.

**Justification.** A seed-value change, not a contract change — the Deceptive carve-out
applies cleanly here.

**Disposition.** Scheduled → WI-073. One `session-config.spec.ts` assertion (which
currently expects the starter map as a fresh room's background) moves with it.

#### IN-052 — Serve asset storage from a GitHub Pages subfolder

**Request.** "Sub folder of the github pages site for asset storage, don't want to
download with every github sync."

**Classification.** **Unclear**, resolved by investigation. `apps/web/public/assets` is
404 KB total; the entire `.git` directory is 2.8 MB. There is no sync cost at this size to
engineer against, and the request's substance — large images a referee uploads — is
already what SPEC-034/WI-066 (Blaze Storage upload containment) schedules.

**Justification.** The premise did not hold as stated; escalated rather than guessed at a
storage architecture for a problem that does not exist yet.

**Disposition.** **Withdrawn (user, 2026-08-11): drop it, the Saved-URL path covers it.**
No work item. Kept in the ledger per RULE-019 — id never reused.

#### IN-053 — Multiple background assets: move/resize, ratio locked, translucent-yellow alignment grid

**Request.** "Allow multiple background assets - each can be moved around the map and
resized but always preserve image ratio - when resizing overlay the current grid on the
image in a translucent yellow to allow the user resizing the image to match existing grid
exactly."

**Classification.** **Deceptive.** `GameMap.background` is one optional field with no
transform. Multiple positioned/scaled backgrounds is a `GameMap`/store schema change ⇒
migration + `.vttcamp` round-trip (RULE-007); a new Firestore subcollection ⇒ rules + rule
tests (RULE-004); new `CampaignStore` methods ⇒ contract-suite additions (RULE-001); and a
new render pass in the Pixi engine.

**Justification.** Every RULE-007/004/001 trigger fires at once — this is the largest item
in the batch by a wide margin.

**Disposition.** Scheduled → SPEC-038 §§1–4, WI-080 – WI-081 (DEC-062, DEC-063). Storage is
a `backgrounds` subcollection; `GameMap.background` narrows to `{ color } | null` only,
since a solid colour is the renderer clear colour, not a layer (SPEC-029 §2's existing
note). Schema **v23**.

#### IN-054 — Move background selection / management to Asset activity

**Request.** "Move background selection / management to asset activity."

**Classification.** **Deceptive.** Changes SPEC-016's stated behaviour ("management lives
in the GM UI" — Session settings today) and moves the `session-background-*` testids
`session-config.spec.ts` depends on (RULE-005).

**Justification.** A stated-behaviour and testid-location change, not a proximity touch.

**Disposition.** Scheduled → SPEC-038 §5, WI-081. SPEC-016 is annotated superseded in
place, never deleted (RULE-019).

#### IN-055 — Profile Template defaults → HP: Number, To Hit: Roll d20, Initiative: Roll d6

**Request.** "Setting Defaults - remove all existing Profile Template settings, add HP:
Number, To Hit : Roll d20, Initiative : Roll d6."

**Classification.** **Simple.** `STARTER_PROFILE_TEMPLATE`
(`apps/web/src/lib/profile/starter-template.ts`) is read in exactly one place —
`Lobby.svelte`'s create-room call. No migration reads it, no stored field changes meaning,
and the fields are referee-chosen labels, so RULE-002's no-mechanics guarantee is
untouched by construction.

**Justification.** A seed-constant edit read at exactly one call site.

**Disposition.** Scheduled → WI-073 (Initiative as the dedicated `initiative` field type,
per the user's answer — see IN-056).

#### IN-056 — Encounter Template default → Initiative: Roll d6 only

**Request.** "Encounter Defaults - remove all existing, add Initiative: d6."

**Classification.** **Deceptive.** `DEFAULT_ENCOUNTER_TEMPLATE`
(`packages/shared/src/types.ts`) is **also** the v13→v14 migration's backfill value, whose
stated purpose is "hands an old room the widgets it already had" — editing the constant
would silently change what that migration produces for a room migrating today, years after
v14 shipped.

**Justification.** The same identifier serves two roles — a live default and a frozen
migration input — and the request only means to change the first. Redefines the
migration's output unless decoupled (RULE-007).

**Disposition.** Scheduled → WI-074 (DEC-065: the migration is pinned to a new
`LEGACY_ENCOUNTER_TEMPLATE_V14` frozen literal before `DEFAULT_ENCOUNTER_TEMPLATE`
changes). Initiative is the dedicated `initiative` field type in both the Profile and
Encounter templates (user, 2026-08-11), wiring Call for Initiative in both Individual and
Side-based modes.

#### IN-057 — Snap selector on the Label and Symbol tools

**Request.** "Add snap selection to Label, Symbol and Door tools."

**Classification.** **Simple.** Door already has the control (`SNAP_TOOLS = [...CARVE_TOOLS,
'wall', 'door']`, `MapToolbar.svelte`). Label and Symbol already **honour** the snap mode
(WI-068, IN-014) — only the UI control is missing. Adding them to `SNAP_TOOLS` surfaces a
control for behaviour that already exists; no testid moves, no contract changes.

**Justification.** Door's precedent in the same array, plus WI-068's confirmed
already-honoured behaviour, makes this the smallest possible instance of "add a control."

**Disposition.** Scheduled → SPEC-028 §1 (a one-line clarification that the control now
covers all vertex/cell-anchored tools uniformly), WI-075.

#### IN-058 — Edit/View map-tools button becomes binary; default View on session join

**Request.** "Make Edit/View map tools button binary - a single button that alternates
between the two states - default for session join should be view."

**Classification.** **Deceptive (reversal).** The button merge alone is mechanical, but the
default flip **reverses WI-053**, whose completion record states `MapToolController
.mapMode`"Defaults to `'edit'`, unchanged from every prior session's behaviour." A reversal
must find the original entry and supersede it (`CLAUDE.md` Shape-A rule), not silently
overwrite it.

**Justification.** The default is the substantive half of the request and it is a stated
reversal of a shipped decision, which the trigger list treats as Deceptive regardless of
how small the code diff is.

**Disposition.** Scheduled → WI-076. DEC-064 names and supersedes WI-053's default. Still
per-viewer client state, still not a resolution of DEC-001.

#### IN-059 — Move BattleMap capture tool to the battle-map quick sheet

**Request.** "Move BattleMap capture tool from map tool quick sheet to battle map quick
sheet."

**Classification.** **Deceptive.** Changes SPEC-029 §1's stated behaviour on a spec marked
**Completed**, and moves `vector-tool-capture` — four Playwright assertions across
`battle-map-capture.spec.ts` and `battle-map-lifecycle.spec.ts` (RULE-005).

**Justification.** A Completed spec's stated authoring path changes, plus a testid
relocation — both explicit triggers.

**Disposition.** Scheduled → SPEC-029 §1 (amended in place, spec reopens then closes again
on landing), WI-077 (DEC-066). The battle-map quick sheet's button arms the same canvas
gesture; `capture` leaves `TOOL_GROUPS` entirely, with `tool-groups.test.ts`'s
every-`MapToolId`-in-a-group invariant carrying a named exemption for it.

### Backgrounds / creature naming / local-runtime batch (2026-08-17)

Seven items from one request. Three are the background transform model (IN-060 – IN-063),
one is creature identity (IN-064), and two are the local-runtime pair (IN-065, IN-066) —
which is the largest architectural request the project has taken since the vector-map
cutover, and the first that a **RULE** stands in the way of.

**Nothing in this batch is Simple.** Every item either changes a stored schema, reverses a
shipped spec clause, or asks for a second backend. That is unusual and worth stating
plainly rather than hunting for something to schedule quickly: the four blocking questions
(DEC-068, DEC-072, DEC-073, DEC-075) were put to the user in the planning session and all
four were answered, which is what let the work items below be written at all.

#### IN-060 — Background move/resize: uncover the runtime errors

**Request.** "Investigate background movement resizing - uncover run time errors."

**Classification.** **Investigation.** Produces findings, not edits (DEC-027). Its host
work item is **WI-083**; each finding it confirms becomes its own intake item rather than
being fixed inside the investigation.

**Justification.** The request names no behaviour to change — it asks what is broken. An
investigation that quietly fixes what it finds is an out-of-chain change (RULE-015).

**Leads to start from** (read during triage, unverified — the investigation confirms or
discards each):

1. **`applyBackgrounds` fails as a batch.** `VectorMapView.applyBackgrounds` awaits
   `Promise.all(bgs.map((bg) => PIXI.Assets.load(...)))`. One unloadable ref — a dead
   saved URL, a host that refuses the cross-origin read, a 404 — rejects the whole
   settlement, so the pass throws before it syncs **any** sprite. It is called as
   `void applyBackgrounds(...)` from an `$effect`, so the throw surfaces as an unhandled
   rejection and every other background silently stops updating: removed images keep their
   sprites, new ones never appear, and a committed transform never re-renders. The
   single-sprite predecessor could only ever fail for the one image it was drawing.
2. **A selected background swallows the whole canvas.** `handleBackgroundPointerDown` runs
   before every tool in `wireStagePointerEvents`, and `backgroundHitTest` returns `'body'`
   for any point inside the rect. A background that has been **Fit** to the grid — the
   default placement, and what the v22→v23 fold gives every upgraded room — therefore
   covers the entire map, so with it selected *no* map tool can be used anywhere. This is
   the defect IN-061 – IN-063 are the fix for; the investigation should confirm the
   mechanism rather than assume it.
3. **`nativeAspect` reads a texture that may not be the image.** It falls back to
   `rect.w / rect.h` when the texture reports no size, and a `Texture.EMPTY` placeholder
   reports 1×1 — an aspect of exactly 1, which would snap a resize to a square.
4. **The alignment overlay on a hex map.** `renderBackgroundAlignment` is called from
   `renderAll` unconditionally, and draws in square-lattice units. A hex map's backgrounds
   are stored in the same lattice fields but the map has no square lattice (RULE-006).
   Whether that is reachable — whether a hex map can hold a background at all — is worth
   settling one way or the other.
5. **Any console error reproduced by an actual drag.** The three leads above came from
   reading; the investigation must also *run* the gesture (dev server plus the existing
   `backgrounds.spec.ts` battery) and record what the console says, which is what the
   request literally asks for.

**Disposition.** Scheduled → WI-083, ahead of WI-084 – WI-086, whose scope its findings may
change.

### Findings from the IN-060 background move/resize investigation (WI-083)

Reported, not fixed (DEC-027). Ran the actual move/resize gesture (dev server + emulator,
plus a scratch two-client Playwright repro deleted after use) with console/page-error
capture, and read every code path the five leads named.

#### IN-067 — A second GM removing a background crashes the first GM's in-progress drag

**Finding.** Live-reproduced (lead 5). `VectorMapView.handleBackgroundPointerUp` awaits
`store.setBackgroundTransform(...)` with nothing to catch a rejection. `FirebaseStore`'s
implementation is a bare `updateDoc`, which the real backend (and the emulator) rejects
with `NOT_FOUND: no entity to update` if the document is gone. Two GMs, or one GM with two
tabs: GM1 selects a background and starts dragging it; GM2 clicks **Remove** on that same
background before GM1 releases the pointer; GM1's release throws an uncaught
`FirebaseError`, visible in the console exactly as a runtime error. `MemoryStore`'s
`patchBackground` silently no-ops on a missing doc instead of throwing — a store-parity gap
(RULE-001 requires both stores to honour the same contract) that also means the
`campaign-store.contract.ts` suite, which runs identically against both, could never have
caught this divergence.

**Classification.** Deceptive candidate — touches the `CampaignStore` write path's
guarantee (RULE-001) if the fix is "align the two stores' behaviour on a missing doc" (as
opposed to guarding only the caller). Triage should decide which.

**Disposition.** Awaiting triage.

#### IN-068 — `applyBackgrounds` reloads every background's texture on any one change, and stops the whole layer if one image is unloadable

**Finding.** Confirmed by code reading (lead 1); not force-reproduced live in this
session — the Assets activity's "By URL" add flow already validates the image loads
(`<img>` `onload`/`onerror`) before it lets the referee save the ref, so a persistently-dead
ref can't be placed through today's UI. The hazard is real regardless:
`applyBackgrounds` (`VectorMapView.svelte:884`) `await Promise.all`s a `PIXI.Assets.load`
per background, every time the `orderedBackgrounds` effect fires — which is every add,
remove, and committed move/resize, for every background, not just the one that changed. It
has no try/catch and is invoked as `void applyBackgrounds(...)`, so if a saved ref that
validated fine at add time later goes dead (the referee's host taken down, a revoked
link), the `Promise.all` rejects before any sprite in that pass is touched: every other
background on the map silently stops updating — new ones never appear, removed ones keep
their sprites, a committed drag never re-renders — until some later change happens to
succeed. Separately, `subscribeBackgrounds`'s listener (`VectorMapView.svelte:607`) sets
`backgrounds = b` unconditionally, unlike the floor/fog/wall/door listeners beside it which
guard their `renderAll()` behind `if (!activeDrag)`; a background change from *any* client
re-runs `applyBackgrounds` for the whole set even while a `bgDrag` gesture is active
locally, and since each surviving sprite's position/size is reset from the *stored* rect,
that can snap an actively-dragged sprite back to its last-committed placement mid-gesture.

**Classification.** Deceptive candidate — touches the background render pipeline's
guarantee (SPEC-038 §§2–3: a committed transform always renders). Triage should decide.

**Disposition.** Awaiting triage.

#### IN-069 — Backgrounds are placeable on hex-grid maps, in a coordinate space RULE-006 never defined for them

**Finding.** Confirmed by code reading (lead 4, extended). Nothing in `BackgroundsPanel`
or in `VectorMapView`'s background gesture (`handleBackgroundPointerDown/Move/Up`,
`renderBackgroundAlignment`) checks `hexGrid`. Every `GameMap` — hex or square — still
carries a `grid: { w, h, cellSize }` field (`packages/shared/src/types.ts:175`, commented
"Square grid only — v1"), and `VectorMapView` derives `cellSize` from it unconditionally,
so a referee can add, select, move and resize a background on a hex crawl exactly as on a
square map. The stored `x, y, w, h` rect is nominally lattice cell units (RULE-006), a
space a hex map does not have — RULE-006 states outright that "a square-lattice
consumer... is undefined on a hex map and must not be reached from one." Nothing throws;
it silently "works" against a coordinate space the hex spec (SPEC-030) never defined,
which is a spec gap rather than a console error.

**Classification.** Deceptive candidate — touches RULE-006's coordinate-space guarantee.
Triage should decide whether backgrounds need a hex-native placement story or should be
hidden/disabled on hex maps until they get one.

**Disposition.** Awaiting triage.

**Discarded.** Lead 3 (`nativeAspect` falling back to a `Texture.EMPTY` 1×1 read) does not
hold up: unlike door sprites, a background sprite is only ever created *after*
`applyBackgrounds` has awaited its real texture — there is no placeholder-texture phase for
`nativeAspect` to observe. When `bgSprites` has no entry yet, it falls back to
`rect.w / rect.h`, which for a freshly placed image is already the correct native-fit
aspect `fitBackgroundToGrid` computed at add time, not a spurious 1. Lead 2 (a Fit-to-grid
background swallowing the whole canvas for every map tool) is confirmed but not
re-investigated in depth here — it is already IN-060's own note that this is the exact
defect IN-061–063/WI-084–086 are fixing, so no new intake item is needed for it.

**Baseline.** A plain, single-user move-then-resize gesture — the same shape as the
passing `backgrounds.spec.ts` acceptance test — produces zero console or page errors. The
one console line captured during the investigation's baseline run was an unrelated 404
resource-load message present on every page in this environment, not specific to
backgrounds. The reported runtime errors need either a concurrent multi-client edit
(IN-067) or one of the other two conditions above; they are not visible from ordinary
single-referee use.

#### IN-061 — Backgrounds are marked locked or unlocked, from the Assets page

**Request.** "Mark backgrounds as locked or unlocked on the asset page."

**Classification.** **Deceptive.** Adds a stored field to `MapBackground`, so it needs a
schema bump, a migration and a `.vttcamp` round-trip test (RULE-007), and a new
`CampaignStore` method on the shared contract suite against both `MemoryStore` and
`FirebaseStore` (RULE-001). Two explicit triggers.

**Justification.** Not "touches the store" — *changes* the store contract and the stored
shape. The carve-out does not reach it.

**Disposition.** Scheduled → SPEC-039 §1, WI-084. DEC-068 answers where the flag lives and
DEC-069 what existing backgrounds migrate to (**locked** — user, 2026-08-17).

#### IN-062 — The Select tool picks up, moves and resizes an unlocked background

**Request.** "Normal object selection tool can select, move and resize unlocked
backgrounds."

**Classification.** **Deceptive.** Changes the stated behaviour of two Completed/Active
specs at once: SPEC-037's selection model gains an object kind, and SPEC-038 §3's gesture
stops being armed by the Assets panel. It also retires the `background-adjust-{id}` control
and the `MapToolController.selectedBackgroundId` bridge that `backgrounds.spec.ts` drives
(RULE-005).

**Justification.** "What Select can grab" is the contract SPEC-037 states; adding a kind to
it is redefinition, not proximity.

**Disposition.** Scheduled → SPEC-039 §2, WI-085. DEC-070 records what survives of the
Assets-panel control (an agent default: the panel keeps add / lock / Fit / remove and loses
"Adjust on map").

#### IN-063 — Corners preserve the aspect ratio; edges change it

**Request.** "Dragging from diagonals preserve aspect ratio, dragging from edges changes
aspect ratio - change from previous behavior."

**Classification.** **Deceptive (reversal).** SPEC-038 §3 states the opposite in as many
words — "a resize **always** preserves the image's native aspect ratio … There is exactly
one resize handle interaction, not independent width/height handles." The user's own
wording ("change from previous behavior") acknowledges it. A reversal must name and
supersede the original clause, never overwrite it silently.

**Justification.** A shipped spec clause is being inverted. That is Deceptive regardless of
how small the diff to `background-transform.ts` turns out to be.

**Disposition.** Scheduled → SPEC-039 §3, which names and supersedes SPEC-038 §3 in place;
WI-086. DEC-071 records the reversal.

#### IN-064 — Creatures get real names, and their symbols read A–Z

**Request.** "Change names of creatures, instead of generated string - add a number when
adding multiple automatically, token symbol reads A-Z. For example: user presses plus sign
and selects generated tokens, enters the name Goblin, enters quantity 3, three goblin
tokens are created within that group, tokens are named goblin 1 goblin 2 goblin 3, tokens
are labeled with the symbols A B and C respectively."

**Classification.** **Deceptive.** A creature has **no stored name today** — `Token` has no
`name` field, and `creatureLabel()` derives a display string from `imageRef` by stripping
the path and extension, which is exactly the "generated string" being complained about
(`gen:disc:a1:%23aabbcc`). Giving a creature a name is a new stored field: schema bump,
migration, `.vttcamp` round-trip (RULE-007). It also changes the meaning of the symbol —
`defaultCreatureRefs` currently bakes a lowercase *type* letter plus a within-batch index
(`a1`, `a2`, `a3`) into the ref, and A/B/C is a different scheme with different uniqueness
(DEC-072).

**Justification.** New stored field plus a changed meaning for an existing derived value.
Two triggers.

**Disposition.** Scheduled → SPEC-040, WI-087. DEC-072 scopes the letters **per group,
restarting at A** (user, 2026-08-17).

#### IN-065 — Local-only mode: the `.vttcamp` is the live document

**Request.** "Local storage - make use of the .vttcamp and allow local usage completely
circumventing firebase as a dependency, may lock features or drop us to single user mode if
necessary. Allow selecting (or creating a new) .vttcamp within the lobby screen."

**Classification.** **Complex (Shape A).** A second backend, a second identity model, and a
second lobby flow. It is also the first request in the project's history that a **RULE**
forbids as written: RULE-009 states the backend as fact — "Firebase serverless on the
**Spark** tier … Anonymous Auth (+ optional Google link) = identity". A build with no
Firebase at all contradicts it, so RULE-009 must be amended in a standalone
`RULE-AMENDMENT:` change before any of the implementation lands (RULE-017).

What makes it tractable rather than speculative: **RULE-001 was built for exactly this.**
`MemoryStore` is a complete, contract-tested `CampaignStore` implementation that already
passes the same suite `FirebaseStore` does, and `packages/shared/src/portability/vttcamp.ts`
is a pure, Firebase-free archive core. The local store is those two joined by a file
handle — not a rewrite. The Postponed "PocketBase second backend" entry in `DECISIONS.md`
records the same bet; this is the first time it is being cashed.

**Justification.** Architectural, and rule-blocked. No other classification applies.

**Disposition.** Scheduled → SPEC-041, WI-088 (the standalone RULE-009 amendment) then
WI-089 (the implementation). DEC-073 chose the `LocalStore`-over-a-`.vttcamp` shape (user,
2026-08-17) and DEC-074 records what a local build gives up.

#### IN-066 — Packaging and distributing a local build

**Request.** "Local run time packaging - how to package and distribute for someone looking
to run locally - no tie ins to our existing firebase project, this would rely on the local
.vttcamp execution above."

**Classification.** **Investigation.** The request is a question — *how* — and its answer
depends on what IN-065 actually builds. It produces a written distribution spec plus
findings; anything it turns up that needs code becomes its own intake item (DEC-027).

**Justification.** Scheduling an implementation for a shape not yet chosen would be
guessing. The shape was chosen at the gate (DEC-075: a static bundle plus a launcher
script, no new runtime dependency), but the packaging details — what a build with no
Firebase config must strip, how the launcher behaves per platform, what the release
artefact is — are findings, not a diff written in advance.

**Disposition.** Scheduled → SPEC-042, WI-090. **Blocked on WI-089**: there is nothing to
package until the local runtime exists.

### Findings from the IN-066 packaging investigation (WI-090)

Reported, not fixed (DEC-027). Built both bundles for real (`pnpm build:local`,
`pnpm build`), grepped and measured them, built and ran a real standalone launcher, zipped
and re-served the bundle to simulate a downloaded release, and drove it in headless
Chromium (console/page-error/network capture) through campaign creation, session render,
and a manual save/download round-trip. Answers SPEC-042 §4's five questions in order.

**§4.1 — The launcher, concretely.** Three candidates were tried against the constraint
"no new runtime dependency the user must install first":

- `npx serve` / `npx http-server` — works instantly, but only if Node and npm are already
  on the machine. For the audience this exists to serve (someone who downloaded a zip, not
  a developer), that is itself the dependency the constraint rules out.
- A documented one-liner (`python3 -m http.server 8000`) — zero shipped artefacts, but the
  spec's own prediction ("most friction") held up: Python 3 is not on stock Windows, the
  command differs (`python` vs `python3`) across platforms that do have it, and "know the
  right incantation for your OS" is exactly the barrier a launcher exists to remove.
- A Node 22 **Single Executable Application** (`node --experimental-sea-config` +
  `postject`) — built one for real in this session: a self-contained binary embedding the
  Node runtime plus a ~40-line static file server, requiring **zero** installed
  dependencies to run. It served `dist-local` correctly (verified — see §4.4) and needs
  nothing beyond "double-click" or "run this file" on the target machine.

  The real cost: **119 MB raw, 44 MB zipped**, measured on this Linux build — against the
  1.4 MB zipped app it serves, a ~30× multiplier from bundling a full Node runtime. Three
  platforms (GitHub Actions already runs `ubuntu-latest`/`macos-latest`/`windows-latest`
  matrices for other repos, so building each is not new infrastructure) would put a
  release in the ~50–150 MB range depending on how the zips are split.

  **Recommendation:** the SEA binary, one per platform, built on a GitHub Actions runner
  matrix — it is the only candidate that actually satisfies "no new runtime dependency,"
  and the size, while real, is still a single flat download with no signing story, unlike
  Electron/Tauri (which SPEC-042 §1 already rejected for exactly that maintenance cost).
  The size tradeoff should be a conscious decision, not a surprise at release time — that
  is IN-070's job, not this investigation's.

  Only exercised on Linux in this sandbox. macOS Gatekeeper (unsigned binary quarantine)
  and Windows SmartScreen (unsigned-executable warning) both plausibly add a click-through
  step on first run; neither was verified here and both are real risk to carry into
  IN-070.

**§4.2 — Does the strip actually strip?** Yes, re-confirmed with fresh numbers, not just
cited from WI-089. `apps/web/dist-local`: 133 files, 4.4 MB unpacked, 1.4 MB zipped.
`grep -rlE "firebase|firestore|osr-vtt|appspot|identitytoolkit|firebaseio" dist-local` →
**0 files, 0 matches**. No `*.map` files in either build (sourcemaps are off by default
project-wide — not a local-specific win, but confirms nothing leaks through one). A raw
`AIza[0-9A-Za-z_-]{35}` API-key-shaped grep also came back empty. For contrast, the same
grep against `apps/web/dist` (hosted, same commit) hits one chunk with **179** total
occurrences (`firestore` 87, `firebase` 76, `firebaseio` 7, `osr-vtt` 4,
`identitytoolkit` 4, `appspot` 1). Main-chunk size: local 3,618.62 kB vs hosted
4,382.65 kB — matches WI-089's 3.62 MB / 4.38 MB exactly.

**§4.3 — How the release is produced.** Nothing today builds or ships one.
`.github/workflows/deploy.yml` triggers only on push to `main` and only ever builds the
hosted bundle (`pnpm --filter @osr-vtt/web build --mode production`) for Firebase Hosting
and GitHub Pages; `.github/workflows/ci.yml` triggers only on PRs to `main`, and its
`build` job runs `pnpm build` (hosted), never `pnpm build:local`, and greps nothing.
Recommendation: a **new** workflow, triggered on a version-tag push (`v*`), building the
launcher matrix plus `pnpm build:local`, zipping, and attaching to a GitHub Release
(DEC-075) — independent of both existing workflows, so the hosted pipeline is untouched by
construction rather than by discipline. Separately, `ci.yml` should gain a cheap PR-time
job — `pnpm build:local` plus the §4.2 grep — so a strip regression fails a pull request
instead of being discovered at release time; SPEC-042 §3 calls this out by name as "the
one thing here that must be mechanically checked in CI."

**§4.4 — What breaks when it is actually run**, from a zip, by someone who did not build
it, on a machine with no toolchain. Simulated for real: unzipped `dist-local` into a fresh
directory, served it with the SEA binary from §4.1 (a binary carrying nothing of this
build environment beyond the app files it was pointed at), and drove it with headless
Chromium with console, page-error, failed-request and out-of-origin-request capture.

- Initial load: **0** console messages, **0** page errors, **0** failed requests, **0**
  requests to anything but `localhost` — confirms SPEC-041 §4's "bundled assets need no
  network" is actually true of the shipped artefact, not just the source.
- Full flow on the **non-Chromium fallback path** (simulated by deleting
  `window.showSaveFilePicker`/`showOpenFilePicker` before load, standing in for
  Firefox/Safari): fill campaign name → **New campaign…** → session renders → the
  campaign-file pill correctly reads "Unsaved — press Save" → **Save** → a real
  888-byte `.vttcamp` downloads. Zero page errors anywhere in the sequence.
- The **Chromium-autosave path** (`showSaveFilePicker`) could not be driven headlessly at
  all: it opens a native OS file dialog outside the page's DOM, which no Playwright input
  action can see or resolve, so the flow simply stalls waiting on a human. Not a defect —
  the feature needs a real user gesture by design — but worth naming: this path has no way
  to get a headless regression test the way the fallback path just did, and nothing in the
  current Playwright suite appears to exercise it.
- Nothing else broke: no missing asset, no MIME-type surprise from the launcher's
  naive extension→content-type map, no CORS issue.

**§4.5 — Versioning.** Two sub-questions, both answered.

*How a user knows which build they have:* **they don't, today.** `apps/web/package.json`
and the workspace root `package.json` both carry `"version": "0.0.0"`, unbumped, and
nothing in the built output or the UI surfaces a version string, a commit hash or a build
date. There is no `data-testid`, no footer, nothing a referee could point to in a bug
report or a support conversation.

*What happens opening a `.vttcamp` written by a newer build* — SPEC-042 §4.5's "the
reverse direction needs an answer too," relative to the already-guarded older-archive
case. **Confirmed live, not just by reading.** `archiveToSnapshot`
(`packages/shared/src/portability/vttcamp.ts:296`) runs the imported room through
`migrateRoom(rawRoom)`, defaulting the target to the *running build's*
`CURRENT_SCHEMA_VERSION`. `migrateRoom`'s walk
(`packages/shared/src/migrations/index.ts:713`, `while (version < targetVersion)`) simply
never enters its loop body when the archive's `schemaVersion` is *above* the target — the
room doc returns unchanged, future `schemaVersion` and all. Reproduced with a real
artefact: saved a campaign (`schemaVersion: 28`, this build's `CURRENT_SCHEMA_VERSION`),
hand-edited the exported `campaign.json`'s `room.schemaVersion` to `999`, re-zipped it, and
opened it through the live "Open campaign…" file-input flow — it opened cleanly: no error
banner, no console error, full session render, room name and all. Contrast with the
**older**-archive direction, which genuinely is guarded:
`assertSupportedFormatVersion` (`vttcamp.ts:422`) rejects any `formatVersion` below
`VTTCAMP_FORMAT_VERSION` with an explicit "unsupported .vttcamp archive" error. The
asymmetry is real and RULE-014-relevant: an older build gives no signal that a campaign
was written by a newer one, that fields it doesn't understand may be present, or that
re-saving from the older build could silently drop or corrupt them.

#### IN-070 — Ship the packaged local release

**Finding.** Per §4.1–§4.3: build the SEA launcher binaries on a GitHub Actions
ubuntu/macos/windows matrix, write the distribution `README` SPEC-042 §2 specifies (what
local mode is/isn't, the browser-support split, URL-vs-bundled assets, where the campaign
file lives), and add a new workflow on a version-tag push that runs `pnpm build:local`,
bundles it with the matching-platform launcher, zips, and attaches to a GitHub Release
(DEC-075) — independent of `deploy.yml` and `ci.yml`.

**Classification.** Simple (proposed) — new build/release tooling; touches no store
interface, schema, security rule, coordinate semantics, auth path, write routing, testid
or documented spec behaviour.

**Disposition.** Awaiting triage.

#### IN-071 — CI mechanical check for the Firebase strip

**Finding.** Per §4.2–§4.3: SPEC-042 §3 calls the strip check "the one thing here that
must be mechanically checked in CI." Add a PR-time job — `pnpm build:local` plus the grep
this investigation ran — so a regression (an import that drags Firebase back into the
local bundle) fails CI instead of surfacing only at release time.

**Classification.** Simple (proposed) — a new CI job asserting an already-documented
guarantee; no contract changes.

**Disposition.** Awaiting triage.

#### IN-072 — No guard against opening a `.vttcamp` newer than the running build

**Finding.** Live-reproduced (§4.5). `migrateRoom`'s forward walk silently no-ops when an
archive's `schemaVersion` exceeds the running build's `CURRENT_SCHEMA_VERSION`, unlike
`assertSupportedFormatVersion`'s explicit rejection of an archive older than
`VTTCAMP_FORMAT_VERSION`. A fix needs a symmetric guard — reject or clearly warn before
opening, rather than rendering a campaign with fields the build cannot interpret.

**Classification.** Deceptive candidate — touches the portability/migration contract
RULE-014 states ("`.vttcamp` export/import must round-trip identically"). Triage should
decide whether the fix is a hard rejection (matching the older-archive case) or a
warn-and-proceed path.

**Disposition.** Awaiting triage.

#### IN-073 — No build/version identifier; `package.json` stuck at `0.0.0`

**Finding.** Per §4.5: nothing in the build or the UI tells a user which build they are
running, and both `package.json`s carry the placeholder version `"0.0.0"`, never bumped.
Needed for a referee to report a bug against a specific build, and for any future guard on
IN-072 to have something concrete to name in its error message.

**Classification.** Simple (proposed) — a version stamp and a UI surface for it; no
contract changes.

**Disposition.** Awaiting triage.

### Icon system revamp (2026-08-28)

Arrived as a design request rather than a playtest finding: replace the in-game icon set
with a deliberately-designed one, usable on both mobile and desktop, mono- or bi-colour,
"high user discoverable". Three overall style directions were drawn as a design canvas
before anything was classified, and the user picked one. The canvas is
`https://claude.ai/code/artifact/b26abf12-6395-40ce-9234-948cac7c5e61` (Direction A ·
Implement, approved 2026-08-28); the decision is recorded as DEC-076.

#### IN-074 — Redraw the icon set under a stated depiction rule

**Request.** All 34 `IconId` glyphs in `apps/web/src/lib/components/shell/Icon.svelte`
redrawn under **Direction A · Implement**: draw the object a person holds or points at.
24 × 24 grid, stroke 1.75, round cap and join, no fills, `currentColor` only — the same
technique SPEC-001 §4 already puts in force, applied to a *subject* rule the set has never
had. Three glyphs were specifically called out as unreadable at palette size and are the
reason the request exists:

- `dice` read as a crate — the d20's facet sat at the top of the hexagon, which is where a
  cube's top face goes. It becomes a true d20: hexagon, centred up-facet, three spokes.
- `tools` read as an unidentifiable wedge — a chisel drawn on the diagonal. It becomes a
  latched toolbox with a carry handle.
- `ruler` read as a rhombus — the silhouette of a ruler with every cue that said *ruler*
  removed. It becomes a straightedge lying flat, with graduations.

The request also asks for a stated rule for the **map-tool family** specifically, which is
the half of the set with no labels and the most tools competing in one strip.

**Classification.** **Simple.** It redefines nothing on the trigger list: no
`CampaignStore`/`AssetStore` method or guarantee, no `GameMap`/`Room`/`PlayerSeat` field,
no `firestore.rules`/`database.rules.json`, no coordinate space, layer order or carve
pipeline stage, no auth or join path, no change to which store a write goes to, and no
`data-testid` moved, renamed or removed — `Icon.svelte` renders an `aria-hidden` `<svg>`
and carries no testid, and every button that wraps one lives in another component that is
not touched. The `IconId` union itself is unchanged: 34 ids in, 34 ids out, no additions
and no removals, so no consumer's type changes. What changes is the path data inside one
fixed `MARKUP` record.

It is also **conformant to** rather than a change of the one spec that governs icons:
SPEC-001 §4 (still in force) states "icons are simplistic single-colour stroke SVGs drawn
as `currentColor`", which is precisely Direction A. **This is load-bearing to the
classification** — the two rejected directions would not have been Simple. Direction B
(duotone) adds a second tone and Direction C (solid woodcut) replaces stroke with fill;
either would have contradicted SPEC-001 §4 in as many words and needed that spec amended
before it could be scheduled.

**Disposition.** WI-091. New behaviour — the depiction rule — is specified in SPEC-043;
the direction choice is DEC-076.

#### IN-075 — No focus or disabled state on any shell icon control

**Finding.** Raised at WI-091's approval gate, from a question about the design canvas
rather than from play. The canvas showed five button states; the codebase has three.

- **There is no `:focus-visible` rule on any shell icon control.** Not on `QuickSheetRail`'s
  toggles, not on `MainViewTabs`, not on `MapToolbar`. `--focus` is consumed in exactly two
  places — `EncounterBoard.svelte`'s `outline: 3px solid var(--focus)` and the
  `--group-world` alias in `tokens.css` — so every icon-only control in the shell falls
  back to whatever outline the UA draws over a `border: 1px solid transparent` button, which
  on a dark panel is close to invisible. A keyboard user cannot see where focus is.
- **A disabled treatment was also reported missing. That half was wrong** — see the
  correction below.

> **Corrected at triage, 2026-08-28.** The disabled half of this finding did not survive
> being checked, and the original wording above is left in place rather than rewritten
> (RULE-019 — entries are annotated, not silently repaired). `MapToolbar.svelte` **does**
> disable icon controls and **does** style them: tool buttons carry `disabled={locked}`
> under the Edit/View soft lock, and `button:disabled { opacity: 0.4; cursor: default }`
> covers them. `QuickSheetRail.svelte` and `MainViewTabs.svelte` contain no `disabled` at
> all — a view or sheet that should not be reachable is not rendered (the
> `availability: 'gm'` gate), so there is no unstyled state to find. **There is no disabled
> work to do**, and SPEC-044 §3 records that finding so it is not rediscovered.
>
> The focus half stands, and is stronger than first written: `--focus` is used in exactly
> two places, neither of them a focus ring — `EncounterBoard.svelte`'s `.card.selected`
> **selection** outline, and the `--group-world` alias. The token named `--focus` is not
> used for focus anywhere in the application.

**Classification.** **Simple.** One `:focus-visible` rule per component, in the components
that already own the button anatomy. Redefines nothing on the trigger list: no store method
or guarantee, no schema field, no security rules, no coordinate space or layer order, no
auth or join path, and no `data-testid` moved, renamed or removed — this adds CSS and no
markup. It is one item, not two.

**Explicitly not part of WI-091.** SPEC-043 §5 states that chrome is untouched, and the
focus ring is chrome. Folding it into the icon redraw would be the "while I was in there"
edit RULE-015 exists to prevent, and would put an accessibility fix behind a cosmetic one.
SPEC-043 §5 is annotated to point at SPEC-044 so the two are not read as contradicting.

**Disposition.** WI-092, specified as SPEC-044. Gate cleared by the user 2026-08-28.

#### IN-076 — `room-uploads.emulator.test.ts` still times out on CI at a 30s budget (third occurrence)

**Finding.** Raised at WI-092's PR (#131) — a CSS-only change (`:focus-visible` on shell
icon controls) that touches no Storage, Firestore, or upload code. `test-emulators` failed
twice in a row on the same test: `deleteRoom sweeps uploaded objects (SPEC-034 §4) >
removes the room's objects, and leaves another room's alone`, timing out at the 30000ms
budget after `RESOURCE_EXHAUSTED: Received message larger than max` on the Firestore
`Listen` stream. `pnpm verify:all` passed clean locally against the same commit, including
this test.

This is the same test WI-085's PR #123 and WI-086's PR #124 hit — the budget has already
gone 5s → 15s → 30s and is timing out again. Whatever the emulator is doing on a cold CI
runner (Storage jar warm-up, or the specific `RESOURCE_EXHAUSTED` gRPC message this time)
is not something a fourth timeout bump is likely to fix for good; worth an actual look at
what's driving the message size or the backend load in that test rather than another blind
bump.

**Classification.** Not yet triaged.

**Disposition.** Awaiting triage.

### Selectable 3D die models (2026-09-02)

Arrived as a design request: let the roller pick which 3D die model the tumble renders,
rather than the one procedural set every roll uses today. The user has a model in hand,
downloadable as **FBX, USDZ, glTF or GLB**.

Of those four only **glTF/GLB** is a web format worth carrying: `GLTFLoader` ships with
`three` (already a dependency), it is the format Three's own pipeline is built around, and
it embeds materials and textures in one file. `FBXLoader` exists but is heavier and lossy;
USDZ is Apple's AR container and has no place in a browser canvas here. So the request
reads, concretely, as **"import a GLB and render dice from it."**

#### IN-077 — Selectable 3D die models

**Request.** A user-selectable die model — the procedural set stays available, and an
imported mesh becomes a second choice alongside it.

**What it collides with.** The dice renderer is not a mesh viewer with a swappable mesh.
`geometry.ts` is a generator whose output is consumed in four ways that an imported model
does not supply, and the collision is with `RULE-013` at the centre:

1. **`locators` + the face→value remap (RULE-013).** The seed decides the value; the
   renderer makes the die *land* on it, by remapping each face's material so the face that
   physics puts on top carries the required number. A GLB has its numerals **baked into its
   own texture atlas** — face 7 is permanently a "7" — so there is nothing to remap. Unless
   the model's face↔value correspondence is recovered, the die lands showing a number that
   disagrees with the Roll doc, which is a RULE-013 violation, not a cosmetic regression.
   It is recoverable (see the two paths below), but not for free and not automatically.
2. **`hullPoints`.** Rapier builds a convex hull from the generated vertex cloud. An
   imported mesh can supply one, but a bevelled/rounded production die is thousands of
   triangles, so the hull wants decimating rather than using raw.
3. **Per-face material groups.** Every downstream effect addresses a die *by face index*:
   the d100 tens half darkened, the d4's three composed corner glyphs, the `DIM_OPACITY` /
   `DIM_DESATURATE` treatment on advantage-dropped dice. A GLB arrives as one mesh with one
   material and no face grouping — it is triangle soup, and coplanar-face recovery is a
   real algorithm, not a loader flag.
4. **Die colour has exactly one source: the roller's character colour**, and it is baked
   into the face **texture** precisely because a `material.color` tint over a coloured
   texture renders `pick × texture` rather than the picked hex — the long-standing "the
   dice are never the colour I chose" bug, fixed by SPEC-031 and stated in `README.md`
   § "Dice (II.6)". An imported model brings its own coloured albedo, so tinting it
   reintroduces exactly that bug. **A model with a pre-coloured body cannot carry the
   per-roller colour cue.** A model with a neutral white albedo and numerals on a separate
   channel could.

**The two honest paths.**

- **(a) Model supplies shape only; numerals stay procedural.** Load the GLB, group its
  triangles into coplanar faces, derive locators and a decimated hull, re-UV each face for
  our number square, and keep the runtime-generated colour-baked textures. Everything above
  survives — RULE-013, the colour guarantee, d4, d100, dimming. The cost is a mesh analyser
  that has to be right about what counts as a "face" on a bevelled die, and the model's own
  material (the thing the user presumably liked about it) is discarded.
- **(b) Model supplies shape and material; numerals stay baked.** Ship a hand-authored
  per-model manifest — a face→value table (4–20 entries), locator directions, hull points,
  scale. The remap is then replaced by **pre-rotation**, which `README.md` already names as
  the equivalent operation, so RULE-013 holds. Cheaper to build, and it looks like the
  model the user chose. The casualty is the per-roller colour cue, plus d100 tinting, the
  d4's composed corners, and the dimming pass, each of which needs a per-model answer.

Path (b) is the realistic one and it is what "selectable" is worth having for: the
procedural set stays the default and keeps the colour identity, and an imported set is an
opt-in trade of that cue for a nicer-looking die.

**The scoping fork that decides how large this is.** *Whose model does a viewer see?*

- **Per-viewer, local.** The choice lives in `localStorage`; everyone sees their own
  preference on every die in the room. No stored field, no migration, no shared asset.
- **Per-seat, shared.** The choice lives on `PlayerSeat`/`ProfileInstance`, and my dice
  look like *my* dice on your screen — which is the version that pairs with the colour cue.
  It is a stored schema field (RULE-007 migration + `.vttcamp` round-trip), and every
  client must be able to fetch the model, so it is bundled, not uploaded — an upload path
  would be an `AssetStore` contract change (RULE-001) and a Blaze cost surface (RULE-010).

**Licensing and build weight.** SPEC-003 §5 bars assets from `owlbear-rodeo/dice`
specifically and states procedural generation as how we comply; a cleanly-licensed
third-party model is not barred by it, but it needs its licence checked for redistribution
in **both** the hosted and the local build, and an `ATTRIBUTION.md` entry — a file SPEC-003
§5 cites and that does not exist (IN-078). A GLB plus `GLTFLoader` also adds to a local
bundle already at 3.62 MB, and the local build ships as a file the user carries.

**Classification.** **Complex (Shape A).** It is an architectural change to the dice
render pass and a reversal of a stated premise — SPEC-003 §2 / R3.2's real *generated*
polyhedra, and `geometry.ts`'s "no imported meshes, no traced assets". It is not a
reversal of SPEC-003 §5, which is a licence constraint scoped to one GPL repository and
stays in force untouched. **No `RULES.md` amendment is required**: RULE-013 is satisfied by
either path above, and RULE-007/RULE-001 bind only under the per-seat half of the fork.
SPEC-003 and SPEC-020 would need amending in place, and a new SPEC written, once the
decision below is answered.

**Disposition.** Not scheduled. Blocked on **DEC-077**, which is Blocking on three counts:
a new asset in the shipped bundle, a possible stored schema field, and the reversal of a
Completed spec's stated behaviour.

#### IN-078 — `ATTRIBUTION.md` is cited by SPEC-003 §5 but does not exist

**Finding.** Surfaced while triaging IN-077. SPEC-003 §5 — a permanently binding standing
constraint — ends "See `ATTRIBUTION.md`", and `docs/archive/VTT_Master_Plan.ORIGINAL.md`
R3.5 says the same. There is no `ATTRIBUTION.md` at the repository root or anywhere else.
Nothing is currently mis-attributed (every dice asset is generated at runtime, which is the
point §5 makes), so this is a dangling reference rather than a licence problem today — but
it becomes a real gap the moment any third-party asset ships, which is exactly what IN-077
proposes.

**Classification.** **Simple** (proposed). Creating a documentation file that no code
reads redefines nothing on the trigger list: no store method or guarantee, no schema field,
no security rule, no coordinate space or layer or pipeline stage, no auth or join path, no
change to which store a write goes to, and no `data-testid`. It does not change SPEC-003
§5's stated behaviour — it satisfies a reference §5 already makes.

**Disposition.** Awaiting triage.

### Dice presentation and die-to-die collision (2026-09-02)

Arrived in the IN-077 gate conversation, once DEC-077 resolved to alternative (c) —
"decline the imported model, spend the effort on the generated set." The user's own words:
the shapes are "still off just a little bit", "several of the numerals still oriented
wrong", the dice are a "core mechanic of the game" and deserve visual work, and — a
separate request — dice in one roll should "physically bounce off of each other."

`3d-dice/dice-box` remains what the user called it: an **open-licensed reference point**
(MIT code, CC0 companion models), not a dependency and not an asset source. The evaluation
is recorded under DEC-077.

These five are logged individually per Shape B, and each is classified on its own.
**All five classifications were approved by the user on 2026-09-02**, together with DEC-078
and DEC-079 as recommended; the batch is specified as SPEC-045 §1–§5 and scheduled as
WI-093 – WI-097.

#### IN-079 — Numeral orientation is arbitrary per face

**Finding.** SPEC-020 §5 states the numeral's U axis is "derived from a face **edge**
(`pts[0]→pts[1]`) rather than a corner so numerals sit square to their faces". Square to
*that* edge, yes — but which edge is `pts[0]→pts[1]` is whatever order the face happens to
carry in `geometry.ts`'s hand-written index table, and those orders are not coherent across
a shape's faces:

- **d20 / d8** (triangles) — the icosahedron table lists `[0,11,5]`, `[0,5,1]`, `[0,1,7]`
  … each face starting from whichever vertex the table author wrote first, so each
  numeral's "up" is effectively a random one of three directions.
- **d12** (pentagons) — the faces come out of `orderRing`, whose starting corner falls out
  of an `atan2` sort against a basis picked by `Math.abs(n.x) < 0.9`. Rotation varies by up
  to 72° face to face.
- **d6** — checkable by hand: the `+x` face `[1,2,6,5]` gives a U axis of `+y`, while `-x`
  `[0,4,7,3]` gives `+z`. Two adjacent faces, two unrelated numeral orientations.

On a physical die the numerals of a shape belong to one family — each reads upright, in a
consistent relation to the solid, when its face is up. That is the property the edge rule
cannot express, because it has no notion of the *die*, only of one face's first edge. The
d10 already needed an escape hatch for a related reason and got `Polyhedron.faceUp`
(SPEC-020 §5's 2026-07-30 amendment); this is the same gap, wider.

**Classification.** **Deceptive.** It changes **the stated behaviour of an existing
`SPEC-nnn`** — an explicit trigger. SPEC-020 §5 names the edge rule in as many words, and
the fix replaces it with a die-global orientation rule, generalising the d10's `faceUp`
escape hatch into the normal path. It is not merely a re-tune within the stated rule.

**The conversation that must happen.** What the replacement rule *is* — the choice is a
design decision, not an implementation detail. Candidates: glyph-up points from the face
centroid toward whichever of the face's own vertices is most aligned with a fixed die-local
axis (deterministic, works for every shape, gives one coherent family); or per-shape
`faceUp` tables authored by hand (exact, matches a chosen reference die, but is twelve to
twenty hand-written vectors per shape and unverifiable by test). Also: whether the d10's
existing `faceUp` becomes redundant or stays as a documented exception.

**Disposition.** DEC-078 answered as recommended (user, 2026-09-02). SPEC-045 §1, WI-093.

#### IN-080 — Die sizing and aspect

**Finding.** `SCALE` multiplies a **unit-normalised** polyhedron, so every entry sets the
die's *circumradius*. `d4: 0.56` and `d20: 0.56` therefore give a tetrahedron and an
icosahedron the same circumscribed sphere — but a tetrahedron fills that sphere far less
evenly, so at equal circumradius the d4 reads as the largest, sharpest object on the table
rather than the smallest die in the set. Real dice sets are sized by a face or edge
convention, not by circumradius. The d10's `apexZ` is a second candidate: it went 1.15 →
0.85 to kill a "spike" reading, and 0.85 (height ÷ width) may now overshoot into squat.

**Classification.** **Simple.** `SCALE` is a tuning table and `apexZ` is documented in
`geometry.ts` as "the aspect knob, and it is the *only* one that may move". Re-tuning them
redefines nothing on the trigger list: no store method or guarantee, no schema field, no
security rule, no coordinate space, layer order or carve-pipeline stage, no auth or join
path, no store routing, no `data-testid`. SPEC-020 §4 records that a ~10% reduction
happened; it does not fix the numbers as a rule. **One hard constraint carries in:** the
d10's `ringZ = apexZ·tan²(π/10)` planarity relation is non-negotiable and pinned by a test —
`apexZ` may move, `ringZ` is always derived.

**Disposition.** SPEC-045 §2, WI-094.

#### IN-081 — Material pass on the generated dice

**Request.** The visual improvement the user asks for, in the half that needs no geometry
change: `MeshStandardMaterial` tuning beyond the current roughness ~0.30 / metalness ~0.10,
an environment map so the gloss has something to reflect, and — the substantive one —
replacing `textures.ts`'s canvas **emboss pass** (numerals drawn to *look* incised) with a
real **normal map**, so the numerals are lit as incised from whatever direction the key
light happens to be. This is where the reference-point comparison actually lands: what
reads as expensive in a good dice renderer is material and lighting, not mesh provenance.

**Classification.** **Simple.** Material parameters and an additional texture channel
redefine nothing on the trigger list. Specifically, it does **not** touch the one guarantee
in this area that is load-bearing: die colour still comes solely from the roller's
character colour, still baked into the face texture rather than applied as
`material.color`. A normal map is a separate channel and does not reintroduce the
`pick × texture` bug SPEC-031 fixed. Face count, groups, locators and hull are untouched.

**Disposition.** SPEC-045 §3, WI-095.

#### IN-082 — Bevelled die edges

**Request.** Every real die has rounded or bevelled edges and corners. The generated set is
sharp-edged with `flatShading: true`, which reads as a faceted gem rather than a die, and
is the likeliest single contributor to "the shapes are still off just a little bit."

**Classification.** **Deceptive.** Bevelling adds geometry that is **not a value face**,
and the whole renderer indexes dice *by face index*: `buildDieGeometry` emits one material
group per face with `faceIndex` as the group id, `locators[faceIndex]` is what
`topFaceIndex` scans, and `scene.ts` remaps `faceIndex → value` to make the die land
correct (RULE-013). Today `groups.length === locators.length === faceCount === the number
of values`. A bevel breaks that 1:1 relation, so it redefines what a "face" means to every
consumer of `DieGeometry` — the d100 tens tint, the d4's composed corner glyphs and the
advantage `DIM_OPACITY` pass all address dice through it. It also changes `hullPoints` and
so the physical die.

**The conversation that must happen.** Whether bevel geometry is carried as separate,
unnumbered material groups outside the value range (keeping the 1:1 relation intact for
value faces, at the cost of a documented split in what a "group" is), or whether
`DieGeometry` grows an explicit value-face count and every consumer is updated. Also
whether `flatShading` survives at all, since a bevel wants smooth normals on the bevel
strips and flat ones on the faces.

**Disposition.** DEC-079 answered as recommended (user, 2026-09-02), sequencing included.
SPEC-045 §4, WI-097 — blocked on WI-095 and WI-096.

#### IN-083 — Dice in one roll rarely touch

**Finding — the collisions are already on.** Worth stating plainly, because the request was
phrased as adding them. In `DiceScene.simulate` every die is a `RigidBodyDesc.dynamic()`
carrying a `ColliderDesc.convexHull` in **one shared Rapier world**, with default collision
groups and no filtering. Rapier resolves die-against-die contacts exactly as it resolves
die-against-floor. Nothing is disabled.

What suppresses them is the **throw geometry**. Dice spawn on a ring of radius 1.4–2.6 at
independent random angles, from a height of 5.5–7.0 under gravity 18 — about 0.75 s of
fall — with an inward velocity of only `0.7 ×` the spawn radius, so a die travels roughly
one unit inward before it lands. Two dice at unrelated angles on that ring simply land
apart, inside a tray of radius 4.4. The dice do not fail to collide; they are thrown so as
not to meet.

So the fix is throw tuning in `simulate()` — a tighter spawn arc, more inward velocity, a
staggered release, or a smaller effective tray — not a physics change.

**Classification.** **Simple.** It redefines nothing on the trigger list. In particular it
does **not** threaten RULE-013: the sim runs headlessly first and the face→value remap is
applied to whatever it produced, so the die still lands on the seeded value no matter how
chaotic the tumble. Cross-client float divergence is already declared harmless in
`README.md` — each client pre-rotates against its own sim — and collisions only amplify a
divergence that was already irrelevant.

**One constraint the work item must specify rather than leave emergent:** what happens when
a die comes to rest **on top of another die**, which is a state the current settle logic has
never had to handle. `topFaceIndex` still returns the correct value there — it takes the
most-up locator, and the remap guarantees that face carries the right number — but a die
resting on a slope is visibly tilted and may partly hide the die beneath it. A settle rule
for stacked dice (nudge apart, extend the step budget, or accept it) belongs in the spec,
not in whatever the physics happens to do.

**Disposition.** SPEC-045 §5, WI-096.

---

### Hex-map tools, snap vocabulary, and the transient view tools (2026-09-02)

A playtest batch (Shape B) of eleven items, arriving with a zip of 37 `.svg` files. It
splits cleanly in two, and the split is the important thing about it:

- **Four items are about the square map and the view tools** — IN-084 – IN-087. Two are
  independently schedulable.
- **Seven items are one programme** — IN-088 – IN-094, "a hex crawl becomes authorable".
  They are logged individually per Shape B, and each is classified on its own, but they
  **cannot be scheduled as seven independent work items**: every one of them stores or
  draws geometry on a map whose coordinate space is axial, and SPEC-030 §5 closed that
  door deliberately. They need one spec and one settled coordinate-space design first,
  the way SPEC-028 served the 2026-08-02 map-tools batch.

SPEC-030 §5 anticipated exactly this request and named the price:

> Re-opening any overlay tool for hex maps means giving it an axial-space form first,
> and is a new intake item.

IN-088 – IN-094 are that intake item, arriving as seven. Nothing in the hex half is
scheduled here; five decisions (DEC-080 – DEC-084) are logged Open in `DECISIONS.md`.

The supplied art is parked, inert and unwired, at `docs/intake/hex-symbols/` with a
README describing what it is and the three facts about it that shape IN-089. Placing it
there is not a step toward shipping it — the files are referenced by nothing — it just
keeps the user's material from being lost between the gate and the work item.

#### IN-084 — `snap = grid`: a fourth mode centring content on the grid lines

**Request.** A snap mode in which content snaps *centred on the grid lines*, rather than
into a cell, applying to every tool that offers a snap selector.

**Where it lands.** `VectorSnapMode` is `'free' | 'full' | 'half'`
(`packages/shared/src/map/vector/snap.ts`); the toolbar labels them Cell · Half · Free.
The request is only meaningful for some tools, because the three tool families already
anchor differently under the *same* mode:

| Family | Tools | What `full` does today |
| ------ | ----- | ---------------------- |
| Intersection-anchored (`snapPoint`) | Wall, Door, Polygon | Rounds to the nearest lattice **intersection** — already "on the grid lines" |
| Cell-anchored (`snapCellCenter`) | Room, Corridor, Path, N-gon, Carve | Centres in the **cell** the pointer is inside |
| Cell-floored (`snapCell`) | Symbol, Label | Floors to the **cell** the pointer is inside |

So `grid` is a **no-op for Wall/Door/Polygon** and a real change for the other seven. That
asymmetry is not a detail to settle during execution: it decides whether the selector
offers a mode that does nothing on three of the ten tools it appears on.

**Classification.** **Deceptive.** Two triggers, either sufficient:

- It changes **what a coordinate means** — SPEC-028's "Cells, not intersections" is a
  reasoned position, not an implementation accident, and it argues at length that rounding
  to the nearest vertex "crosses a cell boundary for three quadrants out of four". A mode
  that deliberately reinstates intersection anchoring for the cell-anchored five qualifies
  the stated behaviour of an existing `SPEC-nnn`.
- It widens a union that is consumed exhaustively — `DEFAULT_BAND_WIDTH` is a
  `Record<VectorSnapMode, number>`, `snapCursorColors` is keyed the same way, and every
  `snapAngle`/`snapSpan`/`snapCellSize` branch is a two-way `mode === 'half' ? … : …`
  that silently treats a fourth member as `full`.

It is **not** a schema change: `MapToolController.snapMode` is per-viewer client state and
is never written to a document, so no migration is in scope (RULE-007 is not engaged).

**Disposition: ⏸ Postponed (user, 2026-09-02).** It stays listed in `PLAN.md` §2 rather
than being scheduled or removed. DEC-080 narrows to its hex half (IN-090), and is written
so that `grid` slots into the mechanism chosen there without redesigning it.

**The conversation that must happen when it is revived.** DEC-080. In short: does `grid`
join Cell/Half/Free as a fourth member, or replace one; what it means for each of the three families above;
what `DEFAULT_BAND_WIDTH['grid']` is; and whether the targeted-cell indicator and the
Corridor/Path band indicator gain a `grid` form or suppress like they do under Free.

**Disposition.** ⏸ **Postponed** (user, 2026-09-02) — see the note above. DEC-080 answered only
its hex half (IN-090), and was written so `grid` slots into the same mechanism later.

#### IN-085 — Snap audit: does every mode draw the same shape class?

**Question, verbatim in substance.** "Do all of our snap modes draw the same shapes
regardless of snap mode? An outlier is fine, but want to confirm we don't have any
unintended ones. In free snap is the snapping to vertex active for all tools?"

**The second half is answerable now, from the code, and the answer is no.**
`attractsToVertex` (`apps/web/src/lib/map/vector-tools.ts:316`) returns true for **Wall,
Door and Polygon only**. `VectorMapView` adds one further case — an **in-progress Select
vertex-handle drag** — and nothing else: not Select's initial pick, not a whole-object
drag, not the five cell-anchored tools (whose anchor is a cell, so a vertex is not a thing
they could be pulled onto), and not Symbol or Label, which under Free pass the raw point
through with no candidate list at all. `vector-tools.test.ts:918` pins all of that. This is
SPEC-028 §12 as designed; the open question the audit should answer is whether **Symbol and
Label** ought to join the attracting set, since they are point-placement tools like
Polygon and there is no geometric reason they could not.

**The first half needs a real audit,** and the documented picture already shows three
outliers, all of which trace to a spec or a decision:

1. **Carve** paints whole lattice cells under Cell/Half and buffers the sampled polyline
   under Free — a square footprint versus a round brush. Deliberate: DEC-032 records Carve
   as "the only organic floor tool — knowingly".
2. **Corridor and Path** cap flat under Cell/Half and round under Free (SPEC-028 §9).
3. **The Corridor/Path band indicator** follows suit — a width×width square under
   Cell/Half, a circle under Free — and **Room's targeted-cell indicator is absent
   entirely** under Free.

So the honest state is "three known outliers, each with a citation". What the docs cannot
establish is whether the *code* holds any further ones, because `README.md` records intent
per tool and the question is about behaviour across ten tools × three modes. That is a
table someone has to build by reading `vector-tools.ts` and the `buildFloorStroke` path.

**Classification.** **Investigation.** It produces findings, not edits (DEC-027); each
finding becomes its own intake item.

**Why it should run before DEC-080 is answered.** IN-084 adds a fourth column to exactly
this table. Deciding what `grid` means per family, without first knowing what `full`,
`half` and `free` actually do per tool, is deciding on a picture assembled from prose.

**Disposition.** WI-098.

#### IN-086 — Eye and Ping expire on a countdown

**Request.** Both should disappear after a countdown, so they do not clutter the map.

**Where it lands.** The two halves are not symmetrical:

- **Ping already expires.** `PING_TTL_MS = 3000` in both `firebase-store.ts` and
  `memory-store.ts`, and the contract comment already reads "Self-expires from RTDB". What
  is missing is that the expiry is *invisible* — `renderPings` draws a fixed
  `circle(0, 0, 14)` at full opacity that vanishes without warning. The request, read
  against what exists, is a **visible** countdown: a fade, a shrinking ring, or both.
- **The Eye does not expire at all.** `eye` is a `$state<Point | null>` in
  `VectorMapView`, set on click and cleared only by clicking elsewhere or changing tool.
  A timer is genuinely new behaviour.

**Classification.** **Simple.** It redefines nothing on the trigger list: no store method
or guarantee (`publishPing`/`subscribePings` keep their signatures, and "self-expires" is
already the stated guarantee), no schema field, no security rule, no coordinate space,
layer order or carve-pipeline stage, no auth or join path, no change to which store a write
goes to, no `data-testid` moved or removed. The Ping half is a change to `renderPings`; the
Eye half is a timer over local component state.

**One consequence the work item must specify rather than leave emergent.**
`mapCtrl.canRevealFromEye` is true exactly while an eye is placed and fog is on, and it is
what enables "reveal what the eye can see". An auto-clearing eye turns that action off
underneath the referee mid-decision. The spec has to say what happens — the countdown
pauses while the reveal is available, the countdown is long enough not to matter, or the
reveal button is accepted as transient — rather than letting the timer decide.

**If the TTL itself moves**, it moves in both store implementations together, and
`rtdb-leaks.test.ts` asserts against the Firebase one.

**Disposition.** SPEC-046 §1, WI-099.

#### IN-087 — Eye and Ping can be aimed at a token or object

**Request.** Either tool may pick a token or a map object instead of open floor, and that
thing becomes the focus. Plus the user's own open question: *how do we visually indicate a
ping on a token?*

**Where it lands.** The Eye half is local — hit-test at the click point, hold a reference
instead of a `Point`, read the token's position each frame. On its own it would be Simple.

The **Ping half is not local**, and that is what classifies the item. A ping is published
over RTDB and rendered by every client, so "this ping is on that token" has to travel with
it. `PingPos` is `{ id, uid, x, y, ts }` and `publishPing(roomId, pos: { x: number; y:
number })` takes a bare point. Carrying a target means a new field on the published shape
and a changed `publishPing` signature.

**Classification.** **Deceptive.** RULE-001 names it outright — "a new method, or a changed
signature or guarantee" on the `CampaignStore` interface is a trigger — and any new store
method or changed guarantee must be added to `campaign-store.contract.ts` and pass against
`MemoryStore`, `FirebaseStore` **and** `LocalStore` (RULE-009's amendment made the local
store a third implementation of the same contract).

RULE-003 is *not* threatened: a ping is high-frequency ephemeral and stays on RTDB.

**The conversation that must happen.** DEC-084. What a target *is* (a token id only, or any
pickable map object); what happens when the target moves, is deleted, or is on a group that
collapses while the ping is live; whether the ping follows the token (it has to, or the
feature is just a click-time snap); and the visual language, which is the user's question.

**Disposition.** Not scheduled. DEC-084; SPEC-046 §2 is reserved for it.

#### IN-088 — Hex maps get their own tool palette

**Request.** A new set of tools for the hex map — explicitly *not* a reuse of the square
map's palette.

**Where it lands.** `HEX_TOOL_IDS` is derived, not authored: it is
`TOOL_GROUPS.filter(g => g.id === 'select' || g.id === 'view').flatMap(g => g.tools)` —
Select plus Pan/Eye/Measure/Ping, and nothing else. A hex-specific palette means new
`MapToolId`s, a new group or a hex-specific catalog, and a `TOOL_GROUPS` structure that
stops being one flat list shared by both grid kinds. `tool-groups.test.ts` asserts every
`MapToolId` is in exactly one group, so the shape of that catalog is pinned by test.

**Classification.** **Deceptive.** It changes **the stated behaviour of an existing
`SPEC-nnn`** — SPEC-030 §5's annotation states the palette *is* Select plus the View tools,
"no overlay tools at all", and gives the reason. It also changes what a tool group means:
today a group is a gesture family shared by every map; afterwards it is that, per grid kind.

**The conversation that must happen.** DEC-081, jointly with IN-092 – IN-094 — the palette
is only a palette once there is something for it to hold, and everything it would hold is
blocked on the same coordinate-space question.

**Disposition.** DEC-080 and DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §3,
WI-104 — where `HEX_TOOL_IDS` stops being a filter over the square map's groups and becomes an
authored list.

#### IN-089 — Hex symbol/terrain art upgrade from the supplied pack

**Request.** 37 supplied `.svg` files become the hex map's terrain and symbol palette.

**Where it lands.** `HEX_TERRAIN_CATALOG` (9 kinds + unknown) and `HEX_CONTENTS_CATALOG`
(10 kinds + unknown) in `packages/shared/src/map/hex/catalog.ts`, against files at
`apps/web/public/assets/hex/{terrain,contents}/*.svg`. The pack is parked at
`docs/intake/hex-symbols/`; its README has the full inventory.

**Three facts decide the classification.**

1. **Additive is cheap; replacing is not.** A hex stores `kind` and nothing else, which is
   why the catalog's own header says "re-drawing the whole terrain set is a change to this
   file rather than a migration". That holds for *re-drawing*. It does not hold for
   *renaming or retiring* a kind: a stored `terrain: 'mountains'` whose catalog entry has
   become `mountain-major` resolves to `UNKNOWN_HEX_KIND` and the hex renders grey. That is
   a stored field's meaning changing — RULE-007, a migration and a `.vttcamp` round-trip
   test.
2. **The art is authored dark, and the pipeline requires white.** Every glyph inks at
   `#111111`. `catalog.ts` states the requirement and the reason: "The art is authored
   white … both overlays are tinted at the render boundary … and a tint multiplies, so
   black art could not be tinted lighter." Terrain overlays are tinted to whichever of
   `HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT` contrasts with the hex's own colour (SPEC-030
   §2); a `#111111` glyph tinted light stays `#111111` and disappears on dark terrain.
   Either the pack is re-authored white, or the render-boundary tint rule changes — and
   that rule is what SPEC-030 §2 relies on to keep contrast from going stale when a terrain
   is re-coloured.
3. **`sym-water.svg` is two-tone** (`fill="#a8c4d0"`, `stroke="#111111"`). One multiply
   tint cannot express two tones. Either that file loses its fill, or the pipeline gains a
   notion of art that is not tinted at all.

**And one that gates shipping rather than design.** The pack carries no licence or
authorship metadata. SPEC-003 §5's licence discipline is a permanent standing constraint
and cites an `ATTRIBUTION.md` that does not exist (IN-078, still Open). Provenance has to
be established before these files land in `apps/web/public/`.

**Classification.** **Deceptive.** Fact 1 is a schema trigger the moment the answer to
"replace or extend" is *replace*, and facts 2–3 change what the render boundary does with
an overlay — the tint contract SPEC-030 §2 states.

**The conversation that must happen.** DEC-083.

**Disposition.** DEC-083 answered as recommended (user, 2026-09-02) — extend and alias, never
rename in place; the pack is re-authored white; `sym-water.svg` becomes single-tone. SPEC-047
§6, WI-101, gate cleared.

**Provenance answered (user, 2026-09-02): no third-party source.** The owner states the files
were generated by Claude in a separate session for a separate project of their own. That is the
answer SPEC-003 §5's licence discipline needs — the risk it contains is ingesting licensed or
GPL art, and there is none here. WI-101 creates `ATTRIBUTION.md` and records it in those terms.
IN-078 stays Open for the rest of that file's scope.

#### IN-090 — Hex maps offer exactly two snap modes: Hex and Free

**Request.** A hex map has two snap modes and only two — Hex and Free.

**Where it lands.** `VectorSnapMode` is one union, `MapToolbar`'s `SNAP_MODES` is one
unconditional array, and `MapToolController.snapMode` is one field with no idea what kind
of map is on stage. Making the offered set depend on grid kind is the small half; deciding
what `hex` *is* is the large one — a new member of the union (honest, but every exhaustive
`Record<VectorSnapMode, …>` and every `mode === 'half' ? … : …` branch has to answer for
it), or `full` reinterpreted per grid kind (closed union, but "full" then means two
different quantizations depending on the map, which is the ambiguity RULE-006's amendment
was written to prevent).

**Classification.** **Deceptive.** Same trigger as IN-084 — what a coordinate means — and
sharper here, because RULE-006 is explicit that axial coordinates are *not* lattice units
and that "a square-lattice consumer … is undefined on a hex map and must not be reached
from one". A snap mode is exactly such a consumer.

**The conversation that must happen.** DEC-080, jointly with IN-084 — one union, one
decision. Taking them separately is how the union ends up with a `grid` member that is
meaningless on hex maps and a `hex` member that is meaningless on square ones, with nothing
in the type saying so.

**Disposition.** DEC-080 answered as recommended (user, 2026-09-02) — `'hex'` joins the union
and the offered set becomes per-grid-kind. SPEC-047 §3, WI-104.

#### IN-091 — Hex terrain tool

**Request.** A tool that paints terrain — a colour *and* a terrain symbol — in two modes:

- **Hex snap** — paint whole hexes; as the user paints, union adjacent similar cells into
  one shape. Open question from the user: *add a border colour?*
- **Free snap** — a hex-sized circular brush painting a free-form region, with terrain
  icons scattered "randomly but at a consistent density".

And the user's own question, which is the item's real content: *can we support both drawing
modes in the same map, and how do we reconcile them?*

**Where it lands.** The Hex-snap half is nearly the existing feature: `hexTiles`, one
document per painted hex carrying `terrain`, rendered by `renderHexTiles` as a per-hex fill
plus a tinted overlay. What is new there is the **union** — merging like-terrain
neighbours into one shape with one outline instead of drawing 40 separate hexes with 40
visible seams.

The Free half has **no storage at all**. A free-form painted region is a polygon, and a hex
map has nowhere to put one: `hexTiles` is keyed by `axialKey`, which is the whole point of
its addressing. It needs a new collection or field, a schema bump, a migration, rules
(RULE-004, `hexTiles` is member-or-GM write today and a new collection needs its own tested
rule), and `.vttcamp` round-trip coverage (RULE-014 — and RULE-009's amendment makes that
non-negotiable, since locally the `.vttcamp` *is* the database).

**Classification.** **Deceptive**, and the heaviest item in the batch. It changes the
`GameMap`/hex schema (RULE-007), adds a store surface (RULE-001), needs security rules
(RULE-004), and introduces geometry in axial space (RULE-006).

**The conversation that must happen.** DEC-082, which is the user's own question restated:
one representation or two layers. It cannot be deferred to execution, because the answer
decides whether there is a migration at all.

**One thing worth settling in the same breath**, since it is cheap once the above is
decided: the icon scatter. "Randomly but at a consistent density" needs a *seed*, or the
icons re-scatter on every render and every client draws a different field. Deriving the
seed from the region id, the way RULE-013 derives dice faces from a roll seed, is the
established pattern here.

**Disposition.** ⏸ **Still Open.** DEC-082 is postponed (user, 2026-09-02) pending **WI-100**'s
investigation — the two live alternatives differ by roughly a collection, a migration and a
rules block, which is more than a coin-flip's worth. SPEC-047 deliberately has no terrain
section; it becomes §7 once DEC-082 closes.

#### IN-092 — Hex symbol tool

**Request.** Places a map symbol; under Free snap it need not snap to the grid.

**Where it lands.** SPEC-030 §5 names this exact blocker: "every overlay tool stores
square-lattice units multiplied by `grid.cellSize` — `MapSymbol.cell` … A hex map's
multiplier is `hex.size`, so placing one would put a second space on the map." A hex symbol
needs an axial-space position, and under Free snap a *fractional* one — which `HexTile`,
keyed by an integer `axialKey`, structurally cannot hold.

**Classification.** **Deceptive** — new schema, and a coordinate space RULE-006 has not
declared for symbols on hex maps. Note that IN-069 (backgrounds placeable on hex maps in an
undefined space) is the same defect already logged from the other direction, and the two
should be answered by one rule about what fractional axial position means.

> **Answered in principle (2026-09-02).** DEC-081 declares that space — `HexPoint`, in
> thirds of a hex step, where a snapped point is integer-valued and a free point is not.
> A Free-snap symbol is the free-valued case and needs nothing further; IN-069 is settled
> by the same declaration rather than by a second one. **No RULE-006 amendment is
> required** — thirds are axial coordinates, and the rule never says integer.

**Disposition.** DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §§1–2 and §4 —
WI-102, WI-103, WI-105.

#### IN-093 — Hex label tool

**Request.** Adds detail tied to that hex's address; under Free snap, find which hex the
pointer is inside and attach the label to it.

**Two observations, and they pull in opposite directions.**

First: **most of this exists.** `HexTile.note` is per-hex markdown, shown on hover through
the same `map-label-tooltip` a room label uses, authored in the hex-tile sheet (SPEC-030
§4, schema v26). "Find which hex we are within" is `hexMap.pixelToAxial`, which the Select
tool already calls. Read narrowly, the request is a *gesture* — a tool that places a note
without going through the sheet — over storage that is already there and already exports.

Second: **it reverses a stated position, twice.** SPEC-030 §1 makes the coordinate the
addressing scheme, "replacing the labels a referee used to invent", and §5 says "Label is
doubly out". A Label tool on a hex map is not obviously the same thing as a note.

**Classification.** **Deceptive** — changing the stated behaviour of an existing
`SPEC-nnn`, on the narrowest reading of what the tool does.

**The conversation that must happen.** DEC-081, but with a specific question inside it:
**is this `HexTile.note` under a new gesture, or a second thing?** If it is the note, this
item is nearly free and needs no schema at all. If it is a placed, named, movable label
like a `MapRoom` label, it is IN-092 again with different art.

**Disposition — answered: it is the note.** SPEC-047 §5, WI-106. The Label tool resolves the
pointer to a hex and opens that hex's `HexTile.note`; Hex and Free snap differ in nothing here,
because a note belongs to a hex by definition and there is no fractional position for it to
occupy. **No new schema, no new collection, no migration** — the cheapest of the seven. It stays
Deceptive because it qualifies SPEC-030 §§1 and 5, which are annotated in place.

#### IN-094 — Hex road and river tools

**Request.** Roads: three shades of brown, three increasing widths, hard angles at the
vertices. Rivers: three shades of blue, three increasing widths, round at the vertices.

**Where it lands.** Nowhere yet — this is new geometry on a map with no line storage.
Two properties make it more than "a `Drawing` with a colour":

- **The vertices are the feature.** Mitred joins for roads and round joins for rivers is a
  stroke-join choice, and it is the same distinction the square map already draws between a
  snapped Corridor's flat caps and a free Path's round ones (SPEC-028 §9). Whatever axial
  polyline type this introduces has to carry the join style, not infer it from the tool
  that made it.
- **They run along hex edges and through hex centres**, which looked at first like a third
  address kind: not an integer `axialKey`, not a free pixel position, but the hex lattice's
  *corners* — which the axial helpers do not currently expose.

**Classification.** **Deceptive** — new schema (RULE-007), new store surface (RULE-001) and
new rules (RULE-004).

> **The third address kind turned out not to exist (2026-09-02).** Every hex corner is an
> exact third of an axial coordinate — offsets `(⅔,−⅓) (⅓,⅓) (−⅓,⅔) (−⅔,⅓) (−⅓,−⅓) (⅓,−⅔)`
> from the centre, constant at every hex and every size — so corners and centres are one
> integer lattice at 3× resolution, separated by `(Q + R) mod 3`. DEC-081 has the
> derivation and the numeric check. A road's vertices are `HexPoint`s like everything
> else's, they meet **exactly** rather than to within a float tolerance, and **no RULE-006
> amendment is required**. What is left for this item is genuinely just the tool: three
> browns and three blues in the catalog, three widths, and mitre versus round joins carried
> on the document rather than inferred from which tool drew it.

**Disposition.** DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §§1–2 and §4 —
WI-102, WI-103, WI-105.

### The 2026-09-03 snap-audit batch (IN-095 – IN-103)

Nine items, all from one source: **WI-098**, IN-085's snap audit, which ran on 2026-09-03
and produced findings rather than edits (DEC-027). The full table — ten geometry-placing
tools × three snap modes, with each tool's anchor and whether its **shape class** changes
with the mode — is `docs/completed/WI-098.md` §1, and every item below cites a finding
there rather than restating it.

**What the audit settled, so these items are read against it.** Only **two** tools change
shape class with the snap mode, and both changes are cited: Path's caps (SPEC-028 §7) and
Carve's brush (DEC-032). Everything else that differs per mode is quantization. The
structural surprise was that the code has **three** anchor families, not the two §2
describes — lattice vertex (`snapPoint`: Wall, Door, Polygon), cell **centre**
(`snapCellCenter`: Corridor, Path, N-gon, Carve) and cell **corner**
(`snapCell`, floored: Room, Symbol, Label) — and that only the first attracts to a vertex
under Free.

> **Classifications approved and scheduled (user, 2026-09-03).** All ten are approved as
> proposed, with two rulings recorded in place: **IN-097 is answered** — keep the Euclidean
> disc and document it, rather than reshaping the brush footprint (the disc is what "a round
> brush, quantized to cells" means, and DEC-032 already commits Carve to being the organic
> tool) — and **IN-102 is raised as DEC-085** rather than scheduled, because it is a
> stated-behaviour change to SPEC-028 that the hex tools will inherit. Eight of the ten ride
> in **WI-107**; **IN-099** takes **WI-108** on its own. **IN-104 was added at approval
> time** — see its entry below for why it was missing.

#### IN-095 — Corridor's Free indicator advertises a cap the tool never draws

**Finding.** `targetedBandFor` (`apps/web/src/lib/map/vector-tools.ts:370`) returns a
circle under Free for **corridor and path alike**, on the stated grounds that it matches
"the round cap a free-snap Path produces". `corridorPoly`
(`packages/shared/src/map/vector/primitives.ts:372`) has **no Free branch**: every mode
goes through `bandRect`, and `bandSpan`'s Free branch (`:278`) returns the raw span — flat
caps, square joints, in all three modes. Under Free the Corridor therefore shows a circle
in front of a rectangle.

**Classification.** **Simple** (proposed) — a one-line predicate change in
`targetedBandFor`, no contract, schema, rules or coordinate-space change. It does alter a
visible indicator, so it wants the `snap-band-readout` testid's existing coverage extended
rather than a new surface.

**Disposition.** **WI-107.** Pairs with IN-096, which is the same defect in the spec. Note the interaction with DEC-085: if the Corridor's Free zero-length gesture comes to commit a `bandWidth` square, the indicator this item fixes should be that same square — one fix, reached from two directions. Pairs naturally with IN-096, which is the same defect in the spec.

#### IN-096 — SPEC-028 attributes the cap change to the Corridor as well as the Path

**Finding.** SPEC-028 §7's "Terminations" paragraph and §6's WI-052 amendment both read as
though Corridor and Path share the flat/round cap split. Only Path rounds. IN-085's own
rationale repeats the error, as finding (2). The Corridor's genuine Free difference is
narrower: unquantized endpoints and an unquantized band centre, same shape class
throughout.

**Classification.** **Simple** (proposed) — a documentation correction to §6 and §7. It
does not change any stated *behaviour*, only a mis-statement of it, so it is not a §-8
"changes the stated behaviour of an existing SPEC" trigger. IN-085's prose record is
preserved as written per §1's reading note; the correction belongs in the spec.

**Disposition.** **WI-107**, alongside IN-095 — the code fix and the doc fix are one story. Should land with IN-095 — the code fix and the doc fix are one story.

#### IN-097 — The snapped Carve dab is a disc of cells, not a block

**Finding.** `buildBrushStroke` (`vector-tools.ts:483`) paints every cell whose **centre**
lies within `radius = max(width / 2, step / 2)` of the anchored path. Under Cell snap a
single dab gives 1 cell at width ≤ 1; at width 2 (radius 1) the anchor **plus its four
cardinal neighbours — a plus, not a 2×2 or 3×3 block**, because the diagonals sit at
√2 ≈ 1.414; at width 3 (radius 1.5) the full 3×3. The footprint alternates plus-shaped and
square-ish as the width climbs. SPEC-028 §2's WI-042 note calls it "a block".

**Classification.** **Simple** (proposed) if the resolution is to document the disc, and
the disc is defensible — it is what "a round brush, quantized to cells" means. It becomes
**Deceptive** if the resolution is to change the footprint to a Chebyshev square, which
redefines what the Carve width *means* and would need a decision first.

**Disposition.** **WI-107**, and the choice this entry names is **answered (user, 2026-09-03): keep the disc, document it.** The disc is what "a round brush, quantized to cells" honestly means, and DEC-032 already commits Carve to being the organic tool; reshaping the footprint to a Chebyshev square would redefine what the Carve width means and needs a decision it does not warrant. That ruling is what keeps this item **Simple**. The work is correcting SPEC-028 §2's WI-042 note, which calls it "a block". The choice between those two is the item.

#### IN-098 — Carve widths 0.5 and 1.0 are one stroke under Cell snap

**Finding.** The `step / 2` floor in the same expression. `MapToolbar`'s Width control is
`min="0.5" step="0.5"` (`apps/web/src/lib/components/MapToolbar.svelte:359-366`), so the
control's first two stops are indistinguishable under `full`. Under `half` the floor is
0.25 against a minimum width of 0.5, so nothing collapses there.

**Classification.** **Simple** (proposed) — the floor itself is deliberate and correct
(IN-012: a sub-cell brush that committed nothing at all). What is missing is either a
control that reflects it or a line of documentation that admits it.

**Disposition.** **WI-107.** Lowest-value item in the batch, carried because the file is already open — not worth a session of its own. Lowest-value item in the batch; listed for completeness.

#### IN-099 — Symbol and Label offer a Snap selector and no snap feedback

**Finding.** `MapToolbar`'s `SNAP_TOOLS` includes `label` and `symbol`
(`MapToolbar.svelte:250`, from IN-057/WI-075), but `VectorMapView`'s `SNAP_CURSOR_TOOLS`
(`VectorMapView.svelte:338`) excludes both, and `targetedCellFor` is Room-only by
construction (`vector-tools.ts:332-345`). The two tools whose placement *is* "which cell
did you click" are the only snap-mode tools with neither a snap dot nor a cell highlight.
`SNAP_CURSOR_TOOLS`'s own comment gives the reason as "`symbol` places by cell-floor, not
vertex-snap" — which argues for giving it Room's **cell** indicator, not for giving it
nothing.

**Classification.** **Simple** (proposed) — widening `targetedCellFor`'s tool test from
`room` to the cell-corner family. It touches SPEC-028 §6, which is currently written as
"Room highlights the cell", so the spec moves with it (RULE-018).

**Disposition.** **WI-108**, on its own. The only finding in the batch that changes what a referee sees, and it touches SPEC-028 §6's "Room highlights the cell" wording, so it earns its own gate and its own diff. The most user-visible item in the batch.

#### IN-100 — Under Free, Symbol and Label store an unquantized anchor

**Finding.** `snapCell(p, 'free')` returns the raw point
(`packages/shared/src/map/vector/snap.ts:91`), so `MapSymbol.cell` and
`MapRoom.labelAnchor` hold arbitrary lattice floats under Free. This is RULE-006-legal —
lattice units are floats and nothing is stored in pixels — and is almost certainly
intended. The mismatch is nominal: the field is called `cell`, and `anchorCellFor`'s doc
calls it "the cell … containing the raw pointer position", which reads as a cell address.

**Classification.** **Simple** (proposed) — a doc note on `anchorCellFor` and on the two
fields. **Not** a schema change and explicitly not a migration: no stored value's type or
meaning moves.

**Disposition.** **WI-107.** A one-sentence doc note, carried with the rest.

#### IN-101 — SPEC-028 §6's dot rule contradicts itself

**Finding.** The WI-048 amendment says the dot "is drawn _in addition to_ the cell
highlight … so Room under Cell or Half snap shows a dot in the middle of the tile it
already highlights", and two sentences later says "Where a tile or shape indicator
supersedes the point, the point is no longer drawn." The code implements the second:
`if (input.cursorSnap && !input.cursorCell && !input.cursorBand)`
(`apps/web/src/lib/map/vector-engine.ts:1895`). Room shows no dot; N-gon, Carve, Wall, Door
and Polygon keep theirs. The first sentence was superseded by WI-052 and never struck.

**Classification.** **Simple** (proposed) — strike the stale sentence and annotate it as
superseded in place, per the amendment convention §6 already uses.

**Disposition.** **WI-107.**

#### IN-102 — "A click with no drag" has five different answers under Free

**Finding.** Under Cell/Half every floor tool commits **exactly one cell** for a
zero-length gesture, and it falls out of five separate mechanisms rather than one rule:
`snapSpan`'s floor, `cellRectPoly`'s inclusive rect, `corridorPoly`'s kept first leg,
`pathPoly`'s single-cell branch and `buildBrushStroke`'s radius floor. Under Free the same
gesture gives **Room — nothing** (`rectPoly` rejects zero area), **Corridor — nothing**
(both legs degenerate), **N-gon — nothing** (`snapSpan` is identity under Free, so
`acrossFlats` is 0), **Path — a round dot** of `bandWidth`, and **Carve — a round dot** of
`width`. Three silent no-ops and two dots. Only Room's half of this is cited (SPEC-028 §1,
§3).

**Classification.** **Deceptive** (proposed) — deciding what a zero-length Free gesture
commits changes the **stated behaviour** of SPEC-028 §3, and a "one rule for all five
tools" answer is a change to what the cell-anchored family guarantees. It also lands
squarely on the `grid` column DEC-080 scheduled (below), so it should not be settled twice.

**Disposition.** **Raised as DEC-085 (Open), not scheduled** (user, 2026-09-03). WI-098's
record and this entry both said this should be settled "alongside DEC-080" — that was
wrong, and the error is worth stating rather than quietly fixing: **DEC-080 was answered
and closed on 2026-09-02**, before WI-098 ran, so it cannot absorb this. DEC-085 carries the
same question with a recommendation (one rule in SPEC-028 §2; four tools endorsed unchanged,
the Corridor moved from "nothing" to a `bandWidth` `cornerBlock` square). It **blocks nothing
that is already scheduled**, but it should be answered **before WI-104 and WI-105**, which
add a `hex` snap mode and three more tools that would otherwise each invent a sixth answer.

#### IN-103 — §12 excludes Symbol and Label by omission

**Finding, and the audit's answer to IN-085's second half.** `VERTEX_ATTRACT_TOOLS` is an
**allowlist** (`vector-tools.ts:314`), and SPEC-028 §12 states its exclusions as "the
cell-anchored tools (Room, Corridor, N-gon, Carve, Path — §2's list)". Symbol and Label are
on neither list and are not `FloorPrimitiveTool`s; they never reach `toLatticeSnapped` at
all (`VectorMapView.svelte:2169`, `:2178`). So nothing in the spec or the suite says why
they do not attract.

**The audit's answer is No, they should not join** — `docs/completed/WI-098.md` §3 has it
in full. In short: attraction moves the anchor to the *nearest* vertex, which can be past
the click, breaking the "the placed footprint must contain the clicked point" invariant
both tools exist to hold (IN-014's bug, through a different door); the anchor is the
footprint's **top-left**, so attracting it to a wall endpoint puts the symbol's corner on
the wall and its body down-and-right of it; and the want behind the request — flush
placement against existing geometry — is Cell snap, one control away and already offered on
both tools.

**Classification.** **Simple** (proposed) — restate §12's exclusion as an allowlist
rationale naming Symbol and Label, and extend `vector-tools.test.ts:918`'s third case with
`symbol` and `label` so the answer is pinned rather than implied by an allowlist's silence.

**Disposition.** **WI-107.**

#### IN-104 — SPEC-028 §2 describes two anchor families; the code has three

**Finding, added at approval time (2026-09-03).** WI-098 recorded this as its §1 structural
result and gave it **no `IN-` id**, which was a logging mistake rather than a judgement: it
is the single most load-bearing thing the audit found, and it belongs in the ledger like
everything else.

SPEC-028 §2 frames the world as cell-anchored versus vertex-snapped. The code has three:

| Anchor | Function | Tools | Free's vertex attraction? |
| --- | --- | --- | --- |
| Lattice vertex | `snapPoint` | Wall, Door, Polygon | **Yes** (§12) |
| Cell **centre** | `snapCellCenter` | Corridor, Path, N-gon, Carve | No |
| Cell **corner** | `snapCell`, floored | Room, Symbol, Label | No |

`CELL_ANCHORED_TOOLS` (`apps/web/src/lib/map/vector-tools.ts:290`) merges the last two,
which is correct for the plumbing — from `buildFloorStroke`'s point of view they share one
property, points arrive raw — and incomplete as a description of behaviour. Room floors to a
corner; its four list-mates centre on a cell; Symbol and Label floor to a corner without
being on the list at all, because they are not `FloorPrimitiveTool`s and take their own path
through `placeSymbolAt` / `placeLabelAt`.

**Why it matters more than its size suggests.** §2 is a **standing constraint on any new
floor tool** (DEC-012), and it is the text WI-102 – WI-106 will be read against while the hex
programme decides what each hex tool's `grid` anchor is. A standing constraint that describes
a two-way split the code does not have is the wrong thing to inherit.

**Classification.** **Simple** — a correction to §2's framing plus the table above. No
behaviour changes; `CELL_ANCHORED_TOOLS` keeps its membership and its purpose, and gains a
comment saying which of the three families each member belongs to.

**Disposition.** **WI-107**, and it is that work item's most important line rather than an
afterthought.

#### What the batch hands to the hex programme

DEC-080 closed on 2026-09-02, before this audit ran, so the handoff is to the work it
scheduled — **WI-102 – WI-106**, which add `grid`/`hex` as a fourth column to WI-098 §1's
table. Three results bear on them:

- The column it joins has **three** anchor families, not two. A hex map's tools will each
  have to say which of hex-vertex, hex-centre or hex-address-floor their `grid` behaviour
  resembles; WI-098 §1's second table is the shape of that question.
- **Only two tools change shape class per mode today, and both are cited.** A `grid` mode
  that adds a third uncited one is a new outlier, not a continuation of a pattern.
- **IN-102 is the thing most likely to be got wrong per mode**, because the zero-gesture
  answer falls out of five floors and identity functions rather than one rule. It is now
  **DEC-085**, and answering it before WI-104/WI-105 is the point: whatever `grid` does, "a
  click with no drag" should be answered once, explicitly, for all of them.
- **IN-104's three anchor families** are what a hex tool's `grid` anchor has to be chosen
  from. WI-107 corrects §2 to say so; scheduling WI-107 ahead of WI-102 is therefore worth a
  little, though nothing blocks on it.

### The 2026-09-03 terrain-investigation batch (IN-105, IN-106)

> Both came out of **WI-100** (`docs/completed/WI-100.md`), the investigation DEC-082 was
> postponed for. Neither depends on how DEC-082 is answered: both are about how a painted
> hex is **drawn** today, under SPEC-030 §2, and both would be wanted under alternatives
> (a) and (b) alike. Classifications are proposed, not approved.

#### IN-105 — Like-terrain hexes have no drawn boundary, and no border colour to draw one with

**Request.** A block of hexes sharing a terrain kind should read as one region with an edge.
Today it reads as an undifferentiated blob.

**What the code does.** `renderHexTiles` (`vector-engine.ts:1185`) fills each painted hex's
polygon into a single `Graphics` and draws **no stroke at all** — no per-hex outline, no
group outline. The hex grid is drawn separately, under the fills. `HexTerrainEntry`
(`map/hex/catalog.ts:27`) carries `kind`, `label`, `color` and `ref`; there is no border
colour for an outline to use, and DEC-082 argues at length that if one is added it belongs
there, beside the fill, for the same reason the fill is not on the document.

**Why it is Simple.** It adds a field to a catalog whose whole point is that it is art
rather than data — "re-drawing the whole terrain set is a change to this file rather than a
migration" — and one pass to a render function. Nothing stored changes, no store method
changes, no coordinate meaning changes. WI-100 §2 measured the pass: **0.18 ms at 300
painted hexes, 0.65 ms at 1200**, with the boundary keyed by exact integer axial *thirds*
(SPEC-047 §1's `HexPoint`) rather than by float or string, and it is skippable for any kind
that declares no border colour.

**Disposition.** Awaiting triage. Naturally pairs with IN-106 and with whatever answers
IN-091 — but it stands alone, and it is worth having whether or not a terrain *tool* ever
ships, since the quick sheet already paints terrain per hex (SPEC-030 §5, WI-041).

#### IN-106 — Per-hex seeded scatter as the terrain texture

**Request.** Terrain should read as a texture — scattered trees, not a tree icon centred in
each hex. IN-091 asked for this inside the terrain tool, "randomly but at a consistent
density"; WI-100 found it is neither tool-shaped nor storage-shaped.

**What the code does.** Each painted hex gets exactly one overlay sprite, centred, at
`hexTerrainArtPx(size) = size × 1.1`, at 55% alpha. At `DEFAULT_HEX_GRID_CONFIG`'s size 48
that reads as a grid of repeated icons — see `docs/completed/wi-100/scatter.svg`, bottom row.

**The finding.** Seeded **per hex from that hex's own axial key** —
`mulberry32(hashSeed("q,r"))`, RULE-013's exact pattern — at a fixed count per hex, the
scatter is continuous across hex boundaries with no visible hex-shaped clumping, is
zoom-invariant by construction, is stable under editing (painting one more hex moves nothing
already drawn), and **stores nothing**: no region, no seed field, no schema.
`docs/completed/wi-100/perhex.svg` is the render, at sizes 20, 32 and 48.

**Why Deceptive rather than Simple.** It changes what a terrain overlay *means* at the render
boundary — one addressable sprite per hex becomes a derived field of many — and the sprite
path it replaces is `syncHexArt`'s keyed node reuse, so it is a render-pass change rather
than a catalog one. It also needs a density number per kind, which is a second field on
`HexTerrainEntry` beside IN-105's border colour. Conservative classification per `CLAUDE.md`.

**Disposition.** Awaiting triage. Pairs with IN-105 — one render pass, two catalog fields —
and both should be looked at together with whatever answers DEC-082.

### The 2026-09-04 e2e-helper finding (IN-107)

#### IN-107 — `switchToEditMode`'s conditional click is a race

**Request.** Raised by WI-103's verification run, not by a user. `pnpm verify:all` failed on
`hex-map.spec.ts:176` ("a hex with a note shows it on hover"), which timed out for the full
180s waiting to click `vector-tool-select` — still `disabled`, `title="Select (locked —
switch to Edit)"`, i.e. the map was in `mapMode === 'view'` for the whole test. Re-running
that spec alone passed all four cases. WI-103's diff contains no `apps/web` file.

**What the code does.** `apps/web/tests/e2e/helpers.ts`:

```ts
export async function switchToEditMode(page: Page): Promise<void> {
  await openMapToolSheet(page);
  const toggle = page.getByTestId('map-mode-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await closeQuickSheet(page, 'maptools');
}
```

**The finding.** The helper reads `aria-pressed` once and clicks conditionally, then closes
the sheet without ever asserting the mode it was called to establish. Both halves are
unguarded: a `getAttribute` on a control Svelte has rendered but not yet wired returns the
attribute without the handler behind it, so the click is swallowed and nothing notices.
Every spec that calls it — `hex-map`, and it is imported widely — then runs its whole body
against a palette where every non-view tool is `disabled`, and fails 180s later somewhere
that has nothing to do with the cause. The other three `hex-map` cases run the identical
preamble, which is why this surfaces as an intermittent failure in one arbitrary spec rather
than a reproducible one.

**The fix is one line**, and is the pattern the rest of `helpers.ts` already uses: assert the
toggle reached `aria-pressed="true"` before closing the sheet, so a swallowed click fails at
the helper with an accurate message instead of 180 seconds later at an unrelated locator.
`expect(toggle).toHaveAttribute('aria-pressed', 'true')` auto-retries, which also removes the
stale-read half of the race.

**Why Simple.** Test-helper only. It adds an assertion to a helper; it changes no `data-testid`
(RULE-005), no store contract, no schema, and no application code. It does not redefine
anything a caller may assume — every current caller already intends the post-condition it
would start asserting.

**Disposition.** Awaiting triage. Not fixed in WI-103: that item is hex overlay storage, and a
flaky e2e helper is outside it (RULE-015). It is worth doing before the batch's remaining
`apps/web` items — WI-104 – WI-106 all touch the hex palette and will run these same specs.

### The 2026-09-04 DEC-085 closure (IN-108)

#### IN-108 — Implement DEC-085's Corridor and Free-indicator change

**Request.** Raised while executing WI-104: DEC-085 ("what does a zero-length gesture
commit, per tool and per snap mode?") was still Open, and WI-104 needed its answer so the
`hex` snap mode's own zero-length case would inherit a settled rule rather than invent a
sixth one. The user answered DEC-085 alternative (a) — one rule in SPEC-028 §2 — as
recommended (2026-09-04, see `docs/decisions/DEC-085.md`).

**What DEC-085 leaves undone.** The answer settles the *rule*; it does not itself change
`corridorPoly`. DEC-085's own Impact section says the Corridor's Free zero-length branch
moving from "nothing" to a `bandWidth` square (`cornerBlock`) is a stated-behaviour change
to SPEC-028 — Deceptive by the trigger list — and it interacts with **IN-095** (the
Corridor's Free indicator should draw that same square once it commits one). Neither the
code change nor the SPEC-028 §2 rewrite is part of WI-104: WI-104 touches only the hex
tools (SPEC-047 §3), and the Corridor is a square-grid tool untouched by that item
(RULE-015).

**Disposition.** Awaiting triage. Two-line code change
(`packages/shared/src/map/vector/primitives.ts`'s `corridorPoly` Free zero-length branch,
plus the Free-indicator draw call IN-095 already identifies) and a SPEC-028 §2 rewrite
stating the rule DEC-085 settled. No schema, no store contract, no rules file, no
coordinate-space change.
