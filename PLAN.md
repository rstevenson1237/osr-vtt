# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-234**, **IN-234**, **DEC-138**, **SPEC-071**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Spec                              | From                           | Agent       | Model  | Effort | Gate                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------ | ----------- | ------ | ------ | ------------------------------------------------------------------------------------------ |
| WI-230 | The token layer leaves `VectorMapView` for a `map/token-layer.svelte.ts` controller, behaviour-identical: the per-token container map and sync passes, texture load and rasterize, broken-image and away badges, the sprite drag (single, collapsed group, set), the snap on drop, the undoable moves, `addCreature`, the quick-sheet drop and the focused token. It keeps its own sprite handlers rather than joining the stage ladder. Unit tests drive `sync`, the drop and `addCreature` without a browser. | SPEC-068, SPEC-060 §2–§5, DEC-135 | IN-199                         | claude-code | sonnet | xhigh  | ✅ **Gate cleared — user, 2026-10-10.** After WI-229; before IN-204.                       |
| WI-231 | Stage pointer dispatch leaves `wireStagePointerEvents` for a `map/map-pointer-router.ts` `MapPointerRouter`, behaviour-identical: one ordered list `[labels, hex, draw, editor]` built in the component, the guards, first-consumer-wins down/move/up, a non-consuming `hover` hook every handler gets on every move, and the `pointerOut`/`cancel` fan-outs. `editor` is the component's stroke tools as one handler. Double-click and keys stay. Unit tests drive the router with a fake stage.               | SPEC-069, SPEC-060 §4, DEC-136    | IN-204                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-230.                                      |

### WI-231 (stage pointer router)

After WI-230, the last extraction whose seam the router dispatches to (or, for tokens,
never sees). Identical-outputs refactor (SPEC-060 §5): no store, schema, rules, layer or
testid change. The router converts nothing; each handler gets raw world pixels and only
`editor` and the square seams call the lattice conversions (RULE-006, SPEC-069 §7). Moves
the hover halves of the draw, labels and hex controllers' move handling into `hover`
(SPEC-069 §3) and adds `StageInput` to `map/map-seam.ts`; updates SPEC-060 §4 and SPEC-066
§5 to point at SPEC-069, and README where it names `wireStagePointerEvents` (RULE-018). If
any ordering turns out not to be tool-exclusive as SPEC-069 §4 claims, stop and log an
intake item rather than reordering.

### WI-230 (token layer controller)

After WI-229, which follows WI-221 (the per-token container this extracts, SPEC-063) and
gives the token click `MapSelection` to write through (SPEC-067 §4). Before IN-204, whose
router never sees token input (SPEC-068 §3). Identical-outputs refactor (SPEC-060 §5): no
store, schema, rules, layer or testid change; every write and undo entry is the same. The
`tokens` layer stays outside the renderer's passes (SPEC-068 §2) and the controller gains
no coordinate conversion (RULE-006). Takes over SPEC-067 §3's `focusToken` as its
`focus(id)`. Updates README where it names the token code it moves (RULE-018). If the move
needs a store method or changes what a token's position means, stop and log an intake
item. `xhigh`: the largest move in the file, with three drag paths.

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
