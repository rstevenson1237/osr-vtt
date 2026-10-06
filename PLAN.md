# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-219**, **IN-227**, **DEC-127**, **SPEC-061**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                            | Spec                 | From   | Agent         | Model    | Effort | Gate                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------ | ------------- | -------- | ------ | --------------------------------------- |
| WI-217 | Hex-native background placement: on hex maps a background stores its corners as `HexPoint`s, migrated v34→v35 from today's placement; move/resize, Add and Fit work in axial space; no square alignment overlay on hex maps. | SPEC-059 §3, DEC-125 | IN-069 | claude-code | opus | xhigh | ✅ **Gate cleared — user, 2026-10-06.** After WI-216. |
| WI-218 | First seam extraction under the controller protocol: the label editor, hover/pinned tooltip, coarse-pointer note dot and anchor maths leave `VectorMapView` for `map/map-seam.ts` (`MapSeamDeps`) and a `map/map-labels.svelte.ts` controller, behaviour-identical. Unit tests drive the controller with a fake `invalidate`. | SPEC-060 §2–§5, DEC-126 | IN-203 | claude-code | sonnet | high | ✅ **Gate cleared — user, 2026-10-06.** After WI-217. |

### WI-218 (first controller)

Runs after WI-217 only to avoid merge conflicts in `VectorMapView`; it touches no background
code. Identical-outputs refactor (SPEC-060 §5): no testid moves (`label-edit-input`,
`map-label-tooltip`, `maproom-note-dot-*` stay in the markup), no store/schema/rules change.
Composers read controller state as plain field reads and stay pure (SPEC-060 §3). Updates
README where it names the extracted code (RULE-018). If the protocol proves wrong on these
166 lines, stop and log an intake item rather than amending SPEC-060 in passing.

### WI-215 – WI-217 (backgrounds)

Run in order; all three change `VectorMapView`'s background code, and IN-200 (extracting that
code) waits until they land. Each updates README → "Background management" for what it
changes (RULE-018). WI-215 and WI-217 change the `CampaignStore` contract and so extend
`campaign-store.contract.ts` against `MemoryStore`, `LocalStore` and `FirebaseStore`
(RULE-001). WI-217 ships the v35 migration, its test and a `.vttcamp` round-trip test
(RULE-007, RULE-014); no RULE-006 amendment (DEC-081, DEC-125).

**Columns.** _Model_ is binding on the execution session (`CLAUDE.md` §Sessions). _Effort_
is advisory and lives **only in this column**, one value per row (DEC-120): `—` (haiku
rows) · `low` · `medium` · `high` · `xhigh` · `max`. A batch runs at the highest effort
among its rows; name the batch in each member's _Description_. _Gate_ records the outcome
(`✅ Gate cleared` / `⏸ Postponed`) per `.claude/commands/work-item.md` step 5.

**Per-item notes** (order, dependencies, README obligations under RULE-018) go in a
`### WI-nnn` block below the table, and leave with the row when the item closes — the
history belongs in `docs/completed/WI-nnn.md`, not here.

---

## 5. External-agent briefs

None. An `external-agent` item carries its spec text inline here (`work-item.md` step 4).
