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

| IN     | Item                                                      | Classification        | Status        | Disposition          |
| ------ | --------------------------------------------------------- | --------------------- | ------------- | -------------------- |
| IN-010 | Battle Map quick sheet                                    | **Complex (Shape A)** | **Scheduled** | SPEC-029, WI-033–036 |
| IN-011 | Hex Crawl map type                                        | **Complex (Shape A)** | **Scheduled** | SPEC-030, WI-037–041 |
| IN-027 | Expanding a group re-lays tokens out in a grid            | **Deceptive**         | **Open**      | Not scheduled        |
| IN-032 | Toolbar-added creatures are invisible to players          | **Unclear**           | **Open**      | Awaiting the user    |
| IN-035 | Full-screen view and the installed/standalone app view    | **Deceptive**         | **Scheduled** | SPEC-033 §5, WI-064  |
| IN-037 | Blaze upload containment — limits enforceable on our side | **Deceptive**         | **Scheduled** | SPEC-034, WI-065–066 |
| IN-041 | Lobby credits, and the symbol pack's provenance           | **Simple**            | **Scheduled** | SPEC-033 §6, WI-060  |
| IN-043 | Un-quarantine and refactor portability.spec.ts e2e test   | **Deceptive**         | **Scheduled** | SPEC-036, WI-070     |

### 1.2 Closed intake

| IN     | Item                                                                     | Classification           | Closed via                |
| ------ | ------------------------------------------------------------------------ | ------------------------ | ------------------------- |
| IN-001 | Refactor the planning and instruction documentation                      | **Complex (Shape A)**    | WI-028                    |
| IN-002 | App Check: monitoring → enforcement                                      | **Deceptive**            | WI-029 `[HUMAN]`          |
| IN-003 | N-gon dropdown, drag orientation, cell-centred sizing                    | **Deceptive**            | WI-030 / SPEC-028         |
| IN-004 | Corridor width dropdown, cell-centred band                               | **Deceptive**            | WI-030 / SPEC-028         |
| IN-005 | Room carve snaps to cells, 1×1 minimum                                   | **Deceptive**            | WI-030 / SPEC-028         |
| IN-006 | Snap indicator: highlight the targeted cell                              | **Deceptive**            | WI-030 / SPEC-028         |
| IN-007 | Evaluate the other carving tools for inconsistencies                     | **Investigation**        | Run inside WI-030         |
| IN-008 | URL-derived token does not display on the map                            | **Simple**               | WI-032                    |
| IN-009 | Move Token scale to the Character quick sheet                            | **Simple**               | WI-031                    |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap                   | **Deceptive**            | WI-042                    |
| IN-013 | Snapped Carve stroke centres on an intersection                          | **Deceptive**            | WI-042                    |
| IN-015 | "Deceptive" stopped discriminating                                       | **Deceptive**            | WI-044                    |
| IN-016 | A classification was invented mid-run                                    | **Simple**               | WI-044                    |
| IN-017 | RULE-018's ordering clause is unenforceable                              | **Deceptive**            | WI-043                    |
| IN-018 | The Model column was lost in the WI-028 split                            | **Simple**               | WI-044                    |
| IN-019 | The completion summary is written before verification                    | **Simple**               | WI-044                    |
| IN-020 | Nothing prompts the `PLAN.md` status write-back                          | **Deceptive**            | WI-045                    |
| IN-021 | Intake rows have outgrown the table                                      | **Simple**               | WI-044                    |
| IN-022 | Scheduled/completed intake rows are never retired                        | **Simple**               | WI-049                    |
| IN-023 | Token scale overflows the quick sheet's bounding box                     | **Simple**               | WI-046                    |
| IN-024 | Quick sheet header reads "Character", not the name                       | **Simple** (borderline)  | WI-046                    |
| IN-025 | Remove the Clear button from quick-sheet colour                          | **Deceptive**            | WI-050 / SPEC-031         |
| IN-026 | Encounter group: a "+" card that adds a creature to it                   | **Simple**               | WI-047                    |
| IN-028 | Path tool adopts the Corridor's snapped behaviour                        | **Deceptive** (reversal) | WI-051, WI-052 / SPEC-028 |
| IN-029 | Superseded point snap-dots are still drawn under the cell                | **Simple**               | WI-048                    |
| IN-031 | Edit/View toggle beside undo/redo — a soft carve lock                    | **Simple**               | WI-053                    |
| IN-030 | Creature cards are inert — selection is keyed to a seat                  | **Complex (Shape A)**    | WI-054–057 / SPEC-032     |
| IN-014 | The Symbol tool ignores the snap mode                                    | **Simple**               | WI-068                    |
| IN-033 | Mobile viewport clipping, map `touch-action`, safe areas                 | **Simple**               | WI-058 / SPEC-033 §§1–3   |
| IN-039 | Path simplification destroys sub-half widths                             | **Simple**               | WI-059 / SPEC-028 §10     |
| IN-038 | Corridor/Path bands overshoot at every bend                              | **Deceptive**            | WI-061 / SPEC-028 §9      |
| IN-040 | The corridor's bend axis is hard-coded horizontal-first                  | **Deceptive**            | WI-062 / SPEC-028 §11     |
| IN-036 | The mobile breakpoint fires on any coarse pointer                        | **Deceptive**            | WI-067 / SPEC-033 §7      |
| IN-042 | Documentation context loading optimization (Planning vs Execution split) | **Deceptive**            | WI-069                    |
| IN-034 | Hover-only affordances are unreachable on touch                          | **Deceptive**            | WI-063 / SPEC-033 §4      |

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

**Disposition.** → **SPEC-036**, **WI-070**.
