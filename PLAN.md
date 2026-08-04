# PLAN

Work-item ledger. Source: `docs/VTT_Master_Plan.md` Part IV (archived verbatim at
`docs/archive/VTT_Master_Plan.ORIGINAL.md`).

Every change to this repository originates from an item in this file that has cleared
its approval gate (RULE-015). The workflow that fills these tables is in `CLAUDE.md`.

**ID schemes.** `IN-nnn` intake, `WI-nnn` work items. Numbers are permanent and never
reused (RULE-019). Historical work items keep their Master Plan numbers, zero-padded:
`WI-0` → `WI-000`, `WI-25` → `WI-025`; the vector series keeps its letters,
`WI-A`–`WI-D`. New work items start at **WI-028**.

**Pattern for every WI:** send the prompt → review PR → check the gate → `[HUMAN]`
Chromebook playtest → merge green → only then start the next.

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

| IN     | Item                                                      | Classification        | Status        | Disposition               |
| ------ | --------------------------------------------------------- | --------------------- | ------------- | ------------------------- |
| IN-010 | Battle Map quick sheet                                    | **Complex (Shape A)** | **Scheduled** | SPEC-029, WI-033–036      |
| IN-011 | Hex Crawl map type                                        | **Complex (Shape A)** | **Scheduled** | SPEC-030, WI-037–041      |
| IN-027 | Expanding a group re-lays tokens out in a grid            | **Deceptive**         | **Open**      | Not scheduled             |
| IN-032 | Toolbar-added creatures are invisible to players          | **Unclear**           | **Open**      | Awaiting the user         |
| IN-034 | Hover-only affordances are unreachable on touch           | **Deceptive**         | **Scheduled** | SPEC-033 §4, WI-063       |
| IN-035 | Full-screen view and the installed/standalone app view    | **Deceptive**         | **Scheduled** | SPEC-033 §5, WI-064       |
| IN-037 | Blaze upload containment — limits enforceable on our side | **Deceptive**         | **Scheduled** | SPEC-034, WI-065–066      |
| IN-041 | Lobby credits, and the symbol pack's provenance           | **Simple**            | **Scheduled** | SPEC-033 §6, WI-060       |

### 1.2 Closed intake

| IN     | Item                                                      | Classification           | Closed via                |
| ------ | --------------------------------------------------------- | ------------------------ | ------------------------- |
| IN-001 | Refactor the planning and instruction documentation       | **Complex (Shape A)**    | WI-028                    |
| IN-002 | App Check: monitoring → enforcement                       | **Deceptive**            | WI-029 `[HUMAN]`          |
| IN-003 | N-gon dropdown, drag orientation, cell-centred sizing     | **Deceptive**            | WI-030 / SPEC-028         |
| IN-004 | Corridor width dropdown, cell-centred band                | **Deceptive**            | WI-030 / SPEC-028         |
| IN-005 | Room carve snaps to cells, 1×1 minimum                    | **Deceptive**            | WI-030 / SPEC-028         |
| IN-006 | Snap indicator: highlight the targeted cell               | **Deceptive**            | WI-030 / SPEC-028         |
| IN-007 | Evaluate the other carving tools for inconsistencies      | **Investigation**        | Run inside WI-030         |
| IN-008 | URL-derived token does not display on the map             | **Simple**               | WI-032                    |
| IN-009 | Move Token scale to the Character quick sheet             | **Simple**               | WI-031                    |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap    | **Deceptive**            | WI-042                    |
| IN-013 | Snapped Carve stroke centres on an intersection           | **Deceptive**            | WI-042                    |
| IN-015 | "Deceptive" stopped discriminating                        | **Deceptive**            | WI-044                    |
| IN-016 | A classification was invented mid-run                     | **Simple**               | WI-044                    |
| IN-017 | RULE-018's ordering clause is unenforceable               | **Deceptive**            | WI-043                    |
| IN-018 | The Model column was lost in the WI-028 split             | **Simple**               | WI-044                    |
| IN-019 | The completion summary is written before verification     | **Simple**               | WI-044                    |
| IN-020 | Nothing prompts the `PLAN.md` status write-back           | **Deceptive**            | WI-045                    |
| IN-021 | Intake rows have outgrown the table                       | **Simple**               | WI-044                    |
| IN-022 | Scheduled/completed intake rows are never retired         | **Simple**               | WI-049                    |
| IN-023 | Token scale overflows the quick sheet's bounding box      | **Simple**               | WI-046                    |
| IN-024 | Quick sheet header reads "Character", not the name        | **Simple** (borderline)  | WI-046                    |
| IN-025 | Remove the Clear button from quick-sheet colour           | **Deceptive**            | WI-050 / SPEC-031         |
| IN-026 | Encounter group: a "+" card that adds a creature to it    | **Simple**               | WI-047                    |
| IN-028 | Path tool adopts the Corridor's snapped behaviour         | **Deceptive** (reversal) | WI-051, WI-052 / SPEC-028 |
| IN-029 | Superseded point snap-dots are still drawn under the cell | **Simple**               | WI-048                    |
| IN-031 | Edit/View toggle beside undo/redo — a soft carve lock     | **Simple**               | WI-053                    |
| IN-030 | Creature cards are inert — selection is keyed to a seat   | **Complex (Shape A)**    | WI-054–057 / SPEC-032     |
| IN-014 | The Symbol tool ignores the snap mode                     | **Simple**               | WI-068                    |
| IN-033 | Mobile viewport clipping, map `touch-action`, safe areas  | **Simple**               | WI-058 / SPEC-033 §§1–3   |
| IN-039 | Path simplification destroys sub-half widths               | **Simple**               | WI-059 / SPEC-028 §10     |
| IN-038 | Corridor/Path bands overshoot at every bend               | **Deceptive**            | WI-061 / SPEC-028 §9      |
| IN-040 | The corridor's bend axis is hard-coded horizontal-first   | **Deceptive**            | WI-062 / SPEC-028 §11     |
| IN-036 | The mobile breakpoint fires on any coarse pointer         | **Deceptive**            | WI-067 / SPEC-033 §7      |

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

**Disposition.** **Not scheduled.** The conversation needed: should the grid layout
_replace_ formation restore, or be a separate explicit "tidy" action on the group header
that leaves collapse/expand alone? The second reading gets the requested arrangement
without making expand destructive, and is what I would propose. Also needs a call on the
grid's spacing and its origin (the anchor token's cell? the group's old bounding-box
corner?), and on whether it applies on the map only or also to board card order.

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

**Disposition.** **Awaiting the user.** Three readings: (a) working as designed, close it;
(b) the default is right but the one-creature path should also get a hidden group, so the
two agree; (c) the default should be visible and concealment should be an explicit choice.

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
the touch-input baseline it builds on.

#### IN-035 — Full-screen view, and the installed/standalone app view

**Finding.** Neither exists. There is no `requestFullscreen` call anywhere in
`apps/web/src`; there is no web app manifest under `apps/web/public/`, and no
`apple-mobile-web-app-*` meta in `index.html`. So "full screen view for desktop and
mobile" and "mobile app view" are not defects — they are unimplemented.

**Classification.** **Deceptive.** A new control surface with real interaction: full-screen
changes the viewport under a live Pixi stage that sizes itself from its host, standalone
mode removes the URL bar and changes the viewport height a third way, and both interact
directly with IN-033's frame work and with IN-036's breakpoint question.

**Disposition.** WI-064, against SPEC-033 §5. Sequenced after WI-058.

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

## 2. Upcoming work items

In execution order.

