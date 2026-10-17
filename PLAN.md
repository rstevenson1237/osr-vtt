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
| WI-233 | A room a newer build has opened stops the stale tab: the room converter checks the raw doc's `schemaVersion` and `collectionsMigratedTo` before `migrateRoom` and the parse; `subscribeRoom` delivers `NewerRoom` and `getRoom` rejects; `RoomShell` replaces the room view with a Reload panel. Contract cases in all three stores.                                                                                                                                                                            | SPEC-070, DEC-137                 | IN-229, IN-230, IN-231, IN-232 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-12.** After WI-232.                                           |
| WI-226 | Pen, ping, measure and cursor publishing leave `VectorMapView` for a `map/map-draw.svelte.ts` controller under the seam protocol, behaviour-identical: the live pings, ping resolution, freehand stroke, throttled cursor publish and their three pointer handlers. RTDB-versus-Firestore routing and the local-build listener guard move unchanged. Unit tests drive the controller with a fake `invalidate`.                                                                                                  | SPEC-060 §2–§5, DEC-126           | IN-202                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-09.** After WI-218.                                      |
| WI-227 | Background sprite lifecycle and the move/resize gesture leave `VectorMapView` for a `map/map-backgrounds.svelte.ts` controller under the seam protocol, behaviour-identical: `applyBackgroundColor`, `applyBackgrounds`, the `bgSprites` map and the hit-test and begin/update/end gesture. Calls the existing `patchBackground`; the hex-axial placement WI-217 delivers moves as it stands. Unit tests drive the controller with a fake `invalidate`.                                                         | SPEC-060 §2–§5, DEC-126           | IN-200                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-09.** After WI-217 and WI-218.                           |
| WI-228 | Hex authoring leaves `VectorMapView` for a `map/map-hex.svelte.ts` controller constructed only on hex maps, behaviour-identical: Select's hex pick, the Symbol, Road/River, Label, Terrain and Reveal/Hide hex tools, the hex note hover, the hex-tile sheet handlers, the hex fog stroke and the three hex subscriptions. The controller is the only place a pointer becomes an axial coordinate. Unit tests drive it with a fake `invalidate`.                                                                | SPEC-066, SPEC-060 §2–§5, DEC-133 | IN-201                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-226 and WI-227.                           |
| WI-229 | The selection becomes one `MapSelection` model whose writers keep the four slots (handles, objects, tokens, background) mutually exclusive in one place, and the Select gesture leaves `VectorMapView` for a `map/map-select.svelte.ts` controller over it, behaviour-identical: pick, vertex and object drag, lasso, rotate and delete. The token click and the background pick write through the model. Unit tests for both.                                                                                  | SPEC-067, SPEC-060 §2–§5, DEC-134 | IN-205                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-221 and WI-228; before IN-199 and IN-204. |
| WI-230 | The token layer leaves `VectorMapView` for a `map/token-layer.svelte.ts` controller, behaviour-identical: the per-token container map and sync passes, texture load and rasterize, broken-image and away badges, the sprite drag (single, collapsed group, set), the snap on drop, the undoable moves, `addCreature`, the quick-sheet drop and the focused token. It keeps its own sprite handlers rather than joining the stage ladder. Unit tests drive `sync`, the drop and `addCreature` without a browser. | SPEC-068, SPEC-060 §2–§5, DEC-135 | IN-199                         | claude-code | sonnet | xhigh  | ✅ **Gate cleared — user, 2026-10-10.** After WI-229; before IN-204.                       |
| WI-231 | Stage pointer dispatch leaves `wireStagePointerEvents` for a `map/map-pointer-router.ts` `MapPointerRouter`, behaviour-identical: one ordered list `[labels, hex, draw, editor]` built in the component, the guards, first-consumer-wins down/move/up, a non-consuming `hover` hook every handler gets on every move, and the `pointerOut`/`cancel` fan-outs. `editor` is the component's stroke tools as one handler. Double-click and keys stay. Unit tests drive the router with a fake stage.               | SPEC-069, SPEC-060 §4, DEC-136    | IN-204                         | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-230.                                      |

### WI-233 (newer room hard stop)

Ahead of the map-controller refactors (WI-226 – WI-231): independent of `VectorMapView`,
and every deploy until it lands can delete newer data from an open tab. Contract change
(RULE-001): `NewerRoom` and `NewerRoomError` join the `CampaignStore` contract with cases in
`campaign-store.contract.ts` passing against `MemoryStore`, `FirebaseStore` and
`LocalStore`. No schema, migration, rules or stored-field change; `schemaVersion` is never
re-stamped (SPEC-070 §1). Two additive testids. Updates SPEC-062 §5 and README where it
describes the room subscription (RULE-018). If DEC-137 is answered (b), the row narrows to
SPEC-070 §3 alone on the parsed `Room` and drops the contract change.

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

### WI-229 (selection model and Select controller)

After WI-221 (whose token container rewrites the sprite pointer handler that writes
`selectedTokenIds`) and WI-228 (the last scheduled extraction in `VectorMapView`); before
IN-199 and IN-204, which are then handed a settled selection (SPEC-067 §7, reversing
WI-171's "IN-205 last"). Identical-outputs refactor (SPEC-060 §5) except the test-only
`selection-count` readout, which becomes `$derived` (SPEC-067 §2). No store, schema, rules,
layer or testid change; every write is the same store call or `applyOp` op. The controller
is handed square-lattice conversions only (RULE-006). Repoints whatever WI-227 hands its
controller to report a background pick. Updates README → "The selection model" where it
names the extracted code (RULE-018). If the move needs a store method or changes what a
selection means, stop and log an intake item.

### WI-228 (hex authoring controller)

After WI-226 (whose Measure reads `hexAt`, and which also edits `wireStagePointerEvents`) and
WI-227. Identical-outputs refactor (SPEC-060 §5, SPEC-066 §6): no store, schema, rules,
layer or testid change; every write is the same store call with the same arguments. The
controller is constructed only on hex maps (DEC-133) and is never handed a square-lattice
conversion (RULE-006); Measure is repointed to `hex?.hexAt ?? null`. Oracle: the hex
Playwright specs unchanged. Updates README's hex sections where they name the extracted
code (RULE-018). If the move needs a store method or changes what a coordinate means, stop
and log an intake item.

### WI-227 (background controller)

After WI-217 (hex-native placement, which rewrites these lines) and WI-218 (the protocol's
first implementer). Identical-outputs refactor (SPEC-060 §5): no store, schema or rules
change, no testid moves; the controller is handed the coordinate conversions the map's grid
kind declares (RULE-006) and calls `patchBackground` as it stands. Updates README →
"Background management" where it names the extracted code (RULE-018). If the move needs a
store method or changes what a placement means, stop and log an intake item.

### WI-226 (draw controller)

After WI-218, which also changes `VectorMapView`; independent of WI-221 (token layer).
Identical-outputs refactor (SPEC-060 §5): pen, ping, measure and cursor publishing keep
their store routing (RTDB for the high-frequency half, RULE-003) and the multiplayer-only
guard that keeps a local build from opening those listeners (SPEC-041 §3). `measureDrag`
and `measureHexDrag` reach `renderAll` and `cancelStroke` only through the controller and
`invalidate`. Updates README where it names the extracted code (RULE-018).

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
