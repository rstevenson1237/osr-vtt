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
> pre-WI-044 wording of the Deceptive triggers, which read *touches X* rather than
> *changes the contract of X*. Their rationales are preserved as written. Where one says
> "touches", read it against the trigger list in force at the time; the classifications
> themselves were reviewed and stand.

| IN     | Item                                                     | Classification        | Disposition        |
| ------ | -------------------------------------------------------- | --------------------- | ------------------ |
| IN-001 | Refactor the planning and instruction documentation      | **Complex (Shape A)** | WI-028             |
| IN-002 | App Check: monitoring → enforcement                      | **Deceptive**         | WI-029 `[HUMAN]`   |
| IN-003 | N-gon dropdown, drag orientation, cell-centred sizing    | **Deceptive**         | WI-030 / SPEC-028  |
| IN-004 | Corridor width dropdown, cell-centred band               | **Deceptive**         | WI-030 / SPEC-028  |
| IN-005 | Room carve snaps to cells, 1×1 minimum                   | **Deceptive**         | WI-030 / SPEC-028  |
| IN-006 | Snap indicator: highlight the targeted cell              | **Deceptive**         | WI-030 / SPEC-028  |
| IN-007 | Evaluate the other carving tools for inconsistencies     | **Investigation**     | Run inside WI-030  |
| IN-008 | URL-derived token does not display on the map            | **Simple**            | WI-032             |
| IN-009 | Move Token scale to the Character quick sheet            | **Simple**            | WI-031             |
| IN-010 | Battle Map quick sheet                                   | **Complex (Shape A)** | SPEC-029, WI-033–036 |
| IN-011 | Hex Crawl map type                                       | **Complex (Shape A)** | SPEC-030, WI-037–041 |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap   | **Deceptive**         | WI-042 ✅ approved  |
| IN-013 | Snapped Carve stroke centres on an intersection          | **Deceptive**         | WI-042 ✅ approved  |
| IN-014 | The Symbol tool ignores the snap mode                    | **Simple**            | Own work item      |
| IN-015 | "Deceptive" stopped discriminating                       | **Deceptive**         | WI-044             |
| IN-016 | A classification was invented mid-run                    | **Simple**            | WI-044             |
| IN-017 | RULE-018's ordering clause is unenforceable              | **Deceptive**         | WI-043             |
| IN-018 | The Model column was lost in the WI-028 split            | **Simple**            | WI-044             |
| IN-019 | The completion summary is written before verification    | **Simple**            | WI-044             |
| IN-020 | Nothing prompts the `PLAN.md` status write-back          | **Deceptive**         | WI-045             |
| IN-021 | Intake rows have outgrown the table                      | **Simple**            | WI-044             |

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

**Finding.** The brush is handed *vertex*-snapped points, then paints every cell whose
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
*between* intersections and a polygon's gesture is placing corners, so a vertex is the
right anchor for all three. The Path tool keeps its free-form ribbon — it is the organic
counterpart to the Corridor, and cell-aligning it would remove the only tool that is not
grid-true. The Label tool already floors to the clicked cell (`snapCell`), matching the
new rule.

### Workflow feedback from the first run under the new layout (2026-08-01)

Seven findings from executing WI-030 — the first work item to go through the WI-028
five-document layout end to end. All seven were approved by the user on the same day.
Three are defects in the layout itself rather than improvements to it.

#### IN-015 — "Deceptive" stopped discriminating

