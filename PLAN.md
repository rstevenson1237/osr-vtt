# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-215**, **IN-223**, **DEC-123**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                            | Spec                 | From   | Agent         | Model    | Effort | Gate                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------ | ------------- | -------- | ------ | --------------------------------------- |
| WI-213 | **Investigation** (findings only). Why `room-uploads.emulator.test.ts` hits `RESOURCE_EXHAUSTED` on the Firestore `Listen` stream on CI: what drives the message size or load; each finding becomes an intake item                                     | SPEC-034 §4          | IN-076 | `claude-code` | `sonnet` | medium | ✅ **Gate cleared — user, 2026-10-02.** |
| WI-214 | One name rule for an unnamed creature: `CharacterDock`'s creature header and `EncounterBoard`'s card name go through `actorPresentation` (letter, else `basename · id6`); `creatureLabel`/`creatureDisplayName` retired or made callers; tests updated | SPEC-055 §4, DEC-122 | IN-218 | `claude-code` | `sonnet` | high   | ✅ **Gate cleared — user, 2026-10-02.** |

**Columns.** _Model_ is binding on the execution session (`CLAUDE.md` §Sessions). _Effort_
is advisory and lives **only in this column**, one value per row (DEC-120): `—` (haiku
rows) · `low` · `medium` · `high` · `xhigh` · `max`. A batch runs at the highest effort
among its rows; name the batch in each member's _Description_. _Gate_ records the outcome
(`✅ Gate cleared` / `⏸ Postponed`) per `.claude/commands/work-item.md` step 5.

**Per-item notes** (order, dependencies, README obligations under RULE-018) go in a
`### WI-nnn` block below the table, and leave with the row when the item closes — the
history belongs in `docs/completed/WI-nnn.md`, not here.

### WI-213, WI-214 — order and obligations

Triaged 2026-10-02 (classifications approved, user). **Batch 6** (WI-206 – WI-212) shipped
as one pull request. WI-213 and WI-214 are each their own unit. No ordering constraint.

**README obligations (RULE-018).** WI-214 nothing beyond SPEC-055 §4 (already amended).

---

## 5. External-agent briefs

None. An `external-agent` item carries its spec text inline here (`work-item.md` step 4).