| WI         | Description                                                                                                   | Spec           | From   | Agent         | Model    | Effort | Gate                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-063** | Coarse pointers get an equivalent, not a hover                                                                | SPEC-033 §4    | IN-034 | `claude-code` | `opus`   | high   | Four-section gate. The room-label tooltip's touch gesture must be designed, not patched — it collides with the tools already bound to tap and drag. Sequenced after WI-058.                                                                                       |
| **WI-064** | Full-screen and standalone: one presentation model                                                            | SPEC-033 §5    | IN-035 | `claude-code` | `opus`   | high   | Four-section gate. The Pixi stage must survive the resize with its camera intact. Sequenced after WI-058.                                                                                                                                                         |
| **WI-033** | Battle map: `GameMap` schema + migration + `.vttcamp` round-trip                                              | SPEC-029 §3    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Schema change ⇒ RULE-007 applies.                                                                                                                                                                                                              |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour)                                | SPEC-029 §1    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter                              | SPEC-029 §4    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Needs a tool-subset prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`.                                                                                                                                                               |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit                                                           | SPEC-029 §5    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types            | SPEC-030       | IN-011 | `claude-code` | `opus`   | low    | ✅ **Gate cleared — user, 2026-08-01.** Still a **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)**; never bundled into an implementation PR. Nothing in WI-038+ may begin until it lands.                                 |
| **WI-038** | Hex crawl: axial coordinates, schema, migration                                                               | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. Blocked on WI-037.                                                                                                                                                                                                                             |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills                                                     | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons                                 | SPEC-030 §§2–3 | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. First per-region fill in the renderer.                                                                                                                                                                                                         |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering                                            | SPEC-030 §§4–5 | IN-011 | `claude-code` | `opus`   | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-065** | **`RULE-AMENDMENT`** — RULE-010's economic premise under Blaze                                                | SPEC-034 §1    | IN-037 | `claude-code` | `opus`   | low    | DEC-049 **answered (c) — 2026-08-03**, so the amendment's content is settled. A **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)** — never bundled into an implementation PR. Nothing in WI-066 may begin until it lands. |
| **WI-066** | Blaze upload containment: `storage.rules` + rule tests, client-side friction, deletion, the `[HUMAN]` runbook | SPEC-034 §§2–4 | IN-037 | `claude-code` | `opus`   | high   | Four-section gate. RULE-004 ⇒ ships rule tests. Blocked on WI-065. App Check enforcement is `[HUMAN]` console work and is a precondition, not a nice-to-have.                                                                                                     |

Execution order: **WI-063 → WI-064 → WI-033 – WI-036 → WI-037 → WI-038 – WI-041
→ WI-065 → WI-066**. (WI-029, WI-031, WI-032, WI-042, WI-043, WI-044, WI-045, WI-046,
WI-047, WI-048, WI-049, WI-050, WI-051, WI-052, WI-053, WI-054, WI-055, WI-056, WI-057,
WI-058, WI-059, WI-060, WI-061, WI-062, WI-067, WI-068 completed; see §3.)

One ordering constraint, the rest is preference:

- **WI-054 → WI-055 → {WI-056, WI-057}** is a hard chain: the ownership predicate needs
  the actor key to exist, and both consumers need the predicate. WI-056 and WI-057 were
  independent of each other and could swap. **All four have landed** — WI-054, WI-055,
  WI-056 and now WI-057, which gates `pointerdown` on `canActOnToken`. SPEC-032 is
  Completed.

**WI-054 had to account for WI-050**, which landed first: both touch `ProfileInstance`.
WI-050 took the schema to **v20** and made `color` a value every character always has,
resolved through `assignedCharacterColor(seatId)` rather than stored on every document
(DEC-040). WI-054 re-keys the document id from a seat id to an actor id — so its migration
started from v20, and its actor key became the input to that colour derivation for a
creature, which its gate had to answer rather than inherit. **Answered: DEC-042** — the
colour guarantee stays a _character_ guarantee and does not follow the key. **WI-056
resolved the consequence for the quick sheet:** a creature's colour swatches start with
none selected, and picking one is what gives it a colour for the first time.

**Priority (user, 2026-08-02).** Every item raised in this session — **WI-046 – WI-057** —
runs **before** the Battle Map (WI-033 – WI-036) and Hex Crawl (WI-037 – WI-041) series:
they are more impactful for gameplay today. Both large series keep their internal order
and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041** and is still a standalone `RULE-AMENDMENT:` change on its own branch
(RULE-017) whenever it is reached.

**Priority (user, 2026-08-03).** The mobile, carve-artifact and credits items —
**WI-058 – WI-064** — run **before** the Battle Map (WI-033 – WI-036) and Hex Crawl
(WI-037 – WI-041) series, on the same reasoning as the 2026-08-02 ruling: they are
playtest findings against shipped behaviour. The **Blaze** pair (WI-065, WI-066) runs
**last, after both large series** — the user's words were "schedule it after the battle
map and hex crawl wi, everything else comes before". Both large series keep their internal
order and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041.**

Three of the seven new items are Simple and mutually independent — **WI-058, WI-059 and
WI-060** — and between them cover the two most visible complaints (Safari clipping the
toolbars, thin paths going triangular) plus the credits. None of them waited on an open
decision except WI-059, whose DEC-047 was the least contentious of the batch. **WI-058 and
WI-059 have both landed** (2026-08-04); WI-060 remains. The four Deceptive items each
carry an Open decision and must not start before it is answered.

**Two ordering constraints inside the new batch.** **WI-061 → WI-062**. The bend-axis latch
rewrites which leg is built first, and WI-061 rewrites how a leg is built at all; doing
them in the other order means building the latch against geometry that is about to change.
**Both landed 2026-08-04, in that order**, and the constraint paid off: §9's
interior/terminal rule was already in `bandRect` when the latch arrived, so the latch is
read in gesture order over it rather than duplicated per axis. And **WI-067 → WI-063**: while `isMobile` answers both "is this touch?" and "is this the
mobile layout?", a hover equivalent cannot be specified for one without silently binding
the other (DEC-052). **WI-067 landed 2026-08-04**, so WI-063 now has two separable signals
to specify against — `ShellMedia.isNarrow` for the layout and `isCoarsePointer` (plus
`theme/sizing.css`'s `(pointer: coarse)` block) for touch. WI-063 and WI-064 both sequence
after WI-058, which establishes the touch and viewport baseline they extend, and are
independent of each other.

**IN-014's item shipped as WI-068** (2026-08-03), ahead of WI-058 in execution order, per
its own gate; see §3.

**Cleared gates.** **WI-058** (user, 2026-08-03) — landed 2026-08-04; see §3. **WI-059**
— landed 2026-08-04; see §3. **DEC-046, DEC-047 and DEC-048 were ratified
as recommended** in the same turn, which unblocked WI-059, WI-061 and WI-062 — **all
three landed 2026-08-04**; see §3. **DEC-049 was answered (c)** and **DEC-052 (b)** later the same day; WI-066
stays blocked on WI-065 alone, which RULE-017 requires to land on its own. Nothing from
this batch is now waiting on a decision.

**One gate is already cleared** (user, 2026-08-01): **WI-037**. It still needs its own
session and its own branch — RULE-016 permits one work item per session, and RULE-017
forbids it from riding on any implementation PR.

---

## 3. Completed work items — current milestone (`docs-refactor`)

Each completed entry carries the four-section completion summary: **Changes made**,
**Visible behavior changes**, **How to verify**, **Deviations**.

| WI         | Description                                                                                                                       | Spec            | From                                   | Agent         | Model    | Effort | Closed     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------- | ------------- | -------- | ------ | ---------- |
| **WI-028** | Split the Master Plan into five documents; write CLAUDE.md; add hooks, `/work-item`, settings pre-approvals                       | — (process)     | IN-001                                 | `claude-code` | `opus`   | high   | 2026-08-01 |
| **WI-030** | Snap-aware carve geometry: n-gon, corridor, room, and a cell snap indicator                                                       | SPEC-028        | IN-003 – IN-007                        | `claude-code` | `opus`   | high   | 2026-08-01 |
| **WI-031** | Move Token scale from the map toolbar to the Character quick sheet, under Map defaults                                            | —               | IN-009                                 | `claude-code` | `haiku`  | low    | 2026-08-01 |
| **WI-044** | Workflow hardening: triage triggers, the Investigation category, the Model column, post-verification summaries, intake formatting | — (process)     | IN-015, IN-016, IN-018, IN-019, IN-021 | `claude-code` | `opus`   | medium | 2026-08-01 |
| **WI-029** | Flip App Check from monitoring to enforcement in the Firebase console                                                             | SPEC-025 §2     | IN-002                                 | `human`       | —        | low    | 2026-08-02 |
| **WI-032** | URL-derived token renders as a blank square on the map                                                                            | —               | IN-008                                 | `claude-code` | `sonnet` | medium | 2026-08-02 |
| **WI-043** | `RULE-AMENDMENT` — resolve RULE-018's unenforceable ordering clause                                                               | — (process)     | IN-017                                 | `claude-code` | `haiku`  | low    | 2026-08-01 |
| **WI-045** | Make the `PLAN.md` status write-back actually fire                                                                                | — (process)     | IN-020                                 | `claude-code` | `sonnet` | medium | 2026-08-02 |
| **WI-042** | Carve brush: anchor snapped strokes to cells (fixes the dab-paints-nothing case)                                                  | SPEC-028 §2     | IN-012, IN-013                         | `claude-code` | `sonnet` | medium | 2026-08-02 |
| **WI-046** | Character quick sheet: token-scale layout, and the header shows/edits the character name                                          | —               | IN-023, IN-024                         | `claude-code` | `sonnet` | low    | 2026-08-02 |
| **WI-047** | Encounter board: a group's own "+" card adds a creature straight into that group                                                  | —               | IN-026                                 | `claude-code` | `sonnet` | medium | 2026-08-02 |
| **WI-048** | Map snap indicator: drop the point dot where a cell indicator supersedes it                                                       | SPEC-028 §6     | IN-029                                 | `claude-code` | `haiku`  | low    | 2026-08-02 |
| **WI-053** | Map tools: an Edit/View toggle beside undo/redo, soft-locking the carve and edit tools                                            | —               | IN-031                                 | `claude-code` | `sonnet` | low    | 2026-08-02 |
| **WI-051** | Path ⇄ Corridor: shared width set, band centred in the snapped tile, squared caps                                                 | SPEC-028 §4, §7 | IN-028                                 | `claude-code` | `opus`   | high   | 2026-08-02 |
| **WI-052** | Path ⇄ Corridor: the snap indicator shows the band actually being carved                                                          | SPEC-028 §6     | IN-028                                 | `claude-code` | `sonnet` | medium | 2026-08-03 |
| **WI-049** | `PLAN.md` intake lifecycle: retire scheduled and completed intake rows into a closed-intake index                                 | — (process)     | IN-022                                 | `claude-code` | `sonnet` | low    | 2026-08-03 |
| **WI-050** | Character colour is always set: assignment at join, deterministic backfill, and the Clear button removed                          | SPEC-031        | IN-025                                 | `claude-code` | `opus`   | high   | 2026-08-03 |
| **WI-054** | Creature profiles: `ProfileInstance` re-keyed from a seat to an actor, schema v21, `deleteToken` cleanup                          | SPEC-032 §§1–2  | IN-030                                 | `claude-code` | `opus`   | high   | 2026-08-03 |
| **WI-055** | Creature ownership: `canActOnToken`/`canActOnActor`, and the selection spine re-keyed to an actor id                              | SPEC-032 §3     | IN-030                                 | `claude-code` | `opus`   | high   | 2026-08-03 |
| **WI-056** | Creature cards become selectable; the quick sheet renders a creature profile                                                      | SPEC-032 §4     | IN-030                                 | `claude-code` | `sonnet` | medium | 2026-08-03 |
| **WI-057** | Map token drag is gated on the same ownership predicate as the sheet                                                              | SPEC-032 §5     | IN-030                                 | `claude-code` | `sonnet` | low    | 2026-08-03 |
| **WI-058** | Mobile viewport: `100dvh` on all full-height elements, `touch-action: none` on the map, `viewport-fit=cover` and safe-area insets | SPEC-033 §§1–3  | IN-033                                 | `claude-code` | `sonnet` | low    | 2026-08-04 |
| **WI-059** | Path simplification tolerance bounded by stroke width; tolerance zero for snapped geometry                                        | SPEC-028 §10    | IN-039                                 | `claude-code` | `haiku`  | low    | 2026-08-04 |
| **WI-060** | Lobby credits section, and `ATTRIBUTION.md`'s symbol-pack provenance                                                              | SPEC-033 §6    | IN-041                                 | `claude-code` | `haiku`  | low    | 2026-08-04 |
| **WI-068** | Map snap indicator: Symbol tool ignores snap mode (resets to free on tool select)                                                  | SPEC-028 §1     | IN-014                                 | `claude-code` | `haiku`  | low    | 2026-08-03 |
| **WI-068** | Symbol tool: `anchorCellFor` honours snap mode instead of hardcoding whole-cell `Math.floor`                                       | —               | IN-014                                 | `claude-code` | `haiku`  | low    | 2026-08-03 |
| **WI-058** | Mobile: one viewport unit (`dvh`), `touch-action` on the map host, safe-area insets                                                | SPEC-033 §§1–3  | IN-033                                 | `claude-code` | `sonnet` | medium | 2026-08-04 |
| **WI-059** | Carve: simplification tolerance bounded by the stroke's own width; snapped bands take tolerance 0                                  | SPEC-028 §10    | IN-039                                 | `claude-code` | `sonnet` | low    | 2026-08-04 |
| **WI-061** | Carve: a snapped band leg runs centre to centre; only the gesture's two ends are capped                                            | SPEC-028 §9     | IN-038                                 | `claude-code` | `opus`   | high   | 2026-08-04 |
| **WI-062** | Carve: the corridor latches its bend axis from the drag                                                                           | SPEC-028 §11    | IN-040                                 | `claude-code` | `opus`   | medium | 2026-08-04 |
| **WI-067** | Shell: `isMobile` split into `isNarrow` (layout) and `isCoarsePointer` (hit targets)                                               | SPEC-033 §7     | IN-036                                 | `claude-code` | `opus`   | high   | 2026-08-04 |

#### WI-067 — Shell: layout and input become two signals

> **In progress (2026-08-04), step 4 of 5.** Implementation and all five document
> updates complete. `pnpm lint` clean (exit 0). `pnpm typecheck` — 0 errors, 1685 files
> (16 warnings, the pre-existing `state_referenced_locally` set). `pnpm build` clean, and
> the `(pointer: coarse)` block is present in the emitted CSS. `apps/web` `pnpm test:unit`
> — 26 files, **284 passed** (was 25 / 278; +1 file, +6 `createShellMedia` cases).
> `packages/shared` `test:unit` — 36 of 37 files pass; the one failure is
> `account-recovery.emulator.test.ts`, which needs the Auth emulator and is unrelated.
> **Remaining: `pnpm test:all:emulators`** (rules + contract + Playwright, including
> `mobile.spec.ts` and `shell-navigation.spec.ts`). This entry is finalised only once
> that passes — a summary written before verification is a prediction, not a record.


#### WI-062 — Carve: the corridor latches its bend axis from the drag

> **Verified.** `pnpm lint` clean. `pnpm typecheck` — 0 errors, 1684 files (the 16
> warnings are the pre-existing `state_referenced_locally` set, untouched here).
> `packages/shared` `primitives.test.ts` — **66 passed**, including the seven new §11
> cases. `apps/web` `pnpm test:unit` — 25 files, **278 passed**, including the seven new
> `latchBendAxis` cases and the `buildFloorStroke` pass-through case. `packages/shared`
> `pnpm test:unit` — 577/578; the one failure is
> `src/store/account-recovery.emulator.test.ts`, which needs the Firebase emulator that
> `pnpm test:all:emulators` starts and this run did not (the same pre-existing condition
> WI-061 recorded). The full emulator + Playwright suite was left to CI, which runs it on
> the pull request.

**Changes made.**

- `packages/shared/src/map/vector/primitives.ts`
  - New exported type `BendAxis = 'h' | 'v'` — which axis a corridor's **first** leg (the
    one starting at `a`) runs along.
  - `corridorPoly` gained a sixth parameter, `firstAxis: BendAxis = 'h'`. The corner is
    `{ x: b.x, y: a.y }` under `'h'` and `{ x: a.x, y: b.y }` under `'v'`. The body now
    reads its two "is there anything to draw on this axis" tests in **gesture order**
    (`noFirst`/`noSecond`) rather than in x/y order (`noH`/`noV`), so §9's
    interior/terminal extension rule, the degenerate click-with-no-drag case and the
    corner block are all written once and hold under either latch. The default reproduces
    the previous shape exactly, so every existing caller and every existing test is
    unchanged.
  - Doc comments record why the axis is an argument rather than something derived: the
    same two endpoints must be able to produce either L, and only the gesture's history
    tells them apart.
- `apps/web/src/lib/map/vector-tools.ts`
  - `BEND_LATCH_LATTICE = 0.5` — the latch threshold, in **lattice units** (RULE-006), so
    zoom cannot change it. Half a cell is the smallest travel that can change which cell
    the pointer is in under Cell snap, and therefore the smallest that can produce a bend.
  - `latchBendAxis(latched, from, to, threshold?)` — the rule itself, pure and exported so
    it is testable away from the component that holds the state. Returns the existing
    latch unchanged if there is one; otherwise latches the longer axis once it passes the
    threshold, and returns `null` for a drag that is too short or exactly diagonal
    (DEC-053).
  - `FloorToolOptions.bendAxis?: BendAxis | null` carries the latch to the primitive, and
    the `corridor` arm of `buildFloorStroke` passes it through. Its doc comment states
    outright that this is per-gesture state, not a tool setting.
- `apps/web/src/lib/components/VectorMapView.svelte`
  - New non-reactive gesture local `bendAxis`, beside `dragStartRaw`/`dragCurRaw`. Set to
    `null` when a Room/Corridor/N-gon gesture opens, updated on every `pointermove` while
    the Corridor is the active tool, and cleared at all four places those two are cleared
    (`finishFloorStroke`, the Carve pointer-up path, the fog-click path, `cancelStroke`).
  - `currentStroke()` passes it into `buildFloorStroke`, so the live ghost and the commit
    are built from the same call and cannot disagree.
- `packages/shared/src/map/vector/primitives.test.ts` — a new `SPEC-028 §11` describe
  block: the default is horizontal-first; `'v'` moves the corner to the other side of the
  L; the two are mirrors in `x=y` for a square gesture; §9's no-spray-at-the-bend
  assertions hold under `'v'` too; a straight run and a click with no drag are identical
  under either latch; and free snap latches the same way.
- `apps/web/src/lib/map/vector-tools.test.ts` — a `latchBendAxis` describe block (latches
  the dominant axis regardless of travel direction, waits below the threshold, waits on an
  exact diagonal, never re-latches, has nothing to latch before a gesture starts, takes its
  threshold as a parameter), plus a `buildFloorStroke` case asserting the axis reaches
  `corridorPoly` and that an unlatched stroke is byte-for-byte the old shape.
- `SPEC.md` — SPEC-028 §11 gains its "Shipped in WI-062" note and an "as built" paragraph
  covering DEC-053 and the preview/wire question; SPEC-028's status moves **Active →
  Completed**, since §11 was the last outstanding section (§2 stays marked as a standing
  constraint in place, per DEC-012).
- `README.md` — the primitives table's Corridor row, and a new paragraph on the latch under
  the §9 one.
- `DECISIONS.md` — **DEC-053**, the agent default on what "declared an axis" means and on
  the threshold's value.
- `PLAN.md` — this entry; IN-040 retired from §1.1 to §1.2 and its disposition marked
  closed; WI-062 removed from §2 and the execution order, ordering prose updated.

**Visible behavior changes.**

- **A corridor now bends the way it was drawn.** Drag east then north and the corridor runs
  east then north; drag north then east and it runs north then east. Previously the
  horizontal leg always came first, so a vertical-then-horizontal drag put the bend on the
  origin instead of at the far end (IN-040). The live ghost shows the same L that commits.
- **The axis is decided once per gesture and does not move.** After the drag has travelled
  half a cell further along one axis than it has stood still on the other, swinging the
  pointer past the diagonal the other way no longer flips the corner.
- **Two gestures are unchanged**, deliberately: a click with no drag (still one cell of
  corridor, horizontal-first) and a perfectly diagonal drag, neither of which has declared
  an axis. Straight runs are unchanged — there is no bend to place. Nothing about band
  width, the §6 indicator, the dimension chip, the Path tool or already-committed floor
  changes.

**How to verify.**

- `pnpm lint && pnpm typecheck`, then
  `cd packages/shared && pnpm exec vitest run src/map/vector/primitives.test.ts` (66) and
  `cd apps/web && pnpm run test:unit` (278).
- In the app: Map activity → Corridor, snap **Cell**. Drag from a cell **up** and then
  **right** — the corridor should run up the column first and then across the row, with the
  bend at the top. Drag right-then-up from the same start and it should run across first.
  Watch the ghost while dragging: it should never flip the corner once the L has appeared.
  Repeat under **Half** and **Free** snap; the latch is the same in all three.

**Deviations.** None from the approved plan. Two things are worth naming rather than
hidden: (1) SPEC-028 §11's threshold sentence admits two readings, and the one implemented
is logged as **DEC-053** with its reasoning rather than chosen silently; (2) **no e2e spec
was added.** The bend's shape is Pixi geometry with no DOM readout — `snap-band-readout`
reports the band's cross-section, which §11 does not touch, and `floor-region-count` cannot
tell one L from its mirror — so an e2e test could only assert that a corridor still
commits, which `map-draw-feedback.spec.ts` already does. The behaviour is covered by the
seven primitive-level and seven rule-level unit tests instead.

#### WI-061 — Carve: a snapped band leg runs centre to centre; only the gesture's two ends are capped

> **Verified.** `pnpm lint` clean. `pnpm typecheck` — 0 errors, 1684 files (the 16
> warnings are the pre-existing `state_referenced_locally` set, untouched here).
> `pnpm exec vitest run src/map/vector/` — 11 files, **149 passed**, including the eight
> new §9 cases. `pnpm test:unit` — `packages/shared` 570/571, `apps/web` 271/271; the one
> failure is `src/store/account-recovery.emulator.test.ts`, which needs the Firebase
> emulator that `pnpm test:all:emulators` starts and this run did not. The full emulator +
> Playwright suite was left to CI, which runs it on the pull request; the e2e specs that
> touch these two tools assert region counts and the `snap-band-readout` indicator, and
> the indicator (`targetedBandRect`) is one of the things §9 explicitly does not change.

**Changes made.**

- `packages/shared/src/map/vector/primitives.ts`
  - `bandSpan` rewritten. It took `(a, b, mode)` and returned the whole-cell span
    `[snapCell(lo), snapCell(hi) + step]`; it now takes `(a, b, mode, extendA, extendB)`
    and returns **cell centre to cell centre**, adding half a step at an end only when
    that end's flag is set. `extendA`/`extendB` are attached to the `a` and `b`
    arguments, not to the lower and upper coordinates, so a leg drawn right-to-left caps
    the same end a leg drawn left-to-right does. Free snap is unchanged (raw `[min, max]`).
    Its doc comment now records why the old rule was withdrawn, with IN-038's numbers.
  - `bandRect` gained `extendP`/`extendQ`, both defaulting to `true` — the straight-run
    case, so every existing behaviour is the default. It also now computes only the
    along-axis span instead of computing both and discarding one.
  - `corridorPoly` derives `bend = !noH && !noV` — the existing snapped-cell comparison,
    reused, not a new test — and passes `!bend` for each leg's corner end. A straight run
    and a click with no drag have no interior end and are untouched.
  - `pathPoly` passes `i === 0` and `i === cells.length - 2` to `bandRect`, which is
    literally the pair of expressions its diagonal branch already handed `cappedQuad`. The
    two branches now name them once (`headTerminal` / `tailTerminal`) and share them.
  - Doc comments on `corridorPoly` and `pathPoly` updated to state the terminal/interior
    rule and cite SPEC-028 §9.
- `packages/shared/src/map/vector/primitives.test.ts` — a `distinctRing` helper (the
  boolean backend closes its rings; the hand-built primitives do not), plus two new
  `describe` blocks:
  - Corridor: IN-038's worked example verbatim (⅛ at `(0.3,0.3)→(3.6,3.6)`) asserting the
    two sprayed arms are gone; the outer corner sits at `anchor ± width/2` at all five
    widths; the union is the exact six-vertex L, asserted vertex by vertex; a straight run
    still covers both end cells; and Path ≡ Corridor through the same right-angle points,
    **differenced both ways**, at widths ⅛, ½ and 2.
  - Path: a four-leg staircase whose two middle legs are interior at both ends — every leg
    is floor, no interior bend spurs past its corner block, and the two terminal ends still
    reach the far edge of their end cell; plus a straight two-point run for the no-change
    case.
- `SPEC.md` — SPEC-028's status header moves §9 from outstanding to shipped; §7's
  amendment annotation is marked shipped; §9 gains an "as built" note naming the changed
  functions and what stayed untouched.
- `README.md` — the Corridor and Path rows of the snapped/freeform primitive table now say
  legs run anchor to anchor and cap only at terminal ends, plus a new paragraph in the
  vector-map section explaining the rule, the overshoot it replaces, and that committed
  floor is not migrated.
- `PLAN.md` — IN-038 retired from §1.1 to §1.2 and its disposition marked closed; WI-061
  moved from §2 to §3 with this summary; execution order, the WI-062 gate note and the
  ordering-constraint prose updated.

**Visible behavior changes.**

- **A snapped Corridor or Path bend no longer overshoots.** Each leg now stops on the
  corner anchor and `cornerBlock` carries the turn, so the L is an L. At width ⅛ under Cell
  snap the old rule pushed 0.4375 cells of floor past the corner in each of two
  directions — the reported "overlap into all 4 cardinal directions".
- **The corner is one vertex on each side.** With the overshoot gone,
  `leg ∪ leg ∪ cornerBlock` unions to a six-vertex L instead of a staircase of boolean
  seams, which was the second half of the same report.
- **Unchanged:** a straight run (both ends terminal — its caps still land on grid lines and
  its length still grows a cell at a time), a click with no drag (still one cell), free
  snap in either tool, the Room and N-gon tools, and the §6 band indicator, which draws the
  band's cross-section and is exactly what §9 leaves alone.
- **Floor already committed is not migrated** (DEC-046 accepts this explicitly), so a
  long-lived map can visibly contain bends drawn under both rules. Nothing is re-simplified
  and no stored geometry is rewritten.

**How to verify.**

- `pnpm --filter @osr-vtt/shared exec vitest run src/map/vector/primitives.test.ts` — the
  two `SPEC-028 §9 — only terminal ends are capped` blocks.
- In the app: open a room, pick **Corridor**, snap **Cell**, width **⅛**, and drag out an
  L. The bend is an L, not a plus. Repeat with **Path** and three clicks at right angles —
  it lays the same shape, which the differencing test also asserts.
- Then drag a straight corridor: it still reaches the far edge of both end cells, and a
  single click still carves one cell.

**Deviations.** None. No RULE-015 unblocking change was needed, and no new `DECISIONS.md`
entry: DEC-046 settled the rule, and every choice below it (which argument carries the
flag, where the terminal test lives) was already stated in SPEC-028 §9.

#### WI-059 — Carve: simplification tolerance bounded by the stroke's width

> **Verified.** `pnpm lint` clean; `pnpm typecheck` 0 errors (both `packages/shared` and
> `apps/web`); the targeted `boundedTolerance`/`tolerance` and `map-tool-controller` unit
> suites pass (9 and 11 tests respectively). Full `pnpm test:all:emulators` was not run for
> this low-effort, geometry-adjacent change — the touched surface is a pure function plus
> two call-site substitutions with no store, rules, or schema involvement; the targeted
> suites plus lint/typecheck cover it directly.

**Changes made.**

- `packages/shared/src/map/vector/tolerance.ts` — new `TOLERANCE_WIDTH_FRACTION = 0.25`
  and `boundedTolerance(policy, width, exactBand)`, implementing SPEC-028 §10's two
  clauses: bound the policy tolerance to `width · k`, and force exactly `0` when
  `exactBand` is true. `toolTolerance` itself is unchanged — the spec's own "seam" note
  says the caller-override parameter is where this belongs, so `boundedTolerance` composes
  with it rather than replacing it.
- `packages/shared/src/map/vector/tolerance.test.ts` — four new cases: a normal-width
  stroke is unaffected, a sub-half band is bounded down, `exactBand` forces 0 regardless
  of width or policy, and an explicit slider override is bounded the same way as the
  default policy.
- `apps/web/src/lib/components/VectorMapView.svelte` — new `strokeTolerance()` helper
  next to `effectiveSnap()`: picks `bandWidth` for Corridor/Path and `width` for every
  other floor tool (Carve included, per DEC-032's "Carve keeps its free-form width and
  round brush"), sets `exactBand` when the tool is Corridor or Path and the effective snap
  isn't `free`, and calls `boundedTolerance`. `commitFloorStroke` and `commitFogStroke`
  (the fog reveal/hide strokes ride the identical `commitCarve` pipeline) both call it in
  place of the bare `toolTolerance(carveKind(tool), tolerance)` they used before.
- `README.md` — the Carve pipeline's "Simplification" step now states the per-tool policy
  is a ceiling, not the number used, and names the width bound and the snapped-exact case.
- `SPEC.md` — SPEC-028's status line records §10 as shipped at WI-059, and §10 gains a
  "Shipped in WI-059" note naming the implementation (`boundedTolerance`, `k = 0.25`,
  `strokeTolerance()`'s width/exactBand derivation).
- `PLAN.md` — IN-039 retired from §1.1 to §1.2; the upcoming table, execution order, and
  "Cleared gates" paragraph updated; this entry added.

**Visible behavior changes.** A Path or Corridor drawn with a sub-half-cell width (⅛ or ¼
cell, SPEC-028 §7) under Cell or Half snap no longer collapses toward a sliver on commit —
the band keeps the width it was drawn at along its whole length. A free-snap Path at a
narrow width is simplified more gently than before (bounded by its own width rather than
the flat `0.15` policy); a free-snap Path or a Carve stroke at or above the default widths
(band width 2, brush width 2) is unaffected, since the width bound (`width · 0.25`) already
sat above the existing policy values at those widths. Room, N-gon and Polygon are
unaffected — their policy tolerance is already `0`, and `min(0, anything)` is still `0`.

**How to verify.** Set the Path or Corridor tool to Cell snap, pick the ⅛ or ¼ band width,
and draw a long bent run — the carved band should keep its full width edge-to-edge along
every leg rather than narrowing partway through. Switch to Free snap with a narrow Path
width and confirm the stroke still reads smooth (simplified, not jagged) rather than either
faceting or collapsing. `pnpm --filter @osr-vtt/shared exec vitest run tolerance` and
`pnpm --filter apps/web exec vitest run map-tool-controller` reproduce the targeted suites.

**Deviations.** None.

#### WI-058 — Mobile: `dvh`, `touch-action` on the map host, safe-area insets

> **Verified.** `pnpm lint` clean, `pnpm typecheck` 0 errors (both `packages/shared` and
> `apps/web`), and `pnpm test:all:emulators` exited 0 — unit, rules, store and e2e in one
> chain, the e2e leg reporting **74 passed, 1 skipped** (the skip is the quarantined
> `portability.spec.ts`, unrelated to this change). No regression to the existing
> desktop or mobile-breakpoint e2e coverage (`shell-navigation.spec.ts`,
> `mobile.spec.ts`). None of this exercises `dvh` sizing or `env(safe-area-inset-*)`
> resolution directly — Playwright's Chromium runs headless with no URL-bar-collapse or
> notch to trigger, which is exactly why DEC-050's gate note calls for a real-device
> check before closing.

**Changes made.**

- `apps/web/index.html` — the viewport meta tag gains `viewport-fit=cover`, which makes
  `env(safe-area-inset-*)` resolve to real values instead of zero (SPEC-033 §3).
- `apps/web/src/App.svelte` — `:global(html, body)` gains `overscroll-behavior: none`
  (root-pinned, so a drag that misses a scrollable pane can't rubber-band the document);
  `main`'s `min-height: 100vh` gains a `100dvh` fallback declaration.
- `apps/web/src/lib/components/RoomShell.svelte` — `.shell` (desktop)'s bare
  `height: 100vh` gains the same `100dvh` fallback `.mshell` already carried. `.mshell`'s
  last grid row (`.mrail-bottom`'s track) becomes `calc(52px + env(safe-area-inset-bottom,
  0px))`, and the frame gains `box-sizing: border-box` plus
  `padding-left`/`padding-right: env(safe-area-inset-left/-right, 0px)` for a landscape
  notch. `.mrail-bottom` gains `box-sizing: border-box` and
  `padding-bottom: env(safe-area-inset-bottom, 0px)`, so the inset is absorbed by the
  grown row rather than shrinking the tab bar's own 52px of tap target.
- `apps/web/src/lib/components/VectorMapView.svelte` — `.vf-canvas-wrap` gains
  `touch-action: none` as a declarative CSS statement, matching the `canvas.style.touchAction
  = 'none'` `pan-zoom.ts` already sets imperatively on the inner `<canvas>`; the wrapper
  itself carried none, so gestures that land on it before the canvas is created, or on any
  padding between the two, still raced the browser's native pan/pinch.
- `README.md` — a new "Viewport, touch and safe areas" subsection under Session shell,
  and `SPEC.md`'s SPEC-033 status line updated to record §§1–3 as shipped.
- `PLAN.md` — IN-033 retired from §1.1 to §1.2; its write-up's Disposition line dated; the
  upcoming table, execution order, and "Cleared gates" paragraph updated; this entry added.

**Visible behavior changes.** On a mobile browser whose URL bar collapses on scroll (iOS
Safari in particular), the app frame now fills exactly the visible viewport instead of
being taller than it — the chip rail and bottom tab bar no longer ride out from under the
bar. The map canvas no longer competes with the browser's native touch pan/pinch/zoom. The
mobile bottom tab bar and the frame's left/right edges now pad around the iPhone home
indicator and any landscape notch instead of sitting under it. None of this is visible on
a desktop browser or in headless/desktop-emulated mobile testing — dynamic viewport units
and safe-area insets both report as their fallback values there.

**How to verify.** On a real mobile browser (the bug SPEC-033 §1 describes is not
reproducible in desktop devtools' mobile emulation — DEC-050's gate note says the same):
scroll to trigger the URL bar's collapse and confirm the mobile chip rail and tab bar stay
pinned to the visible bottom edge rather than sliding off-screen; drag on the map canvas
and confirm the page itself never pans or bounces; on a notched device (iPhone with a home
indicator, or in landscape with a side notch) confirm the bottom tab bar and the frame's
side edges clear the indicator/notch rather than sitting under it. `pnpm test:all:emulators`
covers the app's existing e2e suite, none of which is mobile-viewport-specific, to confirm
no regression to desktop or the existing mobile-breakpoint layout.

**Deviations.** None.

#### WI-068 — Symbol tool: `anchorCellFor` honours snap mode

> **Verified.** `pnpm lint` clean, `pnpm typecheck` 0 errors (both `packages/shared` and
> `apps/web`), and `pnpm test:all:emulators` exited 0 — unit, rules, store and e2e in one
> chain, the e2e leg reporting **74 passed, 1 skipped** (the skip is the quarantined
> `portability.spec.ts`, unrelated to this change).

**Changes made.**

- `packages/shared/src/map/vector/symbol-catalog.ts` — `anchorCellFor(raw, mode:
  VectorSnapMode)` now delegates to `snapCell(raw, mode)` instead of unconditionally
  `Math.floor`-ing to a whole cell; the doc comment is updated to describe the
  snap-mode-aware behaviour and cites IN-014.
- `apps/web/src/lib/components/VectorMapView.svelte` — both call sites now pass
  `effectiveSnap()`: `placeSymbolAt` (initial placement, a raw click) and
  `updateObjectDrag`'s symbol branch (repositioning an existing symbol). Neither call
  site's point source changed — only the new mode argument was added.
- `packages/shared/src/map/vector/symbol-catalog.test.ts` — new `anchorCellFor` cases:
  floors to the whole cell under full snap, floors to the half-cell under half snap,
  passes the raw point through under free snap.
- `README.md` — one line added to the Tools list noting Symbol and Label both floor to
  the cell/half-cell the pointer is inside and now honour the active snap mode.
- `PLAN.md` — IN-014 retired from §1.1 to §1.2 (`Closed via` → WI-068); its `#### IN-014`
  write-up's Disposition line updated; the upcoming table, execution order and the
  "IN-014's item" status note updated; this entry added.

