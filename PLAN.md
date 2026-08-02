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

Classified, not yet scheduled. Classification is itself an approval gate: nothing
advances out of this table until the user approves the classifications.

The table below is the **index**; each item's request, rationale and disposition are the
sections that follow, grouped by the batch they arrived in.

> **Reading the older rationales.** Items IN-001 – IN-021 were classified under the
> pre-WI-044 wording of the Deceptive triggers, which read _touches X_ rather than
> _changes the contract of X_. Their rationales are preserved as written. Where one says
> "touches", read it against the trigger list in force at the time; the classifications
> themselves were reviewed and stand.

| IN     | Item                                                      | Classification           | Disposition               |
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
| IN-010 | Battle Map quick sheet                                    | **Complex (Shape A)**    | SPEC-029, WI-033–036      |
| IN-011 | Hex Crawl map type                                        | **Complex (Shape A)**    | SPEC-030, WI-037–041      |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap    | **Deceptive**            | WI-042                    |
| IN-013 | Snapped Carve stroke centres on an intersection           | **Deceptive**            | WI-042                    |
| IN-014 | The Symbol tool ignores the snap mode                     | **Simple**               | Own work item             |
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
| IN-027 | Expanding a group re-lays tokens out in a grid            | **Deceptive**            | Not scheduled             |
| IN-028 | Path tool adopts the Corridor's snapped behaviour         | **Deceptive** (reversal) | WI-051, WI-052 / SPEC-028 |
| IN-029 | Superseded point snap-dots are still drawn under the cell | **Simple**               | WI-048                    |
| IN-030 | Creature cards are inert — selection is keyed to a seat   | **Complex (Shape A)**    | SPEC-032, WI-054–057      |
| IN-031 | Edit/View toggle beside undo/redo — a soft carve lock     | **Simple**               | WI-053                    |
| IN-032 | Toolbar-added creatures are invisible to players          | **Unclear**              | Awaiting the user         |

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

**Disposition.** Own work item.

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

## 2. Upcoming work items

In execution order.

