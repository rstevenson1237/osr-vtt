# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-215**, **IN-221**, **DEC-123**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                            | Spec                 | From   | Agent         | Model    | Effort | Gate             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------ | ------------- | -------- | ------ | ---------------- |
| WI-202 | **Batch 5.** Create `ATTRIBUTION.md` at the root: what SPEC-003 §5 says it records, today's state (every dice asset generated at runtime; the terrain/contents packs' terms per DEC-088), and the entry shape a third-party asset adds                 | SPEC-003 §5          | IN-078 | `claude-code` | `haiku`  | —      | ⏳ Awaiting gate |
| WI-203 | **Batch 5.** Shorten every `INTAKE.md` §1.2 "Closed via" cell to the one-line pointer SPEC-052 §1 gives a closed row (`**Closed** — WI-nnn (date), SPEC ref. See docs/completed/WI-nnn.md.`). Table cells only; the prose entries are not touched      | SPEC-052 §1          | IN-151 | `claude-code` | `haiku`  | —      | ⏳ Awaiting gate |
| WI-204 | **Batch 5.** Correct `README.md`'s Session settings section: `measure`/`grid` live on `GameMap`, not `room.settings`                                                                                                                                   | —                    | IN-207 | `claude-code` | `haiku`  | —      | ⏳ Awaiting gate |
| WI-205 | **Batch 5.** Move the script-side (toast, error, dialog) and inline-mixed copy WI-170 left into `lib/strings/<Component>.ts`; rendered text and testids unchanged                                                                                      | SPEC-055 §5          | IN-220 | `claude-code` | `haiku`  | —      | ⏳ Awaiting gate |
| WI-206 | **Batch 6.** CI job on PRs: build the local variant, then fail if its output contains Firebase SDK code or a project identifier                                                                                                                        | SPEC-042 §3          | IN-071 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-207 | **Batch 6.** Move `VectorMapView`'s 13 pure helpers (`displayState` … `isAway`) into modules beside `background-transform.ts`, with unit tests; identical outputs                                                                                      | WI-171 §4 item 1     | IN-198 | `claude-code` | `sonnet` | high   | ⏳ Awaiting gate |
| WI-208 | **Batch 6.** `YRoomProvider.handleLocalUpdate` buffers a typing burst for a short idle window before one `mergeYUpdate`; same RTDB path, same store calls                                                                                              | WI-174               | IN-209 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-209 | **Batch 6.** Presence-chip initials legible on Referee/Records seats in both themes (≥ 4.5:1)                                                                                                                                                          | WI-175               | IN-211 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-210 | **Batch 6.** `--accent-text` meets AA in `keyed-blue` on `--bg-panel` and `--bg-inset`                                                                                                                                                                 | WI-175               | IN-212 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-211 | **Batch 6.** `--complication`/`--failure` on their `-bg-strong` (keyed-blue) and `--danger` on `--bg-panel` (parchment-dark) meet AA                                                                                                                   | WI-175               | IN-213 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-212 | **Batch 6.** `--text-dim` on `--bg-panel-alt` meets AA in `keyed-blue`                                                                                                                                                                                 | WI-175               | IN-214 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-213 | **Investigation** (findings only). Why `room-uploads.emulator.test.ts` hits `RESOURCE_EXHAUSTED` on the Firestore `Listen` stream on CI: what drives the message size or load; each finding becomes an intake item                                     | SPEC-034 §4          | IN-076 | `claude-code` | `sonnet` | medium | ⏳ Awaiting gate |
| WI-214 | One name rule for an unnamed creature: `CharacterDock`'s creature header and `EncounterBoard`'s card name go through `actorPresentation` (letter, else `basename · id6`); `creatureLabel`/`creatureDisplayName` retired or made callers; tests updated | SPEC-055 §4, DEC-122 | IN-218 | `claude-code` | `sonnet` | high   | ⏳ Awaiting gate |

**Columns.** _Model_ is binding on the execution session (`CLAUDE.md` §Sessions). _Effort_
is advisory and lives **only in this column**, one value per row (DEC-120): `—` (haiku
rows) · `low` · `medium` · `high` · `xhigh` · `max`. A batch runs at the highest effort
among its rows; name the batch in each member's _Description_. _Gate_ records the outcome
(`✅ Gate cleared` / `⏸ Postponed`) per `.claude/commands/work-item.md` step 5.

**Per-item notes** (order, dependencies, README obligations under RULE-018) go in a
`### WI-nnn` block below the table, and leave with the row when the item closes — the
history belongs in `docs/completed/WI-nnn.md`, not here.

### Batches 5 and 6, WI-213, WI-214 — order and obligations

Triaged 2026-10-02 (classifications approved, user). **Batch 5** (WI-202 – WI-205, `haiku`,
effort `—`) and **Batch 6** (WI-206 – WI-212, `sonnet`, runs at `high` because of WI-207)
are each one pull request with one combined summary (RULE-016). WI-213 and WI-214 are each
their own unit. No ordering constraint between the four units; suggested order Batch 5 →
WI-214 → Batch 6 → WI-213.

**README obligations (RULE-018).** WI-204 is the README fix itself; WI-206 the CI section;
WI-208 the notes/Yjs transport paragraph; WI-209 – WI-212 the theming section if it states
token values; WI-214 nothing beyond SPEC-055 §4 (already amended).

---

## 5. External-agent briefs

None. An `external-agent` item carries its spec text inline here (`work-item.md` step 4).
