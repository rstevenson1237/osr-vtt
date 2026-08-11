# PLAN-COMPLETED

Historical completion records for closed work items.

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
| **WI-060** | Lobby credits section, and `ATTRIBUTION.md`'s symbol-pack provenance                                                              | SPEC-033 §6     | IN-041                                 | `claude-code` | `haiku`  | low    | 2026-08-04 |
| **WI-068** | Symbol tool: `anchorCellFor` honours snap mode instead of hardcoding whole-cell `Math.floor`                                      | —               | IN-014                                 | `claude-code` | `haiku`  | low    | 2026-08-03 |
| **WI-058** | Mobile: one viewport unit (`dvh`), `touch-action` on the map host, safe-area insets                                               | SPEC-033 §§1–3  | IN-033                                 | `claude-code` | `sonnet` | medium | 2026-08-04 |
| **WI-059** | Carve: simplification tolerance bounded by the stroke's own width; snapped bands take tolerance 0                                 | SPEC-028 §10    | IN-039                                 | `claude-code` | `sonnet` | low    | 2026-08-04 |
| **WI-061** | Carve: a snapped band leg runs centre to centre; only the gesture's two ends are capped                                           | SPEC-028 §9     | IN-038                                 | `claude-code` | `opus`   | high   | 2026-08-04 |
| **WI-062** | Carve: the corridor latches its bend axis from the drag                                                                           | SPEC-028 §11    | IN-040                                 | `claude-code` | `opus`   | medium | 2026-08-04 |
| **WI-067** | Shell: `isMobile` split into `isNarrow` (layout) and `isCoarsePointer` (hit targets)                                              | SPEC-033 §7     | IN-036                                 | `claude-code` | `opus`   | high   | 2026-08-04 |
| **WI-069** | Token-optimization refactor: documents become indexes over per-entry files; model routing; `/execute-wi`                          | SPEC-035        | IN-042                                 | `claude-code` | `opus`   | medium | 2026-08-07 |
| **WI-063** | Coarse pointers get an equivalent, not a hover (note dot, `PICK_PX`, `@media (hover: hover)`)                          | SPEC-033 §4     | IN-034                                 | `claude-code` | `opus`   | high   | 2026-08-08 |
| **WI-064** | Full-screen and standalone are one presentation model (frame toggle, web app manifest, iOS meta tags)                  | SPEC-033 §5     | IN-035                                 | `claude-code` | `opus`   | high   | 2026-08-08 |
| **WI-070** | Un-quarantine `portability.spec.ts`: split into live-sync + round-trip, assert imported state over admin emulator REST  | SPEC-036        | IN-043                                 | `claude-code` | `opus`   | high   | 2026-08-09 |
| **WI-033** | Battle map: `GameMap.battle` + schema v22 migration + the `.vttcamp` strip (a battle map never survives an export)      | SPEC-029 §3     | IN-010                                 | `claude-code` | `opus`   | high   | 2026-08-09 |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour)                                          | SPEC-029 §1     | IN-010                                 | `claude-code` | `sonnet` | medium | 2026-08-09 |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter                                        | SPEC-029 §4     | IN-010                                 | `claude-code` | `opus`   | high   | 2026-08-09 |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit                                                                     | SPEC-029 §5     | IN-010                                 | `claude-code` | `sonnet` | medium | 2026-08-10 |
| **WI-071** | Ledger repairs — SPEC-028 index cell, the stale hex-grid "Deferred" entries, IN-041's row move to §1.2                   | —               | IN-044, IN-045, IN-046                 | `claude-code` | `haiku`  | low    | 2026-08-11 |
| **WI-072** | Ledger audit follow-through — repair `PLAN-COMPLETED.md`'s duplicated WI ids; verify SPEC-029 §2 shipped, then close IN-048 | SPEC-029 §2   | IN-047, IN-048                         | `claude-code` | `sonnet` | low    | 2026-08-11 |
| **WI-073** | Seed defaults — no starter map as a new map's default background; Profile Template → HP (Number) / To Hit (Roll d20) / Initiative (Initiative d6) | — | IN-051, IN-055 | `claude-code` | `haiku`  | low    | 2026-08-11 |
| **WI-074** | Encounter Template default → Initiative (Initiative d6) only; v13→v14 migration pinned to `LEGACY_ENCOUNTER_TEMPLATE_V14` (DEC-065) | — | IN-056 | `claude-code` | `sonnet` | low    | 2026-08-11 |
| **WI-075** | Snap-mode selector on the Label and Symbol tools                                                              | SPEC-028 §1    | IN-057 | `claude-code` | `haiku`  | low    | 2026-08-11 |
| **WI-076** | Edit/View as one binary button; default View on session join                                                  | —              | IN-058 | `claude-code` | `sonnet` | low    | 2026-08-11 |

Each entry's full four-section summary lives in `docs/completed/WI-nnn.md` — read the
one you need, not the set.

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
