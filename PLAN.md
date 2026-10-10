# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-232**, **IN-229**, **DEC-137**, **SPEC-070**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Spec                              | From   | Agent       | Model  | Effort | Gate                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ | ----------- | ------ | ------ | ------------------------------------------------------------------------------------------ |
| WI-217 | Hex-native background placement: on hex maps a background stores its corners as `HexPoint`s, migrated v34→v35 from today's placement; move/resize, Add and Fit work in axial space; no square alignment overlay on hex maps.                                                                                                                                                                                                                                                                                               | SPEC-059 §3, DEC-125              | IN-069 | claude-code | opus   | xhigh  | ✅ **Gate cleared — user, 2026-10-06.** After WI-216.                                      |
| WI-218 | First seam extraction under the controller protocol: the label editor, hover/pinned tooltip, coarse-pointer note dot and anchor maths leave `VectorMapView` for `map/map-seam.ts` (`MapSeamDeps`) and a `map/map-labels.svelte.ts` controller, behaviour-identical. Unit tests drive the controller with a fake `invalidate`.                                                                                                                                                                                              | SPEC-060 §2–§5, DEC-126           | IN-203 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-06.** After WI-217.                                      |
| WI-219 | Store updates to a missing document are a quiet no-op everywhere: every single-document update method resolves without effect in all three stores (`FirebaseStore` swallows only `not-found` through one helper); `moveTokens` skips missing tokens; `transferGM` rejects all-or-nothing. Asserted per method by the contract suite against all three stores.                                                                                                                                                              | SPEC-061, DEC-127                 | IN-226 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-06.** Independent of WI-216–WI-218.                      |
| WI-220 | A `.vttcamp` from a newer build is refused: the reader rejects a `formatVersion` or room `schemaVersion` above this build's before any migration, in hosted import and local open alike, with a message saying to update; exports stamp an optional `exportedBy` build version in the manifest so the message can name both builds.                                                                                                                                                                                        | SPEC-062, DEC-128                 | IN-072 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-06.** Independent of WI-216–WI-219.                      |
| WI-221 | Each token is one Pixi container: disc, sprite, letter, badges and ring are children positioned once, so a token moves together by construction; the six per-token maps become one and the drag re-sync is deleted. Rings and group count badges render above all token art. Behaviour otherwise identical.                                                                                                                                                                                                                | SPEC-063, DEC-130                 | IN-113 | claude-code | opus   | high   | ✅ **Gate cleared — user, 2026-10-07.** After WI-218; before IN-199.                       |
| WI-222 | Map settings move to Assets: Grid & measurement and Fog of war leave the Session settings modal for a new `MapSettingsPanel` in the Assets activity, between Maps and Background, with unchanged content; `session-grid-*` testids become `grid-*` and the specs that reach them open Assets.                                                                                                                                                                                                                              | SPEC-064, DEC-131                 | IN-206 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-07.** Independent of WI-217–WI-221.                      |
| WI-223 | The Yjs transport ships the edit, not the document: `rooms/{roomId}/yjs/{docName}` becomes a snapshot `s` plus a `push()` log `u`; `mergeYUpdate` appends, `subscribeYState` delivers each update alone, a transaction compacts the log every 50 entries; today's string node migrates in place on first use. `subscribeYState`'s guarantee becomes "apply every callback".                                                                                                                                                | SPEC-065, DEC-132                 | IN-210 | claude-code | opus   | high   | ✅ **Gate cleared — user, 2026-10-07.** After WI-219.                                      |
| WI-224 | `exportRoom` exports every Yjs doc a room holds, not only `notes`: players' per-map-room notes (`room-notes`) now reach the `.vttcamp` and survive a local-build save and reopen. Same record, one more key; no format, schema or signature change. Round-trip test for the second doc in the shared contract suite, against all three stores.                                                                                                                                                                             | README → Players' notes (no SPEC) | IN-228 | claude-code | sonnet | medium | ✅ **Gate cleared — user, 2026-10-07.** After WI-223.                                      |
| WI-225 | **Investigation, findings only, no code edits:** can a stale tab (its `CURRENT_SCHEMA_VERSION` below a live hosted room's `schemaVersion`) write stripped data back? Trace every write path that sends a whole-object field after `migrateRoom` no-ops and `RoomSchema` strips unknown fields; find what a tab can use to detect a newer room; set out the options (reload prompt, read-only, hard stop). Output: a findings note, one new intake item per finding (DEC-027), and a recommendation for the fix's own gate. | docs/spec/SPEC-062.md §5          | IN-227 | claude-code | opus   | high   | ✅ **Gate cleared — user, 2026-10-07.** After WI-224.                                      |
| WI-226 | Pen, ping, measure and cursor publishing leave `VectorMapView` for a `map/map-draw.svelte.ts` controller under the seam protocol, behaviour-identical: the live pings, ping resolution, freehand stroke, throttled cursor publish and their three pointer handlers. RTDB-versus-Firestore routing and the local-build listener guard move unchanged. Unit tests drive the controller with a fake `invalidate`.                                                                                                             | SPEC-060 §2–§5, DEC-126           | IN-202 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-09.** After WI-218.                                      |
| WI-227 | Background sprite lifecycle and the move/resize gesture leave `VectorMapView` for a `map/map-backgrounds.svelte.ts` controller under the seam protocol, behaviour-identical: `applyBackgroundColor`, `applyBackgrounds`, the `bgSprites` map and the hit-test and begin/update/end gesture. Calls the existing `patchBackground`; the hex-axial placement WI-217 delivers moves as it stands. Unit tests drive the controller with a fake `invalidate`.                                                                    | SPEC-060 §2–§5, DEC-126           | IN-200 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-09.** After WI-217 and WI-218.                           |
| WI-228 | Hex authoring leaves `VectorMapView` for a `map/map-hex.svelte.ts` controller constructed only on hex maps, behaviour-identical: Select's hex pick, the Symbol, Road/River, Label, Terrain and Reveal/Hide hex tools, the hex note hover, the hex-tile sheet handlers, the hex fog stroke and the three hex subscriptions. The controller is the only place a pointer becomes an axial coordinate. Unit tests drive it with a fake `invalidate`.                                                                           | SPEC-066, SPEC-060 §2–§5, DEC-133 | IN-201 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-226 and WI-227.                           |
| WI-229 | The selection becomes one `MapSelection` model whose writers keep the four slots (handles, objects, tokens, background) mutually exclusive in one place, and the Select gesture leaves `VectorMapView` for a `map/map-select.svelte.ts` controller over it, behaviour-identical: pick, vertex and object drag, lasso, rotate and delete. The token click and the background pick write through the model. Unit tests for both.                                                                                             | SPEC-067, SPEC-060 §2–§5, DEC-134 | IN-205 | claude-code | sonnet | high   | ✅ **Gate cleared — user, 2026-10-10.** After WI-221 and WI-228; before IN-199 and IN-204. |
| WI-230 | The token layer leaves `VectorMapView` for a `map/token-layer.svelte.ts` controller, behaviour-identical: the per-token container map and sync passes, texture load and rasterize, broken-image and away badges, the sprite drag (single, collapsed group, set), the snap on drop, the undoable moves, `addCreature`, the quick-sheet drop and the focused token. It keeps its own sprite handlers rather than joining the stage ladder. Unit tests drive `sync`, the drop and `addCreature` without a browser.            | SPEC-068, SPEC-060 §2–§5, DEC-135 | IN-199 | claude-code | sonnet | xhigh  | ✅ **Gate cleared — user, 2026-10-10.** After WI-229; before IN-204.                       |
| WI-231 | Stage pointer dispatch leaves `wireStagePointerEvents` for a `map/map-pointer-router.ts` `MapPointerRouter`, behaviour-identical: one ordered list `[labels, hex, draw, editor]` built in the component, the guards, first-consumer-wins down/move/up, a non-consuming `hover` hook every handler gets on every move, and the `pointerOut`/`cancel` fan-outs. `editor` is the component's stroke tools as one handler. Double-click and keys stay. Unit tests drive the router with a fake stage.                          | SPEC-069, SPEC-060 §4, DEC-136    | IN-204 | claude-code | sonnet | high   | ⏳ **Awaiting gate** (DEC-136 open). After WI-230.                                         |

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

### WI-225 (stale tab vs newer live room, investigation)

After WI-224. Reads `packages/shared/src/converters.ts`, `migrations/index.ts`, `schemas.ts`
(`RoomSchema`) and the room write paths in `firebase-store.ts`; changes no code. Output is a
findings note under `docs/completed/WI-225.md` and one intake item per finding (DEC-027). A fix
that changes the room read path is a contract change and gets its own Deceptive gate and DEC.
`opus`: the output is a design.

### WI-224 (export room-notes)

After WI-223, which also changes `firebase-store.ts` (`getYState`). Changes `exportRoom` in
`firebase-store.ts` and `memory-store.ts` (`LocalStore` saves through the latter's path) to
export `room-notes` beside `notes`, plus a `collab.contract.ts` or `room.contract.ts` round-trip
case (export → import → `getYState` equal) run against all three stores. `snapshot.yjs` is
already `Record<string, string>` and `importRoom` already merges every key, so no
`.vttcamp` format, schema, migration or testid change. Updates README → "Players' notes" with
one sentence: both docs ride a `.vttcamp` (RULE-018). `sonnet`: bounded, no contract change.

### WI-223 (Yjs incremental transport)

After WI-219, which also changes `packages/shared/src/store/firebase-store.ts`. Changes
`FirebaseStore`'s `subscribeYState`/`mergeYUpdate`/`getYState`, the `subscribeYState` doc
comment in `campaign-store.ts` (RULE-001), `collab.contract.ts` (run against all three stores),
new `FirebaseStore` emulator tests (incremental delivery, compaction, concurrent compaction,
legacy-string migration — RULE-007), and `apps/web/tests/e2e/portability.spec.ts`'s direct RTDB
read. RTDB node shape changes (RULE-003); no rules, Firestore, `.vttcamp` or testid change;
`MemoryStore`/`LocalStore` and `YRoomProvider` unchanged. Updates README → "Players' notes"
(the node shape and the "no rules change" sentence) and SPEC-036 §3's RTDB-read sentence
(RULE-018). `opus`: RTDB structure, store contract and an in-place data migration.

### WI-222 (map settings in Assets)

Independent of WI-217–WI-221: it changes `SessionActivity.svelte`, `AssetsActivity.svelte`, a
new `shell/MapSettingsPanel.svelte`, their strings files, and three e2e files
(`session-config.spec.ts`, `backgrounds.spec.ts`, `helpers.ts`), never `VectorMapView`. Moves
and renames testids (RULE-005, SPEC-064 §2); no store, schema, rules or write-path change.
Updates README → "Session settings" (drop sections 2 and 3, renumber), "Fog of war" (where
the on/off switch lives) and "Background management" (the panel above it), and SPEC-049 §2's
"Session settings → Grid & measurement" pointer (RULE-018).

### WI-221 (token container)

After WI-218, because WI-216–WI-218 also change `VectorMapView.svelte`; before IN-199, which
extracts this code into a `TokenLayerController` and should extract one map, not six. Changes
the token render path in `VectorMapView.svelte` only: what the `tokens` layer contains
(RULE-006 trigger). No store, schema, rules or testid change. Verified by the existing
Playwright token specs unchanged plus a PNG export check (SPEC-063 §4). Updates SPEC-048 §4's
pointer and README where it describes token rendering (RULE-018).

### WI-220 (newer-build archive guard)

Independent of WI-216–WI-219: it changes `packages/shared/src/portability/vttcamp.ts`, its
tests, a `LocalStore` test and the `snapshotToArchive` call sites that pass `exportedBy`. A
guarantee on the `.vttcamp` reader (RULE-014); the manifest field is optional and additive,
so no `VTTCAMP_FORMAT_VERSION` bump and no migration (RULE-007). No store method, rules or
testid change. Updates README where it describes `.vttcamp` import and the manifest (RULE-018).

### WI-219 (store missing-document contract)

Independent of WI-216–WI-218: it changes `packages/shared/src/store/` and the contract suite,
not `VectorMapView`. Changes the `CampaignStore` contract (RULE-001): writes each guarantee on
the method doc comments in `campaign-store.ts` and extends `campaign-store.contract.ts` against
`MemoryStore`, `LocalStore` and `FirebaseStore`. Folds WI-215's `patchBackground` into the shared
helper. `moveTokens` keeps one batched commit on the normal path (RULE-003). No schema, rules or
testid change. Updates README where it states store error behaviour (RULE-018).

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