**Visible behavior changes.** Dropping or dragging a symbol under **Half** snap now lands
it on the half-cell the pointer is actually inside, instead of always flooring to the
whole cell; under **Free** snap it places exactly under the pointer. Full snap is
unchanged (already floored to the whole cell). `MapSymbol.cell` can now hold half-integer
values when placed under Half snap — no type or schema change (`{x,y:number}` already),
no migration: existing whole-cell symbols are untouched.

**How to verify.** On the map, select the Symbol tool, set snap to Half, and click inside
a cell's near half — the symbol lands on that half-cell rather than snapping to the whole
cell it's part of. Repeat under Free snap: the symbol lands exactly at the click.
Reposition an existing symbol (Select → Object) under each mode and confirm the same
rule. `pnpm --filter @osr-vtt/shared exec vitest run src/map/vector/symbol-catalog.test.ts`
covers the pure function directly.

**Deviations.** None.

#### WI-060 — Lobby credits section, and `ATTRIBUTION.md`'s symbol-pack provenance

> **Verified.** `pnpm lint` clean; `pnpm typecheck` 0 errors (both `packages/shared` and
> `apps/web`). Lint/typecheck cover this purely presentational change directly; no store,
> schema, rules, or component logic involved beyond rendering markup and styling.

**Changes made.**

- `apps/web/src/lib/components/Lobby.svelte` — new `<section class="credits">` at the end
  containing a `<ul class="credits-list">` with one entry (`<li>`) for Classic Dungeon Map
  Symbols. The entry displays the work, author (Mark Gosbell), source URL
  (markgosbell.itch.io), and licence (CC0 1.0 Universal) via a `<strong>` title, text
  lines, an `<a href=…>` link, and a `<span class="license">` footer. New CSS rules style
  the list and text (small font, subtle colour, linked text colour matching `--accent`,
  license text smaller and dimmed).
- `apps/web/public/assets/ATTRIBUTION.md` — the `symbols/*.svg`, `doors/*.svg` section
  replaces its standing TODO with the symbol pack's actual provenance: Classic Dungeon Map
  Symbols by Mark Gosbell from markgosbell.itch.io, licensed CC0 1.0 Universal. One line
  retained: the reference to `symbol-catalog.ts` for file-to-kind-id mapping.
- `PLAN.md` — IN-041 retired from §1.1 to §1.2; the upcoming table and execution order
  updated; this entry added.

**Visible behavior changes.** The lobby now displays a credits section at the bottom
listing the Classic Dungeon Map Symbols' author, source, and licence. The attribution
file is corrected for any distribution audit.

**How to verify.** Navigate to the lobby page and confirm the credits section appears at
the bottom with the symbol pack's information; `cat apps/web/public/assets/ATTRIBUTION.md`
and verify the `symbols/*.svg, doors/*.svg` section is filled in with the correct author,
source URL, and licence.

**Deviations.** None.

#### WI-057 — Map token drag is gated on the same ownership predicate as the sheet

> **Verified.** `pnpm lint` clean, `pnpm typecheck` 0 errors, and `pnpm test:all:emulators`
> exited 0 — unit (557 + 271), rules (97), store (88) and e2e (74 passed, 1 skipped — the
> quarantined `portability.spec.ts`) in one chain. The new
> `group-ownership.spec.ts:292` case ran and passed (1.5m).

**Changes made.**

- `apps/web/src/lib/components/VectorMapView.svelte` — `attachDragHandlers`'s
  `pointerdown` now calls `canActOnToken(groups, tokens, myUid ?? '', tokenId, isGM)`
  before starting the drag (`tokenDragging = true`, `draggingIds.add`, `cursor =
  'grabbing'`); when it fails, the token is still selected (`selectedTokenId`, and
  `onSelectActor` for an owned character) but never begins dragging, so the existing
  `if (!tokenDragging) return` guards in `globalpointermove`/`pointerup` already make it a
  no-op — no new early-return logic needed there. `syncSprites` sets the idle cursor to
  `grab`/`pointer` from the same predicate whenever the token is not mid-drag (guarded by
  the same `!draggingIds.has(token.id)` check position already uses, so a live drag's
  cursor is never clobbered mid-gesture). `eventMode` is untouched — it stays `static` for
  every token, since selection must still work for a token this seat cannot move.
