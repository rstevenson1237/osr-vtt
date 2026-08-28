# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                                                                          | Spec           | From   | Agent         | Model    | Effort | Gate                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | --------------------------------------------------------------------------- |
| **WI-091** | Redraw all 34 `IconId` glyphs under SPEC-043 — Direction A, "the implement"; `dice`, `tools`, `ruler` are the three that failed | SPEC-043 | IN-074 | `claude-code` | `sonnet` | medium | ✅ **Gate cleared — user, 2026-08-28.** |

The previous batch has fully landed; see §3 for its completion records. **WI-091 opens a
new batch** and is independent of everything in it (RULE-019 — ids are never reused;
WI-090 was the last id issued).

**WI-089 has run and closed (2026-08-18)** — local mode exists. `LocalStore` is
`MemoryStore` plus a debounced, whole-file `.vttcamp` write-back and passes the full
contract suite as the third implementation (RULE-001); `pnpm build:local` builds the
`local-build` Vite mode, which aliases the store touchpoint to a Firebase-free
`client.local.ts` **in the resolver**, so the output greps zero matches for
`firebase|firestore|osr-vtt|appspot|identitytoolkit|firebaseio` (main chunk 4.38 MB →
3.62 MB); one `SESSION_MODE_KEY` flag, read in six containers, removes SPEC-041 §3's list
by not rendering it; the local lobby offers Open campaign… / New campaign… and nothing
else. **SPEC-041 is Completed.** Three unblocking changes were needed and are recorded
under Deviations — `MemoryStore.importRoom` was dropping document ids, and the local
bundle only stops carrying the Firebase SDK once `FirebaseStorageAssetStore` leaves
`asset-store.ts` and `@osr-vtt/shared` is marked side-effect-free. One item of §3's
removed list, **shared rolls and roll readiness**, could not be removed by not rendering:
the encounter board's Call for initiative is the only way to open one and its Roll/Apply
actions live in the readiness panel, so removing it would remove a feature §3 keeps. See
`docs/completed/WI-089.md`.

WI-066 closed 2026-08-14 and was the last item in the previous ledger; this batch starts at
**WI-083** (RULE-019 — ids are never reused).

**WI-084 has run and closed (2026-08-18)** — `MapBackground.locked`, schema v27, the
lock backfill, `setBackgroundLocked` and the Assets-panel toggle (`docs/completed/WI-084.md`).

