# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order. Next free ids: **WI-222**, **IN-228**, **DEC-131**, **SPEC-064**. Intake still
waiting on a design conversation (the Deceptive items) is `INTAKE.md` §1.1.

| WI     | Description                                                                                                                                                                                                                                            | Spec                 | From   | Agent         | Model    | Effort | Gate                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------ | ------------- | -------- | ------ | --------------------------------------- |
| WI-217 | Hex-native background placement: on hex maps a background stores its corners as `HexPoint`s, migrated v34→v35 from today's placement; move/resize, Add and Fit work in axial space; no square alignment overlay on hex maps. | SPEC-059 §3, DEC-125 | IN-069 | claude-code | opus | xhigh | ✅ **Gate cleared — user, 2026-10-06.** After WI-216. |
| WI-218 | First seam extraction under the controller protocol: the label editor, hover/pinned tooltip, coarse-pointer note dot and anchor maths leave `VectorMapView` for `map/map-seam.ts` (`MapSeamDeps`) and a `map/map-labels.svelte.ts` controller, behaviour-identical. Unit tests drive the controller with a fake `invalidate`. | SPEC-060 §2–§5, DEC-126 | IN-203 | claude-code | sonnet | high | ✅ **Gate cleared — user, 2026-10-06.** After WI-217. |
| WI-219 | Store updates to a missing document are a quiet no-op everywhere: every single-document update method resolves without effect in all three stores (`FirebaseStore` swallows only `not-found` through one helper); `moveTokens` skips missing tokens; `transferGM` rejects all-or-nothing. Asserted per method by the contract suite against all three stores. | SPEC-061, DEC-127 | IN-226 | claude-code | sonnet | high | ✅ **Gate cleared — user, 2026-10-06.** Independent of WI-216–WI-218. |
| WI-220 | A `.vttcamp` from a newer build is refused: the reader rejects a `formatVersion` or room `schemaVersion` above this build's before any migration, in hosted import and local open alike, with a message saying to update; exports stamp an optional `exportedBy` build version in the manifest so the message can name both builds. | SPEC-062, DEC-128 | IN-072 | claude-code | sonnet | high | ✅ **Gate cleared — user, 2026-10-06.** Independent of WI-216–WI-219. |
| WI-221 | Each token is one Pixi container: disc, sprite, letter, badges and ring are children positioned once, so a token moves together by construction; the six per-token maps become one and the drag re-sync is deleted. Rings and group count badges render above all token art. Behaviour otherwise identical. | SPEC-063, DEC-130 | IN-113 | claude-code | opus | high | ⏳ Gate pending. After WI-218; before IN-199. |

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