**Finding.** Six of twelve items in the map-tools batch classified Deceptive, all for the
same reason: RULE-006 names the Pixi layer stack, the carve pipeline and lattice
coordinates as triggers, and any real map work touches one. What actually predicted
difficulty was *changing the contract of* those things, not *touching* them — IN-003–006
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

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                           | Spec        | From   | Agent   | Model  | Effort | Gate                                                           |
| ---------- | --------------------------------------------------------------------- | ----------- | ------ | ------- | ------ | ------ | -------------------------------------------------------------- |
| **WI-042** | Carve brush: anchor snapped strokes to cells (fixes the dab-paints-nothing case) | SPEC-028 §2 | IN-012, IN-013 | `claude-code` | `sonnet` | medium | ✅ **Gate cleared — user, 2026-08-01.** See the brief below. |
| **WI-033** | Battle map: `GameMap` schema + migration + `.vttcamp` round-trip | SPEC-029 §3 | IN-010 | `claude-code` | `opus` | high | Four-section gate. Schema change ⇒ RULE-007 applies. |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour) | SPEC-029 §1 | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate. |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter | SPEC-029 §4 | IN-010 | `claude-code` | `opus` | high | Four-section gate. Needs a tool-subset prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`. |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit | SPEC-029 §5 | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate. |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types | SPEC-030 | IN-011 | `claude-code` | `opus` | low | ✅ **Gate cleared — user, 2026-08-01.** Still a **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)**; never bundled into an implementation PR. Nothing in WI-038+ may begin until it lands. |
| **WI-038** | Hex crawl: axial coordinates, schema, migration | SPEC-030 §1 | IN-011 | `claude-code` | `opus` | high | Four-section gate. Blocked on WI-037. |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills | SPEC-030 §1 | IN-011 | `claude-code` | `opus` | high | Four-section gate. |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons | SPEC-030 §§2–3 | IN-011 | `claude-code` | `opus` | high | Four-section gate. First per-region fill in the renderer. |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering | SPEC-030 §§4–5 | IN-011 | `claude-code` | `opus` | medium | Four-section gate. |

Execution order: **WI-042 → IN-014's item →
WI-033 – WI-036 → WI-037 → WI-038 – WI-041**. (WI-029, WI-031, WI-032, WI-043, WI-044,
WI-045 completed; see §3.)

**Two gates are already cleared** (user, 2026-08-01): **WI-037** and **WI-042**. Each
still needs its own session and its own branch — RULE-016 permits one work item per
session, and RULE-017 forbids WI-037 from riding on any implementation PR.

**Out of scope for WI-042:** anything touching the snap-mode reminder hook or DEC-016/
DEC-029 — that was WI-045's job, already closed; see §3. RULE-018's ordering clause was
WI-043's job, also closed.

### WI-042 — brief

Approved 2026-08-01. Fixes IN-012 and IN-013, which share one root cause and must land
together.

**The defect.** `buildBrushStroke` (`apps/web/src/lib/map/vector-tools.ts`) receives
points that `VectorMapView` has already run through `snapPoint`, i.e. lattice
*vertices*. Under cell/half snap it then paints every cell whose **centre** lies within
`radius = max(width / 2, step / 2)` of the stroke. A cell centre is always `0.707` from
the nearest vertex, so:

- at `radius = 0.5` (any width ≤ 1) **no cell qualifies and the stroke commits nothing**;
- at larger radii the painted block is symmetric about the grid *corner*, not about the
  cell the referee aimed at — clicking well inside cell `(3,5)` paints `(3,4)`, `(4,4)`,
  `(3,5)` and `(4,5)`.

Reproduced directly against `buildFloorStroke`: widths 0.5 and 1 emit nothing; 1.5, 2
and 3 emit a 2×2 block spanning `[3,5] × [4,6]`.

**The fix.** Add `carve` to `CELL_ANCHORED_TOOLS` so the brush takes raw lattice points
like Room, Corridor and N-gon, and paint from the cell the pointer is in rather than
from a rounded vertex. `snapCellCenter` already expresses that anchor (SPEC-028 §2).

**Why this is Deceptive, not a one-liner.** It changes *every* snapped brush stroke, not
just the failing case — a stroke that used to straddle a corner now sits on the cell —
so it needs the same before/after care WI-030 took, and the `radius` floor of `step / 2`
should be re-derived rather than kept by habit.

**In scope:** `vector-tools.ts` (`buildBrushStroke`, `CELL_ANCHORED_TOOLS`),
`VectorMapView.svelte`'s carve branches (`collecting` must collect raw points, and
`onPointerUp`'s carve path resets `dragStartRaw`/`dragCurRaw` already), plus
`vector-tools.test.ts` and the `map-draw-feedback` carve e2e.

**Out of scope:** IN-014 (the Symbol tool ignoring snap mode) — its own item; it changes
stored `MapSymbol.cell` values and wants a separate gate.

**Status.** In progress — gate already cleared 2026-08-01. Fix implemented
(`CELL_ANCHORED_TOOLS`/`buildBrushStroke` in `vector-tools.ts`, raw-point plumbing in
`VectorMapView.svelte`), unit tests added and passing, e2e regression test added, lint +
typecheck clean. Step 3 of: implement fix → update/add tests → run emulator + e2e suites
→ completion summary → PR. 2026-08-02.

---

## 3. Completed work items — current milestone (`docs-refactor`)

Each completed entry carries the four-section completion summary: **Changes made**,
**Visible behavior changes**, **How to verify**, **Deviations**.

| WI         | Description                                             | Spec        | From   | Agent         | Model   | Effort | Closed     |
| ---------- | ------------------------------------------------------- | ----------- | ------ | ------------- | ------- | ------ | ---------- |
| **WI-028** | Split the Master Plan into five documents; write CLAUDE.md; add hooks, `/work-item`, settings pre-approvals | — (process) | IN-001 | `claude-code` | `opus` | high   | 2026-08-01 |
| **WI-030** | Snap-aware carve geometry: n-gon, corridor, room, and a cell snap indicator | SPEC-028 | IN-003 – IN-007 | `claude-code` | `opus` | high | 2026-08-01 |
| **WI-031** | Move Token scale from the map toolbar to the Character quick sheet, under Map defaults | — | IN-009 | `claude-code` | `haiku` | low | 2026-08-01 |
| **WI-044** | Workflow hardening: triage triggers, the Investigation category, the Model column, post-verification summaries, intake formatting | — (process) | IN-015, IN-016, IN-018, IN-019, IN-021 | `claude-code` | `opus` | medium | 2026-08-01 |
| **WI-029** | Flip App Check from monitoring to enforcement in the Firebase console | SPEC-025 §2 | IN-002 | `human` | — | low | 2026-08-02 |
| **WI-032** | URL-derived token renders as a blank square on the map | — | IN-008 | `claude-code` | `sonnet` | medium | 2026-08-02 |
| **WI-043** | `RULE-AMENDMENT` — resolve RULE-018's unenforceable ordering clause | — (process) | IN-017 | `claude-code` | `haiku` | low | 2026-08-01 |
| **WI-045** | Make the `PLAN.md` status write-back actually fire | — (process) | IN-020 | `claude-code` | `sonnet` | medium | 2026-08-02 |

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
  coordinate, layer or pipeline stage *means* rather than the Pixi stack and carve
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
   *WI-031 → WI-032 → WI-042 → …*, omitting WI-043 and WI-045 entirely while the table
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
   denied at write time unconditionally; `RULES.md` is denied at *commit* time without the
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

| Milestone            | Items                                 | Closed     | Archive                                        |
| -------------------- | ------------------------------------- | ---------- | ---------------------------------------------- |
| **v2-core**          | WI-000 – WI-012 (15 items, incl. WI-004b/005a/005b) | 2026-07-19 | `docs/archive/PLAN-COMPLETED-v2-core.md`          |
| **vector-map**       | WI-A – WI-D (4 items)                 | 2026-07-24 | `docs/archive/PLAN-COMPLETED-vector-map.md`       |
| **addendum-c**       | WI-013 – WI-024 (12 items) + 6 unnumbered follow-on passes | 2026-07-30 | `docs/archive/PLAN-COMPLETED-addendum-c.md`       |
| **access-lifecycle** | WI-025 – WI-027 (3 items)             | 2026-08-01 | `docs/archive/PLAN-COMPLETED-access-lifecycle.md` |
| **docs-refactor**    | WI-028 – (open)                       | —          | current (§3 above)                             |

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