**WI-085 has run and closed (2026-08-18)** — Select picks up an unlocked background on the
canvas, lowest priority behind vertex handles, whole objects and the lasso; move and resize
(the existing single ratio-locked handle) in one gesture; `background-adjust-{id}` and the
`MapToolController.selectedBackgroundId` bridge are retired (`docs/completed/WI-085.md`).
PR #123's CI caught an unrelated `room-uploads.emulator.test.ts` timeout flake (Storage
emulator jar still downloading when the test ran); user-approved deviation bumped it to
15s, re-verified against the emulator, and pushed (see Deviations, `docs/completed/WI-085.md`).
**WI-086 has run and closed (2026-08-18)** — `background-transform.ts`'s `resizeBackground`
is now handle-parameterised (`BgHandle`), `backgroundHitTest` grows to all eight handles
plus the body (corner-before-edge, handle-before-body), and `vector-engine.ts` draws all
eight; the stored `x, y, w, h` shape is untouched, so no migration ships
(`docs/completed/WI-086.md`). PR #124's first CI run hit the same
`room-uploads.emulator.test.ts` Storage-emulator-jar-download flake WI-085's PR #123 hit
(the 15s bump wasn't enough on a second cold run); user-approved deviation bumped it to
30s and pushed (see Deviations, `docs/completed/WI-086.md`).

**All eight gates cleared (user, 2026-08-17)** — "schedule everything as approved", the
whole batch in one disposition. Clearing a gate does not lift a constraint: **WI-088 was
still a standalone `RULE-AMENDMENT:` change on its own branch (RULE-017), WI-089 was still
blocked on it, and WI-090 on WI-089.** Approval is permission to start in the stated order,
not permission to bundle. **WI-088 landed 2026-08-18 on exactly that shape**, unblocking
WI-089, which landed the same day and unblocked WI-090 in turn — all three now closed.

### Ordering and constraints

**Gate cleared 2026-08-28 (user).** Approval is permission to start on the scope as
specified — SPEC-043's 34 glyphs plus the documentation — and is not permission to widen
it. See constraint 3 below, raised at the gate itself.

**WI-091 has no predecessor and blocks nothing.** It touches one file's `MARKUP` record
plus documentation, so it neither waits on nor holds up any other item, and it can be run
against `main` whenever it is scheduled.

**Two constraints the execution session must not lose.**

1. **`README.md` is part of this work item, not of this plan.** Nothing has been written to
   it here, deliberately — `README.md` documents *present-day* behaviour, and until the
   glyphs are actually redrawn the depiction rule is intent, which is what SPEC-043 is for.
   The execution PR adds the icon-system paragraph to README's "Session shell — quick
   sheets (II.1)" section and cross-references SPEC-043 §3 from the map-palette prose
   around the `tool-groups.ts` description. RULE-018 is satisfied by that PR, not by this
   one.
2. **34 glyphs, not 33.** The design canvas drew 33 — `fullscreen-exit` was not among them,
   being the mirror of `fullscreen`. It is still an `IconId` and it is still in scope; it
   is drawn during execution, mirroring whatever `fullscreen` becomes.
3. **The focus and disabled states are NOT in this work item** (IN-075). The design canvas
   showed five button states; only three of them — rest, hover, active — exist in the shell
   icon chrome today, and those three are what SPEC-043 §5 documents as unchanged. The
   focus ring and the disabled dimming on that board were proposals drawn without being
   labelled as such: there is no `:focus-visible` rule anywhere on the rail toggles, the
   view tabs or the map toolbar. Execution must not add them on the strength of the canvas.
   Logged as IN-075 and awaiting its own triage.


**WI-083 has run and closed (2026-08-17), ahead of WI-084 – WI-086 as planned.** It
live-reproduced one runtime error (a second GM removing a background the first GM is
mid-drag on throws an uncaught `FirebaseError`, IN-067) and confirmed two more by code
reading (`applyBackgrounds`'s all-or-nothing texture load, IN-068; backgrounds placeable
on hex maps in an undefined coordinate space, IN-069) — see `docs/completed/WI-083.md`.
None of the three changes WI-084 – WI-086's scope: they are independent of the
lock/select/handle rewrite these items make, and none of them is the Fit-to-grid
canvas-swallowing defect that IN-060 already knew WI-084 – WI-086 exist to fix. All three
are logged as their own intake items (DEC-027) and await triage rather than being fixed
here.

**WI-084 → WI-085 → WI-086 is a hard chain.** Select cannot ask whether a background is
unlocked until the field exists, and the handle model is only reachable through the
selection that WI-085 builds. WI-086 could technically land before WI-085 (the math is pure
and testable on its own) but would then be unreachable from the UI, which is how WI-039
ended up shipping a renderer with no producer.

**WI-087 has run and closed (2026-08-18)**, independent of the background chain as
planned — `Token.name` and schema **v28** (the migration deliberately backfills nothing:
`creatureLabel`'s output is the very ref fragment IN-064 is about), `setTokenName` on the
contract suite, the picker's Name + Quantity fields, and generated symbols that are
uppercase and **per group**, restarting at A. The board card, the quick sheet header and
the initiative order all resolve one name through `creatureDisplayName`; the last of those
was printing a whole `gen:disc:` ref. SPEC-040 §5's "the map token's label" is annotated in
place rather than built — a map token renders no text label and §4 defines its on-map
identity as the letter; giving it one is a new intake item. **SPEC-040 is Completed.** See
`docs/completed/WI-087.md`.

**WI-088 → WI-089 → WI-090 is a hard chain, and the first link is a rule.** RULE-009 stated
the backend as fact, so a backend-less build contradicted it as written; RULE-017 required
the amendment to be its own change, its own branch, its own `RULE-AMENDMENT:`-prefixed
commit and its own approval, landing **before** any implementation. This is the same shape
WI-037 and WI-065 took.

**WI-088 closed 2026-08-18** — the amendment landed on its own branch and its own
`RULE-AMENDMENT:`-prefixed commit. RULE-009 is now **"Backend, per build"**: the hosted
Firebase/Spark backend is restated word for word and unchanged, a local build with no
backend, no identity and no network is admitted beside it, RULE-003, RULE-004, RULE-011 and
RULE-012 are **scoped to the hosted build** (none weakened), and RULE-001 and RULE-014 are
recorded as binding *harder* locally. SPEC-041's blocking note is cleared. See
`docs/completed/WI-088.md`. **WI-089 then closed on 2026-08-18** and built the local
runtime, so **WI-090 was unblocked**: it had a real bundle to package, a real
`pnpm build:local` to run, and a measured Firebase-free result to mechanise in CI rather
than a hypothesis (`docs/completed/WI-089.md`).

**WI-090 closed 2026-08-18** — investigation only (RULE-015), no product code. Built and
grepped both bundles fresh (0 Firebase/project hits in `dist-local` vs 179 in `dist`,
matching WI-089's numbers exactly); built and live-ran a real no-install launcher (a Node
22 Single Executable Application — 0 installed dependencies, but 119 MB raw / 44 MB zipped
per platform); zipped, unzipped and served the bundle to simulate a real downloaded
release, and drove it in headless Chromium through a full create → render → save →
download round-trip with zero console errors and zero non-localhost requests; and live-
reproduced a real gap — a `.vttcamp` with a `schemaVersion` newer than the running build's
opens silently, with no guard, unlike the (correctly guarded) older-archive direction. Four
new intake items logged (IN-070 – IN-073), awaiting triage. See `docs/completed/WI-090.md`
and `INTAKE.md`'s "Findings from the IN-066 packaging investigation".

**Suggested execution order:** WI-083, WI-084, WI-085, WI-086, WI-087, WI-088, WI-089,
WI-090 — all landed. The local-runtime trio was last because it was the largest and because the four
background items were playtest findings against shipped behaviour — the same reasoning as the
2026-08-02, 2026-08-03 and 2026-08-11 priority rulings.

### Schema versions in this batch

Two schema bumps land in order: **v27** (WI-084, `MapBackground.locked` — landed
2026-08-18) then **v28** (WI-087, `Token.name` — landed 2026-08-18,
`CURRENT_SCHEMA_VERSION = 28`). Both took the numbers the spec text predicted. If the execution order changes, the numbers follow the order they
actually land in — the spec text names the version each work item is expected to take, and
the execution session is responsible for reconciling it against
`CURRENT_SCHEMA_VERSION` rather than trusting the spec's number (RULE-007).

Execution order: — (WI-029, WI-031, WI-032, WI-033, WI-034, WI-035, WI-036, WI-037, WI-038, WI-039, WI-040, WI-041, WI-042, WI-043, WI-044,
WI-045, WI-046, WI-047, WI-048, WI-049, WI-050, WI-051, WI-052, WI-053, WI-054, WI-055, WI-056,
WI-057, WI-058, WI-059, WI-060, WI-061, WI-062, WI-063, WI-064, WI-065, WI-066, WI-067, WI-068, WI-070, WI-071, WI-073,
WI-074, WI-075, WI-076, WI-077, WI-078, WI-079, WI-080, WI-081, WI-082, WI-083, WI-084, WI-085, WI-086, WI-087, WI-088, WI-089, WI-090 completed; see §3.)

---

One ordering constraint, the rest is preference:

- **WI-054 → WI-055 → {WI-056, WI-057}** is a hard chain: the ownership predicate needs
  the actor key to exist, and both consumers need the predicate. WI-056 and WI-057 were
  independent of each other and could swap. **All four have landed** — WI-054, WI-055,
  WI-056 and now WI-057, which gates `pointerdown` on `canActOnToken`. SPEC-032 is
  Completed.

**WI-054 had to account for WI-050**, which landed first: both touch `ProfileInstance`.
WI-050 took the schema to **v20** and made `color` a value every character always has,
resolved through `assignedCharacterColor(seatId)` rather than stored on every document
(DEC-040). WI-054 re-keys the document id from a seat id to an actor id — so its migration
started from v20, and its actor key became the input to that colour derivation for a
creature, which its gate had to answer rather than inherit. **Answered: DEC-042** — the
colour guarantee stays a _character_ guarantee and does not follow the key. **WI-056
resolved the consequence for the quick sheet:** a creature's colour swatches start with
none selected, and picking one is what gives it a colour for the first time.

**Priority (user, 2026-08-02).** Every item raised in this session — **WI-046 – WI-057** —
runs **before** the Battle Map (WI-033 – WI-036) and Hex Crawl (WI-037 – WI-041) series:
they are more impactful for gameplay today. Both large series keep their internal order
and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041** and is still a standalone `RULE-AMENDMENT:` change on its own branch
(RULE-017) whenever it is reached.

**Priority (user, 2026-08-03).** The mobile, carve-artifact and credits items —
**WI-058 – WI-064** — run **before** the Battle Map (WI-033 – WI-036) and Hex Crawl
(WI-037 – WI-041) series, on the same reasoning as the 2026-08-02 ruling: they are
playtest findings against shipped behaviour. The **Blaze** pair (WI-065, WI-066) runs
**last, after both large series** — the user's words were "schedule it after the battle
map and hex crawl wi, everything else comes before". Both large series keep their internal
order and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041.**

Three of the seven new items are Simple and mutually independent — **WI-058, WI-059 and
WI-060** — and between them cover the two most visible complaints (Safari clipping the
toolbars, thin paths going triangular) plus the credits. None of them waited on an open
decision except WI-059, whose DEC-047 was the least contentious of the batch. **WI-058 and
WI-059 have both landed** (2026-08-04); WI-060 remains. The four Deceptive items each
carry an Open decision and must not start before it is answered.

**Two ordering constraints inside the new batch.** **WI-061 → WI-062**. The bend-axis latch
rewrites which leg is built first, and WI-061 rewrites how a leg is built at all; doing
them in the other order means building the latch against geometry that is about to change.
**Both landed 2026-08-04, in that order**, and the constraint paid off: §9's
interior/terminal rule was already in `bandRect` when the latch arrived, so the latch is
read in gesture order over it rather than duplicated per axis. And **WI-067 → WI-063**: while `isMobile` answered both "is this touch?" and "is this the
mobile layout?", a hover equivalent could not be specified for one without silently binding
the other (DEC-052). **WI-067 landed 2026-08-04**, giving WI-063 two separable signals to
specify against — `ShellMedia.isNarrow` for the layout and `isCoarsePointer` (plus
`theme/sizing.css`'s `(pointer: coarse)` block) for touch — and **WI-063 landed 2026-08-08**
on exactly that split, taking `isCoarsePointer` as a prop into `VectorMapView` and leaving
`isNarrow` untouched. **WI-064 landed 2026-08-08**, last of the batch — it sequenced after
WI-058 because it extends that viewport baseline, and it closes SPEC-033.

**IN-014's item shipped as WI-068** (2026-08-03), ahead of WI-058 in execution order, per
its own gate; see §3.

**Cleared gates.** **WI-058** (user, 2026-08-03) — landed 2026-08-04; see §3. **WI-059**
— landed 2026-08-04; see §3. **DEC-046, DEC-047 and DEC-048 were ratified
as recommended** in the same turn, which unblocked WI-059, WI-061 and WI-062 — **all
three landed 2026-08-04**; see §3. **DEC-049 was answered (c)** and **DEC-052 (b)** later the same day; WI-066
stays blocked on WI-065 alone, which RULE-017 requires to land on its own. Nothing from
this batch is now waiting on a decision.

**WI-069 landed 2026-08-07** — the token-optimization refactor (SPEC-035); see
`docs/completed/WI-069.md`. It is the reason `SPEC.md`, `DECISIONS.md` and
`PLAN-COMPLETED.md` are now indexes over `docs/spec/`, `docs/decisions/` and
`docs/completed/`, and the reason execution sessions run `sonnet` by default.

**All remaining gates cleared** (user, 2026-08-08): **WI-033–WI-036, WI-038–WI-041,
WI-065, WI-066, WI-070** — approved and scheduled. **WI-033 landed 2026-08-09**, first of
the Battle Map series — `GameMap.battle`, schema v22, and the rule that a battle map never
survives a `.vttcamp` (SPEC-029 §3); see `docs/completed/WI-033.md`. **WI-070 landed
2026-08-09** — the `portability.spec.ts` un-quarantine (SPEC-036); see
`docs/completed/WI-070.md`. The e2e battery now carries no `test.fixme`. **WI-034 landed
2026-08-09** — the capture tool (SPEC-029 §1): `vectorMap.captureRect`, the `capture`
`MapToolId` in the `shapes` group (referee-only, filtered out of `MapToolbar` for a
non-GM seat), its own `theme.battleCapture` preview colour, and
`MapToolController.pendingBattleCapture` as the commit target — still no document write,
so WI-035 – WI-036 inherit a schema with no producer; see `docs/completed/WI-034.md`.
**WI-035 landed 2026-08-09** — the §4 render differences: a bounded camera
(`VectorMapEngine.setCameraBounds`, geometry in `map/pan-zoom.ts`), the doubled grid and
halved per-square display value, and the `toolSubset` prop threaded
`MapToolsSheet → MapToolPalette → MapToolbar` that leaves a battle map with the View tools
only; all three derived from `GameMap.battle`, none stored. See `docs/completed/WI-035.md`.
**WI-036 landed 2026-08-10** — the §5 quick sheet: `CampaignStore.createBattleMap`/
`exitBattleMap` (RULE-001, both new to the contract suite), the preview thumbnail
(`VectorMapEngine.exportPng` reused with an explicit frame, `hideGrid` and background-colour
compositing — SPEC-029 §2), and Start/Exit. This is the producer WI-035's differences and
WI-034's capture were waiting on; SPEC-029 is now Completed. See `docs/completed/WI-036.md`.
**WI-071 closed 2026-08-11** — ledger repairs: SPEC-028 index cell, hex-grid "Deferred"
entries annotated as stale, IN-041 moved from §1.1 to §1.2; see `docs/completed/WI-071.md`.
**WI-082 closed 2026-08-13** — group card "Tidy" (DEC-067): `tidyGroupUpdates` grid-
arranges a group's members on demand, a batched `moveTokens` write that never touches
`memberOffsets`; see `docs/completed/WI-082.md`. The map-tools/backgrounds playtest
batch (WI-072 – WI-082) is now fully closed.
**WI-037 closed 2026-08-13** — the `RULE-AMENDMENT` that scopes RULE-006's
single-coordinate-space guarantee per grid kind, on its own branch and its own
`RULE-AMENDMENT:`-prefixed commit (RULE-017); SPEC-030's blocking warning is cleared and
WI-038 – WI-041 may begin. See `docs/completed/WI-037.md`. **WI-065 carried the same
standalone-`RULE-AMENDMENT`-commit requirement and closed 2026-08-14.**
**WI-038 closed 2026-08-13** — the first of the Hex Crawl implementation items and the
one WI-037 gated: SPEC-030 §1's axial space (`packages/shared/src/map/hex/`, exported as
the `hexMap` namespace beside `vectorMap`), `GameMap.hex` as the map's grid kind, schema
**v24** and its migration, `createMap({ gridKind })` as the only producer, and the
RULE-007 `.vttcamp` round-trip. See `docs/completed/WI-038.md`.
**WI-039 closed 2026-08-13** — the renderer WI-038 left missing, completing SPEC-030 §1:
`VectorMapEngine.renderHexGrid`, mutually exclusive with `renderGrid` because one map has
one coordinate space; the pure viewport culling in `packages/shared/src/map/hex/grid.ts`;
the `axialKey` coordinate pill on every hex; and a camera that opens on `0,0`. It also
carries the two things that made the renderer reachable and safe, both recorded as
**Deviations**: the UI producer WI-038 explicitly left unbuilt (**"+ New hex crawl"** in
`MapsPanel`), and the blunt form of §5's tool filtering — a hex map offers the **View
tools only**, through the same `toolSubset` path a battle map uses, so a square-lattice
carve gesture cannot write cell-space geometry onto an axial map (RULE-006). **WI-041
still owns §5 proper** — the overlay tools a hex map should keep, plus the hex-tile quick
sheet — and replaces that subset rather than inheriting it. See
`docs/completed/WI-039.md`.
**WI-040 closed 2026-08-14** — SPEC-030 §§2–3 as a model, a store and a renderer: the
`hexTiles` collection (one sparse document per painted hex, **keyed by its own
`axialKey`** so the coordinate is stored once and `HexTile.hex` is parsed back out of the
id), schema **v25** and its no-op migration, three store methods on the contract
(`subscribeHexTiles`/`setHexTerrain`/`setHexContents`, RULE-001), member-or-GM
`firestore.rules` with rule tests (RULE-004 — §3's "any seat" read literally), the
terrain/contents catalogs on the symbol-catalog pattern with 20 original white-authored
SVGs, and `VectorMapEngine.renderHexTiles` — **the renderer's first per-region fill**,
where a square map paints one themed colour under its whole floor. Clearing a hex's last
field deletes its document: an infinite plane is only storable sparsely. **Nothing
authors these yet** — no UI sets a terrain, because SPEC-030 §5's hex-tile quick sheet is
WI-041, which is the one remaining Hex Crawl item. See `docs/completed/WI-040.md`.
**WI-066 closed 2026-08-14** — the second half of the Blaze pair and the last item in the
ledger: SPEC-034 §§2–4 as `firebase/storage.rules` (per-object size, an image content-type
allowlist, the `rooms/{roomId}/uploads/{uid}/{objectId}` path shape and a cross-service
membership check) with 26 rule tests (RULE-004), the client-side usage readout and soft cap
in `upload-containment.ts` — **friction, labelled as such**, because an aggregate quota
needs a trusted writer RULE-010 forbids — `deleteRoom`'s object sweep (§4), and the
`[HUMAN]` runbook at `docs/runbooks/blaze-billing.md`. **Nothing changes in any build that
exists today:** uploads stay off until `VITE_ENABLE_STORAGE_UPLOADS=true`, and that flag
must not be set before the runbook's console steps. SPEC-034 is Completed. See
`docs/completed/WI-066.md`.
**WI-065 closed 2026-08-14** — the `RULE-AMENDMENT` DEC-049 (c) called for: RULE-010's
economic premise is now stated per tier, the no-Cloud-Functions clause stands unchanged,
and the Blaze consequences (per-write containment only, App Check no longer optional, a
billing budget that warns rather than caps, and the exposure beyond Storage) are recorded
in the rule itself. WI-066 is unblocked. See `docs/completed/WI-065.md`.
**WI-041 closed 2026-08-14** — the last of the Hex Crawl series and the authoring half
of WI-040: `HexTile.note` (schema **v26** and its no-op migration) with `setHexNote` on
the contract and the hover tooltip §4 asks for, plus the hex-tile body of the Map tools
sheet — Select picks a hex, the sheet paints its terrain, its contents and its note.
`HEX_TOOL_IDS` replaces WI-039's View-only subset with **Select plus the View tools**,
and is **narrower than SPEC-030 §5's own wording**: every overlay tool stores
square-lattice geometry, so admitting one would put a second coordinate space on an
axial map (RULE-006). §5 is annotated in place rather than the rule bent; giving an
overlay tool an axial-space form is a new intake item. **SPEC-030 is Completed** and the
Hex Crawl series (WI-037 – WI-041) is fully closed. See `docs/completed/WI-041.md`.

**Priority (user, 2026-08-11).** The map-tools/backgrounds playtest batch — **WI-072 –
WI-082** — runs **before** the Hex Crawl series (WI-037 – WI-041), on the same reasoning
as the 2026-08-02 and 2026-08-03 rulings: these are playtest findings against shipped
behaviour. WI-037 keeps its own cleared gate; only its position moves, again. The Blaze
pair (WI-065, WI-066) stays last, per the 2026-08-03 ruling.

Three of the twelve are Simple and mutually independent — **WI-072, WI-073 and WI-075** —
covering ledger bookkeeping, the seed defaults, and the Label/Symbol snap selector. (WI-071
landed 2026-08-11; WI-072 is the next.) The remaining nine each carried an Open decision
(DEC-060 – DEC-067, all eight answered in the same planning session) before they could
schedule.

**One hard chain: WI-080 → WI-081 — both landed.** The background transform UI had
nothing to write to until the `backgrounds` subcollection and its Firestore rules existed
— **WI-080 landed 2026-08-11** (schema v23, the subcollection, its rules and the five
store methods), and **WI-081 landed 2026-08-12** on top of them: the Assets-activity
`BackgroundsPanel`, the GM-only canvas move/resize with the native ratio locked, and the
alignment overlay. SPEC-038 is complete and every `session-background-*` testid is
retired; see `docs/completed/WI-080.md` and `docs/completed/WI-081.md`. WI-078 ran before
WI-079 (preference, not a hard chain) because the lasso's vertex index is a natural place
to hang the vertex-attraction hit-test against — **WI-078 landed 2026-08-11**, so that
index (`vertexHandles`, now carrying each floor vertex's ring position) is in place; see
`docs/completed/WI-078.md`. The preference paid off: **WI-079 landed 2026-08-11** reading
that same catalog at the same `PICK_PX` radius, so free-snap attraction and Select's
picking agree on what counts as "on" a vertex by construction rather than by a second
hit-test — and it closes SPEC-028's third reopening, taking the spec to Completed; see
`docs/completed/WI-079.md`. Everything else in the batch is independent and could run in
any order; the table above states one, for reproducibility.

**Edge-dragging was retired with WI-078** (landed 2026-08-11). `selectEdge` — the ability
to grab a wall, door, or floor-ring edge and drag both endpoints together — went away when
Select consolidated (DEC-060); moving a wall now means dragging each endpoint. Recorded
here because it is the one capability loss in this batch and does not show up anywhere
else in the ledger.