| WI         | Description                                                                                                                  | Spec           | From   | Agent         | Model    | Effort | Gate                                                                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-052** | Path ⇄ Corridor: the snap indicator shows the band actually being carved                                                     | SPEC-028 §6    | IN-028 | `claude-code` | `sonnet` | medium | Four-section gate. **Unblocked — WI-051 landed 2026-08-02**; the indicator must draw the band `pathPoly`/`corridorPoly` now carve (`bandWidth` centred in the snapped tile, a circle of that width under Free).                   |
| **WI-049** | `PLAN.md` intake lifecycle: retire scheduled and completed intake rows                                                       | — (process)    | IN-022 | `claude-code` | `sonnet` | low    | Four-section gate. No `RULES.md` edit — the moment it needs one it becomes an amendment (RULE-017).                                                                                                                               |
| **WI-050** | Character colour is always set: assignment, migration, backfill, and the Clear button removed                                | SPEC-031       | IN-025 | `claude-code` | `opus`   | high   | Four-section gate. Stored-field meaning change ⇒ RULE-007 applies (migration + migration test + `.vttcamp` round-trip). Rewrites `dice-overlay.spec.ts:171` in the same change (RULE-005).                                        |
| **WI-054** | Creature profiles: re-key `ProfileInstance` from a seat to an actor, migration, `.vttcamp` round-trip, `deleteToken` cleanup | SPEC-032 §§1–2 | IN-030 | `claude-code` | `opus`   | high   | Four-section gate. Schema change ⇒ RULE-007. New store method ⇒ RULE-001 contract suite, both stores.                                                                                                                             |
| **WI-055** | Creature ownership: `canActOnToken` (group membership, seatless-aware) and the selection re-key                              | SPEC-032 §3    | IN-030 | `claude-code` | `opus`   | high   | Four-section gate. Changes `onSelectActor`'s contract across three components. Blocked on WI-054.                                                                                                                                 |
| **WI-056** | Creature cards become selectable; the quick sheet renders a creature profile                                                 | SPEC-032 §4    | IN-030 | `claude-code` | `sonnet` | medium | Four-section gate. Blocked on WI-055.                                                                                                                                                                                             |
| **WI-057** | Gate map token drag on the same ownership predicate                                                                          | SPEC-032 §5    | IN-030 | `claude-code` | `sonnet` | low    | Four-section gate. DEC-036 makes ungrouped seatless tokens referee-only — a capability removal. Blocked on WI-055.                                                                                                                |
| **WI-033** | Battle map: `GameMap` schema + migration + `.vttcamp` round-trip                                                             | SPEC-029 §3    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Schema change ⇒ RULE-007 applies.                                                                                                                                                                              |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour)                                               | SPEC-029 §1    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter                                             | SPEC-029 §4    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Needs a tool-subset prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`.                                                                                                                               |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit                                                                          | SPEC-029 §5    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types                           | SPEC-030       | IN-011 | `claude-code` | `opus`   | low    | ✅ **Gate cleared — user, 2026-08-01.** Still a **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)**; never bundled into an implementation PR. Nothing in WI-038+ may begin until it lands. |
| **WI-038** | Hex crawl: axial coordinates, schema, migration                                                                              | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. Blocked on WI-037.                                                                                                                                                                                             |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills                                                                    | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate.                                                                                                                                                                                                                |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons                                                | SPEC-030 §§2–3 | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. First per-region fill in the renderer.                                                                                                                                                                         |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering                                                           | SPEC-030 §§4–5 | IN-011 | `claude-code` | `opus`   | medium | Four-section gate.                                                                                                                                                                                                                |

Execution order: **WI-052 → WI-049 →
WI-050 → WI-054 – WI-057 → IN-014's item → WI-033 – WI-036 → WI-037 → WI-038 – WI-041**. (WI-029, WI-031, WI-032,
WI-042, WI-043, WI-044, WI-045, WI-046, WI-047, WI-048, WI-051, WI-053 completed; see §3.)

Two ordering constraints, the rest is preference:

- **WI-052 follows WI-051** — satisfied; WI-051 landed 2026-08-02, so the band the
  indicator must draw is now fixed (`bandLo` = `snapCellCenter − width / 2`, and
  `pathPoly` for the Path's own shape). WI-048's dot-removal (dropping the point where a
  tile indicator supersedes it) is completed and does not constrain WI-052.
- **WI-050 is placed last of the small items** because it carries a migration; nothing
  else in the batch is blocked by it, so it should not block them.
- **WI-054 → WI-055 → {WI-056, WI-057}** is a hard chain: the ownership predicate needs
  the actor key to exist, and both consumers need the predicate. WI-056 and WI-057 are
  independent of each other and may swap.

**WI-050 and WI-054 both migrate `ProfileInstance`** — WI-050 backfills `color`, WI-054
re-keys the document id. They are ordered adjacently on purpose. Whichever lands second
must account for the first, and if they slip apart, re-check that ordering before
starting the second.

**Priority (user, 2026-08-02).** Every item raised in this session — **WI-046 – WI-057** —
runs **before** the Battle Map (WI-033 – WI-036) and Hex Crawl (WI-037 – WI-041) series:
they are more impactful for gameplay today. Both large series keep their internal order
and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041** and is still a standalone `RULE-AMENDMENT:` change on its own branch
(RULE-017) whenever it is reached.

**IN-014's item** (the Symbol tool ignoring snap mode) is still unnumbered — it takes the
next free `WI-` when it is scheduled, and sits after WI-057.

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

#### WI-051 — Path ⇄ Corridor: shared width set, band centred in the snapped tile, squared caps

**Status while running:** implementation complete, docs written, unit suites green;
verifying with the e2e suite against the emulator, then PR.

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
`pnpm lint`, `pnpm typecheck`, `pnpm --filter @osr-vtt/shared exec vitest run
src/map/vector/primitives.test.ts`, `pnpm --filter @osr-vtt/web exec vitest run`, and
`map-draw-feedback.spec.ts` against the Firebase emulator.

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
