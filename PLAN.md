# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-236**, **IN-237**, **DEC-139**, **SPEC-071**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Spec                              | From                           | Agent       | Model  | Effort | Gate                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------ | ----------- | ------ | ------ | ------------------------------------------------------------------------------------------ |
| WI-234 | Remove the bottom tool-hint bar: delete the `.vf-hint` element and CSS, the `hint`/`HINTS` derivations in `VectorMapView.svelte`, and the strings only they read (`toolHints`, `fogCarveHint`). README updated in the same PR. Verify no e2e/unit test reads the text. | — | IN-235 | claude-code | sonnet | medium | Awaiting gate |
| WI-235 | Remove first-start hints per DEC-138: the rail's first-run labels (`showLabels`/`railSeen`), the empty-map hint card and `mapIsEmpty` mirror if nothing else reads it, the "Show me around" `?`-sheet entry, and `ShellState` `dismissedHints`/`railSeen`/`dismissHint`/`resetHints` (old stored values ignored on load). Keep the empty-board hint and the `title` tooltips. Annotate SPEC-054 §1/§3 superseded in place; update README §rail, §ShellState, §First-run cues; update `shell-state.svelte.test.ts`. | SPEC-054 §1, §3 | IN-236 | claude-code | sonnet | high | Awaiting gate |

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