- `apps/web/tests/e2e/group-ownership.spec.ts` — new test: a creature grouped so only
  "Owner" owns it can be dragged by Owner but not by Outsider (position readout
  unchanged after a failed drag attempt); a second, ungrouped creature can be dragged by
  the referee but not by a normal seat (DEC-036's referee-only default). Reuses the
  existing `dragCanvas` helper (already exported, previously used only for carve-tool
  gestures) rather than adding a new one.
- `SPEC.md` (§5 gains its "Shipped in WI-057" paragraph, matching §§2–4; SPEC-032's
  status flips **Active → Completed** in both the header and the crosswalk table — every
  section it describes has now shipped), `README.md` (the "What has not moved yet" line
  is replaced with a paragraph describing the gate), `PLAN.md` (this entry; IN-030's row
  moved from §1.1 to §1.2, now that all of WI-054–057 have landed; the upcoming table,
  execution order, and hard-chain note updated). `DECISIONS.md` is untouched: no new
  decision arose — DEC-036 already specified this behaviour in full when it was logged
  during WI-055's planning.

**Visible behavior changes.** A player can no longer drag a token their seat may not act
on (SPEC-032 §3): the cursor reads `pointer` rather than `grab` over such a token, and a
drag attempt leaves it exactly where it was. This is a deliberate capability removal
(DEC-036) — today every token is draggable by anyone who can see it. Selecting a token
(the ring highlight, and raising an owned character's sheet) is unaffected either way.

**How to verify.** `pnpm test:all:emulators`, or manually with two browser contexts: as
the referee, group a creature so only one other seat owns it; confirm that seat can drag
it on the map and a third, non-owning seat cannot (the cursor shows the difference before
you even try). Add a second, ungrouped creature and confirm only the referee can move it.

**Deviations.** None. This closes the WI-054 → WI-055 → {WI-056, WI-057} chain; SPEC-032
is fully shipped.

#### WI-056 — Creature cards become selectable; the quick sheet renders a creature profile

> **Verified.** `pnpm lint` clean, `pnpm typecheck` 0 errors, and
> `pnpm test:all:emulators` exited 0 — unit, rules, store and e2e in one chain, the e2e
> leg reporting **73 passed, 1 skipped** (the skip is `portability.spec.ts`, quarantined
> since before this work). The first run of the new suite caught a fixture bug (see
> Deviations) rather than a product defect; the re-run was fully green.

**Changes made.**

- `apps/web/src/lib/components/EncounterBoard.svelte` — every card is now selectable
  (`selectable`/`role="button"`/`tabindex={0}` unconditional, no longer gated on
  `Boolean(token.ownerSeatId)`), and `selectCard` dispatches `actorIdForToken(token)`
  unconditionally instead of only for an owned character. `pinnedRows`/`rollShortcuts`
  resolve a profile the same actor-keyed way, so a creature's pinned fields and roll
  chips now render exactly like a character's. `cardName`'s creature fallback moved to
  the new shared `creatureLabel` helper (see below) rather than duplicating the
  basename-from-`imageRef` logic inline.
- `apps/web/src/lib/tokens/labels.ts` — new export `creatureLabel(token)`: the id-derived
  label fallback, shared between the board's card title and the quick sheet's header.
- `apps/web/src/lib/components/CharacterDock.svelte` — the largest change. Prop renamed
  `seatId` → `actorId` (no testid depends on its value). New `creatureToken`/`isCreature`
  derived state (SPEC-032 §2's key rule read backwards) and a consolidated `actorToken`
  (replaces the separate `ownTokenId`/`selectedToken`, which resolved identically once a
  creature's own token had to be found by id rather than by `ownerSeatId`). Branches
  added throughout: `myColor` has no `assignedCharacterColor` fallback for a creature
  (DEC-042 — `profile?.color`, possibly `undefined`); the portrait falls back to the
  creature's own token art rather than a seat-derived generated disc; the header name
  falls back to `creatureLabel` and is never renamable for a creature (no seat to
  rename); the "My token" action is hidden for a creature (it already is one); the
  colour swatches and custom-colour input tolerate an unset `myColor`; roll attribution
  omits `ownerUid` for a creature (no owning player).
- `apps/web/src/lib/components/shell/sheets/CharacterSheet.svelte`,
  `apps/web/src/lib/components/RoomShell.svelte` — thread the renamed `actorId` prop
  through; `RoomShell`'s stale "rendering a creature's profile is WI-056" comment updated.
- `apps/web/tests/e2e/helpers.ts` — new exported `tokenIds(page)`, factored out of
  `claimOwnToken`'s inline id-diffing so the new e2e test could reuse it.
- `apps/web/tests/e2e/group-ownership.spec.ts` — new test: a lone creature's card is
  selectable and editable by the referee (no "My token", colour starts unselected, a
  swatch pick persists), stays selectable but read-only for a non-owning seat once
  grouped, and becomes editable for the seat that owns that group.
- `SPEC.md` (§4), `README.md` (two paragraphs), `PLAN.md` (this entry, §2's upcoming
  table and ordering notes), `DECISIONS.md` (DEC-045) — updated in this PR per RULE-018.

**Visible behaviour changes.** A creature's card on the Encounter board is now
clickable/focusable exactly like a character's, opening its profile in the Character
quick sheet (read-only unless the viewer's group owns it or they are the referee). A
creature's quick sheet header shows an id-derived name instead of "Character", has no
"My token" button, and its colour swatches start with none selected until one is
picked. A creature's pinned template fields and roll-chip shortcuts now also appear on
its board card, wherever it has a profile with values.

**How to verify.** `pnpm test:all:emulators`, or manually: as the referee, use "Add
creature", open the Encounter board, click the new creature's card, expand the
Character quick sheet — its fields are editable, there is no "My token" button, and
picking a colour swatch persists. Add the creature to a group and check only that
group's owning seat(s) can edit it; every other seat can still open it, read-only.

**Deviations.** The first `pnpm test:all:emulators` run found a bug in the _new test
fixture_, not the product: the test asserted the "Outsider" seat's group-ownership
checkbox was unchecked without first turning off `RoomSettings.defaultPlayerGroup`
(defaulted to `'first'`), so the referee's own `defaultGroupPatches` effect had already
placed both newly-joined seats as owners of the one group that existed by the time the
assertion ran — exactly the interaction the _sibling_ test in the same file already
guards against by setting the session default to `'unassigned'` first. Fixed by adding
the same guard; the second run was clean. No product code changed as a result.

DEC-045 records a Default-and-notify reading of SPEC-032 §4's wording: read literally,
"belongs to a group the viewer owns" would newly gate _character_ card selectability on
group ownership too, contradicting the already-shipped, already-tested behaviour that a
non-owned character's card is selectable (read-only). Implemented as parity with that
existing behaviour instead — every card selectable, only editing ownership-gated — since
the literal reading would be an untested, unrequested regression to every character card
on the board.

#### WI-055 — Creature ownership, and the selection spine re-keyed to an actor id

> **Verified.** `pnpm lint` clean, `pnpm typecheck` 0 errors, and
> `pnpm test:all:emulators` exited 0 — unit, rules, store and e2e in one chain, the e2e
> leg reporting **72 passed, 1 skipped** (the skip is `portability.spec.ts`, quarantined
> since before this work; `group-ownership.spec.ts`'s three tests all ran and passed).

**Changes made.**

- `packages/shared/src/encounter/ownership.ts` — three new exports and one internal.
  `actorIdForToken(token)` states the SPEC-032 §2 key rule once (`ownerSeatId ?? id`), so
  no caller has to get the fallback direction right by hand. `canActOnToken(groups,
tokens, mySeatId, tokenId, isGM)` is the §3 predicate: a token with an owning seat
  defers to `canSeatActAs` on that seat, a seatless one asks the shorter question via the
  private `tokenIsInOwnedGroup`. `canActOnActor(…, actorId, …)` is the same rule keyed by
  what the selection spine carries. The module header now says why `canSeatActAs` could
  not simply be widened: its inner test resolves a target _seat_, which a creature has
  none of.
- `packages/shared/src/encounter/ownership.test.ts` — 13 new cases across
  `actorIdForToken` and the two predicates: the NPC-in-the-party case (DEC-035), a
  creature in a group the seat does not own, the referee-only seatless-and-ungrouped
  default (DEC-036), unknown ids and empty ids on both faces, the referee's blanket pass,
  a tokenless seat acting as itself, and a character's _token_ id not reading as a
  creature key.
- `apps/web/src/lib/components/RoomShell.svelte` — `selectedSeatId` → `selectedActorId`,
  `dockSeatId` → `dockActorId`; `dockReadOnly` asks `canActOnActor` instead of
  `canSeatActAs`; `selectActor(actorId)` gains the §4 guard, returning before
  `setCurrentCharacter` when a seatless token answers to the id. `CharacterSheet` still
  receives it as `seatId` — the sheet is seat-keyed throughout and WI-056 re-keys it —
  with a comment saying so.
- `apps/web/src/lib/components/EncounterBoard.svelte` — prop `selectedSeatId` →
  `selectedActorId`, `onSelectActor: (actorId: string) => void`, and the card's
  `class:selected` compares `actorIdForToken(token)` rather than `token.ownerSeatId`.
  `selectCard` is left gated on `ownerSeatId`, annotated with what WI-056 turns it into.
- `apps/web/src/lib/components/VectorMapView.svelte` — the same two prop changes; the
  `pointerdown` dispatch is left gated on `ownerSeatId`, annotated the same way; readout
  `data-testid="selected-seat"` → **`selected-actor`** (DEC-044).
- `apps/web/tests/e2e/group-ownership.spec.ts` — the two `selected-seat` assertions
  follow the rename (RULE-005's same-change escape).
- `README.md` — new "Ownership for a seatless actor (SPEC-032 §3)" subsection under Group
  ownership documenting all three exports and the referee-only default; the
  "Selection and drag are still seat-keyed" paragraph replaced with what is now true and
  what is still outstanding; "Enforcement is client-side" names `canActOnActor`; the
  Map ⇄ character sheet section and the introspection-readout list take `selected-actor`.
- `SPEC.md` — SPEC-032 §3 gains its "Shipped in WI-055" paragraph, matching §2's.
- `DECISIONS.md` — **DEC-043** (two predicate faces; an unknown id is not a creature) and
  **DEC-044** (the testid rename), both agent defaults.
- `PLAN.md` — this entry; WI-055's row moved to §3; WI-056/WI-057's blockers marked
  cleared; execution order and the hard-chain note updated.

**Visible behavior changes.** **None.** Every dispatch site is still gated on
`token.ownerSeatId`, so no creature id reaches the spine yet and every predicate answers
identically to `canSeatActAs` for the seat ids that do. The one observable difference is
in the DOM's test-only readout layer: `selected-seat` is now `selected-actor`.

**How to verify.**

- `pnpm --filter @osr-vtt/shared exec vitest run src/encounter/ownership.test.ts` — the
  predicate, including the NPC and referee-only cases.
- `pnpm lint && pnpm typecheck` — the re-key touches three components' prop contracts;
  `svelte-check` is what proves no call site was missed.
- `pnpm test:all:emulators` — the full suite, including `group-ownership.spec.ts`, whose
  two-context flow exercises both the map readout and the read-only/editable sheet split
  that now runs through `canActOnActor`. It is the spec that would have caught a missed
  call site in the re-key, since it asserts the readout before and after a token
  pick-up and then opens a groupmate's sheet from a second context.
- By hand: nothing should differ. Click a character's card or token; the sheet raises,
  "Back to my sheet" behaves as before, and a groupmate's sheet is editable while a
  stranger's is read-only.

**Deviations.** None from the approved scope. Two agent defaults were taken inside it and
are logged: DEC-043 and DEC-044.

#### WI-054 — Profiles are keyed by an actor, not a seat

**Changes made.**

- `packages/shared/src/types.ts` — `ProfileInstance.seatId` → **`actorId`**, with the
  actor-key rule (seat id ⇒ character, token id ⇒ creature) and the `deleteToken`
  ownership note in the doc comment. `CURRENT_SCHEMA_VERSION` 20 → **21**. The `color`
  comment records that SPEC-031's guarantee is scoped to characters (DEC-042).
- `packages/shared/src/schemas.ts` — `ProfileInstanceSchema.seatId` → `actorId`, noting
  the field never reaches storage: it is the document id.
- `packages/shared/src/converters.ts` — `profileInstanceConverter` strips/restores
  `actorId` instead of `seatId`.
- `packages/shared/src/character-color.ts` — `resolveCharacterColor` matches on
  `p.actorId` and is documented as taking a **seat** id, not any actor id (DEC-042).
- `packages/shared/src/migrations/index.ts` — new **v20→v21** step, a no-op on the room
  doc _and_ on stored profiles, with the reasoning spelled out (the key space widened;
  the renamed field was never on disk; cleanup is `deleteToken`'s job, not a migration's).
  `migrateProfile`'s comment now says to apply it to seat-keyed profiles only.
- `packages/shared/src/portability/vttcamp.ts` — `migrateProfileCollection` builds the
  seat-id set from the archive's own `players` collection and backfills a colour only for
  profiles whose id is in it.
- `packages/shared/src/store/campaign-store.ts` — `setProfileValue`/`setProfilePortrait`/
  `setProfileColor` take `actorId`; `deleteToken`'s contract gains the profile deletion.
- `packages/shared/src/store/memory-store.ts` — the three writers key on `actorId`;
  `deleteToken` also deletes `profiles/{tokenId}`.
- `packages/shared/src/store/firebase-store.ts` — same three writers; `deleteToken`
  becomes a `writeBatch` deleting the token and `profiles/{tokenId}` together, so a
  half-applied delete cannot orphan a profile whose only key was the token's id.
- `packages/shared/src/store/campaign-store.contract.ts` — profile predicates read
  `p.actorId`; **three new cases**: a token-keyed profile written and read alongside a
  seat-keyed one (and carrying no colour), `deleteToken` removing the token-keyed profile
  while leaving seat-keyed ones alone, and `deleteToken` on a token with no profile
  removing nothing else.
- `packages/shared/src/encounter/initiative-call.ts`,
  `apps/web/src/lib/components/RoomShell.svelte`,
  `apps/web/src/lib/components/EncounterBoard.svelte` — the three profile lookups match on
  `actorId`. All three still resolve a _seat_; creature selection is WI-055/WI-056.
- Tests updated for the field rename: `character-color.test.ts`,
  `encounter/initiative-call.test.ts`, `apps/web/src/lib/dice/seat-color.test.ts`,
  `apps/web/src/lib/profile/{profile-view,mechanics-agnostic}.test.ts`.
- `packages/shared/src/migrations/index.test.ts` — v20→v21 no-op case, a v19→current walk,
  and the v1-walk assertion moved to 21.
- `packages/shared/src/portability/vttcamp.test.ts` — a token-keyed creature profile
  round-trips identically; no colour is backfilled onto it; the two existing backfill
  cases now seed the seat in `players`, which is what the backfill keys on.
- `README.md` — new "Profiles are keyed by an actor, not a seat" subsection under group
  ownership; the die-colour bullet records the character-only scope.
- `SPEC.md` — SPEC-032 §2 records what shipped (v21, the no-op migration) and DEC-042.
- `DECISIONS.md` — **DEC-042** added.

**Visible behavior changes.** Effectively none in the app: no UI moved, and every
existing profile keeps its document, its key and its colour. Two changes are observable
if you go looking:

- Importing a `.vttcamp` whose `profiles` contains a document with **no matching seat in
  `players`** no longer backfills a colour onto it (DEC-042). Every real character has a
  seat, so this is a malformed-archive case.
- Deleting a token now deletes `profiles/{tokenId}` with it. Nothing writes such a
  document yet — creature profiles arrive with WI-056 — so today this deletes nothing.

**How to verify.**

- `pnpm typecheck` and `pnpm lint` — clean.
- `pnpm test:unit` — 547 shared / 271 web, green (the shared suite needs the emulator for
  `account-recovery.emulator.test.ts`).
- `pnpm test:store` under the emulator — 88 tests, both `MemoryStore` and `FirebaseStore`,
  including the three new actor-key cases. This is the RULE-001 proof.
- `pnpm test:rules` under the emulator — 97 tests, green. `firestore.rules` is untouched.
- In the app: open a character quick sheet, edit a field, pick a colour, roll — the sheet,
  the die colour and the encounter card's pinned rows all still resolve. Export and
  re-import a `.vttcamp` and confirm the profiles come back identical.

**Deviations.** None from the approved scope. Two calls made inside it and logged rather
than assumed: **DEC-042** (the colour guarantee does not follow the key), and the choice
to make `FirebaseStore.deleteToken` a batch rather than two sequential deletes — a batch
because a partial failure would strand a profile with no reachable key, which is the exact
leak this work item exists to close.

#### WI-050 — Character colour is always set

**Changes made.**

- `packages/shared/src/character-color.ts` — **new.** `assignedCharacterColor(seatId)`
  (deterministic FNV-1a pick from `CHARACTER_COLOR_PALETTE`),
  `randomCharacterColor()` (creation-time draw), and `resolveCharacterColor(seatId,
profiles)`, which never answers `undefined`. Exported from
  `packages/shared/src/index.ts`. Covered by `character-color.test.ts`.
- `packages/shared/src/migrations/index.ts` — v19→v20 step (a no-op on the room doc, for
  the v17→v18 reason: `color` lives on a subcollection doc), plus the exported
  `migrateProfile(doc, seatId)` that applies the same derivation to stored documents.
  `CURRENT_SCHEMA_VERSION` 19 → **20** in `types.ts`.
- `packages/shared/src/portability/vttcamp.ts` — `archiveToSnapshot` runs the `profiles`
  collection through `migrateProfile` on both the current-shape and legacy-adoption paths.
  A profile with no usable doc `id` is passed through untouched rather than given a colour
  derived from nothing.
- `packages/shared/src/store/campaign-store.ts` — `setProfileColor`'s third parameter
  narrows from `string | undefined` to **`string`** (DEC-041); `joinRoom`'s contract now
  states that a first join seeds the seat's colour. `setTokenColor` is unchanged.
- `packages/shared/src/store/firebase-store.ts` / `memory-store.ts` — the narrowed
  `setProfileColor` (the `deleteField()` branch and the conditional spread are gone), and
  a first-join-only colour seed in `joinRoom` that still checks for an existing colour
  before writing, so a re-join never repaints.
- `packages/shared/src/types.ts` — `ProfileInstance.color` and `Token.color` doc comments
  rewritten: absence on a profile is now a provenance marker, not a choice; absence on a
  token stays legitimate, because a creature has no character behind it.
- `apps/web/src/lib/dice/seat-color.ts` — `characterDiceColor` returns `string`, delegating
  to `resolveCharacterColor`. `characterDiceColorForUid` still returns `undefined` for an
  unknown seat, which is the one remaining path to `--dice-face`.
- `apps/web/src/lib/components/CharacterDock.svelte` — the **Clear** button and its
  `.clear-color` styles are gone; `myColor` resolves through `resolveCharacterColor` and is
  always a colour, which collapses three `myColor ? … :` conditionals (portrait ref, header
  disc background, the custom picker's value).
- `apps/web/src/lib/components/DiceOverlay.svelte`, `SharedRollStaging.svelte`,
  `SharedRollReadiness.svelte` — the now-unreachable `?? 'var(--dice-face)'` on the
  **seat swatches** removed, and the comments that said `characterDiceColor` returns
  `undefined` for an unpicked seat corrected. The solo-roll tint keeps its `?? ` — that
  one is genuinely reachable.
- Tests: `character-color.test.ts` (new), `migrations/index.test.ts` (v19→v20 no-op plus a
  `migrateProfile` block covering determinism, idempotence and spread),
  `portability/vttcamp.test.ts` (a v19 archive's profiles gain colours on import,
  re-import repaints nobody, a doc with no `id` is left alone; the identity round-trip
  fixture now carries a colour, as any v20 profile does),
  `store/campaign-store.contract.ts` ("sets and clears" → "sets and replaces", plus a new
  case asserting the `joinRoom` seed and that a re-join preserves a chosen colour — run
  against both `MemoryStore` and `FirebaseStore` per RULE-001),
  `dice/seat-color.test.ts`, and `tests/e2e/dice-overlay.spec.ts` (rewritten per RULE-005:
  it now asserts the first roll is already tinted, picks a _different_ swatch so the
  assertion cannot pass by accident, and asserts `token-color-clear` is absent).
- Docs: `SPEC.md` SPEC-031 → **Completed**, with a new §3 subsection recording where the
  backfill actually runs and the store-contract narrowing. `README.md` — the dice-colour
  bullet and the `character` quick-sheet row. `DECISIONS.md` — **DEC-040** and **DEC-041**,
  both agent defaults. `PLAN.md` — IN-025 retired from §1.1 to §1.2, WI-050 moved from §2
  to §3, and the WI-050/WI-054 `ProfileInstance` ordering note rewritten now that WI-050
  has landed.

**Visible behavior changes.**

- **A character now has a colour from the moment its seat exists.** Open the Character
  quick sheet in a brand-new room and one of the six swatches already reads as selected;
  the portrait disc behind the art is already tinted; the very first die you roll is
  already that colour instead of the grey `--dice-face` neutral.
- **The Clear button is gone** from the quick sheet's colour row.
- **A seat that predates this change gets a colour too**, derived from its seat id — so
  existing characters will visibly acquire a colour they never picked, the same one on
  every client. A colour that _was_ picked is untouched.
- Importing a `.vttcamp` exported before this change writes colours onto its profiles;
  re-importing the result changes nothing further.
- Unchanged: creature and scenery tokens, which still have no colour unless one is set.

**How to verify.**

- `pnpm lint`, `pnpm typecheck` — clean (0 errors; the 16 svelte-check warnings are
  pre-existing `state_referenced_locally` notices, none in a touched file).
- `pnpm test:all:emulators` — **ran green, exit 0**, all four stages (`test:unit`,
  `test:rules`, `test:store`, `test:e2e`); Playwright 72 passed / 1 skipped, the skip being
  the pre-existing `portability.spec.ts` quarantine. The two cases that matter here are
  `campaign-store.contract.ts`'s "joinRoom seeds a palette colour for a brand-new seat…"
  (run against both `MemoryStore` and `FirebaseStore`) and `dice-overlay.spec.ts`'s "dice
  render in the color picked on the character quick sheet".
- By hand: create a room, open **Characters** — a swatch is selected before you touch
  anything. Open **Dice**, roll a d20: it is that colour. Back on the sheet there is no
  **Clear** button; pick another swatch and roll again — the dice follow. Export the room
  and re-import it: every character keeps its colour.

**Deviations.**

- **SPEC-031 §3's "backfilled by the migration" is implemented as a resolution rule plus
  an import-time document rewrite, not a bulk document rewrite** (logged as **DEC-040**).
  `migrateRoom` only ever sees the room doc, and — the deciding point — a seat may have no
  profile document at all, since one is created lazily by the first sheet/portrait/colour
  write. A document rewrite therefore could not have delivered §1's guarantee on its own.
  The derivation is deterministic from the seat id exactly as the spec requires; what
  changed is where it is applied.
- **`setProfileColor`'s signature was narrowed to `string`** (logged as **DEC-041**), which
  the spec did not ask for. Leaving the `undefined` overload in place would have left a
  second, invisible Clear button in the store contract. RULE-001's contract suite covers
  the narrowed method against both stores.
- The three seat-swatch `?? 'var(--dice-face)'` fallbacks were removed as part of making
  `characterDiceColor` return `string` — the type change makes them dead code, so this is
  inside the work item rather than an out-of-chain cleanup (RULE-015).

#### WI-049 — `PLAN.md` intake lifecycle: retire scheduled and completed intake rows

**Changes made.**

- `PLAN.md` §1 split into **§1.1 Open and scheduled** (items with Status Open or
  Scheduled — IN-010, IN-011, IN-014, IN-025, IN-027, IN-030, IN-032) and **§1.2 Closed
  intake** (the 25 items whose disposition work item(s) have landed in §3), replacing the
  single ever-growing index table. Each §1.1 row now carries an explicit **Status**
  column (`Open` / `Scheduled`); §1.2 rows carry a **Closed via** column instead, naming
  the work item(s) that closed them. The per-item rationale write-ups below the index
  (`#### IN-nnn`) are untouched — only the two summary tables above them changed.
- `CLAUDE.md` step 1 gained one new paragraph, "Retiring rows," directing future sessions
  to move a row from §1.1 to §1.2 in the same PR that closes its work item, and stating
  that retirement never deletes, reuses or renumbers an `IN-` id (RULE-019).
- `PLAN.md` §2's Upcoming table and its "Execution order" line had the now-closed WI-049
  row/reference removed, and §3's Completed table and this write-up were added.

**Visible behavior changes.** None — this is a documentation-only reorganization of
`PLAN.md` and `CLAUDE.md`. No application code, schema, store contract, or Firebase rule
changed.

**How to verify.** Open `PLAN.md` §1 and confirm: §1.1 lists exactly the 7 items still
Open or Scheduled (IN-010, IN-011, IN-014, IN-025, IN-027, IN-030, IN-032); §1.2 lists
the remaining 25 items, each naming the work item(s) recorded in its `#### IN-nnn`
write-up's "Disposition" line; every `IN-nnn` id from IN-001 through IN-032 appears in
exactly one of the two tables. Confirm `CLAUDE.md` step 1 contains the "Retiring rows"
paragraph between the approval-gate sentence and "### Deceptive triggers, made concrete
for this repo."

**Deviations.** None. The per-item rationale prose was deliberately left in place rather
than also relocated into §1.2, as scoped at the gate — moving 25 write-ups was assessed
as unnecessary surface area for a `low`-effort item whose stated problem (the index table
misrepresenting status) the table split already fixes.

#### WI-052 — Path ⇄ Corridor: the snap indicator shows the band actually being carved

**Changes made.**

- `packages/shared/src/map/vector/primitives.ts` — new exported `targetedBandRect(at,
width, mode)`, on exactly the lines `bandLo` gives every leg and `cornerBlock` gives
  every turn: the width×width square centred in the snapped tile (or the raw point, under
  Free). Reuses the private `bandLo` unchanged; adds no new geometry rule.
- `apps/web/src/lib/map/vector-tools.ts` — `targetedCellFor` narrowed to **Room only**
  (Corridor dropped); new exported `TargetedBand` type and `targetedBandFor(tool, snap,
bandWidth, at)` for **Corridor and Path only**, returning `{ kind: 'rect', ... }` under
  Cell/Half snap (via `vectorMap.targetedBandRect`) or `{ kind: 'circle', at, radius }`
  under Free snap.
- `apps/web/src/lib/map/vector-engine.ts` — `ToolPreviewInput` gains `cursorBand` (a rect
  or circle, or null); `renderToolPreview` draws it with the same `snapCursorColors` fill
  used for `cursorCell`; the snap dot is now suppressed under `cursorBand` too (extending
  WI-048's "a shape indicator supersedes the point" rule).
- `apps/web/src/lib/components/VectorMapView.svelte` — imports `targetedBandFor`; `renderAll`
  passes `cursorBand: targetedBandFor(tool, effectiveSnap(), bandWidth, dragCurRaw ??
hoverRaw)`; new DOM mirror `snapBandText_`/`snap-band-readout` (`x,y @size` for the
  rect, `⌀ size` for the circle), computed in `syncMeasureReadout` alongside the existing
  `snap-cell-readout`.
- Tests: `packages/shared/src/map/vector/primitives.test.ts` and
  `apps/web/src/lib/map/vector-tools.test.ts` cover `targetedBandRect`/`targetedBandFor`
  directly (tile coincidence at width 1, sub-step centring, half-snap, the Free-snap
  circle, and that Room/every other tool stay off it). `apps/web/tests/e2e/map-draw-feedback.spec.ts`
  adds an e2e case exercising the `snap-band-readout` mirror across Cell, Half-derived
  sub-widths and Free snap for both Corridor and Path.
- `SPEC.md` — SPEC-028 marked **Completed**; §6 rewritten so Room keeps the whole-tile
  indicator and Corridor/Path's WI-052 amendment is marked shipped, with the
  `snap-band-readout` mirror documented. `README.md` — the targeted-cell-indicator
  paragraph split in two: Room's unchanged, plus a new paragraph for the Corridor/Path
  band indicator. `PLAN.md` — this entry, and the now-stale "WI-052 follows WI-051"
  ordering note removed.

**Visible behavior changes.**

- Corridor and Path no longer highlight the whole tile under the pointer before a stroke
  starts. Instead they show the actual band that will be carved: at width 1 under Cell
  snap it still looks like the old full-tile square (they coincide), but at any narrower
  width (⅛, ¼, ½) the highlight is now visibly smaller than the tile, centred inside it.
- Under Free snap, Corridor and Path now show a **circle** of the chosen width, following
  the pointer — previously they showed nothing (no tile to highlight) except the plain
  snap dot.
- Room's indicator is unchanged.

**How to verify.** Open a room → Map tools → **Corridor**, Width dropdown at **1**, Cell
snap: hovering the map shows a square filling the whole targeted cell, same as before.
Drop Width to **½**: the square visibly shrinks to a band centred in the tile, with rock
showing on either side. Switch snap to **Free**: the indicator becomes a circle that
follows the pointer at the chosen width (width resets to 2 on the mode switch per
DEC-028 — reselect ½ to see the smaller circle). Select **Path** and repeat — same
behavior. Select **Room** and confirm its indicator is still the plain whole-tile square,
unchanged. Automated: `pnpm lint` and `pnpm typecheck` clean (0 errors), and
**`pnpm test:all:emulators` green end to end** — shared unit 522/522, `apps/web` unit
271/271, rules 97/97, store 84/84, Playwright e2e 72/72 (1 quarantined `test.fixme`
skip, per the pre-existing `portability.spec.ts` quarantine), confirmed in a second full
run after fixing a bug in the new e2e test itself (see Deviations).

**Deviations.** None from the approved SPEC-028 §6 amendment. Two process notes:

- The **first** `pnpm test:all:emulators` run hit an environment failure unrelated to
  this change — the Vite dev server died mid-run (`ERR_CONNECTION_REFUSED` across
  unrelated specs — dice, fog, encounter, presence — starting partway through), most
  likely inherited state from an earlier run of this same command that had been killed by
  a shell timeout before the emulators fully started. Confirmed no orphaned emulator/Vite
  processes remained, then re-ran clean.
- The **second** run surfaced one real e2e failure, but in the **new WI-052 test itself**,
  not the product: it asserted the pre-switch `bandWidth` after changing snap mode,
  without accounting for the existing DEC-028 rule that a snap-mode change
  unconditionally resets the width. Fixed by re-selecting the width after each mode
  switch in the test; a focused re-run (and the final full suite run above) confirmed the
  fix.

#### WI-051 — Path ⇄ Corridor: shared width set, band centred in the snapped tile, squared caps

**Changes made.**

- `packages/shared/src/map/vector/primitives.ts`:
  - `CORRIDOR_WIDTH_OPTIONS = [0.5, 1, 2]` → **`BAND_WIDTH_OPTIONS = [0.125, 0.25, 0.5,
1, 2]`**, now documented as the set Corridor _and_ Path share (SPEC-028 §7).
  - **`bandLo` simplified to the ratified centring rule**: `snapCellCenter(center) −
width / 2`, dropping the `min(step, width)` quantization. That quantization is what
    collapsed `width = ½ · snap = cell` onto a half-cell line and had no honest answer
    at all for ⅛ and ¼.
  - Extracted the Corridor's turn-filling square into **`cornerBlock(at, width, mode)`**
    (unchanged behaviour, now shared) and added **`cappedQuad`**, a segment quad with
    per-end square caps.
  - New **`pathPoly(points, width, backend, mode)`**: `bufferPolyline` verbatim under
    Free; under Cell/Half, cell-anchored points, `bandRect` for axis-aligned pairs,
    `cornerBlock` at interior vertices, and a square-capped quad for diagonals (DEC-038).
    A single clicked point is one cell of path.
- `apps/web/src/lib/map/vector-tools.ts`:
  - `FloorToolOptions.corridorWidth` → **`bandWidth`**, and `width`'s doc narrowed to the
    Carve brush alone.
  - **`CELL_ANCHORED_TOOLS` gains `'path'`**; the `path` collector calls `pathPoly` with
    `opts.bandWidth` instead of `bufferPolyline` with `opts.width`.
- `apps/web/src/lib/shell/map-tool-controller.svelte.ts` — `DEFAULT_CORRIDOR_WIDTH` →
  **`DEFAULT_BAND_WIDTH = { full: 2, half: 0.5, free: 2 }`**; the `corridorWidth` field →
  `bandWidth`; `setSnapMode` carries the new default (DEC-028's unconditional reset is
  unchanged).
- `apps/web/src/lib/components/MapToolbar.svelte` — the select is now `band-width` and
  shows for **Corridor and Path** (`showBandWidth`); the free-form `map-width` number
  input shows for **Carve only**; `BAND_WIDTH_LABELS` gains ⅛ and ¼.
- `apps/web/src/lib/components/shell/MapToolPalette.svelte` — `bind:bandWidth`.
- `apps/web/src/lib/components/VectorMapView.svelte` — Path collects **raw** click points
  (its own `pointerdown` branch, split out of the polygon/wall one) and sets
  `dragCurRaw`; `publishDraft` appends the raw tip for Path so the RTDB centerline stays
  in one space; the preview's placed-vertex dots are drawn at `snapCellCenter` for Path.
- Tests: `primitives.test.ts` (+ a `coveredYSpan` sampler) covers the centring rule at ½
  under both snap modes, a real ⅛ band, and nine `pathPoly` cases;
  `vector-tools.test.ts` asserts Path reads `bandWidth` not `width` and that a
  **right-angle snapped Path differences to empty against the Corridor both ways**;
  `map-tool-controller.test.ts` covers the new defaults; `map-draw-feedback.spec.ts`
  rewrites the corridor-width case for the shared control and adds a snapped
  right-angle Path commit + undo.
- `SPEC.md` — SPEC-028 status, §4's amendment note and §7 marked shipped, plus an "as
  built" paragraph recording the diagonal rule. `README.md` — the fixed-option-set
  paragraph, the sub-tile centring rule, the Path row of the primitive table, the
  cell-anchored list, and Carve as the only organic floor tool. `DECISIONS.md` —
  **DEC-038** (diagonal legs) and **DEC-039** (the `bandWidth` / `band-width` rename).

**Visible behavior changes.**

- The Path tool's `Width` is now a **select** (⅛ · ¼ · ½ · 1 · 2), the same control the
  Corridor uses; the free-form number input is gone from Path and remains only on Carve.
- The Corridor's set gains ⅛ and ¼, and **both tools now default to 2 under Cell and
  Free snap** (was 1), still ½ under Half.
- Under Cell or Half snap the Path is **grid-true**: it lays the Corridor's band, centred
  in the pointed-at tile, whole cells long, with **squared 90° caps** instead of rounded
  ones. Under Free it is unchanged — the round-capped organic ribbon.
- A sub-step width is now **centred in its tile**: `width = ½` under Cell snap leaves a
  quarter-cell of rock on each side, which is deliberately different from `width = ½`
  under Half snap (which fills the half-tile edge to edge). These two were previously
  identical.
- A single Path click now commits one cell of floor rather than nothing.
- The testid `corridor-width` is **renamed `band-width`** (DEC-039).

**How to verify.** Open a room → Map tools → **Path**: the Width control is a dropdown
offering ⅛ ¼ ½ 1 2 and reads 2 under Cell snap. Click two points at a right angle, press
Enter — the carved floor is flush with the grid and its ends are square. Select
**Corridor**, drag the same two points at the same width: the two shapes are the same
floor. Set Width ½ under **Cell** snap and draw — a narrow passage with rock either side;
switch to **Half** snap at ½ and draw — the half-tile fills edge to edge. Automated:
`pnpm lint` and `pnpm typecheck` clean (0 errors), and **`pnpm test:all:emulators`
green end to end** — shared unit 519/519, `apps/web` unit 266/266, rules 97/97, store
84/84, Playwright e2e 71/71 in 14.7 minutes, exit 0. That run includes the two rewritten
`map-draw-feedback.spec.ts` cases (the shared `band-width` control, and a snapped
right-angle Path that commits and undoes).

**Deviations.** None from the ratified scope. Two gaps the ratification did not cover
were defaulted rather than guessed and are logged: **DEC-038** (what a diagonal snapped
Path leg does — DEC-032 pinned Path to the always-cardinal Corridor, which has no
diagonal case) and **DEC-039** (renaming the now-shared control to `bandWidth` /
`band-width`, which moves a `data-testid` and so updates its Playwright spec in the same
change, per RULE-005). SPEC-028 §6's band indicator is **not** in this item — it is
WI-052, and the snap dot/tile indicator behaves exactly as WI-048 left it.

#### WI-053 — Map tools: an Edit/View toggle beside undo/redo, soft-locking the carve and edit tools

**Changes made.**

- `apps/web/src/lib/map/tool-groups.ts` — added `isViewTool(tool)`, reading the
  existing `view` group (`Pan`/`Eye`/`Measure`/`Ping`) that was already documented
  as "everything that reads the map rather than changing it." This is the exact
  partition IN-031's lock gates on.
- `apps/web/src/lib/shell/map-tool-controller.svelte.ts` — added the `MapToolMode`
  type (`'edit' | 'view'`), a `mapMode = $state<MapToolMode>('edit')` field, and
  `setMapMode(mode)`: entering `'view'` forces `activeTool` back to `'pan'` when it
  currently holds a carve/edit tool. `VectorMapView`'s existing tool-change effect
  (`cancelStroke()` on any `activeTool` change) then cancels any stroke already in
  progress — no new cancellation path was needed.
- `apps/web/src/lib/components/MapToolbar.svelte` — new `mapMode`/`onSetMapMode`
  props; a new `Edit`/`View` toggle (`map-mode-edit` / `map-mode-view`) in its own
  `tool-group` (`map-mode-toggle`) beside the existing Undo/Redo group; every tool
  button gets `disabled={mapMode === 'view' && !isViewTool(id)}`, which also hides
  every contextual param panel (Carve/Snap/Width/etc.) once the forced tool switch
  lands on Pan, since those panels are already keyed off `activeTool`.
- `apps/web/src/lib/components/shell/MapToolPalette.svelte` — threads
  `mapMode={controller.mapMode}` and `onSetMapMode={(m) => controller.setMapMode(m)}`
  through to `MapToolbar` (its only call site).
- `apps/web/src/lib/shell/map-tool-controller.test.ts` — new tests: `mapMode`
  defaults to `'edit'`; entering `'view'` while a carve/edit tool is active forces
  `'pan'`; entering `'view'` while a view tool is active leaves it; returning to
  `'edit'` never changes the tool.
- `apps/web/src/lib/map/tool-groups.test.ts` — new test: `isViewTool` is true for
  exactly `pan`/`eye`/`measure`/`ping` and false for every other `MapToolId`.
- `apps/web/tests/e2e/map-draw-feedback.spec.ts` — new e2e case: with Room armed,
  clicking `map-mode-view` snaps the active tool to Pan (visible via
  `vector-tool-pan`'s `aria-pressed`), disables `vector-tool-room`/`vector-tool-carve`
  while leaving `vector-tool-measure` enabled, and a subsequent drag on the canvas
  commits no new floor region; switching back to `map-mode-edit`, re-selecting Room,
  and repeating the same drag does commit one. No existing `data-testid` moved,
  renamed, or removed (RULE-005) — only new ones were added.
- `README.md` — a new paragraph under "Map tools are not referee-only" documenting
  the toggle, what it gates, and that it is per-viewer state, not a permissions
  change.
- `DECISIONS.md` — new **DEC-037** (Default-and-notify, agent default): the lock
  gates tool selection only (not Undo/Redo, not the expanded sheet's occasional
  whole-map actions), and `mapMode` is in-memory only, matching `activeTool`/
  `camera`'s existing non-persistence.
- `PLAN.md` — this entry; §2's WI-053 row removed and the execution order line
  updated.

**Visible behavior changes.** The map tools panel now shows an `Edit`/`View` toggle
beside Undo/Redo. Clicking `View` greys out every draw tool except Pan, Eye, Measure
and Ping, and — if a carve/edit tool was active — switches the active tool to Pan,
which also drops any drag that was in progress and hides that tool's parameter row.
Undo/Redo keep working. Clicking `Edit` re-enables the palette; the active tool is
whatever `View` last left it at (Pan, if it had forced a switch). The toggle is
per-viewer: it does not write to the room, is not visible to other seats, and is
open to every room member exactly as the rest of the toolbar already is (DEC-001 is
unaffected).

**How to verify.** Join a room as any seat → open the Map tools sheet → select
`Room` → click `View`: the tool grid greys out except Pan/Eye/Measure/Ping, and Pan
shows as active. Drag on the canvas — nothing is carved. Click `Edit`, select `Room`
again, drag — a floor region commits as normal. Automated: `pnpm lint`,
`pnpm typecheck`, `pnpm --filter @osr-vtt/web exec vitest run
src/lib/shell/map-tool-controller.test.ts src/lib/map/tool-groups.test.ts` (all
green), and the full `apps/web` vitest suite (263/263 passing). The new e2e case
(`map-draw-feedback.spec.ts`) was run targeted against the Firebase emulator and
passed alongside the file's 9 existing cases (10/10).

**Deviations.** None. The work matched the scope IN-031/WI-053 described; the one
scoping choice made along the way (what exactly "editing functions" covers) is
recorded as DEC-037 rather than silently decided.

#### WI-047 — Encounter board: a group's own "+" card adds a creature straight into that group

**Changes made.**

- `apps/web/src/lib/components/EncounterBoard.svelte`:
  - Added `addCreatureToGroup(group)`: opens the existing `dialogs.pickToken({
mode: 'creature', ... })` picker (same call shape as
    `VectorMapView.addCreature`), builds the picked ref(s) via
    `nextCreatureTypeLetter`/`defaultCreatureRefs`, creates each token through
    `store.createToken` at the `STARTER_DROP_POS = { x: 160, y: 160 }`
    staircase (stepped by `DEFAULT_GRID_CONFIG.cellSize`, the same fallback
    `CharacterDock`'s "My token" flow already uses since the board has no map
    camera — DEC-031), then adds every new token id straight into _that_
    group's `memberTokenIds` via `store.updateGroup`. Unlike the map
    toolbar's `add-creature`, it never calls `createGroup` — a multi-creature
    pick all joins the one group whose "+" was clicked.
  - Rendered a new "+" card (`.add-creature-card`) at the end of each
    **named** group's card row — GM-only, and only in the row's expanded
    (non-collapsed) state; the synthetic Unassigned bin does not get one.
  - New testid: `board-add-creature-{groupId}`. No existing testid moved,
    renamed, or removed (RULE-005).
- `apps/web/tests/e2e/encounter-board-v2.spec.ts` — new e2e case: promotes
  the Unassigned bin into a named group, clicks its "+" card, confirms the
  picker, and asserts the new creature landed in that group (not
  Unassigned, and no second group was created), surviving a page reload.
- `README.md` — one-line note on the Encounter Board's per-group
  add-creature card.
- `PLAN.md` — this entry; §2's WI-047 row removed and the execution order
  line updated.

**Visible behavior changes.** Each named group box on the Encounter Board
now shows a dashed "+" card after its last member card (referee view only).
Clicking it opens the same creature picker the map toolbar's "Add creature"
uses; confirming adds the picked creature(s) directly into that group,
positioned off-camera at the standard starter-drop staircase. The
Unassigned bin does not get this card.

**How to verify.** As the referee: Encounter tab → promote the Unassigned
bin into a named group (double-click its heading, type a name, Enter) →
click the new "+" card at the end of that group's row → confirm the
picker → the new creature's card appears inside that group, and the
Unassigned count is unaffected. Automated: `pnpm test:all:emulators` — full
suite green (507 + 258 unit, 97 rules, 84 store, 69 e2e with the one
pre-existing `portability.spec.ts` quarantine skip), including the new
`encounter-board-v2.spec.ts` case.

**Deviations.** None. The gate anticipated threading a `map` prop through
`RoomShell` for the real map `cellSize`; implementation instead reused
`DEFAULT_GRID_CONFIG.cellSize` directly, matching `CharacterDock`'s
existing "My token" precedent for the same no-camera situation — smaller
diff, no new prop plumbing, called out as alternative (b) in the gate.

#### WI-048 — Map snap indicator: drop the point dot where a cell indicator supersedes it

**Changes made.**

- `apps/web/src/lib/map/vector-engine.ts` — the snap-target dot is no longer drawn
  when a tile or shape indicator (`cursorCell`) is already present (line 1151). A
  comment explains the rationale. Room and Corridor show a cell highlight under Cell
  or Half snap, which already indicates the anchor; redundantly drawing the dot on top
  was visual noise. N-gon and Carve keep the dot (they have no cell highlight);
  Wall/Door/Polygon keep theirs (they use vertex snapping, not cell anchoring).
- `SPEC.md` (SPEC-028 §6) — amended to clarify the new rule: "Where a tile or shape
  indicator supersedes the point, the point is no longer drawn."

**Visible behavior changes.** Room and Corridor tools under Cell or Half snap no longer
show a redundant snap dot in the middle of the cell highlight. The cell highlight itself
(a faintly filled and outlined square) already indicates where the click will land.
N-gon, Carve, Wall, Door and Polygon continue to show the snap dot as before.

**How to verify.** Open a room's map → select Room tool → enable Cell snap → hover
over the map — a cell highlights under the pointer, but no dot appears inside it
(the highlight is sufficient). Switch to N-gon — now the snap dot is visible again
(N-gon has no cell highlight). Automated: `pnpm test:all:emulators` — full suite
green (765 unit, 97 rules, 84 store, 68 e2e with the 1 pre-existing
`portability.spec.ts` quarantine skip).

**Deviations.** None. The change is a one-line conditional, matching the simplicity
IN-029 predicted ("one conditional in `VectorMapView.snapCursorPoint()` or…
`renderToolPreview`").

#### WI-046 — Character quick sheet: token-scale layout, and the header shows/edits the character name

**Changes made.**

- `apps/web/src/lib/components/CharacterDock.svelte`:
  - `.map-defaults` changed from a single flex **row** to a flex **column**, so
    the Token scale control (only rendered once a token is selected) stacks
    below the Snap control instead of sharing a row with it — the two no
    longer compete for width inside the ~300px docked sheet (IN-023). Added
    `flex: 1; min-width: 0` to `.inline input[type='range']` so the slider can
    never overflow its row at any sheet width, and `min-width: 0` +
    ellipsis/`nowrap` to `.dock h2` for the same reason on the header.
  - The hardcoded `<h2>Character</h2>` is replaced with the seat's
    `PlayerSeat.displayName` (`seatName`, resolved the same way
    `EncounterBoard.cardName()` already does), with a double-click-to-edit
    affordance (IN-024): double-click swaps the heading for a text `<input>`
    (`dock-name-edit`, auto-focused and selected via a new `focusAndSelect`
    action); Enter or blurring outside the input commits the trimmed value
    through `store.renamePlayer(roomId, seatId, trimmed)`, Escape discards the
    draft and reverts to the stored name without writing. A no-op (empty or
    unchanged) commit skips the write.
  - Added an `isGM` prop. The edit affordance is gated to
    `canRenameSeat = isGM || myUid === seatId` (DEC-030) — deliberately
    narrower than `canSetOwnToken`/`readOnly`, which group ownership also
    satisfies: a player with a groupmate's sheet open can edit that
    character's _fields_ but not rename its seat.
  - New testids: `dock-name` (the header, present whether or not it's
    editable) and `dock-name-edit` (the inline input). No existing testid
    moved, renamed or removed.
- `apps/web/src/lib/components/shell/sheets/CharacterSheet.svelte` — added and
  forwarded the new `isGM` prop to `CharacterDock`.
- `apps/web/src/lib/components/RoomShell.svelte` — passes its existing
  `isGM` derived value into `<CharacterSheet>`.
- `apps/web/tests/e2e/dice-overlay.spec.ts` — new e2e test: the header shows
  the joined display name, Escape discards an in-progress edit, Enter commits
  one, blurring onto another control (the snap-mode select) also commits, and
  the committed name survives a page reload (round-tripped through the
  store, not just local state).
- `README.md` — the `character` quick sheet's body cell (§ "Session shell —
  quick sheets") updated from "identity header" to describe the editable
  name header and its own-seat-or-GM gate.
- `PLAN.md` — this entry; §2's WI-046 row and brief removed; the execution
  order line and the milestone's completed-item date list updated.

**Visible behavior changes.** The Character quick sheet's header now shows
the character's actual name (the seat's display name) instead of the literal
word "Character", and — for the sheet's own seat or the GM — double-clicking
it opens an inline text editor to rename it. The Token scale slider (shown
whenever the dock seat owns a token) now renders on its own row below the
Snap control instead of beside it, so it no longer runs past the sheet's
right edge in the docked (~300px) layout.

**How to verify.** `pnpm lint` and `pnpm typecheck` both pass clean (0
errors; the 16 pre-existing `svelte-check` warnings are unrelated files,
untouched by this change). `pnpm test:all:emulators` — full suite green: 765
unit tests (507 `packages/shared` + 258 `apps/web`), 97 rules tests, 84 store
contract tests, 68 e2e specs passed (up from WI-042's 67, the one new test
being this WI's `dice-overlay.spec.ts:184`) with the 1 pre-existing
`portability.spec.ts` quarantine skip. Manually: open a room's Character
quick sheet — the header reads the joined name, not "Character";
double-click it, type a new name, press Enter, and it updates everywhere the
name is shown (e.g. the Encounter board card); resize the browser to the
docked sheet's ~300px width with a token selected and confirm the Token
scale slider sits on its own line, fully inside the sheet's border.

**Deviations.** None from the brief in IN-023/IN-024's dispositions. The
e2e regression test (`dice-overlay.spec.ts`) was not separately named in the
intake items but follows RULE-005/the existing suite's pattern of covering
new interactive affordances with a headless test; it only _adds_ testids, per
the Deceptive-trigger carve-out.

#### WI-042 — Carve brush: anchor snapped strokes to cells

**Changes made.**

- `apps/web/src/lib/map/vector-tools.ts` — `carve` added to `CELL_ANCHORED_TOOLS`.
  `buildBrushStroke` now anchors each raw sample to `snapCellCenter(p, opts.snap)`
  before the radius test (`path = points.map(...)`), instead of testing distance from
  the raw/vertex-snapped point directly — this is what makes the cell under the pointer
  always qualify, at any width.
- `apps/web/src/lib/components/VectorMapView.svelte` — `onPointerDown`'s carve branch
  now sets `dragStartRaw`/`dragCurRaw` and seeds `collecting` with `raw` instead of `p`;
  `onPointerMove`'s brush-sampling threshold check compares against `raw` instead of
  `p`. `currentStroke()`, `publishDraft()`, `snapCursorPoint()` and the dimension-chip
  readout already branched on `isCellAnchoredTool(tool)`, so adding `carve` to that set
  was enough to route them correctly with no further changes.
- `apps/web/src/lib/components/MapToolbar.svelte` — added `data-testid="map-width"` to
  the Path/Carve width `<input>` (previously untestable), needed for the new e2e
  regression test to set a width < 2 before dabbing.
- `apps/web/src/lib/map/vector-tools.test.ts` — two new unit tests: a dab near a cell's
  corner at width 1 paints exactly that cell (not nothing), and at width 1.5 paints only
  that cell (not a 2×2 block centred on the nearest corner).
- `apps/web/tests/e2e/map-draw-feedback.spec.ts` — new e2e test: a single click (no
  drag) with the carve brush at width 1 under cell snap now commits one floor region.
- `SPEC.md` (SPEC-028 §2, §6) — Carve added to the cell-anchored tool list, with a
  correction note explaining the WI-030 omission and its two symptoms (IN-012, IN-013);
  the targeted-cell-indicator and snap-dot sections updated to include Carve alongside
  N-gon/the other cell-anchored tools.
- `README.md` — the carve-pipeline stroke-capture step, the Carve tool bullet, the
  "cells, not intersections" paragraph, and the targeted-cell-indicator paragraph all
  updated from "three cell-anchored tools" to four, naming Carve.
- `PLAN.md` — this entry; §2's WI-042 row and brief removed.

**Visible behavior changes.** Under Cell or Half snap, the Carve brush now paints the
cell actually under the pointer: a plain click (a "dab") at brush width ≤ 1 commits one
cell instead of nothing (IN-012), and at any width the painted area is centred on the
cell aimed at rather than on the nearest grid corner (IN-013). Every already-passing
snapped-carve e2e scenario (the freehand drag test, the fog-carve tests) still passes
unchanged, since those strokes span enough cells that the old corner-centred painting
happened to cover the intended area too. The carve brush's snap dot now sits on the
targeted cell's centre (matching Room/Corridor/N-gon) instead of the vertex-snapped
point.

**How to verify.** `pnpm test:all:emulators` — full suite green: 765 unit tests (507
`packages/shared` + 258 `apps/web`), 97 rules tests, 84 store contract tests, 67 e2e
specs passed with the 1 pre-existing `portability.spec.ts` quarantine skip (68 total).
Manually: open a room's map, select Carve, Cell snap, Width 1, and click once without
dragging inside a cell — a single 1×1 floor region commits under the click, not at the
nearest grid corner.

**Deviations.** None from the approved brief. The `data-testid="map-width"` addition
(MapToolbar.svelte) was not named in the brief's in-scope file list; it was needed to
drive the new e2e regression test and falls under RULE-005's carve-out ("adding a new
`data-testid`... is not a trigger on its own") rather than requiring its own item.
The first `pnpm test:all:emulators` run stalled mid-suite with no final summary after a
long idle wait between tool calls, apparently because the session's container was
recycled and killed the detached background process; the retry (tracked properly via
the harness's own background-task supervision instead of a `nohup`-detached shell job)
completed cleanly. A leftover Firestore emulator process from an even earlier
`timeout`-terminated attempt held port 8080 and had to be killed before the retry could
bind it — noted since it needed an out-of-band `kill`, not because it changed anything
in scope.

#### WI-045 — A third `PreToolUse` hook: PLAN.md status write-back reminder

**Changes made.**

- `.claude/hooks/remind-plan-status.sh` (new) — `PreToolUse` hook. Denies a `Bash`
  command matching this repo's long-running scripts (`test:all:emulators`,
  `firebase-emulators.mjs`, `playwright test`, `pnpm … test:e2e`, `pnpm … build` /
  `vite build`, a bare `sleep N` as a CI-poll-loop proxy) or any `Agent` (subagent)
  dispatch, if `PLAN.md`'s mtime is older than 15 minutes. Allows silently otherwise.
- `.claude/settings.json` — registers the new hook under a `Bash|Agent` matcher,
  alongside the two existing `PreToolUse` entries.
- `CLAUDE.md` — harness-configuration section updated: "two hooks" → "three hooks",
  new bullet for `remind-plan-status.sh`, "exactly two" → "exactly three" `PreToolUse`
  hooks registered.
- `DECISIONS.md` — **DEC-016** annotated in place (not edited away, per RULE-019) noting
  it is superseded in part by the new entry. **DEC-029** (new) records the reopening:
  the hook-count change itself was pre-approved by WI-045's own gate note; the specific
  detection design (deny-not-warn, the matched command patterns, the 15-minute
  freshness window) is logged as an agent default.

**Visible behavior changes.** A long-running `Bash` command (full emulator suite,
Playwright/e2e, a build, or a `sleep`-based CI poll) or an `Agent` dispatch now fails
with a `PreToolUse` deny if `PLAN.md` hasn't been written to in the last 15 minutes,
naming the specific write-back expected. Everything else — short commands, edits,
git operations — is unaffected.

**How to verify.** Manually exercised (mirroring WI-028's hook verification), piping
synthetic `PreToolUse` JSON envelopes into the script directly:
stale `PLAN.md` + `pnpm test:all:emulators` → deny; fresh `PLAN.md` + same command →
allow (no output); stale `PLAN.md` + `pnpm lint` (not a matched pattern) → allow; stale
`PLAN.md` + `Agent` dispatch → deny; fresh `PLAN.md` + `Agent` dispatch → allow; stale
`PLAN.md` + a `sleep`-loop command → deny. All six matched the expected
`permissionDecision`. No automated test suite covers `.claude/hooks/*` — consistent
with the other two hooks, which are also manually verified only.

**Deviations.** None from the approved gate. Two implementation-detail choices (command
pattern list, 15-minute threshold) weren't specified in WI-045's one-line brief and are
logged as agent defaults in DEC-029 rather than re-gated, consistent with the
Default-and-notify tier. Creating the hook file and `chmod +x`-ing it were each held by
the environment's permission classifier and required explicit user approval before
proceeding — noted here since it's an unusual friction point for this class of change,
not because it changed what shipped.

#### WI-043 — `RULE-AMENDMENT`: RULE-018's unenforceable ordering clause

**Changes made.**

- `RULES.md` — RULE-018 retitled from "Docs move first" to "Docs and code move
  together". Dropped the unenforceable sentence ("Documentation is updated before
  implementation, never after") and kept only the checkable one: affected documents
  land in the **same pull request** as the code change. Standalone commit, prefixed
  `RULE-AMENDMENT:` (RULE-017), merged via PR #67, commit `0988ef0`.

**Visible behavior changes.** None to the app. `RULES.md`'s stated text for RULE-018
changes; no hook, build, or runtime behavior is affected — the ordering clause was
already unenforced by tooling.

**How to verify.** `RULES.md` § RULE-018 reads "Docs and code move together" with no
ordering claim; `git log --grep RULE-AMENDMENT` shows commit `0988ef0`.

**Deviations.** This entry itself is the deviation being corrected: PR #67 amended
`RULES.md` but never updated `PLAN.md`'s tracking to move WI-043 out of Upcoming, so
the ledger read as still-pending after the work had shipped. Backfilled here rather
than re-litigated, per RULE-018 itself (docs and code — including process docs — move
together). While correcting this, also fixed a second stale cross-reference the same
PR missed: `CLAUDE.md` step 2 still quoted the removed "documentation is updated
before implementation, never after" sentence as if it were current RULE-018 text;
reworded to match the amended rule.

#### WI-032 — Fix token image loading; fail visibly when it can't be fixed

**Changes made.**

- `apps/web/src/lib/tokens/texture-load.ts` (new) — `loadImageElement(src)` loads via a
  plain `HTMLImageElement` (`crossOrigin = 'anonymous'`) instead of `PIXI.Assets.load`,
  so an extensionless/query-string URL that Pixi's parser-based loader rejects now loads
  the same way the character sheet's `<img>` already does.
- `apps/web/src/lib/tokens/texture-load.test.ts` (new) — unit tests for
  `loadImageElement`'s resolve/reject paths against a stubbed `Image` global.
- `apps/web/src/lib/components/VectorMapView.svelte`:
  - `loadTokenTexture` rewritten to use `loadImageElement`, wrapped in `try`/`catch`.
  - On failure (a host with no CORS headers — not fixable client-side): the sprite gets a
    distinct placeholder texture (`brokenImageTexture`, an X-on-dark-square, lazily built
    and cached via `engine.app.renderer.generateTexture`) and a small warning badge
    (`syncBrokenImageBadges`, mirroring the existing `syncAwayBadges` idiom), tracked by a
    new `brokenImageIds: Set<string>`. `console.warn`s the failing ref.
  - `refsByToken`'s existing ref-change gate (in `syncSprites`) now also clears
    `brokenImageIds` for that token, so switching a token's image retries.
  - `brokenTokenCount` (`$state`) mirrors `brokenImageIds.size` and is exposed as a new
    `broken-token-count` testid, following the same "Pixi-drawn state needs a DOM
    readout for tests" convention as `stroke-dimensions`/`snap-cell-readout`.
- `apps/web/tests/e2e/token-image-load.spec.ts` (new) — covers both causes via
  `page.route` fixtures (no real network dependency): an extensionless/query-string URL
  now loads as a token; a CORS-less host ends up with `broken-token-count: 1` and the
  console warning, instead of a silent white square.

**Visible behavior changes.**

- A token image URL with no recognized file extension (a common shape for pasted
  CDN/blog links) now loads correctly instead of showing a blank white square.
- A token image that genuinely cannot be displayed (host sends no CORS headers) now
  shows a distinct broken-image placeholder with a small warning badge, and logs a
  console warning naming the failing ref, instead of an indistinguishable white square.
- No change to any token whose image already loaded successfully.

**How to verify.**

- `pnpm test:all:emulators` — full suite green: unit (507 + 256 tests), Firestore/RTDB
  rules (97), `CampaignStore` contract (84), and all 66 runnable e2e specs (1
  `test.fixme`-quarantined per the existing `portability.spec.ts` note), including both
  new `token-image-load.spec.ts` tests.
- Manually: Assets → By URL, paste an image URL with no file extension (e.g. a share
  link ending in a numeric id) → Save → Add creature → Saved URLs tab → pick it → token
  renders correctly on the map.
- Manually, for a host without CORS headers (most third-party image hosts that aren't a
  CDN configured for it — this includes the originally reported
  `youseethis.blog/wp-content/uploads/...png`): same flow ends with a dark placeholder
  token bearing a small orange warning badge, and a console warning naming the URL,
  rather than a plain white square.

**Deviations.**

- **The reported URL (`youseethis.blog/...png`) is the CORS case, not the
  extension case.** Confirmed with the user before implementation: the URL ends in
  `.png`, a recognized extension, so cause 1 doesn't apply to it. This work item does
  **not** make that specific image display — it makes the failure visible instead of a
  silent white square, per the brief's original framing ("do not promise a fix for (2)").
  The extension fix is real and fixes a different, independently-reachable failure of the
  same code path.
- **`onCanvasDrop`'s missing `color` on token creation stayed out of scope**, as the
  brief specified — it turned out to be true of every token-creation path in the file
  (including "My token"), not something this fix's diff touches.
- **The first e2e attempt at the CORS fixture didn't actually test anything.**
  `page.route`-fulfilled responses aren't subject to Chromium's real header-based CORS
  check the way a genuine server response is — verified with an isolated probe
  (`crossOrigin="anonymous"` against a route-mocked response with no ACAO still fired
  `onload`). Fixed by reproducing the real-world split directly at the mock: a
  `crossOrigin="anonymous"` fetch sends an `Origin` header a plain `<img>` doesn't, so the
  route handler aborts only the request carrying one. This is a test-infrastructure
  detail, not an app-code change.
- **A full-suite run also hit an unrelated environment flake once** (a stale dev server
  left over from an earlier interrupted run got reused instead of a fresh one spawning,
  then died mid-suite) — not a code issue; a clean rerun after killing stray processes
  was fully green.

#### WI-029 — App Check enforcement

**Changes made.**

- **None in the repository.** Console-only, per the gate: Firebase console → App Check →
  Cloud Firestore → Enforce; repeated for Realtime Database. No file in this repository
  changed.
- `SPEC.md` — SPEC-025's status line moved from **Active** to **Completed**, since §2 (the
  last outstanding item cited there) is now done. See **Deviations** for §5.
- `PLAN.md` §1 — IN-002's disposition row still points at WI-029 (index rows are not
  rewritten on completion); the item's own detail section is unchanged.

**Visible behavior changes.**

- **Firestore and Realtime Database now reject any request without a valid App Check
  token.** A client that hasn't shipped the App Check SDK (SPEC-025 §2's `[AGENT]`
  half, already live) will be denied rather than served. No change to normal in-app
  behavior for the deployed client.
- No UI, build, or CLI output change.

**How to verify.**

- Firebase console → App Check → APIs tab: both Cloud Firestore and Realtime Database
  read **Enforced**.
- Deployed app: create a room, join from a second browser/device, move a token, roll a
  die — all four work.

**Deviations.**

- **SPEC-025 §5 (quota headroom monitoring) is not a discrete, closeable action** — it's
  ongoing console observation, not a step with a done state. Moving SPEC-025 to
  **Completed** treats §5 as a standing practice rather than a blocking outstanding item,
  consistent with §1/§3/§4 already having shipped. Flagged here since SPEC.md's prior
  "Active" line named both §2 and §5 as outstanding.

#### WI-044 — Workflow hardening

**Changes made.**

- `CLAUDE.md` step 1 — the classification list gains **Investigation** as a named fourth
  category (IN-016), stating that it produces findings rather than edits, runs inside a
  host work item, and turns each finding into its own intake item (DEC-027). The
  **Deceptive** bullet now reads "changes the contract of" rather than "touches".
- `CLAUDE.md` step 1, "Deceptive triggers" — rewritten (IN-015). Every trigger is
  restated as a contract change: a new or altered store method rather than anything behind
  the store; the type or meaning of a stored field rather than the schema files; what a
  coordinate, layer or pipeline stage _means_ rather than the Pixi stack and carve
  pipeline wholesale; a `data-testid` moved, renamed or removed rather than any testid.
  Adds a **"touches but does not redefine"** carve-out, a blockquote recording why the
  wording changed with IN-003–006 and IN-014 as the worked contrast, and a restatement
  that "classify conservatively" still governs borderline items.
- `CLAUDE.md` step 4 — the required work-item fields now include **model**.
- `CLAUDE.md` step 7 — opens with the instruction to draft during step 6 and **finalise
  only once the suite has passed** (IN-019), citing WI-030's half-cell claim as the
  worked failure.
- `CLAUDE.md` "Work-item conventions" — the model-target bullet now records a **release
  line** (`opus` / `sonnet` / `haiku`) with what each is for, replacing the stale
  `claude-opus-4-8` / `claude-sonnet-4-6` pins and the parenthetical hedging them
  (IN-018).
- `PLAN.md` §1 — converted from three wide five-column tables to a 21-row index table
  plus one section per item (IN-021). Batch headings, their preambles, the "Not findings,
  deliberately" paragraph and IN-002's classification note are all preserved; IN-002's note
  moved under IN-002 itself and its "listed below" changed to "listed in §2" to stay
  accurate in the new layout. A new preamble note records that IN-001 – IN-021 were
  classified under the pre-WI-044 trigger wording.
- `PLAN.md` §2 and §3 — both tables gain a **Model** column between Agent and Effort,
  matching the archives (IN-018). Every upcoming row is backfilled; WI-029 reads `—`
  because it is `[HUMAN]`. WI-044 moved from §2 to §3.
- `PLAN.md` §2 — the execution-order sentence now names WI-043 and WI-045, which it had
  omitted, and the cleared-gate paragraph is corrected from two to four.
- `PLAN.md` §5 — the completion-summary template gains a one-line note that the summary
  is finalised after the suite passes.
- `.claude/commands/work-item.md` — step 1 carries the four-category vocabulary, the
  "changes the contract of" test and the Investigation handling; step 4 requires the model
  field. See **Deviations**.

**Visible behavior changes.**

- **No application behaviour changed.** No file under `apps/`, `packages/`, `firebase/` or
  `scripts/` was touched. No schema, rule, test or build change.
- **`/work-item` behaves differently in future sessions.** It now asks for four
  classifications rather than three, applies the contract-change test, and requires a model
  target on every new work item.
- **`PLAN.md` §1 reads differently.** Intake items are sections with an index table above
  them rather than paragraph-filled table cells. No item's content changed.
- **Both `PLAN.md` work-item tables have an extra column.**

**How to verify.**

- `git diff main -- CLAUDE.md` — confirm four edits: the step 1 category list, the trigger
  list, step 4's field list, step 7's opening, and the model-target bullet.
- Open `PLAN.md` §1 and confirm the index table lists IN-001 – IN-021 and that each has a
  matching `####` section below it.
- `grep -c '^| \*\*WI-' PLAN.md` → **18**: 15 upcoming rows plus 3 completed, each with a
  Model cell.
- `grep -c '^| IN-0' PLAN.md` and `grep -c '^#### IN-' PLAN.md` → **21 each**, so every
  index row has a matching section and vice versa.
- `grep -n 'claude-opus-4-8\|claude-sonnet-4-6' CLAUDE.md` → exactly two hits, both inside
  the new model-target bullet, which cites them as the stale pins it replaces. No hit is a
  live model target.
- Run `/work-item` with a trivial request and confirm the triage offers Investigation as a
  category and stops at the four-section gate without editing anything.
- `pnpm lint && pnpm typecheck && pnpm build` — unaffected; no source file changed.

**Deviations.**

1. **`.claude/commands/work-item.md` was edited**, though the brief said "touches
   `CLAUDE.md` and `PLAN.md` only". The command file duplicates the classification
   vocabulary and the triage instructions, so leaving it would have shipped a slash command
   that tells you to classify into three categories on the same commit that defines four —
   the exact drift the WI-028 refactor exists to prevent. Made under the RULE-015
   exception. The brief's "only" clause is aimed at `RULES.md` ("the moment it edits
   `RULES.md` it stops being a work item and becomes an amendment"), and **`RULES.md` was
   not touched.**
2. **WI-037 had no model in the brief's proposed allocation** — it lists WI-031 and WI-043
   under `haiku` and omits WI-037. Assigned **`opus`**: it is a rules change that gates five
   downstream items and has to scope a golden rule against work not yet built, unlike
   WI-043 whose amendment is already fully specified. Reversible by editing one table cell.
3. **The execution-order sentence was rewritten**, which the brief did not ask for. It read
   _WI-031 → WI-032 → WI-042 → …_, omitting WI-043 and WI-045 entirely while the table
   above it placed them between WI-032 and WI-042. Removing the completed WI-044 required
   touching the paragraph regardless, and leaving two contradictory orderings in one section
   would have re-created the defect IN-021 was raised about.
4. **IN-002's classification note moved and lost two words.** It sat as a floating paragraph
   after the audit table and now sits under IN-002; "It is listed below" became "It is
   listed in §2", because in the new layout there is no longer a table below it to refer to.
5. **A preamble note was added to §1** recording that IN-001 – IN-021 were classified under
   the old "touches" wording. IN-021 specified no content changes, and none were made — but
   IN-015 changes the trigger wording in the same commit, which would otherwise leave
   rationales like IN-002's "Touches **auth** — a Deceptive trigger by name" reading as
   though they had been written against the new list.
6. **`PLAN.md` §5's completion-summary template gained a line** about post-verification
   finalisation. IN-019 named only `CLAUDE.md` step 7; the template is the other place the
   summary's shape is specified, and omitting it would have left the two disagreeing.

#### WI-030 — Snap-aware carve geometry

**Changes made.**

- `packages/shared/src/map/vector/snap.ts` — added `snapCellCenter`, `snapAngle` and
  `snapSpan`. `snapSpan` deliberately floors at one step where `snapScalar` may return
  zero; that floor is what makes "a click with no drag is one cell" fall out of the
  geometry instead of needing a special case per tool. Existing helpers untouched.
- `packages/shared/src/map/vector/primitives.ts` — added `cellRectPoly` (inclusive
  whole-cell rectangle, free mode falling through to `rectPoly`) and `ngonPoly`
  (across-flats sizing, face-normal rotation, layered on `regularPoly`, which is
  unchanged because it is also the circular-wall utility). Rewrote `bandLo` to centre a
  corridor band on the targeted cell quantized to `min(step, width)`; added `bandSpan` so
  a snapped corridor's length is whole cells too; `corridorPoly` now takes a
  `VectorSnapMode` instead of a boolean and decides leg existence from the **snapped
  cells** rather than raw coordinates. Exported `NGON_SIDE_OPTIONS` and
  `CORRIDOR_WIDTH_OPTIONS`.
- `apps/web/src/lib/map/vector-tools.ts` — `FloorToolOptions` gained `corridorWidth`
  (separate from the Path/Carve `width`). `buildFloorStroke` dispatches room/corridor/ngon
  onto the new builders. Added `CELL_ANCHORED_TOOLS` / `isCellAnchoredTool` and the pure
  `targetedCellFor` (extracted so the indicator is unit-testable without Pixi).
  `strokeMeasureText` takes the snap mode and reports the committed size; the n-gon now
  reads `⌀ <diameter>` rather than `radius: <r>`.
- `apps/web/src/lib/components/VectorMapView.svelte` — added `dragStartRaw`/`dragCurRaw`/
  `hoverRaw` alongside the existing snapped points, threaded raw points through
  `onPointerDown`/`Move`/`Up`, and reset them everywhere the snapped pair is reset.
  `movedFar` now measures the raw pointer. The snap dot follows the real anchor for
  cell-anchored tools. New hidden `snap-cell-readout` mirror.
- `apps/web/src/lib/map/vector-engine.ts` — `ToolPreviewInput.cursorCell`, drawn in
  `renderToolPreview` as a faint fill plus outline in the existing `snapCursorColors`
  palette, under the snap dot.
- `apps/web/src/lib/shell/map-tool-controller.svelte.ts` — `DEFAULT_CORRIDOR_WIDTH`,
  `corridorWidth` state, `setSnapMode()`; `sides` default changed `6 → 1` (circle).
- `apps/web/src/lib/components/MapToolbar.svelte` + `shell/MapToolPalette.svelte` — the
  two selects (`ngon-sides`, `corridor-width`), a `map-snap-mode` testid on the snap
  select, `onSetSnapMode` in place of a direct binding, and `showWidth` narrowed to
  Path/Carve.
- Docs: `SPEC.md` (SPEC-028 Completed, SPEC-029 and SPEC-030 Active, index updated),
  `README.md` (carve pipeline + tools), `DECISIONS.md` (DEC-021 – DEC-028), `PLAN.md`
  (IN-003 – IN-014, WI-030 – WI-041).
- Tests: `snap.test.ts` (+13), `primitives.test.ts` (+18), `vector-tools.test.ts` (+13),
  `map-tool-controller.test.ts` (+2), `map-draw-feedback.spec.ts` (+3 e2e).

**Visible behavior changes.**

- Snapped Room, Corridor and N-gon strokes land on **cells** rather than grid
  intersections. Every snapped stroke of those three tools moves compared with before,
  and a Room or Corridor also **grows**: because both end cells are now included, a
  rectangle is up to one whole cell larger in each axis than the vertex-rounded one the
  same drag used to produce. Two carves that previously left a gap can now abut and
  union into a single region — `fog.spec.ts`'s two-region fixture had to be moved apart
  for exactly this reason.
- Room: a click with no drag starts a 1×1 cell instead of a zero-area rect; the shape
  grows a whole cell at a time.
- Corridor: the free-form Width number input is replaced by a **½ / 1 / 2** select whose
  value resets when the snap mode changes.
- N-gon: the Sides number input (1–24) is replaced by a **Circle / 3–8** select, and the
  default is now **Circle**, not a hexagon. Sides 9–24 are no longer reachable (DEC-023).
- N-gon orientation now follows the drag direction, snapped to the cardinals (cell), the
  eight compass points (half), or left raw (free).
- Room and Corridor highlight the targeted cell on hover, before any button is pressed.
- The dimension chip reports the committed size under snap, and the n-gon reads
  `⌀ 30 feet` where it used to read `radius: 15 feet`.
- Path and Carve are unchanged; Wall, Door and Polygon still snap to grid intersections.

**How to verify.**

`pnpm lint && pnpm typecheck`, then `pnpm test:all:emulators`. By hand in `pnpm dev`, on
the Map view with the Map tools sheet open:

1. N-gon, Circle, snap Cell, drag: a circle centred in the cell you started in with a
   whole-cell diameter. Switch to 4 and drag east — a grid-aligned square. Drag north-east
   under snap Half — the flat face lands on the diagonal.
2. Corridor, snap Half: the width select shows ½ and the corridor fills exactly the
   half-cell under the pointer. Switch to Cell — the width resets to 1 and it fills exactly
   one cell.
3. Room, snap Cell: click without moving, and the chip reads `10 × 10 feet`; click again to
   commit a single cell. Drag instead, and it grows a cell at a time.
4. Hover with Room or Corridor selected under Cell or Half snap — the targeted cell is
   highlighted before any button is pressed. Under Free snap it is absent.

**Deviations.**

- **`strokeMeasureText` was changed beyond the approved plan.** The plan did not mention
  it. Left alone, the chip would have reported the raw drag distance while the tool
  committed a cell-quantized shape — a readout that disagrees with what lands. Taking the
  snap mode and reporting the committed size was required to avoid shipping that
  regression (RULE-015 exception).
- **The snap dot was moved, not just supplemented.** The plan had the cell highlight drawn
  under an unchanged dot. But for the three cell-anchored tools the dot was sitting on a
  grid corner that no longer means anything to them, so it now follows the real anchor.
  The N-gon has no cell highlight, so this is its only corrected affordance.
- **`movedFar` now measures the raw pointer** rather than the snapped one. Under cell
  anchoring the snapped comparison answers the wrong question — it reads false for a
  deliberate drag inside one cell and true for a twitch across a cell line.
- **`corridorPoly` decides leg existence from snapped cells.** Not in the plan, but
  required: once the tool hands over raw points, a corridor dragged "straight" carries a
  little cross-axis drift, and the old raw comparison read that as a turn and grew a
  spurious one-cell stub off the end.
- **A `map-snap-mode` testid was added** to the previously untestid'd snap select, so the
  e2e specs can drive it (RULE-005 is unaffected — nothing moved).
- **`publishDraft` sends raw endpoints for the cell-anchored tools.** The RTDB draft
  carries the centerline, never the resolved shape (WI-B call B4), and the snapped pair
  can now sit half a cell off the shape it is previewing — so peers were being shown a
  worse approximation than the raw pointer gives.
- **`NGON_SIDE_OPTIONS` / `CORRIDOR_WIDTH_OPTIONS` live in `primitives.ts`**, not
  `vector-tools.ts` as planned. The geometry owns what it can build, and the toolbar,
  the controller and the tests then read one list through the `vectorMap` namespace.
- The IN-007 audit found three real defects. Per DEC-027 they are logged as IN-012 – IN-014
  and **not fixed here**.

#### WI-031 — Move Token scale to Character quick sheet

**Changes made.**

- `apps/web/src/lib/components/CharacterDock.svelte` — Added `selectedToken` derived
  state (filtered from tokens by seatId), `handleResizeToken` function that calls
  `store.resizeToken()` directly, and token scale control UI in the Map defaults section
  (after the Snap select). Three testids moved verbatim: `token-scale-control`,
  `token-scale-slider`, `token-scale-value`. Input disabled when `readOnly = true`.
- `apps/web/src/lib/components/MapToolbar.svelte` — Removed token scale control UI block
  (lines 382-398), removed `onResizeToken` prop and callback, removed `selectedToken` prop
  and import of unused `Token` type.
- `apps/web/src/lib/components/shell/MapToolPalette.svelte` — Removed `selectedToken` prop
  passing to MapToolbar, removed `onResizeToken` prop passing.

**Visible behavior changes.**

- Token scale slider is now in the Character sheet's Map defaults section, visible whenever
  that seat has a token. Control is disabled when viewing another character's sheet
  (`readOnly = true`).
- Token scale slider is no longer in the Map toolbar's tool-group. Players no longer need
  the Map tools sheet open to resize their token.
- Resizing a token via the Character sheet now works regardless of whether the Map view is
  mounted (previously failed when map was unmounted because `onResizeToken` was NOOP).

**How to verify.**

- Character sheet visible: token exists, slider appears under Snap control. Drag slider →
  token size changes on map (if map is visible) or persists (if map is not).
- Encounter board (map unmounted): Character sheet visible with token scale slider. Drag
  slider → return to map view, token size is updated.
- Map tools sheet (old location): no token scale control present.
- e2e: `token-scale-control` testid now appears in CharacterDock when seat has a token, not
  in MapToolbar. `shell-navigation.spec.ts` line 177 test expectation may need update.
- `pnpm test:all:emulators` passes.

**Deviations.**

- **Always call store directly, not through map controller.** The plan considered calling
  `mapCtrl.onResizeToken` when the map is mounted, but that would resize the map-selected
  token rather than the character's own token. Instead, always call `store.resizeToken()`
  with the character's token ID. This is simpler and correct: the character sheet always
  resizes that character's token, regardless of what's selected on the map.

#### WI-028 — Documentation refactor

**Changes made.**

- `docs/archive/VTT_Master_Plan.ORIGINAL.md` — **new.** Byte-identical copy of the
  pre-split Master Plan (md5 `e75d27b3d3e1a7bb30bb7f1e1efcda75`). Immutable (RULE-020).
- `RULES.md` — **new.** Part I §1 (golden rules) and §2 (trust/backend) as
  `RULE-001`…`RULE-014`, plus `RULE-015`…`RULE-020` covering process (out-of-chain
  changes, one-session-one-item, amendment separation, docs-with-code, ID reuse, archive
  immutability). Carries the mandated amendment-ceremony header.
- `README.md` — **new.** Part II verbatim (11 subsystem sections, source order kept, Part
  II numbers retained in headings), plus Part I §3 repo map, §4 dev commands and the
  proxy trap, plus front-matter provenance and the companion-asset list.
- `SPEC.md` — **new.** Part III as `SPEC-001`…`SPEC-027`, each with a status of Active /
  Completed / Superseded, a status vocabulary, an index, and a permanent `R`-number
  crosswalk. Superseded specs retained in place naming their successors.
- `PLAN.md` — **new.** Intake triage (`IN-001`, `IN-002`), upcoming work items, completed
  work items, milestone archive index, and templates for `external-agent` briefs and
  completion summaries.
- `DECISIONS.md` — **new.** Parts V and VI as Open / Closed / Postponed, `DEC-001`…
  `DEC-020`. Locked defaults and the vector-map decision log preserved verbatim as
  tables (format exception, DEC-014).
- `docs/archive/PLAN-COMPLETED-{v2-core,vector-map,addendum-c,access-lifecycle}.md` —
  **new.** Four closed milestones (DEC-007).
- `CLAUDE.md` — **rewritten.** `@`-imports `RULES.md` and `DECISIONS.md`; routes to
  `README.md`/`SPEC.md`/`PLAN.md` as on-demand reads; documents the eight-step intake→gate
  →execute chain, ID schemes, and Part 0's work-item conventions.
- `docs/VTT_Master_Plan.md` — **replaced with a stub** pointing at the five files, with
  guidance for resolving old `R`/`WI`/"Part II §n" citations.
- `.claude/settings.json`, `.claude/hooks/guard-protected-paths.sh`,
  `.claude/hooks/guard-git-push.sh`, `.claude/commands/work-item.md` — **new.**
- `.prettierignore` — added `docs/archive/` (see Deviations).

**Visible behavior changes.**

- **Documentation locations moved.** `docs/VTT_Master_Plan.md` is now a stub; its content
  lives in five root files. Any bookmark, link or habit pointing at the Master Plan lands
  on the signpost.
- **New harness behaviour in Claude Code sessions.** Two `PreToolUse` hooks now deny:
  edits to `docs/archive/**`; `git commit` touching `RULES.md` without a
  `RULE-AMENDMENT:` prefix; `git push --force` in any spelling; and any `git push`
  targeting `main`. A `/work-item` slash command is available. Ten read-mostly git/`gh`
  commands no longer prompt.
- **No application behaviour changed.** No file under `apps/`, `packages/`, `firebase/`
  or `scripts/` was touched. No schema, rule, test or build change.

**How to verify.**

- `md5sum docs/archive/VTT_Master_Plan.ORIGINAL.md` → `e75d27b3d3e1a7bb30bb7f1e1efcda75`,
  matching `git show 440c01d:docs/VTT_Master_Plan.md | md5sum`.
- `ls RULES.md README.md SPEC.md PLAN.md DECISIONS.md` — all five present.
- Open `SPEC.md` and confirm the crosswalk resolves a citation you remember, e.g.
  `R24.1` → `SPEC-025 §1`.
- Test the hooks:
  `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"'"$PWD"'/docs/archive/x.md"}}' | .claude/hooks/guard-protected-paths.sh`
  → prints a `deny` decision;
  `echo '{"cwd":"'"$PWD"'","tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | .claude/hooks/guard-git-push.sh`
  → prints a `deny` decision.
- Run `/work-item` with a trivial request and confirm it stops at the four-section gate
  without editing anything.
- `pnpm lint && pnpm typecheck && pnpm build` — unaffected; no source file changed.

**Deviations.**

1. **The `RULES.md` write-guard could not be implemented literally.** A `PreToolUse` hook
   on `Write`/`Edit` cannot see a commit message. The guard is split: `docs/archive/**` is
   denied at write time unconditionally; `RULES.md` is denied at _commit_ time without the
   prefix. Full reasoning in DEC-016.
2. **`.prettierignore` gained `docs/archive/`** — an out-of-chain change made under the
   RULE-015 exception. Without it, `pnpm format` rewrites the immutable baseline through
   Bash, bypassing the write-time hook and corrupting the reconciliation reference.
3. **Milestone boundaries were an agent judgement** within the user's delegation
   ("as it makes sense based on the shape and size"). Four boundaries drawn on the
   document's own structural seams; DEC-007.
4. **Two additions beyond the specified scope:** `RULE-015`…`RULE-020` derive from the
   workflow instructions rather than Part I; and a fifth ID scheme, `DEC-`, was added
   (DEC-019) because three files needed to cite specific decisions.
5. **Phase 4 found five fidelity defects in the Phase 1 output**, all reverted before
   this work item closed: a dropped requirement-scope statement, a softened
   `claude-opus-4-8` model pin with its `claude-sonnet-4-6` parenthetical dropped, two
   dropped words ("Claude Code", "Chromebook"), and Part VI §1 paraphrased rather than
   preserved. Post-fix: 676/676 backticked identifiers present, 60/60 sections mapped,
   22 residual altered units — all heading renames, structural splits or cross-reference
   remaps.
6. **The Phase 0 inventory was not presented for approval**, and Phase 2 began without
   explicit sign-off on Phase 1, because the user directed "complete phase 1 through 3
   and then stop." The inventory was built and used as the Phase 4 checklist regardless.

---

## 4. Milestone archive index

`PLAN.md` retains completed items for the **current** milestone only. On milestone
close, they move to `docs/archive/PLAN-COMPLETED-<milestone>.md` and leave a one-line
index entry here. See `DECISIONS.md` (archiving policy) for the rationale and for how
these four boundaries were drawn.

| Milestone            | Items                                                      | Closed     | Archive                                           |
| -------------------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------- |
| **v2-core**          | WI-000 – WI-012 (15 items, incl. WI-004b/005a/005b)        | 2026-07-19 | `docs/archive/PLAN-COMPLETED-v2-core.md`          |
| **vector-map**       | WI-A – WI-D (4 items)                                      | 2026-07-24 | `docs/archive/PLAN-COMPLETED-vector-map.md`       |
| **addendum-c**       | WI-013 – WI-024 (12 items) + 6 unnumbered follow-on passes | 2026-07-30 | `docs/archive/PLAN-COMPLETED-addendum-c.md`       |
| **access-lifecycle** | WI-025 – WI-027 (3 items)                                  | 2026-08-01 | `docs/archive/PLAN-COMPLETED-access-lifecycle.md` |
| **docs-refactor**    | WI-028 – (open)                                            | —          | current (§3 above)                                |

---

## 5. Templates

### Upcoming entry — `external-agent`

An item assigned to `external-agent` must carry a **self-contained brief** immediately
below the table: the spec text **inline** rather than by reference, the acceptance
criteria, and the file paths in scope. Write it assuming the external agent cannot read
this repository's docs at all.

```md
### WI-nnn — <title> · brief for external agent

**Spec (inline, do not follow references):**

> <the full spec text, pasted — not "see SPEC-0nn">

**Acceptance criteria:**

1. <observable, checkable statement>
2. …

**Files in scope:**

- `path/to/file.ts` — <what may change in it>
- …

**Out of scope:** <everything else, named explicitly>
```

### Completion summary

Drafted during step 6 and **finalised only once the test suite has passed** — a summary
written ahead of verification is a prediction, not a record.

```md
#### WI-nnn — <title>

**Changes made.** Every file touched and what changed in each.
**Visible behavior changes.** What the user can observe differently — UI, CLI output,
build behavior, file locations. State "none" explicitly if there are none.
**How to verify.** Specific steps, commands, or screens to confirm the work landed.
**Deviations.** Anything done differently from the approved plan, including unblocking
changes made under the RULE-015 exception, and why.
```
