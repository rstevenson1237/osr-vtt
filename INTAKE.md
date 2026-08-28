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
| IN-074 | Redraw the icon set under a stated depiction rule                    | **Simple**            | **Scheduled** | WI-091        |
| IN-075 | No focus state on any shell icon control                             | **Simple**            | **Scheduled** | WI-092        |

### 1.2 Closed intake

| IN     | Item                                                                           | Classification                    | Closed via                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
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
