# INTAKE

Triage and intake ledger for request classification.

Every request enters here for triage (RULE-015).
See `PLAN.md` for active and upcoming work items.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 1. Intake triage

Classified, not necessarily scheduled. Classification is itself an approval gate:
nothing advances out of this table until the user approves the classifications.

The tables below are the **index**, split by status; each item's request, rationale and
disposition are the sections that follow, grouped by the batch they arrived in — that
prose record is never moved or trimmed, only the two index tables above it change as an
item's status changes. §1.1 holds every item still Open or Scheduled — this is the "what
is waiting" table. §1.2 is the closed-intake index: items whose disposition's work
item(s) have landed in §3. Retirement moves a row from §1.1 to §1.2 in the same pull
request that closes the work item; per RULE-019 no `IN-` id is ever deleted, reused or
renumbered by the move, only its table.

> **Reading the older rationales.** Items IN-001 – IN-021 were classified under the
> pre-WI-044 wording of the Deceptive triggers, which read _touches X_ rather than
> _changes the contract of X_. Their rationales are preserved as written. Where one says
> "touches", read it against the trigger list in force at the time; the classifications
> themselves were reviewed and stand.

### 1.1 Open and scheduled

| IN     | Item                                                                                                                                                | Classification                   | Status          | Disposition                                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN-044 | `SPEC.md` indexes SPEC-028 as Active; its body says Completed                                                                                       | **Simple**                       | **Scheduled**   | WI-071                                                                                                                                                                                                                      |
| IN-045 | `DECISIONS.md` still records the hex grid as Deferred                                                                                               | **Simple** (answered)            | **Scheduled**   | WI-071                                                                                                                                                                                                                      |
| IN-046 | IN-041 never moved to §1.2 after WI-060 landed                                                                                                      | **Simple**                       | **Scheduled**   | WI-071                                                                                                                                                                                                                      |
| IN-051 | Remove the starter map as a new map's default background                                                                                            | **Simple**                       | **Scheduled**   | WI-073                                                                                                                                                                                                                      |
| IN-055 | Profile Template defaults → HP, To Hit, Initiative                                                                                                  | **Simple**                       | **Scheduled**   | WI-073                                                                                                                                                                                                                      |
| IN-057 | Snap selector on the Label and Symbol tools                                                                                                         | **Simple**                       | **Scheduled**   | SPEC-028 §1, WI-075                                                                                                                                                                                                         |
| IN-067 | A second GM removing a background crashes the first GM's drag                                                                                       | **Deceptive** (proposed)         | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-068 | `applyBackgrounds` — all-or-nothing texture load, no drag guard                                                                                     | **Deceptive** (proposed)         | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-069 | Backgrounds are placeable on hex maps in an undefined space                                                                                         | **Deceptive** (proposed)         | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-071 | CI mechanical check — grep `build:local` output for Firebase hits                                                                                   | **Simple** (proposed)            | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-072 | No guard against opening a `.vttcamp` newer than the running build                                                                                  | **Deceptive** (proposed)         | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-076 | `room-uploads.emulator.test.ts` still times out on CI at a 30s budget (third occurrence)                                                            | **Simple** (proposed)            | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-078 | `ATTRIBUTION.md` is cited by SPEC-003 §5 but does not exist                                                                                         | **Simple** (proposed)            | **Open**        | Awaiting triage                                                                                                                                                                                                             |
| IN-084 | `snap = grid` — a fourth mode centring content on the grid lines, for every snapping tool                                                           | **Deceptive**                    | ⏸ **Postponed** | Postponed — user, 2026-09-02. DEC-080 narrows to its hex half.                                                                                                                                                              |
| IN-102 | "A click with no drag" has five different answers under Free; only Room's is cited                                                                  | **Deceptive**                    | **Open**        | Blocked on DEC-085 — answer before WI-104/WI-105                                                                                                                                                                            |
| IN-106 | Per-hex seeded scatter as the terrain texture, in place of the single centred overlay                                                               | **Deceptive** (proposed)         | **Open**        | Awaiting triage — from WI-100. **Survives DEC-082** (user, 2026-09-07): it stores nothing and never needed a region, so it is wanted under §7's click-per-hex tool exactly as it was under a brush. Not bundled into WI-111 |
| IN-113 | A token's drawings are five parallel maps with no per-token container                                                                               | **Deceptive** (proposed)         | **Open**        | Awaiting triage — the structural end state IN-112 fixes by convention; changes Pixi layer composition                                                                                                                       |
| IN-117 | Replacement `danger` contents art, in the WI-101 pack's stroked idiom | **Simple** (proposed) | **Open** | Awaiting triage — the project owner is authoring it (user, 2026-09-10, out of DEC-091 (c)); it lands as art plus an `ATTRIBUTION.md` entry, no catalog change beyond the `ref` |
| IN-151 | `INTAKE.md` §1.2's ~120 "Closed via" cells are multi-sentence prose, not the one-line shape SPEC-052 §1 gives a closed-intake row | **Simple** (proposed) | **Open** | Awaiting triage — WI-144's remainder (DEC-107's `PLAN.md`-only fallback); see `docs/completed/WI-144.md` Deviations |
| IN-156 | Persist the Edit/View choice per room instead of resetting to View every session | **Complex (Shape A)** | **Scheduled** | WI-189 — INT-UX-04 (persistence half); suggested model `opus` |
| IN-158 | Handouts, a play-time action, live inside the Session settings modal | **Deceptive** | **Scheduled** | WI-177 — INT-UX-06; suggested model `sonnet` |
| IN-159 | Add creature and PNG export exist only in the expanded Map tools sheet | **Simple** | **Scheduled** | WI-159 — INT-UX-07; suggested model `sonnet` |
| IN-160 | "Room" names both the campaign room and map rooms; "Referee" and "GM" are both used | **Simple** | **Scheduled** | WI-160 — INT-UX-08; suggested model `haiku` |
| IN-161 | No single-key tool hotkeys | **Simple** | **Scheduled** | WI-161 — INT-UX-09; suggested model `sonnet` |
| IN-162 | An open Call for Initiative locks every die on the table | **Complex (Shape A)** | **Scheduled** | WI-190 — INT-UX-10; suggested model `opus` |
| IN-163 | Token snap and drawing snap are two selectors on two sheets with nothing saying so | **Simple** | **Scheduled** | WI-162 — INT-UX-11; suggested model `haiku` |
| IN-164 | Hex authoring palette shows two paths per field without saying they write the same thing | **Simple** | **Scheduled** | WI-163 — INT-UX-12; suggested model `haiku` |
| IN-165 | The room password is plaintext, readable by any signed-in user, and never checked | **Complex (Shape A)** | **Scheduled** | WI-191 — INT-UX-13; suggested model `opus` |
| IN-166 | Undo covers geometry edits but not deletes, token moves or group changes, and dies on map switch | **Deceptive** | **Scheduled** | WI-178, WI-179, WI-180 — INT-UX-14 (+ INT-NX-04); suggested model `opus` |
| IN-167 | No multi-token selection or group move outside a collapsed group | **Deceptive** | **Scheduled** | WI-181 — INT-UX-15 (+ INT-NX-04); suggested model `opus` |
| IN-169 | Enable Firestore offline persistence on the hosted build | **Deceptive** | **Scheduled** | WI-186 — INT-UX-16 (cache half); suggested model `opus` |
| IN-215 | A dropped connection shows nothing — the store exposes no connectivity signal | **Simple** (proposed) | **Open** | Awaiting triage — from WI-156 (INT-UX-16's reconnecting half): re-triaged rather than widened, since answering it needs a new `CampaignStore` read (RULE-001); suggested model `sonnet` |
| IN-216 | Playwright has no suite-wide timeout or failure cap, so a systemic break costs hours instead of failing fast | **Simple** | **Open** | Classification approved (user, 2026-09-23), not yet scheduled — reported by the user, 2026-09-23: `apps/web/playwright.config.ts` sets only a per-test `timeout: 180_000`; add `globalTimeout` and `maxFailures`; suggested model `haiku` |
| IN-217 | `pnpm verify:all` shows only the last 40 lines of a failing step, which hid the failing test | **Simple** | **Open** | Classification approved (user, 2026-09-23), not yet scheduled — reported by the user, 2026-09-23: `scripts/verify.mjs` `TAIL_LINES = 40`; `pnpm test:all:emulators` shows full output. Surface the failing test names (or full output on failure); suggested model `haiku` |
| IN-170 | The Map tools palette is ~50 controls in a half-height phone sheet | **Investigation** | **Scheduled** | WI-176 — INT-UX-17; suggested model `sonnet` |
| IN-173 | `FirebaseStore` hand-writes ~20 near-identical `subscribeX` methods | **Deceptive** | **Scheduled** | WI-183, WI-184 — INT-AR-02 (primitive); suggested model `sonnet` |
| IN-174 | Split `CampaignStore` into per-domain interfaces and contract suites | **Complex (Shape A)** | **Scheduled** | WI-194 — INT-AR-02 (split); suggested model `opus` |
| IN-175 | Every change redraws every layer, and a vertex drag rebuilds LoS per pointer-move | **Complex (Shape A)** | **Scheduled** | WI-192, WI-193 — INT-AR-03; suggested model `opus` |
| IN-176 | Once-per-room-open backfills are a second, unversioned migration system | **Deceptive** | **Scheduled** | WI-185 — INT-AR-04 (+ INT-AR-12); suggested model `opus` |
| IN-178 | No code splitting — three.js, Rapier and the hex art load before the join gate | **Simple** | **Scheduled** | WI-166 — INT-AR-06; suggested model `sonnet` |
| IN-180 | The e2e introspection readouts ship to every production user | **Simple** | **Scheduled** | WI-167 — INT-AR-09; suggested model `sonnet` |
| IN-181 | Three snap vocabularies — `SnapMode`, `VectorSnapMode` and the hex snap | **Simple** | **Scheduled** | WI-168 — INT-AR-10; suggested model `sonnet` |
| IN-182 | Actor name, letter and colour are resolved in five places | **Simple** | **Scheduled** | WI-169 — INT-AR-11; suggested model `sonnet` |
| IN-183 | Three modal mechanisms with a hand-rolled Escape priority | **Deceptive** | **Scheduled** | WI-182 — INT-AR-13; suggested model `sonnet` |
| IN-184 | Deleting a map label is undoable from the Room sheet but not from the canvas | **Deceptive** | **Scheduled** | WI-178, WI-179 — INT-AR-14; suggested model `opus` |
| IN-185 | Token vision and automatic fog reveal | **Complex (Shape A)** | ⏸ **Postponed** | Postponed — user, 2026-09-23. INT-NX-01; suggested model `opus` |
| IN-186 | Import walls, doors and image from `.dd2vtt`/`.uvtt` | **Deceptive** | **Scheduled** | WI-187 — INT-NX-02; suggested model `opus` |
| IN-187 | Small images (token portraits) stored as bytes in Firestore, inside Spark | **Complex (Shape A)** | **Scheduled** | WI-195 — INT-NX-03; suggested model `opus` |
| IN-188 | Conditions / status markers on tokens | **Deceptive** | ⏸ **Postponed** | Postponed — user, 2026-09-23. INT-NX-05; suggested model `opus` |
| IN-189 | Whisper to the referee | **Deceptive** | ⏸ **Postponed** | Postponed — user, 2026-09-23. INT-NX-06; suggested model `opus` |
| IN-190 | Multi-point path measurement and a live distance chip on token drag | **Simple** | **Scheduled** | WI-164 — INT-NX-07; suggested model `sonnet` |
| IN-191 | No tool writes a text drawing, though `Drawing.kind === "text"` renders | **Simple** | **Scheduled** | WI-165 — INT-NX-08; suggested model `sonnet` |
| IN-192 | Fog on hex maps | **Deceptive** | **Scheduled** | WI-188 — INT-NX-09; suggested model `opus` |
| IN-195 | Every user-facing string is inline | **Simple** | **Scheduled** | WI-170 — INT-NX-12 (strings); suggested model `haiku` |
| IN-197 | `renderAll` has 42 call sites and no inputs, so no seam can be extracted cleanly | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §2.1, the prerequisite for IN-199 – IN-205; suggested model `opus` |
| IN-198 | Thirteen pure helpers sit inside `VectorMapView` where nothing can unit-test them | **Simple** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 1, no prerequisite; suggested model `sonnet` |
| IN-199 | The token/encounter layer is 783 lines of `VectorMapView` | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 8, after IN-113; suggested model `opus` |
| IN-200 | Background sprite lifecycle and transform gesture are 171 lines of `VectorMapView` | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 5; schedule with or after IN-067 – IN-069; suggested model `sonnet` |
| IN-201 | Hex authoring (pick, notes, terrain, symbol, road/river) is 230 lines of `VectorMapView` | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 6, after WI-188; suggested model `opus` |
| IN-202 | Pen, ping, measure and cursor publishing are 158 lines of `VectorMapView` | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 4; suggested model `sonnet` |
| IN-203 | The label editor, tooltip and note dot are 166 lines of `VectorMapView` | **Simple** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 3, the controller-protocol shakedown; suggested model `sonnet` |
| IN-204 | Stage pointer dispatch is a 464-line if-ladder over seams that should own their own branches | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 9, after items 3–8; suggested model `opus` |
| IN-205 | The Select gesture is 313 lines of `VectorMapView` | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-171 §4 item 10, **hard-blocked on WI-181**; suggested model `opus` |
| IN-206 | Fold Grid & measurement and Fog of war out of Session settings into the Assets activity | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-173's proposal; suggested model `sonnet` |
| IN-207 | `README.md`'s Session settings section states a stale `room.settings` shape (`measure`/`grid`, moved to `GameMap` before this was noticed) | **Simple** (proposed) | **Open** | Awaiting triage — found during WI-173; suggested model `haiku` |
| IN-208 | `session-config.spec.ts`'s two `gm2` `room-name` assertions use the global 8s timeout for a same-context second-tab restore that can legitimately run longer | **Simple** | **Scheduled** | WI-198 — give both `gm2` `room-name` assertions (`session-config.spec.ts:61,144`) an explicit `{ timeout: 15_000 }`, matching `signInAsReferee`'s own budget; suggested model `haiku` |
| IN-209 | Every Yjs keystroke merges into RTDB immediately, with no coalescing of a typing burst | **Simple** (proposed) | **Open** | Awaiting triage — WI-174's proposal: buffer `YRoomProvider.handleLocalUpdate` for a short idle window before calling `mergeYUpdate`, cutting write/broadcast round trips with no change to the RTDB path shape or store contract; suggested model `sonnet` |
| IN-210 | The RTDB Yjs node always holds full doc state, so every listener downloads the whole document on every edit, not the edit | **Deceptive** (proposed) | **Open** | Awaiting triage — WI-174's proposal: an incremental-update path (or changed node shape) at `rooms/{roomId}/yjs/{docName}` with periodic compaction, in place of always broadcasting the full merged state; changes the write shape (RULE-003) and plausibly the `subscribeYState`/`mergeYUpdate` contract (RULE-001); suggested model `opus` |
| IN-211 | Presence-chip initials are near-illegible for Referee/Records seats in both themes | **Simple** (proposed) | **Open** | Awaiting triage — WI-175's proposal: `SessionTab.svelte`'s chip text (`--bg-root`) against `--group-records`/`--group-referee` scores 1.84:1/1.43:1 in `parchment-dark`, 2.97:1/3.95:1 in `keyed-blue`; suggested model `sonnet` |
| IN-212 | `--accent-text` fails WCAG AA broadly in `keyed-blue` | **Simple** (proposed) | **Open** | Awaiting triage — WI-175's proposal: 3.70:1 on `--bg-panel`, 2.88:1 on `--bg-inset`, across ten-plus components; suggested model `sonnet` |
| IN-213 | Two feedback-color text pairs dip under AA, one per theme | **Simple** (proposed) | **Open** | Awaiting triage — WI-175's proposal: `--complication`/`--failure` on their own `-bg-strong` score 3.81:1/4.05:1 in `keyed-blue`; `--danger` on `--bg-panel` (`EncounterBoard`'s group-delete button) scores 3.69:1 in `parchment-dark`; suggested model `sonnet` |
| IN-214 | `--text-dim` on `--bg-panel-alt` fails AA in `keyed-blue` | **Simple** (proposed) | **Open** | Awaiting triage — WI-175's proposal: 3.99:1, under the 4.5:1 normal-text threshold; suggested model `sonnet` |

### 1.2 Closed intake

| IN     | Item                                                                                                                                                             | Classification                                     | Closed via                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN-152 | A first-time referee lands on a blank grid with no empty-state cue; the empty board likewise | **Simple** | **Closed** — WI-152 (2026-09-23), Batch 1, SPEC-054 §1. See `docs/completed/WI-152.md`. |
| IN-153 | A referee who creates a room is then asked to join it | **Simple** | **Closed** — WI-153 (2026-09-23), Batch 1, SPEC-054 §2. See `docs/completed/WI-153.md`. |
| IN-154 | Icon-only rail; two of three main views are behind a hover drawer | **Simple** | **Closed** — WI-154 (2026-09-23), Batch 1, SPEC-054 §3. See `docs/completed/WI-154.md`. |
| IN-155 | Clicking a disabled drawing tool under View does nothing and says nothing | **Simple** | **Closed** — WI-155 (2026-09-23), Batch 1, SPEC-054 §4. See `docs/completed/WI-155.md`. |
| IN-168 | A wrong room id shows "Loading room…" forever; a dropped connection shows nothing | **Simple** | **Closed** — WI-156 (2026-09-23), Batch 1, SPEC-054 §10 (states half only — the reconnecting half re-triaged as IN-215). See `docs/completed/WI-156.md`. |
| IN-171 | The hosted build shows no version, and there is no "report a problem" affordance | **Simple** | **Closed** — WI-157 (2026-09-23), Batch 1, SPEC-054 §11. See `docs/completed/WI-157.md`. |
| IN-193 | No "Now on: <map>" notice when the referee switches the active map | **Simple** | **Closed** — WI-158 (2026-09-23), Batch 1, SPEC-054 §14. See `docs/completed/WI-158.md`. |
| IN-196 | `PLAN.md` "Effort" column holds T-shirt sizes, not effort levels | **Simple** | **Closed** — WI-196 (2026-09-23), DEC-120. See `docs/completed/WI-196.md`. |
| IN-172 | `VectorMapView.svelte` is 4,095 lines and the whole map application | **Investigation** | **Closed** — WI-171 (2026-09-23), findings only. Nine extraction findings logged as IN-197 – IN-205. See `docs/completed/WI-171.md`. |
| IN-157 | Map configuration lives on three surfaces | **Investigation** | **Closed** — WI-173 (2026-09-23), findings only. Two findings logged as IN-206, IN-207. See `docs/completed/WI-173.md`. |
| IN-177 | Yjs state is one RTDB node rewritten whole on every edit | **Investigation** | **Closed** — WI-174 (2026-09-23), findings only. Two findings logged as IN-209, IN-210. See `docs/completed/WI-174.md`. |
| IN-194 | Contrast of `parchment-dark` and `keyed-blue` has never been measured | **Investigation** | **Closed** — WI-175 (2026-09-23), findings only. Four findings logged as IN-211 – IN-214. See `docs/completed/WI-175.md`. |
| IN-150 | `session-config.spec.ts` Gate 6 fails twice in a row on CI (PR #193): a third same-context tab (`gm2`) times out at 8s waiting for `room-name` after `gm2.goto()`, stuck on "Loading room…" | **Investigation** | **Closed** — WI-197 (2026-09-23), findings only. One finding logged as IN-208. See `docs/completed/WI-197.md`. |
| IN-179 | Reads, writes and listeners per session are unmeasured | **Investigation** | **Closed** — WI-172 (2026-09-23), findings only: measured counts written to `README.md` §II.8. See `docs/completed/WI-172.md`. |
| IN-145 | The `PLAN.md` freshness hook churns a tracked file every 15 minutes | **Complex (Shape A)** — reverses DEC-029 | **Closed** — WI-150 (2026-09-20), SPEC-053 §3, DEC-102 answered (b): relocate, not retire. See `docs/completed/WI-150.md`. |
| IN-146 | Every planning turn runs on `opus` and reads the most tokens of any session | **Complex (Shape A)** — amends SPEC-035 §4 | **Closed** — WI-151 (2026-09-20), SPEC-035 §4, DEC-103 answered (b). See `docs/completed/WI-151.md`. |
| IN-147 | RULE-015 forbids an executor from fixing a one-line defect in a file already open | **Complex (Shape A)** — rule-blocked | **Closed** — WI-149 (2026-09-20), `RULE-AMENDMENT:` to RULE-015, DEC-101 answered (b). See `docs/completed/WI-149.md`. |
| IN-142 | Two sessions and two pull requests for a 22-line fix: Simple items have no batch lane | **Complex (Shape A)** — rule-blocked | **Closed** — WI-148 (2026-09-20), `RULE-AMENDMENT:` to RULE-016, DEC-100 answered (b). See `docs/completed/WI-148.md`. |
| IN-140 | Every completion summary is written four times; `PLAN.md` was 1,142 lines with three items queued | **Simple** | **Closed** — WI-144 (2026-09-19). See `docs/completed/WI-144.md`. |
| IN-141 | Rationale is restated at four altitudes — README, decision, work item, code comment | **Simple** | **Closed** — WI-146 (2026-09-20). See `docs/completed/WI-146.md`. |
| IN-149 | No release mechanism: no tag workflow, no artefact, no version a user can quote | **Simple** | **Closed** — WI-147 (2026-09-20), SPEC-042 §5, DEC-104 — closes IN-070 and IN-073. See `docs/completed/WI-147.md`. |
| IN-070 | Ship the packaged local release — launcher, README, tag workflow | **Simple** | **Closed** — WI-147 (2026-09-20). See `docs/completed/WI-147.md`. |
| IN-073 | No build/version identifier; `package.json` version stuck at `0.0.0` | **Simple** | **Closed** — WI-147 (2026-09-20). See `docs/completed/WI-147.md`. |
| IN-148 | An index disagreeing with its entry is a recurring work item (IN-044/045/046) | **Simple** | **Closed** — WI-145 (2026-09-20), SPEC-052 §4. See `docs/completed/WI-145.md`. |
| IN-144 | The emulator battery never runs in a session, so rules/store/e2e are first exercised by CI | **Simple** | **Closed** — WI-142 (2026-09-19), SPEC-053 §1, DEC-106: a `SessionStart` hook, `.claude/hooks/session-bootstrap.sh`, runs `pnpm install --frozen-lockfile` and pre-fetches the Firebase emulator jars and Playwright's Chromium (proxy vars stripped for those two fetches), registered in `.claude/settings.json`. Best-effort, idempotent, never edits a tracked file, never runs the suite itself. See `docs/completed/WI-142.md`. |
| IN-143 | CI is 28–35 min per pull request: 100 e2e flows, one worker, two retries | **Simple** | **Closed** — WI-143 (2026-09-19), SPEC-053 §2, DEC-105: CI's four jobs become three — `static` (lint+typecheck+build, one `pnpm install`), `test-emulators-core` (unit+rules+store), and `test-e2e` (a 4-way `--shard=i/4` Playwright matrix, each shard its own `firebase emulators:exec`). `retries` on CI 2→1. Same specs, same `chromium`/`mobile-chromium` projects, nothing skipped. See `docs/completed/WI-143.md`. |
| IN-136 | Road, River and Terrain wear another tool's glyph; the hex-map button has none | **Simple** | **Closed** — WI-139 (2026-09-19), SPEC-051 §5: `road`, `river`, `terrain` and `hex` join the `MARKUP` record and `IconId` as their own ids, no longer borrowing `path`/`shapes`. Not yet drawn into the hex toolbar — that's WI-140/141. See `docs/completed/WI-139.md`. |
| IN-137 | Four silhouettes collide at 16px; `ngon` and `polygon` are drawn the wrong way round | **Simple** | **Closed** — WI-139 (2026-09-19), SPEC-051 §6: `encounter`, `session`, `room`, `corridor`, `ngon` and `polygon` redrawn per the audit's six findings — crossed swords, a toothed cog, a plan-view room, a closed L-run, a pentagon with a centre dot, an irregular hexagon. See `docs/completed/WI-139.md`. |
| IN-138 | Six render sizes in use for one 1.75 stroke weight | **Simple** | **Closed** — WI-139 (2026-09-19), SPEC-051 §2, DEC-098: `theme/sizing.css` gains `--icon`/`--icon-sm` (20/16px precise, 24/20px coarse); `Icon.svelte`'s `size` prop now takes `'sm'` or is left unset, defaulting to `--icon`, and every existing call site's ad-hoc number resolves to one of the two tokens. See `docs/completed/WI-139.md`. |
| IN-134 | ~40 controls across 17 components type a Unicode character instead of using the icon record | **Simple** | **Closed** — WI-140 (2026-09-19), SPEC-051 §§1, 3: every typed character across the audit's controls (plus `EncounterBoard`, `RollSheet`, `SessionActivity`, named by the same TYPED table) is now an `<Icon>` call against WI-139's ids; nine controls that had no accessible name gained one. See `docs/completed/WI-140.md`. |
| IN-135 | The mobile quick-sheet chips are icon-only at 16px with a hover-only name | **Simple** | **Closed** — WI-141 (2026-09-19), SPEC-051 §4, DEC-099: `QuickSheetRail`'s `chips` variant now labels each chip under its glyph, matching `MainViewTabs`'s mobile layout; the glyph rises to `--icon`'s default size. See `docs/completed/WI-141.md`. |
| IN-139 | The map toolbar's actions are words only, costing a full row each on a phone | **Simple** | **Closed** — WI-139 (glyphs, 2026-09-19) + WI-141 (application, 2026-09-19), SPEC-051 §§5, 7: Undo, Redo, Reveal all, Reset fog, Rotate/Flip and Download PNG each draw the glyph WI-139 added beside their unchanged label; no button became icon-only. See `docs/completed/WI-139.md` and `docs/completed/WI-141.md`. |
| IN-133 | The initiative tracker falls back to internal id fragments instead of a seat's `displayName` or a token's letter | **Simple** | **Closed** — WI-137 (2026-09-17), SPEC-050 §4: `tokenLabel`/`refLabel` (`apps/web/src/lib/encounter/labels.ts`) take an optional `players` parameter and resolve a seat-owned token's `displayName` before `Token.name`; the fallback chain now checks `Token.letter` (SPEC-048) ahead of the id-fragment/imageRef fallback. `CombatTracker.svelte`, `TurnStrip.svelte` and its two callers thread `players` through. Stores nothing, invents nothing — the naming gap was that `refLabel` was never given `players` and never read `letter`. See `docs/completed/WI-137.md`. |
| IN-132 | During a Call for Initiative a player's own slot is unreachable from the Dice tray | **Deceptive** | **Closed** — WI-136 (2026-09-16), SPEC-050 §3: DEC-097 (b) delivered. Rather than repair `SharedRollStaging`'s bare-uid `mySlot` lookup, the ordinary-shared-roll panel it belongs to now disables outright while a Call for Initiative is staging — the same doc, wrong-shaped slot id, so opening or resolving one there mid-call would have corrupted the call. Every other die control outside the call's own staging path (`rollOrStage`) disables and says why too: the Roll sheet's dice/Roll/Hidden buttons, the dice tray, saved macros, and `SharedRollReadiness`'s own add-slot/Roll controls — the referee is not exempt. A referee-only Cancel (`cancelSharedRoll`, new on the store contract, all three implementations) sets the staging doc to `resolved` with no `Roll` written and the tracker untouched, the only way out of a call opened by mistake. See `docs/completed/WI-136.md`. |
| IN-130 | Side-mode initiative: a player cannot stage their own side's slot — `firestore.rules` denies it | **Deceptive** | **Closed** — WI-134 (2026-09-16), SPEC-050 §1: DEC-096 (a) delivered. `initiativeSlotId` keys a side `side:{groupId}` and the rule admits the literal prefix alongside the own-uid one, so a player pressing their card's die in side mode now stages their side instead of being denied. One slot per side, whoever presses first — a scheme carrying the stager's uid would have made two slots for one tracker row. `slotOwnerUid` answers `null` for a side slot rather than reading `side` as a uid. A bare groupId stays denied: it is indistinguishable from another member's uid without a billed `get()`. Nothing migrated — `sharedRoll/current` is transient. See `docs/completed/WI-134.md`. |
| IN-131 | No global indicator that initiative has been called, and the Caller marker is unreachable | **Simple** | **Closed** — WI-135 (2026-09-16), SPEC-050 §2: the Caller is room-scoped, not free-mode-only — `EncounterBoard` no longer unmounts `CombatTracker` (and the `caller-select`/`caller-rotate` controls inside it) when the session's mode isn't Free, and the Caller row now renders whenever an encounter doc exists, in all three modes. `TurnStrip` subscribes to `sharedRoll` and shows "Initiative called — N of M ready" on every stage while a call is staging, even before any order exists — previously the only signal was `combat-staging-note` inside `CombatTracker`, visible on the Encounter board alone. No schema change. See `docs/completed/WI-135.md`. |
| IN-126 | The river tool draws hard edges; it wants smoothing | **Deceptive** | **Closed** — WI-133 (2026-09-15), SPEC-047 §16: DEC-095 (a) delivered. `renderHexLines` samples a centripetal Catmull-Rom through the stored vertices (`smoothHexLinePoints`, 8 segments a span, in the thirds lattice), gated on the stored `join === 'round'` so a road stays angular; §12's preview stays the raw polyline, so smoothing still arrives at the end of the gesture. `HexLine.points` keeps the referee's clicks — nothing migrated, every river already drawn improved |
| IN-120 | A hex map's token snap still offers Cell/Half/Free | **Deceptive** | **Closed** — WI-132 (2026-09-15), SPEC-047 §15: DEC-094 (a) delivered. The quick sheet's `token-snap-mode` now offers Hex/Free on a hex map (mirroring `MapToolbar`'s tool-snap selector); `snapTokenPosition` gains a `'hex'` mode resolving through `pixelToAxial`/`axialToPixel`, centring every token size on the hex under the pointer — a larger token overflows it, which is accepted. `setHexMap` switches `tokenSnap` the same way it already switches `snapMode`. Nothing stored changes and no `data-testid` moved. See `docs/completed/WI-132.md`. |
| IN-123 | Per-hex measurement: the Measure tool reads a hex map against `grid.cellSize` | **Deceptive** | **Closed** — WI-131 (2026-09-14), SPEC-049: the Measure tool now resolves both drag ends to hexes and reports `hexMap.axialDistance` through `perSquare`/`unit`, fixing the RULE-006 breach; Grid & measurement reads "Per hex" on a hex map; a freshly created hex map defaults to `{ perSquare: 6, unit: 'miles' }`. **No backfill** — DEC-093 was amended the same day it was answered (user, 2026-09-11) to drop the backfill and the RULE-007 migration this row's earlier disposition described; existing hex maps keep whatever `measure` they already had. See `docs/completed/WI-131.md`. |
| IN-118 | A per-hex terrain clip that batches, so the overlay box can grow past the 1.2247× fit ceiling | **Deceptive** | **Closed** — WI-130 (2026-09-14), SPEC-047 §13: DEC-092 (b) delivered. Each terrain kind's art is composited against a hex silhouette once at load time (`loadHexClippedTexture` → a 256px canvas, `destination-in`, `hexTerrainClipPolygon()` from shared), so the overlay layer stays one batched draw and nothing is clipped per frame. `hexTerrainArtPx` is `size * 1.8` — WI-119's figure, kept on the reference material (DEC-092 amended, user 2026-09-11). The east/west corner tips stay bare `color` and that is accepted, not a defect. The palette swatch takes the same polygon as a CSS `clip-path` so the two cannot drift; painted hexes now read edge-to-edge; a baked clip is fixed at bake time, which neither blocks nor helps IN-106. `vector-engine-hex.test.ts`'s fit assertion is now a clip assertion. Nothing stored changes (RULE-007 untouched) |
| IN-129 | The quick sheet's Letter control sits beside the colour swatches and runs off the sheet | **Simple** | **Closed** — WI-127 (2026-09-14): `.token-color` uses `flex-wrap: wrap` and `[data-testid="token-letter-control"]` takes `flex-basis: 100%` to force it to the next line at docked width. CSS only, no DOM or testid changes. See `docs/completed/WI-127.md`. |
| IN-125 | Road/River: drop the shade selector, derive the shade from the width | **Deceptive** | **Closed** — WI-129 (2026-09-14), SPEC-047 §14: `selectedHexLineShade` removed from `MapToolController`/`MapToolPalette`/`MapToolbar` (and its `hex-line-shade` swatch row); the committed write and the live preview both derive `shade` from `selectedHexLineWidth`. `HexLine.shade` keeps §2's stored meaning; lines already drawn are unchanged. See `docs/completed/WI-129.md`. |
| IN-127 | Road/River draw with no in-progress preview | **Simple** | **Closed** — WI-126 (2026-09-13), SPEC-047 §12: the collected run plus a segment to the pointer, in the shade, width and join the commit will take, on the never-exported `tools` layer and writing nothing. Closes WI-105's own recorded Deviation. See `docs/completed/WI-126.md`. |
| IN-122 | The hex Symbol tool's kind picker offers `unknown` | **Simple** | **Closed** — WI-128 (2026-09-14): found already fixed by WI-123's landed diff, which applied `paintableHexContentsCatalog()` to `MapToolbar`'s `HEX_SYMBOL_KINDS` as well as `HexTilePanel`'s `CONTENTS` three days earlier. No code change; `pnpm verify` green. See `docs/completed/WI-128.md`. |
| IN-119 | An `.svg` token renders as a black square on the map | **Simple** | **Closed** — WI-125 (2026-09-13), SPEC-007: `loadTokenTexture` rejects a genuinely zero-`naturalWidth`/`naturalHeight` `HTMLImageElement` into the existing broken-image path, and — added to the same PR after the user's own reported asset showed the first fix wasn't sufficient — rasterizes any other loaded image onto a fixed-size canvas before texturing, since a real SVG with a `viewBox` but no `width`/`height` attributes can report a nonzero `naturalWidth` yet still be silently rejected by WebGL's `texImage2D`. See `docs/completed/WI-125.md`. |
| IN-121 | Entering a hex map leaves the Snap selector blank until one is picked | **Simple** | **Closed** — WI-124 (2026-09-11), SPEC-047 §11: `setHexMap` calls `setSnapMode('hex')` on entry (and `setSnapMode('full')` on exit). See `docs/completed/WI-124.md`. |
| IN-124 | Remove the Eye tool from the hex palette | **Simple** | **Closed** — WI-124 (2026-09-11), SPEC-047 §11: `'eye'` removed from `HEX_TOOL_IDS`, unchanged everywhere else — a hex crawl has no walls for it to answer a question about. See `docs/completed/WI-124.md`. |
| IN-128 | A hex-only tool stays armed after leaving the hex map | **Simple** | **Closed** — WI-124 (2026-09-11), SPEC-047 §11: leaving a hex map now falls the active tool back to Pan when it holds a hex-only tool, via `groupForTool` returning `undefined` — the mirror of the check entering already had. See `docs/completed/WI-124.md`. |
| IN-115 | Terrain glyph legibility: grow `hexTerrainArtPx`'s box (1.1× → WI-119's studied 1.8×, clipped to the hex boundary) and retire `palm`/`plateau`/`grass`/`scrub`/`tundra`/`ice-floe` from a new-authoring terrain picker | **Split on triage (2026-09-10): picker half Simple, render-box half Deceptive** | Picker half → **WI-121** (2026-09-11). Render-box half → **WI-122** (2026-09-11), which measured DEC-090's cost condition and took the pre-approved (b) fallback: `hexTerrainArtPx` is `size * 1.22` unclipped, because a per-hex stencil cost 376 ms/frame under pan at 400 painted hexes against 0.20 ms/frame unclipped at the same box. The legibility goal the item was raised for is **not** met by that 11% growth and continues as **IN-118** |
| IN-116 | `HEX_CONTENTS_CATALOG` retains three pre-pack glyphs (`danger`, `ruins`, `tower` — the only three files with no `aria-label`, WI-040-era filled paths) beside the WI-101 pack's own `ruin`/`tower-keep`, and all are pickable | **Deceptive** | **Closed** — WI-123 (2026-09-11), SPEC-047 §10 per DEC-091 (c): `ruins`' and `tower`'s `ref`s move to `ruin`'s/`tower-keep`'s art, both set `paintable: false` via a new `paintableHexContentsCatalog()` mirroring WI-121's terrain mechanism; `danger` keeps its own WI-040 art and palette slot until IN-117's replacement art exists. See `docs/completed/WI-123.md`. |
| IN-114 | Obsolete WI-101's hex terrain art in favour of the public-domain Worldographer/Inkwell Ideas icon sets | **Deceptive** | **Closed** — WI-119 (2026-09-09, reference sheet — findings only) and WI-120 (2026-09-09, SPEC-047 §8 per DEC-088/DEC-089): 41 candidates traced to SVG, an authored `color`/`ink` pair per kind (guarded by a minimum-contrast unit test), six existing kinds aliased to another kind's art with no honest equivalent of their own, `water` reduced to a background colour with no overlay, and `volcano` kept in both catalogs unrenamed. `ATTRIBUTION.md` and SPEC-030 §2 both updated. See `docs/completed/WI-119.md`, `docs/completed/WI-120.md`. |
| IN-087 | Eye and Ping can be aimed at a token or object, which becomes the focus                                                                                          | **Simple** (reclassified 2026-09-07)               | **Closed** — WI-112 (2026-09-09), SPEC-046 §2 per DEC-084 (b, with a drop-on-move rider): a click on a token resolves it at click time — a ping publishes at the token's position, an eye is placed there — with nothing about the target published, so `publishPing`/`PingPos` are unchanged. Each client independently drops a token-aimed ping's render once its remembered token moves off. Object targeting (rooms, symbols, doors) stays out per DEC-084 (d). See `docs/completed/WI-112.md`.                                                                                                                                                         |
| IN-091 | Hex terrain tool — colour + symbol, hex-union under Hex snap, circular brush under Free                                                                          | **Simple** (reclassified 2026-09-07)               | **Closed** — WI-111 (2026-09-08), SPEC-047 §7 per DEC-082 (b, narrowed): `hexTerrain` paints or clears one hex per click through the existing `setHexTerrain`; no brush, no union, no schema, rules or contract change. See `docs/completed/WI-111.md`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| IN-105 | Like-terrain hexes have no drawn boundary, and `HexTerrainEntry` has no border colour                                                                            | **Simple** (proposed)                              | **Denied** — user, 2026-09-07, with DEC-082's answer. The union outline and the border colour are dropped together: DEC-082 had told the user "so yes" to their own _(add a border colour?)_, and that is withdrawn. Like-terrain hexes keep their seams, and `HexTerrainEntry` gains no border field. No work item was ever reserved, so no `WI-` id is retired. See SPEC-047 §7 and `DECISIONS.md` → DEC-082                                                                                                                                                                                                                                              |
| IN-099 | Symbol and Label show the Snap selector but draw neither a snap dot nor a cell highlight                                                                         | **Simple**                                         | **Closed** — WI-108 (2026-09-05), SPEC-028 §6: `targetedCellFor`'s tool check widens to `symbol`/`label`, joining Room's existing whole-tile highlight (both already anchor to the same `snapCell(at, snap)`). Symbol/Label still draw no snap dot; the highlight is now their only feedback. See `docs/completed/WI-108.md`.                                                                                                                                                                                                                                                                                                                               |
| IN-095 | Corridor's Free-snap indicator is a circle, but the Corridor never draws a round cap                                                                             | **Simple**                                         | **Closed** — WI-107 (2026-09-05), SPEC-028 §6: `targetedBandFor` now special-cases the Free-snap circle to Path only; Corridor keeps the width×width square (`targetedBandRect`/`bandLo`) under Free too. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| IN-107 | `switchToEditMode`'s conditional click is a race — an e2e spec can run its whole body in view mode                                                               | **Simple**                                         | **Closed** — WI-109 (2026-09-08): the helper now asserts `aria-pressed` on the `map-mode-toggle` after the click, before the sheet closes. Test-helper only — no `data-testid`, no store contract, no schema, no app code. See `docs/completed/WI-109.md`.                                                                                                                                                                                                                                                                                                                                                                                                  |
| IN-108 | Implement DEC-085's answer for square-grid tools: `corridorPoly`'s Free zero-length case becomes a `bandWidth` square, plus IN-095's matching Free-indicator fix | **Deceptive**                                      | **Closed** — WI-110 (2026-09-08), SPEC-028 §4: `corridorPoly` falls back to a `bandWidth` square (`cornerBlock`) when both legs are degenerate under Free snap. The Free-indicator half was already shipped by WI-107 (IN-095). See `docs/completed/WI-110.md`.                                                                                                                                                                                                                                                                                                                                                                                             |
| IN-112 | A dragged token leaves its ring, colour disc and badges behind — the drag handler re-syncs only the collapsed-group badge                                        | **Simple**                                         | **Closed** — WI-118 (2026-09-08): `resyncTokenDecorations` repositions the background disc, status ring, away badge and broken-image badge from both `globalpointermove` and the drop-time snap, alongside the sprite. See `docs/completed/WI-118.md`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-110 | Letter colours key off whether the token has a seat: white-on-black for a character, black-on-white for a creature | **Deceptive** | **Closed** — WI-115 (2026-09-09), SPEC-048 §4 per DEC-086 (a): the letter is a render pass on the token layer, drawn **over** whatever art a token has, and its colours are derived from `ownerSeatId` — white text with a black outline for a token with a seat, black text with a white outline for one without. No schema change. The rule tests *"is this somebody's character?"*, not *"who created it"*, which nothing records. Because it **replaces** `discStyle`'s lightness flip rather than extending it, the glyph outline is load-bearing and is a genuine stroke on the text (`letterStyleFor`), never the disc's ring. See `docs/completed/WI-115.md`. |
| IN-109 | Retire the `gen:disc:` letter mechanic: the letter becomes stored data drawn over any art, and everything that reads a letter out of a ref migrates | **Complex (Shape A — reversal)** | **Closed** — WI-113 (2026-09-09, schema v30, the fields and the backfill), WI-114 (2026-09-09, assignment reads the field) and WI-116 (2026-09-09, SPEC-048 §5): writers move to `letter`/`color` fields, `imageRef`/`portraitRef` are cleared once they are only ever a `gen:disc:` recipe, and `resolveGenTokenRef`/`parseGenTokenRef`/`buildGenTokenRef` are deleted from `AssetStore`'s public surface — the deletion is the acceptance test (DEC-087 (a)). Supersedes SPEC-040 §4 in place; DEC-072 not reopened. See `docs/completed/WI-113.md`, `docs/completed/WI-114.md`, `docs/completed/WI-116.md`. |
| IN-111 | Edit the token letter from the character sheet's token/colour control, at the existing 3-glyph cap                                                  | **Simple** | **Closed** — WI-117 (2026-09-09), SPEC-048 §5: a new `token-letter-control`/`token-letter-input` beside `token-color-control`, capped at `GEN_TOKEN_LABEL_CAP` (3, unchanged) via `letterGlyphs`, calling `setTokenLetter` on the player's own token only. No store/schema change — WI-113 already owned the contract method. See `docs/completed/WI-117.md`. |
| IN-096 | SPEC-028 §7/§6 attribute the flat-vs-round cap change to Corridor as well as Path                                                                                | **Simple**                                         | **Closed** — WI-107 (2026-09-05): §6's WI-052 amendment corrected in place. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-097 | The snapped Carve dab is a Euclidean disc of cells — width 2 gives a plus, not a block                                                                           | **Simple** (answered — keep the disc, document it) | **Closed** — WI-107 (2026-09-05), SPEC-028 §2: the WI-042 note now documents the disc instead of calling it "a block". See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-098 | Carve widths 0.5 and 1.0 are the same stroke under Cell snap (the `step/2` radius floor)                                                                         | **Simple**                                         | **Closed** — WI-107 (2026-09-05), SPEC-028 §2 and README: the collapse is now documented as the floor's known cost. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| IN-100 | Under Free, Symbol and Label store an unquantized `cell`/`labelAnchor` float                                                                                     | **Simple**                                         | **Closed** — WI-107 (2026-09-05): `anchorCellFor`'s doc comment and README note the Free-mode float explicitly. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| IN-101 | SPEC-028 §6's dot rule contradicts itself; the code follows the second half                                                                                      | **Simple**                                         | **Closed** — WI-107 (2026-09-05), SPEC-028 §6: the WI-048 amendment's superseded sentence is struck and annotated in place. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-103 | §12 excludes Symbol and Label by omission — write the reason down and pin it                                                                                     | **Simple**                                         | **Closed** — WI-107 (2026-09-05), SPEC-028 §12: the exclusion is now stated with its rationale, and `attractsToVertex('symbol'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 'label')`is pinned in`vector-tools.test.ts`. See `docs/completed/WI-107.md`. |
| IN-104 | SPEC-028 §2 describes two anchor families; the code has three (vertex / cell-centre / cell-corner)                                                               | **Simple**                                         | **Closed** — WI-107 (2026-09-05), SPEC-028 §2: rewritten around the three-family table (vertex/`snapPoint`, centre/`snapCellCenter`, corner/`snapCell`), with `CELL_ANCHORED_TOOLS`'s merge of the last two noted explicitly. See `docs/completed/WI-107.md`.                                                                                                                                                                                                                                                                                                                                                                                               |
| IN-093 | Hex label tool — detail tied to a hex address                                                                                                                    | **Deceptive**                                      | **Closed** — WI-106 (2026-09-04), SPEC-047 §5: the `hexLabel` tool resolves the pointer to a hex (`hexAt`, the same `pixelToAxial` Select's own click uses) and publishes it as `MapToolController.selectedHex`, opening the same `HexTile.note` field the hex-tile sheet already edits. No new schema, no new collection, no migration. SPEC-030 §§1 and 5 are annotated in place. See `docs/completed/WI-106.md`.                                                                                                                                                                                                                                         |
| IN-089 | Hex symbol/terrain art upgrade — the supplied 37-file pack becomes the palette                                                                                   | **Deceptive**                                      | **Closed** — WI-101 (2026-09-04), SPEC-047 §6: the 37 files land re-authored white at `apps/web/public/assets/hex/{terrain,contents}/*.svg`, wired into `HEX_TERRAIN_CATALOG`/`HEX_CONTENTS_CATALOG`. 10 supersede an existing kind's `ref` under an unchanged `kind` string; the other 27 are new kinds. Provenance recorded in `ATTRIBUTION.md`. See `docs/completed/WI-101.md`.                                                                                                                                                                                                                                                                          |
| IN-088 | Hex maps get their own tool palette, not a subset of the square one                                                                                              | **Deceptive**                                      | **Closed** — WI-104 (2026-09-04), SPEC-047 §3: `HEX_TOOL_IDS` is now a plain authored array instead of a filter over the square map's `TOOL_GROUPS`; content unchanged today (`select`, `pan`, `eye`, `measure`, `ping`), but it can now grow to hold SPEC-047 §4's hex-only tools without a square-palette group inventing a home for them. See `docs/completed/WI-104.md`.                                                                                                                                                                                                                                                                                |
| IN-092 | Hex symbol tool — places a symbol, unsnapped under Free                                                                                                          | **Deceptive**                                      | **Closed** — WI-105 (2026-09-04), SPEC-047 §4: the `hexSymbol` tool, its own `HEX_TOOL_IDS`/`MapToolbar` row, resolves through `hexMap.pixelToAxial`/`axialToHexPoint` under Hex snap and raw `pixelToHexPoint` under Free, and calls `store.placeHexSymbol`. See `docs/completed/WI-105.md`.                                                                                                                                                                                                                                                                                                                                                               |
| IN-094 | Hex road and river tools — three shades, three widths, mitred vs round joins                                                                                     | **Deceptive**                                      | **Closed** — WI-105 (2026-09-04), SPEC-047 §4: the `road`/`river` tools reuse the Wall/Path/Polygon click-to-click gesture, each vertex resolved through `snapHexPoint` under Hex snap, and commit via `store.addHexLine` on a double-click (or Enter) once ≥2 points have been collected. See `docs/completed/WI-105.md`.                                                                                                                                                                                                                                                                                                                                  |
| IN-090 | Hex maps offer exactly two snap modes: Hex and Free                                                                                                              | **Deceptive**                                      | **Closed** — WI-104 (2026-09-04), SPEC-047 §3: `VectorSnapMode` grows `'hex'`, and `MapToolbar`'s `SNAP_MODES` is a function of grid kind — Hex/Free for a hex map, Cell/Half/Free otherwise. No visible change yet: no current hex tool shows the Snap selector. See `docs/completed/WI-104.md`.                                                                                                                                                                                                                                                                                                                                                           |
| IN-086 | Eye and Ping both expire on a countdown rather than cluttering the map                                                                                           | **Simple**                                         | **Closed** — WI-099 (2026-09-03), SPEC-046 §1: the ping's ring shrinks and fades over its unchanged 3s RTDB lifetime; the eye gets a 4s client-local lifetime of its own, pausing while `canRevealFromEye` is true so the fog-reveal action is never stranded mid-decision. See `docs/completed/WI-099.md`.                                                                                                                                                                                                                                                                                                                                                 |
| IN-085 | Snap audit — does every mode draw the same shape class, and is Free's vertex attraction universal?                                                               | **Investigation**                                  | **Closed** — WI-098 (2026-09-03). Findings only, no code changes (DEC-027). Ten tools × three modes tabulated from the code: **three** anchor families (vertex / cell-centre / cell-corner), and **only two** tools change shape class with the mode — Path's caps (SPEC-028 §7) and Carve's brush (DEC-032), both cited. Nine uncited differences found, logged as IN-095 – IN-103. Symbol and Label should **not** join the vertex-attracting set. See `docs/completed/WI-098.md`.                                                                                                                                                                        |
| IN-079 | Numeral orientation is arbitrary per face — the edge rule reads face-table winding                                                                               | **Deceptive**                                      | **Closed** — WI-093 (2026-09-02), SPEC-045 §1 per DEC-078: the edge rule is replaced by axis-projection + symmetry-snap, and the binding test (rotating a face's index list must not change its glyph-up) makes the defect class unable to return. See `docs/completed/WI-093.md`.                                                                                                                                                                                                                                                                                                                                                                          |
| IN-080 | Die sizing and aspect — circumradius parity makes the d4 read oversized                                                                                          | **Simple**                                         | **Closed** — WI-094 (2026-09-02), SPEC-045 §2: `SCALE` is retuned so each die's real circumradius (`hullPoints`' farthest vertex from centre, not the raw table entry) follows `d4 ≤ d6 < d8 < d10 ≈ d12 < d20`, pinned by a new test; `apexZ` left unchanged at 0.85. See `docs/completed/WI-094.md`.                                                                                                                                                                                                                                                                                                                                                      |
| IN-081 | Material pass on the generated dice — PBR tuning, normal-mapped incised numerals                                                                                 | **Simple**                                         | **Closed** — WI-095 (2026-09-02), SPEC-045 §3: `textures.ts`'s canvas emboss pass is replaced by a generated normal map per numeral label, the material is retuned (roughness 0.34, metalness 0.09, `envMapIntensity` 0.6), and `scene.ts` bakes a PMREM `RoomEnvironment` onto `scene.environment` once per mount. See `docs/completed/WI-095.md`.                                                                                                                                                                                                                                                                                                         |
| IN-082 | Bevelled die edges — real dice have no sharp corners                                                                                                             | **Deceptive**                                      | **Closed** — WI-097 (2026-09-03), SPEC-045 §4 per DEC-079: every value face is inset in its own plane and the band that opens up is filled with edge strips and corner patches, all in **one** material group past the value range (`DieGeometry.bodyGroupIndex`, always `faceCount`), so the `faceIndex → value` 1:1 relation every consumer assumes is untouched. `flatShading` splits per material (faces `true`, body `false`) over an authored `normal` attribute. Both judgements §4 deferred were made by looking: the seam is clean, and `hullPoints` stays un-bevelled (worst-case recession 9.4%, the d4's apex). See `docs/completed/WI-097.md`. |
| IN-083 | Dice in one roll rarely touch — the throw disperses them                                                                                                         | **Simple**                                         | **Closed** — WI-096 (2026-09-02), SPEC-045 §5: `simulate()`'s spawn is retuned (shared per-roll arc, tighter ring, stronger inward launch) so dice in a multi-die roll visibly strike one another; `MAX_STEPS` raised 300 → 360; a stacked die is documented as an accepted outcome. See `docs/completed/WI-096.md`.                                                                                                                                                                                                                                                                                                                                        |
| IN-077 | Selectable 3D die models — imported meshes beside the procedural set                                                                                             | **Complex (Shape A)**                              | **Denied** (user, 2026-09-02) — DEC-077 answered (c). No `WI-` id was ever reserved, so none is retired; the effort goes to the generated set instead, as IN-079 – IN-083.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| IN-001 | Refactor the planning and instruction documentation                                                                                                              | **Complex (Shape A)**                              | WI-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-002 | App Check: monitoring → enforcement                                                                                                                              | **Deceptive**                                      | WI-029 `[HUMAN]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| IN-003 | N-gon dropdown, drag orientation, cell-centred sizing                                                                                                            | **Deceptive**                                      | WI-030 / SPEC-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-004 | Corridor width dropdown, cell-centred band                                                                                                                       | **Deceptive**                                      | WI-030 / SPEC-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-005 | Room carve snaps to cells, 1×1 minimum                                                                                                                           | **Deceptive**                                      | WI-030 / SPEC-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-006 | Snap indicator: highlight the targeted cell                                                                                                                      | **Deceptive**                                      | WI-030 / SPEC-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-007 | Evaluate the other carving tools for inconsistencies                                                                                                             | **Investigation**                                  | Run inside WI-030                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-008 | URL-derived token does not display on the map                                                                                                                    | **Simple**                                         | WI-032                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-009 | Move Token scale to the Character quick sheet                                                                                                                    | **Simple**                                         | WI-031                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-011 | Hex Crawl map type                                                                                                                                               | **Complex (Shape A)**                              | SPEC-030 (Completed), WI-037 – WI-041 (WI-037 – WI-039 closed 2026-08-13; WI-040, WI-041 2026-08-14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-012 | Carve dab paints nothing at widths ≤ 1 under cell snap                                                                                                           | **Deceptive**                                      | WI-042                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-013 | Snapped Carve stroke centres on an intersection                                                                                                                  | **Deceptive**                                      | WI-042                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-015 | "Deceptive" stopped discriminating                                                                                                                               | **Deceptive**                                      | WI-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-016 | A classification was invented mid-run                                                                                                                            | **Simple**                                         | WI-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-017 | RULE-018's ordering clause is unenforceable                                                                                                                      | **Deceptive**                                      | WI-043                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-018 | The Model column was lost in the WI-028 split                                                                                                                    | **Simple**                                         | WI-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-019 | The completion summary is written before verification                                                                                                            | **Simple**                                         | WI-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-020 | Nothing prompts the `PLAN.md` status write-back                                                                                                                  | **Deceptive**                                      | WI-045                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-021 | Intake rows have outgrown the table                                                                                                                              | **Simple**                                         | WI-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-022 | Scheduled/completed intake rows are never retired                                                                                                                | **Simple**                                         | WI-049                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-023 | Token scale overflows the quick sheet's bounding box                                                                                                             | **Simple**                                         | WI-046                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-024 | Quick sheet header reads "Character", not the name                                                                                                               | **Simple** (borderline)                            | WI-046                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-025 | Remove the Clear button from quick-sheet colour                                                                                                                  | **Deceptive**                                      | WI-050 / SPEC-031                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-026 | Encounter group: a "+" card that adds a creature to it                                                                                                           | **Simple**                                         | WI-047                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-028 | Path tool adopts the Corridor's snapped behaviour                                                                                                                | **Deceptive** (reversal)                           | WI-051, WI-052 / SPEC-028                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| IN-029 | Superseded point snap-dots are still drawn under the cell                                                                                                        | **Simple**                                         | WI-048                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-031 | Edit/View toggle beside undo/redo — a soft carve lock                                                                                                            | **Simple**                                         | WI-053                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-030 | Creature cards are inert — selection is keyed to a seat                                                                                                          | **Complex (Shape A)**                              | WI-054–057 / SPEC-032                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IN-014 | The Symbol tool ignores the snap mode                                                                                                                            | **Simple**                                         | WI-068                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-033 | Mobile viewport clipping, map `touch-action`, safe areas                                                                                                         | **Simple**                                         | WI-058 / SPEC-033 §§1–3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| IN-039 | Path simplification destroys sub-half widths                                                                                                                     | **Simple**                                         | WI-059 / SPEC-028 §10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IN-038 | Corridor/Path bands overshoot at every bend                                                                                                                      | **Deceptive**                                      | WI-061 / SPEC-028 §9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-040 | The corridor's bend axis is hard-coded horizontal-first                                                                                                          | **Deceptive**                                      | WI-062 / SPEC-028 §11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IN-036 | The mobile breakpoint fires on any coarse pointer                                                                                                                | **Deceptive**                                      | WI-067 / SPEC-033 §7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-037 | Blaze upload containment — limits enforceable on our side                                                                                                        | **Deceptive**                                      | SPEC-034 (Completed), WI-065 (RULE-010 amendment) + WI-066 (§§2–4), both 2026-08-14. The `[HUMAN]` console half is `docs/runbooks/blaze-billing.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-042 | Documentation context loading optimization (Planning vs Execution split)                                                                                         | **Deceptive**                                      | WI-069                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| IN-034 | Hover-only affordances are unreachable on touch                                                                                                                  | **Deceptive**                                      | WI-063 / SPEC-033 §4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-035 | Full-screen view and the installed/standalone app view                                                                                                           | **Deceptive**                                      | WI-064 / SPEC-033 §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-043 | Un-quarantine and refactor portability.spec.ts e2e test                                                                                                          | **Deceptive**                                      | WI-070 / SPEC-036                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-010 | Battle Map quick sheet                                                                                                                                           | **Complex (Shape A)**                              | WI-033–036 / SPEC-029                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| IN-041 | Lobby credits, and the symbol pack's provenance                                                                                                                  | **Simple**                                         | WI-060 / SPEC-033 §6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-032 | Toolbar-added creatures are invisible to players                                                                                                                 | **Unclear**                                        | Closed, no work item — user (2026-08-11): working as designed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| IN-052 | Serve asset storage from a GitHub Pages subfolder                                                                                                                | **Unclear**                                        | Withdrawn, no work item — user (2026-08-11): premise didn't hold (404 KB total assets); the Saved-URL path covers it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-047 | `PLAN-COMPLETED.md` §3 carries duplicated WI ids                                                                                                                 | **Investigation**                                  | WI-072 — repaired the WI-058/WI-059/WI-068 duplicate rows; each pair described one real change, not two, so no fresh id was needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| IN-048 | SPEC-029 §2 is cited by no Battle Map work item                                                                                                                  | **Deceptive** (verify then close)                  | WI-072 — verified: rect-not-raster, background/floor/overlay clipped with no source grid, `exportPng` stays wired with `backgroundColor` compositing all shipped; no gap found                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| IN-056 | Encounter Template default → Initiative only                                                                                                                     | **Deceptive**                                      | WI-074 / DEC-065                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| IN-058 | Edit/View becomes one binary button, default View                                                                                                                | **Deceptive** (reversal)                           | WI-076 / DEC-064                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| IN-059 | Capture tool moves to the battle-map quick sheet                                                                                                                 | **Deceptive**                                      | WI-077 / DEC-066 / SPEC-029 §1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| IN-049 | Lasso — vertex/object multi-select, Backspace deletes, loop-preserving removal                                                                                   | **Deceptive**                                      | WI-078 / DEC-060 / SPEC-037                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-050 | Free snap also snaps to an existing vertex                                                                                                                       | **Deceptive**                                      | WI-079 / DEC-061 / SPEC-028 §12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| IN-053 | Multiple background assets — move/resize, ratio locked, alignment grid                                                                                           | **Deceptive**                                      | WI-080 + WI-081 / SPEC-038                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| IN-054 | Move background management into the Assets activity                                                                                                              | **Deceptive**                                      | WI-081 / SPEC-038 §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-027 | Expanding a group re-lays tokens out in a grid                                                                                                                   | **Deceptive**                                      | WI-082 / DEC-067 — a separate "Tidy" action; expand keeps restoring the stored formation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| IN-060 | Background move/resize — uncover the runtime errors                                                                                                              | **Investigation**                                  | WI-083 — findings logged as IN-067 – IN-069                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-061 | Backgrounds are marked locked or unlocked, from the Assets page                                                                                                  | **Deceptive**                                      | WI-084 / SPEC-039 §1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-062 | Select picks up, moves and resizes an unlocked background                                                                                                        | **Deceptive**                                      | WI-085 / DEC-070 / SPEC-039 §2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| IN-063 | Corners keep the ratio, edges free it                                                                                                                            | **Deceptive** (rev.)                               | WI-086 / SPEC-039 §3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| IN-064 | Creatures get real names and A–Z symbols                                                                                                                         | **Deceptive**                                      | WI-087 / DEC-072 / SPEC-040 — schema v28; §5's "map token's label" annotated in place (no on-map name label exists to agree with)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IN-065 | Local-only mode — the `.vttcamp` is the live document                                                                                                            | **Complex (Shape A)**                              | WI-088 (RULE-009 amendment, RULE-017) + WI-089 / DEC-073 – DEC-075 / SPEC-041 (Completed) — `LocalStore`, the `local-build` Vite mode, the single-user scoping and the local lobby; packaging is IN-066/WI-090                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| IN-066 | Packaging and distributing a local build                                                                                                                         | **Investigation**                                  | WI-090 — findings logged as IN-070 – IN-073                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-074 | Redraw the icon set under a stated depiction rule                                                                                                                | **Simple**                                         | WI-091 / SPEC-043 / DEC-076                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| IN-075 | No focus state on any shell icon control                                                                                                                         | **Simple**                                         | WI-092 / SPEC-044                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

#### IN-001 — Refactor the planning and instruction documentation

**Request.** "Refactor this repository's planning and instruction documentation." (Phases
0–4: baseline, split the Master Plan into five files, write CLAUDE.md, apply decided
configuration, reconcile.)

**Classification.** **Complex (Shape A)** — Large refactor spanning every planning
document, plus new harness configuration (hooks, slash command, settings). Not a playtest
item, so Simple/Deceptive triage does not apply; it arrived already discussed and
multi-phase.

**Disposition.** → **WI-028**. Phases 1–3 executed; Phase 4 reconciliation gates deletion
of the source document.

#### IN-002 — App Check: monitoring → enforcement

**Request.** Carried from the WI-025 ledger: "the remaining step is watching metrics
through at least one full real session and then flipping to **enforcement**."

**Classification.** **Deceptive** — Touches **auth** — a Deceptive trigger by name.
SPEC-025 §2 states outright that enforcing early "will lock out legitimate clients". Zero
code changes, but the failure mode is a total outage for every player, and there is no
in-app reversal path.

**Disposition.** → **WI-029**, `[HUMAN]`. Its multi-phase plan already exists as SPEC-025
§2's monitoring-first rollout; the gate is your explicit go-ahead after reviewing console
metrics.

**Note on the classification.** Triage says Deceptive items "do not get scheduled; they
stop and become a conversation with the user, then a multi-phase plan with its own specs."
That conversation and that plan already happened — SPEC-025 §2 _is_ the multi-phase plan,
and monitoring mode is phase one, already live. WI-029 is phase two. It is listed in §2
rather than withheld because withholding it would lose the only record that the rollout is
half-finished.

### Map-tools playtest batch (2026-08-01)

A nine-item batch: four restatements of one geometry problem, an investigation, two
small fixes, and two large new map types. `IN-003` was the next unused id (RULE-019).

#### IN-003 — N-gon dropdown, drag orientation, cell-centred sizing

**Request.** "Ngon drop down — select between: circle, 3, 4, 5, 6, 7, 8. Direction of the
drag changes the orientation… snap the flat face… Snap diameter… Default to circle. Center
the ngon in the middle of the selected cell."

**Classification.** **Deceptive** — Touches the **carve pipeline and lattice coordinates**
— a RULE-006 trigger by name. Changes what "snap" means for an existing tool, which is a
reversal, not an addition.

**Disposition.** → **WI-030**, under new **SPEC-028**.

#### IN-004 — Corridor width dropdown, cell-centred band

**Request.** "Corridor drop down — select between: ½, 1, 2. Default to ½ when snap = half
and 1 when snap = cell or free. Center the corridor in the selected cell or half cell."

**Classification.** **Deceptive** — Same trigger: `corridorPoly`'s band quantization is
carve-pipeline geometry, and the width control is shared with two other tools.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-005 — Room carve snaps to cells, 1×1 minimum

**Request.** "Room carve should snap to the cell (or half cell) when in snap mode,
starting with a 1x1 carve and then grow as the user moves the mouse."

**Classification.** **Deceptive** — Same trigger. Also turns a currently-degenerate case (a
click that never moves) into a committing one.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-006 — Snap indicator: highlight the targeted cell

**Request.** "Snap indicator for room and corridor tool when in cell snap should be the
highlighted cell that is targeted (and half cell when in half)."

**Classification.** **Deceptive** — A new draw call on the Pixi `tools` layer — **the layer
stack** is a named trigger.

**Disposition.** → **WI-030** / SPEC-028.

#### IN-007 — Evaluate the other carving tools for inconsistencies

**Request.** "Evaluate other carving tools for inconsistencies."

**Classification.** **Investigation** — Not a change at all. It produces findings, not
edits, so Simple/Deceptive does not apply.

**Disposition.** Audited inside **WI-030**; findings logged as IN-012 – IN-014 below
(DEC-027).

#### IN-008 — URL-derived token does not display on the map

**Request.** "When a url derived token is used, click dragging from the character sheet
does not display the token on the map."

**Classification.** **Simple** — The change is contained to texture loading inside
`VectorMapView`; it adds no store method, no schema field, no rules change, and moves no
`data-testid`.

**Disposition.** → **WI-032**.

#### IN-009 — Move Token scale to the Character quick sheet

**Request.** "Move token scale from map tools to character quick sheet, underneath map
defaults."

**Classification.** **Simple** — The control, its three testids and its callback move
verbatim between two components that both already hold `MapToolController` in context;
nothing about the underlying `resizeToken` call changes.

**Disposition.** → **WI-031**.

#### IN-010 — Battle Map quick sheet

**Request.** "Battle Map quick sheet…" (full text in SPEC-029).

**Classification.** **Complex (Shape A)** — A new map type ⇒ `GameMap` schema change ⇒
migration (RULE-007), new store methods (RULE-001), toolbar filtering, a new quick sheet, a
bounded camera.

**Disposition.** → **SPEC-029**, phased **WI-033 – WI-036**.

#### IN-011 — Hex Crawl map type

**Request.** "Hex Crawl Map Type…" (full text in SPEC-030).

**Classification.** **Complex (Shape A)** — Replaces the square lattice with a hex one —
**a second coordinate space, which RULE-006 forbids** — plus a terrain model the renderer
has no concept of. Needs a rule amendment before it can start.

**Disposition.** → **SPEC-030**, phased **WI-037 – WI-041**.

### Findings from the IN-007 carve-tool audit

Reported, not fixed (DEC-027). All three were verified against the code, and the first
two were reproduced by probing `buildFloorStroke` directly.

#### IN-012 — A single Carve dab paints nothing at widths ≤ 1 under cell snap

**Finding.** The brush is handed _vertex_-snapped points, then paints every cell whose
**centre** is within `radius = max(width/2, step/2)` of them. A cell centre is always
`0.707` from the nearest vertex, so at radius `0.5` no cell qualifies and the stroke
commits nothing. Verified: widths 0.5 and 1 → nothing; 1.5, 2 and 3 → a 2×2 block.

**Classification.** **Deceptive** — Carve pipeline (RULE-006). The fix is to feed the brush
raw points like the other cell-anchored tools, which changes every snapped brush stroke,
not just the failing case.

**Disposition.** → **WI-042** (approved 2026-08-01).

#### IN-013 — A snapped Carve stroke is centred on a grid intersection, not on the cell under the pointer

**Finding.** Same root cause as IN-012: clicking at `(3.9, 5.1)` — well inside cell
`(3,5)` — paints cells `(3,4)`, `(4,4)`, `(3,5)`, `(4,5)`, a block symmetric about the
corner rather than about the cell aimed at.

**Classification.** **Deceptive** — Same trigger and same fix as IN-012; they should land
together.

**Disposition.** → **WI-042**, with IN-012 (approved 2026-08-01).

#### IN-014 — The Symbol tool ignores the snap mode

**Finding.** `anchorCellFor` (`symbol-catalog.ts:207`) hardcodes `Math.floor`, so a symbol
always lands on a whole cell even under Half or Free snap — the only tool whose snap
control does nothing.

**Classification.** **Simple** — One pure function plus its call site; no schema, no store,
no rules, no testid move. But it changes stored `MapSymbol.cell` values from integers to
halves, so it wants its own gate.

**Disposition.** → **WI-068**, closed 2026-08-03.

**Not findings, deliberately.** Wall, Door and Polygon keep vertex snapping: a wall runs
_between_ intersections and a polygon's gesture is placing corners, so a vertex is the
right anchor for all three. The Path tool keeps its free-form ribbon — it is the organic
counterpart to the Corridor, and cell-aligning it would remove the only tool that is not
grid-true. The Label tool already floors to the clicked cell (`snapCell`), matching the
new rule.

> **The Path clause is under reversal (2026-08-02).** IN-028 asks for exactly the
> cell-alignment this paragraph declined. The disposition is **named and superseded by
> DEC-032**, which is Open — it is annotated here rather than rewritten (RULE-019), and
> stands until that decision is answered.

### Workflow feedback from the first run under the new layout (2026-08-01)

Seven findings from executing WI-030 — the first work item to go through the WI-028
five-document layout end to end. All seven were approved by the user on the same day.
Three are defects in the layout itself rather than improvements to it.

#### IN-015 — "Deceptive" stopped discriminating

**Finding.** Six of twelve items in the map-tools batch classified Deceptive, all for the
same reason: RULE-006 names the Pixi layer stack, the carve pipeline and lattice
coordinates as triggers, and any real map work touches one. What actually predicted
difficulty was _changing the contract of_ those things, not _touching_ them — IN-003–006
redefined what "snap" means, while IN-014 merely touches the same files and is genuinely
small.

**Classification.** **Deceptive** — Changes the triage rule itself, so it changes how every
future item is classified. No clean reversal once items have been classified under new
wording.

**Disposition.** → **WI-044**.

#### IN-016 — A classification was invented mid-run

**Finding.** IN-007 ("evaluate other carving tools") is neither Simple, Deceptive nor
Unclear — it produces findings, not edits. It was labelled **Investigation** and the
vocabulary was extended without flagging it.

**Classification.** **Simple** — One list in `CLAUDE.md` gains a named fourth category; no
code, no schema, no rule text, reversible in a single commit.

**Disposition.** → **WI-044**.

#### IN-017 — RULE-018's ordering clause is unenforceable

**Finding.** "Documentation is updated before implementation, never after" — WI-030
implemented first and wrote SPEC-028 afterward. The PR carried both, satisfying the second
sentence, which is the checkable one. No hook or CI job can observe the ordering.

**Classification.** **Deceptive** — Amends `RULES.md`. Requires the stop-flag-approve-amend
ceremony and a standalone `RULE-AMENDMENT:` commit (RULE-017).

**Disposition.** → **WI-043**.

#### IN-018 — The Model column was lost in the WI-028 split

**Finding.** `CLAUDE.md` still requires each work item to name a model target; both
`PLAN.md` tables carry Agent and Effort and no Model. The archives
(`PLAN-COMPLETED-addendum-c.md`, `-access-lifecycle.md`) do carry it, so this is a
**regression introduced by the new layout**. Twelve WI rows were added under it without a
model target and nothing caught it. The pinned IDs in `CLAUDE.md` (`claude-opus-4-8`,
`claude-sonnet-4-6`) are also both stale.

**Classification.** **Simple** — Restores a column the archives already use and updates one
paragraph of `CLAUDE.md`; no code, no rule text, reversible in a single commit.

**Disposition.** → **WI-044**.

#### IN-019 — The completion summary is written before verification, so it is a prediction

**Finding.** WI-030's summary claimed strokes "move by up to half a cell" — true of the
anchor, false of the extent, since a Room grows by up to a full cell per axis. A failing
e2e fixture caught it, not review. Step 7 follows step 6 but nothing requires the suite to
have passed first.

**Classification.** **Simple** — One clause in `CLAUDE.md` step 7; no code, no rule text.

**Disposition.** → **WI-044**.

#### IN-020 — Nothing prompts the `PLAN.md` status write-back

**Finding.** `CLAUDE.md` asks for one before any long-running operation. WI-030 ran a
27-minute suite twice without one. Good advice with no trigger attached.

**Classification.** **Deceptive** — The obvious fix is a third `PreToolUse` hook, and
**DEC-016 fixed the count at exactly two**, saying no more without a work item and a
`DECISIONS.md` entry. So this touches a closed decision and the harness.

**Disposition.** → **WI-045**.

#### IN-021 — Intake rows have outgrown the table

**Finding.** IN-012's row is a full paragraph inside a five-column markdown table —
unreadable raw, awkward rendered.

**Classification.** **Simple** — Reformats one section of `PLAN.md` into the
section-plus-index shape §3 already uses; no content change.

**Disposition.** → **WI-044**.

### Quick-sheet / encounter / path-tool playtest batch (2026-08-02)

Eight items plus two questions. The two questions are answered in place — a question
produces an answer, not an edit, so only the one that asked for a **behaviour change**
(IN-022) became an intake item. `IN-022` was the next unused id (RULE-019).

**The character-ownership question, answered.** Asked: can a player own multiple
characters, can the referee, and who owns a character when its player disconnects?

- **A player can act as many characters.** Ownership is a property of the **group**, not
  the token (`packages/shared/src/encounter/ownership.ts`). A seat listed in
  `Group.memberSeatIds` may act as _every_ character in that group — open its sheet, edit
  its profile, roll its fields. `PlayerSeat.currentCharacterSeatId` is the pointer to
  which one they are currently playing; they switch freely, and they write that pointer
  themselves.
- **The referee owns every character.** GM membership is _derived_ from `Room.gmUid` in
  `canSeatActAs`, never stored, so transferring GM moves that membership across every
  group at once with no writes.
- **Disconnecting changes ownership not at all.** Presence is ephemeral (an RTDB node
  removed by `onDisconnect`); the durable seat, its group memberships and its profile all
  survive. The only visible effect is that the token dims (`AWAY_ALPHA`, SPEC-027). The
  referee still owns the character, as they always did, and any other seat in the same
  group can still act as it. A seat is only actually reclaimed by the GM-confirmed prune
  at `ABANDONED_SEAT_DAYS = 30`.

  **Worth naming:** if a lone player owns a group by themselves and drops, no _player_
  can act as those characters until they return — the referee is the only fallback. That
  is the current design, not a defect, but if you want a hand-off on disconnect it is a
  new intake item.

#### IN-022 — Scheduled or completed intake rows are never retired

**Request.** "Intake items not removed from `PLAN.md` as scheduled or completed, should we
update this behavior?"

**Finding.** Confirmed. All 21 existing intake items sit in §1 permanently; IN-001's
disposition still reads "→ WI-028" although WI-028 closed on 2026-08-01, and WI-029's
completion summary says outright that "index rows are not rewritten on completion". §1 is
described as "classified, not yet scheduled", which is now false of most of its contents,
so the one table that should answer "what is waiting" answers "everything that ever
arrived". RULE-019 forbids deleting or reusing the ids, so the fix is a **status column
plus a closed-intake archive**, not deletion.

**Classification.** **Simple** — Reformats `PLAN.md` §1 and adds one paragraph to
`CLAUDE.md` step 1. No code, no schema, no rule text, no `RULES.md` edit; reversible in a
single commit. It changes no item's classification or disposition, only where a retired
row is displayed.

**Disposition.** → **WI-049**.

#### IN-023 — Token scale overflows the quick sheet's bounding box

**Request.** "In character quick sheet, token scale goes past the bounding of the sheet,
move down below."

**Classification.** **Simple** — A layout fix in one component
(`CharacterDock.svelte`'s `.map-defaults` block, added by WI-031). It moves no
`data-testid` out of the component, touches no store method, no schema and no rules.

**Disposition.** → **WI-046**, with IN-024 (same component, same area).

#### IN-024 — The quick sheet header reads "Character", not the character's name

**Request.** "Next to the token image we display 'Character' instead of the current name
associated with that token. Update to the Character name. Allow double click to edit and
change the name. Enter or clicking outside the bounding box of the edit to complete or esc
to cancel."

**Classification.** **Simple**, and **flagged as borderline** — see below.

`CharacterDock.svelte:265` hardcodes `<h2>Character</h2>`. The name to show is
`PlayerSeat.displayName` for the sheet's seat, which is already the established answer:
`EncounterBoard.cardName()` resolves a card's title exactly that way, with the comment
"Never a game value". It cannot be a profile field — RULE-002 and the component's own
header comment forbid per-field-id logic, and the template is referee-defined so there may
be no `name` field at all. The edit writes through the existing `renamePlayer` store
method; `firestore.rules` already permits `players/{uid}` writes from that uid or the GM,
so no rules change is needed.

Why it does not trip a Deceptive trigger: no store method is added or re-signed, no stored
field changes type or meaning, `firestore.rules` is untouched, no coordinate or layer
semantics move, and no existing `data-testid` is moved, renamed or removed (the inline
editor adds new ones).

**Why it is flagged.** `renamePlayer`'s doc comment says "GM renames a seat's display
name", and under group ownership a player can have another character's sheet open and
editable — but the rules deny them writing that seat's `players/{uid}` doc. The affordance
is therefore gated to own-seat-or-GM (**DEC-030**). That is a UI gate over an existing
rule, not a change to one, which is why this stays Simple — but it is close enough to the
line to name explicitly at the gate.

**Disposition.** → **WI-046**, with IN-023.

#### IN-025 — Remove the Clear button from the quick-sheet colour picker

**Request.** "Remove the 'clear' button from color selection - not needed."

**Classification.** **Deceptive** — two triggers, one of them substantive.

1. `token-color-clear` is a `data-testid` a Playwright spec depends on
   (`dice-overlay.spec.ts:171`) — removed, which is a named trigger.
2. More seriously, **Clear is the only path back to no colour.** `ProfileInstance.color`
   and `Token.color` are both `color?`, and absent means something specific: the die
   renders one theme-wide neutral (`--dice-face`) rather than a per-seat value, and a
   letter token keeps its auto-assigned `gen:disc:` fill. Neither swatch nor
   `<input type="color">` can produce `undefined`. Deleting the button makes the absent
   state unreachable once any colour has been set — a one-way door for every character,
   with no reversal path in the UI.

**Disposition.** → **WI-050**, under new **SPEC-031**. **Resolved by the user,
2026-08-02** (DEC-033): "we can just always assign a color, at random if necessary. There
should be no case where a roll does not have a color associated." That removes the
objection by removing the unset state itself — but it makes this the larger half of the
item, not the smaller: an absent `color` stops meaning "no custom colour chosen" and
starts meaning "written before this rule, needs backfill", which is a stored-field
meaning change under RULE-007 and ships a migration, a migration test and a `.vttcamp`
round-trip test. Removing the button is the last step, not the work.

#### IN-026 — An empty "+" card on each encounter group adds a creature to it

**Request.** "In encounter activity, each group displays at the far right an empty card,
containing only a plus sign. Click on this to add a new creature to the group."

**Classification.** **Simple** — It is a new card rendered at the end of each group's card
row in `EncounterBoard.svelte`, reusing machinery that all already exists: the
`dialogs.pickToken` creature picker, `store.createToken`, and `store.updateGroup(...,
{ memberTokenIds })`. No store method is added or re-signed, no schema field changes, no
rules change, no coordinate or layer semantics move, and it only _adds_ `data-testid`s.
The equivalent flow already ships in `VectorMapView.addCreature`.

**Open sub-question, defaulted:** the board has no map camera, so a creature created there
needs a spawn position. Defaulted to the same `STARTER_DROP_POS` staircase
`VectorMapView.addCreature` already uses (**DEC-031**), and the card is GM-gated to match
the existing `add-creature` control.

**Disposition.** → **WI-047**.

#### IN-027 — Expanding a group re-lays its tokens out in a grid

**Request.** "If a group is collapsed and then expanded, do not retain the original
relative position, instead arrange the tokens in the order they are included in the group,
when 4 or more are included, move to a new row (grid layout)."

**Classification.** **Deceptive** — It changes the meaning of a stored field.
`Group.memberOffsets` exists for exactly one purpose: `collapseGroupPatch` records each
member's offset from the anchor so `collapsedDragUpdates` can restore the formation, and
the code comment states the intent as "keeps the stored formation … so the formation
survives a collapsed drag and expand". Re-laying out on expand makes that field either
dead or half-dead — it is still needed _during_ a collapsed drag but must be discarded
_at_ expand — and that is a schema-meaning change under RULE-007, not a rendering tweak.

It is also a **write to every member token's position on every expand**, which the token
layer has no undo for. A referee who collapses a group to drag it, then expands it, loses
the arrangement they built, with no way back.

**Disposition.** ~~Not scheduled.~~ **Answered (user, 2026-08-11, DEC-067): a separate
explicit "Tidy" action.** Collapse/expand keep restoring the formation unchanged;
`Group.memberOffsets` keeps its one stated meaning. **Scheduled → WI-082.** The grid's
spacing, its origin, and whether it applies to board card order are left to WI-082's own
execution-time decisions per DEC-067.

#### IN-028 — The Path tool adopts the Corridor's snapped behaviour

**Request.** "Path tool, adjust to match the behavior of the corridor tool. When snap is
cell or half, snap icon should be a full or half tile. When snap is free, the snap display
should be a circle of the desired width. Change width selection to a drop down (⅛, ¼, ½,
1, 2). Default width is ½ when snap = half and 2 when snap = cell or free. When snap = cell
or half, path termination points should be 90°, not rounded (ie if player draws a path
between right angle points, behavior should be identical to corridor tool)."

**Classification.** **Deceptive**, and it is additionally a **reversal** — it must name and
supersede the decision it overturns before it can be planned.

- **It reverses a recorded disposition.** `PLAN.md` §1, "Not findings, deliberately"
  (WI-030, IN-007 audit) states: "The Path tool keeps its free-form ribbon — it is the
  organic counterpart to the Corridor, and cell-aligning it would remove the only tool that
  is not grid-true." That reasoning is now being overturned deliberately, which is fine,
  but it is a Shape A move: the entry is named and superseded by **DEC-032**, never
  silently overwritten.
- **It splits a shared contract.** `FloorToolOptions.width` is documented as "Path and
  Carve brush width, free-form", and `MapToolbar`'s `showWidth` renders one control for
  both tools. Giving Path a fixed option set either changes Carve's brush at the same time
  or splits the field — the same surgery `corridorWidth` needed (DEC-023), which was itself
  classified Deceptive.
- **It changes what "snap" means for a fourth tool**, adds Path to `CELL_ANCHORED_TOOLS`
  and to `targetedCellFor` (whose doc comment currently restricts it to Room and Corridor
  on stated grounds), and changes the carve pipeline's output: squared line caps mean
  `bufferPolyline` — shared with Carve — grows a cap-style parameter.
- **The ⅛ and ¼ widths are new territory.** Every existing snapped width is a whole or half
  cell; sub-half widths interact with `snapSpan`'s one-step floor and with the "full or half
  tile" snap icon the same request asks for, which cannot show a ⅛ width truthfully.

**Disposition.** → **WI-051** and **WI-052**, amending **SPEC-028**. **Ratified by the
user, 2026-08-02** (DEC-032), wholesale and with two extensions that resolve the two
objections above:

- **The Corridor adopts the same ⅛/¼/½/1/2 set**, so the two tools share one width
  vocabulary. This supersedes DEC-023's corridor half.
- **When `width` is below the snap step, the carved band is centred inside the snapped
  tile** — so `width = ½ · snap = cell` (a ¼-cell inset on each side of a full tile) is
  deliberately _distinct_ from `width = ½ · snap = half` (fills a half-tile exactly). The
  snap indicator then shows the band actually being carved rather than the tile it sits
  in, which is what makes a ⅛ width representable at all.

Carve keeps its free-form width and becomes the only organic floor tool — knowingly.

**Verified while planning:** the centring rule is a _simplification_ of `bandLo`, not an
addition. It currently quantizes to `min(step, width)`; the ratified rule is plain
`cellCenter - width/2`. Every expectation `bandLo`'s doc comment claims survives the
simpler form, and the quantization is exactly what was collapsing `width = ½ · snap =
cell` onto a half-cell line instead of centring it.

#### IN-029 — Superseded point snap-dots are still drawn under the cell indicator

**Request.** "For any tools that used to have a point snap indicator that was superseded by
a tile or shape snap indicator, make sure we are not also overlaying the point."

**Finding.** Confirmed, and it is exactly one case. `vector-engine.ts:1134` draws the
`cursorCell` highlight and then `:1150` draws `cursorSnap` — the dot — unconditionally on
top, with the comment "Drawn last so it always reads on top". `VectorMapView` supplies both
for Room and Corridor under Cell or Half snap, so those two tools show a dot in the middle
of the tile they already highlight. N-gon and Carve show only the dot (they have no cell
highlight, deliberately — `targetedCellFor` returns null for them), and Wall/Door/Polygon
legitimately snap to a point, so none of those change.

**Classification.** **Simple** — One conditional in `VectorMapView.snapCursorPoint()` (or,
equivalently, one `else` in `renderToolPreview`). It removes a draw call; no store method,
no schema, no rules, no coordinate semantics, and no `data-testid` moves — `snap-cell-readout`
and `snap-cursor` keep reporting what they report today.

**Disposition.** → **WI-048**.

### Creature selection and the edit lock (2026-08-02)

Two requests, plus a third item split out of the first because the investigation showed
the request's two halves have different causes. `IN-030` was the next unused id.

#### IN-030 — Creature cards are inert, because selection is keyed to a seat

**Request.** "In map or encounter activity view, creature cards are not selectable which
means we cannot click and drag to reposition on the map. I believe we should be able to
select any card (player or creature) that belongs to a group we are a member of, which for
a referee is all of them."

**Finding — the board half is confirmed, and the cause is structural.**
`EncounterBoard.selectCard()` is `if (token.ownerSeatId) onSelectActor(token.ownerSeatId)`
— a no-op for a token with no owning seat. `class:selectable`, `role="button"` and
`tabindex` are all gated on `Boolean(token.ownerSeatId)` too, so a creature card is not
merely unresponsive, it is not focusable and does not advertise itself as clickable.
Creatures never have a seat: `VectorMapView.addCreature` calls `createToken` with
`pos`/`size`/`layer`/`imageRef` only.

The cause is not a missing branch, it is the **key**. The whole selection spine is
seat-keyed end to end: `onSelectActor(seatId)` → `RoomShell.selectActor(seatId)` →
`selectedSeatId` → `canSeatActAs(..., targetSeatId, ...)` → `store.setCurrentCharacter`,
and `CharacterDock` then resolves a _profile_ from that seat. A creature has no seat and
no profile, so it cannot enter that model at all. Making creature cards selectable means
re-keying selection from "a seat" to "a token, which may or may not have a seat", and
deciding what the quick sheet shows when there is no profile behind the selection.

**The map half of the request does not reproduce.** Token drag on the map is **not**
ownership-gated: `syncSprites` sets `eventMode = 'static'` and calls `attachDragHandlers`
for _every_ token it renders, and `attachDragHandlers` has no seat or group check. A
referee can already click and drag any creature token on the map. What can hide one from a
_player_ is visibility, not selection — see IN-032, which is why that half is split out.

**Classification.** **Complex (Shape A)** — Reclassified from Deceptive on 2026-08-02,
once the user's three answers made the scope explicit. Creatures gaining profiles
(DEC-034) is a `ProfileInstance` schema change with a migration, so this is no longer a
single gated item — it is a phased body of work with its own spec.

It changes the contract of the selection callback shared by `EncounterBoard`,
`VectorMapView` and `RoomShell` (`onSelectActor(seatId)`), and the meaning of
`PlayerSeat.currentCharacterSeatId`, which is defined as "the seat whose character this
player is currently playing" and has no reading for a seatless creature. It also reaches
`CharacterDock`, whose every control — profile fields, colour, portrait, and the rename
affordance added in WI-046 — assumes a seat behind the selection.

**The three questions, answered by the user (2026-08-02).**

1. **What does selecting a creature open?** → **A real profile.** "Lets go ahead and add
   the profiles, will be needed eventually anyways" (**DEC-034**). Profiles are re-keyed
   from a seat id to an **actor id** — a seat id for a character, a token id for a
   creature — reusing the room's existing `profileTemplate`. Two findings from planning:
   `deleteToken` cleans up nothing today, so a token-keyed profile would leak on every
   creature deletion and `deleteToken` must enumerate it; and `firestore.rules` needs **no
   change**, because `profiles/{seatId}` is already member-writable rather than
   own-seat-only.
2. **Is the ownership rule new?** → **New, and one step shorter** (**DEC-035**). The
   motivating case is an NPC travelling with the party: in the group, owned by no one
   player. `canSeatActAs` resolves a seat by finding a group that lists me _and_ holds a
   token whose `ownerSeatId` is the target — an inner test a seatless creature can never
   pass. For a creature the rule is simply **is this token in a group I own**, with the
   referee's membership still derived from `Room.gmUid`.
3. **Should map drag be gated?** → **Yes** (**DEC-036**), the user's instruction being to
   gate it only if straightforward. It is: the check goes inside the `pointerdown`
   handler, which closes over live `tokens`/`groups` state and so re-evaluates on every
   press with no sprite-cache invalidation when membership changes. One policy gap is
   defaulted rather than asked: a token with **no group and no seat** — scenery, and the
   single creature `addCreature` deliberately leaves ungrouped — matches no ownership rule
   and becomes **referee-only**. That is a capability removal, since map drag is ungated
   today, and it is reversible in one predicate.

**Disposition.** → **SPEC-032**, phased **WI-054 – WI-057**.

#### IN-031 — An Edit/View toggle beside undo/redo: a soft lock on carving

**Request.** "We should add a edit/view toggle near undo/redo in map tools. This is a soft
lock on carving functions or editing functions. No permissions change, just a quick toggle
to prevent accidental edits when not intended."

**Classification.** **Simple** — Client-local, per-viewer UI state (a boolean on
`map-tool-controller.svelte.ts`) plus a toolbar control and a disabled/inert state for the
carve and edit tools while it is off. It adds no store method, writes nothing to Firestore
or RTDB, changes no schema field, touches no security rule, and moves no `data-testid` —
it only adds one. It redefines no coordinate, layer or pipeline stage: the tools it gates
keep meaning exactly what they mean, they just do not receive input.

**Explicitly not a permissions change**, per the request — which also means **it does not
resolve DEC-001** (whether the vector toolbar should be GM-gated at all). That decision
stays Open; this is a latch the holder can flip for themselves, not a boundary.

**Disposition.** → **WI-053**.

#### IN-032 — A creature added from the map toolbar is invisible to every player

**Finding, from the IN-030 investigation.** `VectorMapView.addCreature` creates its group
with `showMap: false, showBoard: false`. `visibleTokenIds` hides a token whose every group
has the surface flag off, and `renderableTokens` applies that to all non-GM viewers —
`isGM ? tokens : tokens.filter(...)`. So a batch of creatures added from the toolbar
renders for the referee and for nobody else until the referee flips `[Map]` on the group
card.

This may well be deliberate — staging a monster group unseen and revealing it on the
referee's cue is exactly how an ambush should work, and the `[Map]`/`[Board]` toggles exist
to do it. It is recorded because it is a plausible second cause of "we cannot reposition
creatures on the map" as observed from a _player's_ seat, and because a single creature
added alone gets **no group at all** (`addCreature` only calls `createGroup` when
`newTokenIds.length > 1`), so it is visible to everyone immediately — the two paths
disagree, which is harder to defend than either rule on its own.

**Classification.** **Unclear** — Whether this is a defect depends on intent, which the
code does not record and I should not guess.

**Disposition.** ~~Awaiting the user.~~ **Answered (user, 2026-08-11): (a) working as
designed — closed, no work item.** Staging a batch unseen and revealing it on the
referee's cue is the intent; the single-creature path's immediate visibility is accepted
as-is despite the two paths disagreeing.

---

### Mobile, Blaze prep, carve artifacts and credits (2026-08-03)

A four-part investigation request rather than a playtest list: the user asked for findings
on each area **before** any plan was formed. Each finding below is logged as its own
intake item (Shape B, one row per item), and the classification table was approved by the
user on 2026-08-03 before anything advanced.

#### IN-033 — Mobile viewport clipping, the map's missing `touch-action`, and safe areas

**Finding.** Three separate causes behind "toolbars are often not visible under Safari"
and "click-and-drag is inconsistent on mobile":

1. **The viewport.** `.mshell` correctly uses `height: 100vh; height: 100dvh`
   (`RoomShell.svelte:1113`), but its ancestor `App.svelte:46` is `min-height: 100vh` —
   the **large** viewport. The document is therefore taller than the visible small
   viewport, the page scrolls, and `mrail-chips` + `mrail-bottom` ride out from under
   Safari's collapsing URL bar. `.shell` (the desktop frame, `RoomShell.svelte:914`) has
   the same `100vh` with no `dvh` fallback.
2. **`touch-action`.** It appears in exactly two places in the whole app
   (`RoomShell.svelte:968`, the rail drag handle; `QuickSheetCard.svelte:205`). The Pixi
   map host `.vf-canvas-wrap` has **none**, so the browser's native pan/pinch competes
   with the map's own pan/zoom and with token drag. `map/pan-zoom.ts:124` already carries
   a comment relying on a `touch-action: none` that is never set on the map host.
3. **Safe areas.** `apps/web/index.html` has no `viewport-fit=cover`, and
   `env(safe-area-inset-*)` appears nowhere in the codebase, so the mobile bottom bar
   sits under the iPhone home indicator.

**Classification.** **Simple.** CSS plus one `<meta>` attribute. It touches no
`CampaignStore`/`AssetStore` method, no `GameMap`/`Room`/`PlayerSeat` field, neither rules
file, no lattice/layer/pipeline semantics, no auth or join path, no store routing, and no
existing `SPEC-nnn`'s stated behaviour. It moves and renames no `data-testid` — the mobile
frame's `app-shell-mobile`, `mobile-activity-bar`, `shell-stage` and `vector-map-canvas`
all stay exactly where they are.

**Disposition.** WI-058, against SPEC-033 §§1–3. Closed 2026-08-04.

#### IN-034 — Hover-only affordances are unreachable on touch

**Finding.** `@media (hover: hover)` appears **zero** times in the codebase. Three
affordances are hover-gated with no touch equivalent: the map's room-label tooltip
(`VectorMapView`'s `showHoverLabel` / `hoverLabel`, driven from `pointermove`), the Select
tool's `hoverHandle` highlight, and every plain `:hover` rule — which on iOS latches after
a tap and stays lit until the next tap elsewhere.

**Classification.** **Deceptive.** The fix is not a media query: it has to decide what
each affordance _becomes_ on a coarse pointer, and the label tooltip in particular has no
obvious touch gesture that does not collide with the tools already bound to tap and drag
on that canvas. That is a change to what an existing interaction means.

**Disposition.** WI-063, against SPEC-033 §4. Sequenced after WI-058, which establishes
the touch-input baseline it builds on. **The conversation this Deceptive item was waiting
for happened in WI-063's planning session (2026-08-08) and is recorded as DEC-059:** a
coarse pointer gets a target, not a gesture — a note dot for the tooltip, size rather than
a highlight for the Select handles, `@media (hover: hover)` for the rest. SPEC-033 §4 now
states the resolved rule; WI-063's gate is presented and awaiting approval.

#### IN-035 — Full-screen view, and the installed/standalone app view

**Finding.** Neither exists. There is no `requestFullscreen` call anywhere in
`apps/web/src`; there is no web app manifest under `apps/web/public/`, and no
`apple-mobile-web-app-*` meta in `index.html`. So "full screen view for desktop and
mobile" and "mobile app view" are not defects — they are unimplemented.

**Classification.** **Deceptive.** A new control surface with real interaction: full-screen
changes the viewport under a live Pixi stage that sizes itself from its host, standalone
mode removes the URL bar and changes the viewport height a third way, and both interact
directly with IN-033's frame work and with IN-036's breakpoint question.

**Disposition.** WI-064, against SPEC-033 §5. Sequenced after WI-058. **Closed 2026-08-08**
— see `docs/completed/WI-064.md`.

#### IN-036 — The mobile breakpoint fires on any coarse pointer

**Finding.** `MOBILE_MEDIA_QUERY = '(max-width: 899px), (pointer: coarse)'`
(`shell/layout.svelte.ts:8`). A touchscreen laptop at 1920 px, and an iPad Pro in
landscape, both get the phone shell — single stage, chip rail, no docked sheet column —
regardless of how much room they have.

**Classification.** Raised as **Unclear** — whether this was a defect depended on intent,
and the code does not record which of the two concerns the clause was for. **Reclassified
**Deceptive** once the user ruled** (2026-08-03): the answer splits one boolean into two
independent signals, and `isMobile` is a contract shared by `RoomShell.svelte` and
`shell-state.svelte.ts`'s `isSheetOpen`/`toggleSheet`/`expandSheet`, so the change reaches
the quick-sheet state machine rather than stopping at CSS.

**Disposition.** **User, 2026-08-03: (b)** — split the two concerns. Width alone picks the
layout; a coarse pointer alone widens hit targets. SPEC-033 §7, DEC-052, **WI-067**, which
lands **before WI-063**: while one boolean answers both questions, §4's hover equivalents
and §5's full-screen affordance cannot be specified for one without silently binding the
other. Still a layout change on hardware I cannot test from here, so it wants the same
real-device check WI-058 does.

#### IN-037 — Blaze upload containment: what is actually enforceable on our side

**Finding.** There is no `firebase/storage.rules` and no `storage` block in
`firebase.json`; `AssetStore.upload?` is a declared-but-unimplemented interface slot.

What Security Rules **can** enforce with no trusted writer: per-file size
(`request.resource.size`), a `contentType` allowlist, a path shape binding an object to a
room and an uploader uid, and room membership via a cross-service `firestore.get()`.
What they **cannot** enforce: any aggregate per-room or per-user byte quota, and any rate
limit — both need state that only a trusted writer can maintain, and RULE-010 forbids
Cloud Functions.

**The blocker, and it is a rule conflict.** RULE-010's stated premise is that "on Spark,
quota exhaustion **denies requests rather than generating a bill** — the downside of abuse
is an outage for the group, not a charge. Tune for availability and containment, not
cryptographic guarantees." Blaze inverts that premise exactly, and the user's stated
concern — a malicious outsider rather than the actual players — is the case the rule
assumed away. No work item here can clear a gate until RULE-010 is amended, and RULE-017
makes that amendment a standalone change of its own.

**Classification.** **Deceptive**, and additionally **Blocked**. It adds a rules file
(RULE-004 trigger: rule changes ship with rule tests), it depends on auth and on the
membership predicate (RULE-011), and it changes the trust model's stated economics
(RULE-008, RULE-010).

**Disposition.** **DEC-049 answered (c)** — user, 2026-08-03: RULE-010's no-Cloud-Functions
clause stands, only its economic premise is replaced. The ruling accepts that a Cloud
Billing budget alerts rather than caps, so containment is per-write plus early warning, not
a guarantee; a hard ceiling was reachable only through Cloud Functions and that door is now
closed rather than left ajar. SPEC-034, then WI-065 (the standalone `RULE-AMENDMENT:`) and
WI-066 (the implementation). **Scheduled last** — after the Battle Map and Hex Crawl
series, with everything else in this batch ahead of it.

#### IN-038 — Corridor and Path bands overshoot at every bend

**Finding, verified against `primitives.ts` by hand.** `bandSpan`
(`packages/shared/src/map/vector/primitives.ts:248`) makes **every** leg span whole cells,
both end cells inclusive. That is right for a straight run's two terminal ends and wrong
at a bend, where each leg then overshoots the other by `(step − width) / 2`.

Worked example — snap = cell, width = ⅛, drag `(0.3, 0.3) → (3.6, 3.6)`:

| Leg        | Extent                              |
| ---------- | ----------------------------------- |
| horizontal | `x ∈ [0, 4] × y ∈ [0.4375, 0.5625]` |
| vertical   | `x ∈ [3.4375, 3.5625] × y ∈ [0, 4]` |

The horizontal leg runs 0.4375 past the vertical band's outer edge and the vertical leg
runs 0.4375 below the horizontal band — a plus, not an L, which is precisely the reported
"the two paths overlap into all 4 cardinal directions instead of a single bend". The user's
proposed fix is the correct one: legs run **cell-centre to cell-centre**, extended half a
step only at the two **terminal** ends of the gesture.

Because `pathPoly` builds its axis-aligned legs with the same `bandRect`, one change fixes
both tools — and it is also what delivers the second half of the report, "we should meet
the connecting inside and outside corner in a single vertices": with the overshoot gone,
leg ∪ leg ∪ `cornerBlock` unions to a clean six-vertex L. It is additionally consistent
with what `pathPoly` **already** does for diagonal runs, where `cappedQuad` caps the two
terminal ends and leaves interior ends flush (DEC-038).

**Classification.** **Deceptive.** It reverses the stated behaviour of SPEC-028 §7 ("the
length covers whole cells, both ends inclusive"), which was ratified in DEC-032 and
elaborated in DEC-038 — an existing spec's stated behaviour is a named Deceptive trigger,
and a reversal must name and supersede the original decision rather than overwrite it.

**Disposition.** SPEC-028 §9, WI-061. DEC-046 records the reversal. **Closed 2026-08-04.**

#### IN-039 — Path simplification destroys sub-half widths

**Finding.** `DEFAULT_TOOL_TOLERANCE.path = 0.15` lattice units
(`packages/shared/src/map/vector/tolerance.ts:41`), while `BAND_WIDTH_OPTIONS` offers
**0.125** and 0.25 (`primitives.ts:212`). Douglas-Peucker with a tolerance wider than the
shape itself keeps only each side's two endpoints, so a long thin band collapses toward a
sliver — the reported "the shape becomes almost triangular from one end of the path to the
other". The user's own diagnosis is correct, and the effect worsens with length, because a
longer chain gives DP more to discard between the pinned endpoints.

This is fallout from WI-051, which gave Path the shared ⅛/¼/½/1/2 set. The tolerance
values predate it and were tuned for a free-form organic ribbon, which is the only thing
Path used to be.

**Classification.** **Simple.** It changes one policy function whose values are already
documented as tunable and which already takes a caller override
(`toolTolerance(tool, override?)`). No store method, no schema, neither rules file, no
coordinate/layer/pipeline **meaning** — the pipeline stage's inputs and outputs are
unchanged, only how aggressively it prunes — no auth, no testid, and no existing spec's
stated behaviour: SPEC-028 §7 states what the band _is_, and this is about not destroying
it afterwards.

**Disposition.** SPEC-028 §10, WI-059. **Closed 2026-08-04.**

#### IN-040 — The corridor's bend axis is hard-coded horizontal-first

**Finding.** `corridorPoly` builds its corner as `const corner: Point = { x: b.x, y: a.y }`
(`primitives.ts:307`) — unconditionally horizontal leg first, then vertical. So the bend's
position relative to the gesture depends entirely on which way the user happened to drag,
which is the reported asymmetry between drawing horizontally and drawing vertically. The
user's proposed fix — wait for the drag to declare a dominant direction, then latch that
axis for the rest of the gesture — is the right shape.

**Classification.** **Deceptive.** It needs a new argument on a shared geometry primitive
(the same surgery DEC-023 and DEC-032 each did to the width controls), new per-gesture
drag state in `VectorMapView` that must survive the whole stroke, and it changes what a
corridor gesture _means_ — the same shape now depends on gesture history, not only on its
two endpoints. It also has to answer what a diagonal-ish drag with no clear dominant axis
does before the latch engages.

**Disposition.** SPEC-028 §11, WI-062. Sequenced after WI-061, which rewrites the leg
geometry it latches onto. **Closed 2026-08-04.**

#### IN-041 — Lobby credits, and the symbol pack's provenance

**Finding.** The lobby has no credits section. Separately,
`apps/web/public/assets/ATTRIBUTION.md` carries a standing TODO against the same asset
pack: 73 dungeon-map symbol icons and 13 door variants, "supplied by the project owner as
a pre-made SVG pack ('Classic Dungeon Map Symbols')… **TODO: source/license not yet
recorded** — the archive carried no license file or provenance metadata… fill in this
section (author, source URL, license) before any public release/distribution build."

The link the user supplied is that pack's provenance, so the credits section and the
attribution file are the same fact recorded in two places and are filled in together.
**Licence: CC0 1.0 Universal** (user, 2026-08-03,
`https://creativecommons.org/publicdomain/zero/1.0`); author **Mark Gosbell**; source
`https://markgosbell.itch.io/classic-dungeon-map-symbols`.

**Classification.** **Simple.** Additive markup in one component plus one documentation
file. No store method, no schema, neither rules file, no coordinate/layer/pipeline
semantics, no auth or join path, no store routing. It **adds** `data-testid`s rather than
moving or renaming any, which the Deceptive carve-out names explicitly as not a trigger.

**Disposition.** SPEC-033 §6, WI-060.

---

#### IN-042 — Documentation context loading optimization (Planning vs Execution split)

**Request.** User requested optimization of documentation context loading during work item execution to reduce API token costs.

**Classification.** **Deceptive**. Changes the workflow instructions in `CLAUDE.md` and context loading rules for `@DECISIONS.md`, `SPEC.md`, and `PLAN.md`.

**Justification.** Redefines how agents load system specs and rules. Simple carve-out does not apply.

**Disposition.** → **WI-069**.

---

#### IN-043 — Un-quarantine and refactor portability.spec.ts e2e test

**Request.** Audit test suite against specs to un-quarantine flaky e2e tests (`portability.spec.ts`).

**Classification.** **Deceptive**. Touches Playwright e2e specs, `.vttcamp` export/import verification, and multi-context browser sync.

**Justification.** Refactors existing Playwright test contract. Simple carve-out does not apply.

**Disposition.** → **SPEC-036**, **WI-070**. **Closed 2026-08-09** — see
`docs/completed/WI-070.md`.

---

### Ledger audit against the specs (2026-08-09)

Raised by the user immediately after WI-070: compare every scheduled plan against every
provided spec and find what else is missing. Six discrepancies surfaced, all in the
ledgers rather than the code. The first was WI-070's own RULE-018 obligation
(`DECISIONS.md` still described `portability.spec.ts` as quarantined) and was fixed in
that work item's PR. The remaining five are logged here.

#### IN-044 — `SPEC.md` indexes SPEC-028 as Active; its body says Completed

**Request.** `docs/spec/SPEC-028.md`'s status line reads **Completed** — it records the
reopening by IN-038 – IN-040 and then closes it: "§10 shipped at WI-059, §9 at WI-061 and
§11 at WI-062 (all 2026-08-04), which closes the reopening." `SPEC.md`'s index row still
shows **Active**. All three work items are in `PLAN-COMPLETED.md` §3, and no upcoming item
cites SPEC-028.

**Classification.** **Simple**. A single index cell, brought into line with the spec body
that already governs. It changes no contract, no schema and no stated behaviour — the
spec's own text is the source of truth here and is already correct.

**Justification.** The Deceptive carve-out applies: this touches a document that indexes
specs without redefining any of them.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-071** (2026-08-11). Overtaken in
part by SPEC-028's own third reopening (IN-050) during the same planning session, which
re-set the spec body to **Active** — so the fix is now "index and body agree," not
"index catches up to a settled Completed."

#### IN-045 — `DECISIONS.md` still records the hex grid as Deferred

**Request.** Two entries — the locked-defaults row `Hex grid | Deferred` and the Postponed
bullet `**Hex grid.** Deferred.` — contradict the current plan, where SPEC-030 (Hex Crawl
map type) is **Active**, IN-011 is **Scheduled**, and WI-037 – WI-041 all carry cleared
gates.

**Classification.** **Unclear**. The likely reading is that both entries are simply stale
and were left behind when IN-011 was scheduled. But a locked default is normative, and
"Deferred" surviving a scheduling decision could equally mean the hex work was parked
without the entries being revisited. Only the user can say which.

**Justification.** Classified Unclear rather than Simple because the two readings lead to
opposite actions — delete the entries, or unschedule WI-037 – WI-041. Guessing is exactly
what the Unclear class exists to prevent.

**Disposition.** ~~Open, awaiting the user.~~ **Answered (user, 2026-08-11): stale — clear
them.** Reclassified **Simple** now that the reading is settled. **Scheduled → WI-071.**
Both entries are annotated in place per RULE-019 (`DECISIONS.md`'s locked-defaults row and
Postponed bullet), not deleted.

#### IN-046 — IN-041 never moved to §1.2 after WI-060 landed

**Request.** §1.1 still lists IN-041 (Lobby credits, and the symbol pack's provenance) as
**Scheduled** → WI-060, but WI-060 closed 2026-08-04 and is in `PLAN-COMPLETED.md` §3. The
row should have moved to §1.2 with `Closed via WI-060 / SPEC-033 §6`. It is the only §1.1
row pointing at a landed work item — IN-010, IN-011 and IN-037 are all correctly open.

**Classification.** **Simple**. Moving one row between two tables in one document.

**Justification.** Bookkeeping. Nothing depends on the row's position except the reader.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-071.**

#### IN-047 — `PLAN-COMPLETED.md` §3 carries duplicated WI ids

**Request.** Three ids appear twice in the completed ledger:

- **WI-058** — the same item written two ways, with different effort (`low` vs `medium`).
- **WI-059** — the same item written two ways, with different model (`haiku` vs `sonnet`).
- **WI-068** — two rows describing **different changes**: "Symbol tool ignores snap mode
  (resets to free on tool select)" (spec `SPEC-028 §1`) and "`anchorCellFor` honours snap
  mode instead of hardcoding whole-cell `Math.floor`" (spec `—`).
  `docs/completed/WI-068.md` covers only the second.

**Classification.** **Investigation**. The WI-058/WI-059 pairs are plainly duplicate rows,
but WI-068 needs the history read before anything is deleted: if the two rows were two
real changes, one id was used twice and RULE-019 was breached, which is repaired by giving
the second a fresh id and its own completion file — not by deleting a row. If they were
one change described twice, the stale row goes.

**Justification.** The remedy differs by which case holds, and the wrong one destroys a
record. Investigate first, then schedule the fix.

**Disposition.** ~~Open, not scheduled.~~ **Scheduled → WI-072.** The investigation runs at
execution time; its findings license the WI-058/WI-059 duplicate-row cleanup outright, and
either a fresh id for WI-068's second change (if the history shows two real changes) or a
stale-row removal (if it shows one change described twice) — per RULE-019, whichever the
investigation finds.

#### IN-048 — SPEC-029 §2 is cited by no Battle Map work item

**Request.** The four scheduled Battle Map items cite SPEC-029 §3 (WI-033), §1 (WI-034),
§4 (WI-035) and §5 (WI-036). **§2 — "What is captured"** is cited by none of them, and it
is not descriptive prose: it fixes the rect-not-raster decision (DEC-025), specifies that
the battle map renders the source map's background, floor and overlay layers clipped to
the rect but not the source grid, requires the `exportPng` path to stay wired for a future
Blaze upgrade, and records that a solid background _colour_ lives on the renderer clear
colour rather than in `layers.background` and must be composited separately. It is the
only section of an Active spec with no work item attached. (SPEC-034 §5 is also uncited,
correctly — it is the "Out of scope" section.)

**Classification.** **Deceptive**. Attaching §2 changes what WI-034 and WI-035 must
honour, and their gates were cleared against scopes that did not include it — so their
approvals no longer cover what would be built.

**Justification.** The carve-out does not apply: this is not "touches the same file", it
is a change to the agreed scope of already-gated work. Whether §2 folds into WI-034 and
WI-035 or becomes its own item is a gate question, not an execution detail.

**Disposition.** ~~Open, not scheduled. Must be resolved before WI-034 starts.~~ **The
precondition was overtaken by events**: WI-034, WI-035 and WI-036 have all landed and
SPEC-029 is (was, until the 2026-08-11 reopening) Completed — so "before WI-034 starts" no
longer applies to anything. **Scheduled → WI-072** as a verification pass: confirm each §2
clause actually shipped (clipped background/floor/overlay render, no source grid,
`exportPng` stays wired, colour composited separately), then close IN-048 if clean, or log
any gap found as a fresh intake item.

---

### Map-tools / backgrounds playtest batch (2026-08-11)

Raised after the Battle Map series landed (SPEC-029 Completed). Eleven change requests
plus a directive to sweep the entire unscheduled backlog. All classifications and every
decision below were reviewed and answered by the user in the same planning session;
see `PLAN.md` WI-071 – WI-082 and `docs/decisions/DEC-060.md` – `DEC-067.md`.

#### IN-049 — Lasso tool for vertices and objects; Backspace deletes; vertex removal preserves the loop

**Request.** "Lasso tool for vertices and object selection - backspace removes from the
map, vertices should preserve the loop when possible."

**Classification.** **Deceptive.** A new geometric edit on a committed `FloorRegion` ring
needs an op + inverse for undo — Model A floor stores no construction history to replay
(`README.md` → Data model), so "remove a vertex, keep the loop" is new stored-geometry
logic, not a rendering tweak. Discussed with the user, the item grew into consolidating
Select into one tool and retiring `selectEdge` (DEC-060), which changes the engine's
`ToolPreviewInput.selectMode` contract outright.

**Justification.** Not a carve-out case: this redefines what a `MapToolId` in the select
group does and what removing a stored vertex means, both squarely inside RULE-001's
sibling concerns for the vector map (the tool contract) and RULE-007's schema-meaning
trigger.

**Disposition.** Scheduled → SPEC-037, WI-078. Backspace already deletes a selected object
today (`VectorMapView.onKeyDown` → `deleteSelectedObject`) — this extends that binding to
a multi-selection rather than inventing a new one.

#### IN-050 — Free snap also snaps to an existing vertex

**Request.** "Free snap selection, also snaps to an existing vertex, makes it easier to
connect existing free snap work."

**Classification.** **Deceptive.** `snapPoint(p, mode)` (`map/vector/snap.ts`) documents
Free as pure identity; SPEC-028 states Free's behaviour as such throughout. Making Free
consult map geometry redefines the per-point snap abstraction every floor tool routes
through.

**Justification.** Touches the shared snap function every tool calls, but the trigger is
redefinition of Free's stated meaning (SPEC-028), not mere proximity to a shared file.

**Disposition.** Scheduled → SPEC-028 §12, WI-079 (DEC-061). Applies to Wall/Door/Polygon
and the new lasso's vertex handles; explicitly not the cell-anchored tools, per SPEC-028
§2's standing constraint.

#### IN-051 — Remove the starter map as a new map's default background

**Request.** "Remove the default background map as a settings default."

**Classification.** **Simple.** `DEFAULT_BACKGROUND` / `createDefaultGameMap`
(`packages/shared/src/types.ts`) seed a value for a freshly created map. The field, its
type (`{ ref } | { color } | null`), its meaning, and every `CampaignStore` method touching
it are unchanged; no existing map's stored background is touched.

**Justification.** A seed-value change, not a contract change — the Deceptive carve-out
applies cleanly here.

**Disposition.** Scheduled → WI-073. One `session-config.spec.ts` assertion (which
currently expects the starter map as a fresh room's background) moves with it.

#### IN-052 — Serve asset storage from a GitHub Pages subfolder

**Request.** "Sub folder of the github pages site for asset storage, don't want to
download with every github sync."

**Classification.** **Unclear**, resolved by investigation. `apps/web/public/assets` is
404 KB total; the entire `.git` directory is 2.8 MB. There is no sync cost at this size to
engineer against, and the request's substance — large images a referee uploads — is
already what SPEC-034/WI-066 (Blaze Storage upload containment) schedules.

**Justification.** The premise did not hold as stated; escalated rather than guessed at a
storage architecture for a problem that does not exist yet.

**Disposition.** **Withdrawn (user, 2026-08-11): drop it, the Saved-URL path covers it.**
No work item. Kept in the ledger per RULE-019 — id never reused.

#### IN-053 — Multiple background assets: move/resize, ratio locked, translucent-yellow alignment grid

**Request.** "Allow multiple background assets - each can be moved around the map and
resized but always preserve image ratio - when resizing overlay the current grid on the
image in a translucent yellow to allow the user resizing the image to match existing grid
exactly."

**Classification.** **Deceptive.** `GameMap.background` is one optional field with no
transform. Multiple positioned/scaled backgrounds is a `GameMap`/store schema change ⇒
migration + `.vttcamp` round-trip (RULE-007); a new Firestore subcollection ⇒ rules + rule
tests (RULE-004); new `CampaignStore` methods ⇒ contract-suite additions (RULE-001); and a
new render pass in the Pixi engine.

**Justification.** Every RULE-007/004/001 trigger fires at once — this is the largest item
in the batch by a wide margin.

**Disposition.** Scheduled → SPEC-038 §§1–4, WI-080 – WI-081 (DEC-062, DEC-063). Storage is
a `backgrounds` subcollection; `GameMap.background` narrows to `{ color } | null` only,
since a solid colour is the renderer clear colour, not a layer (SPEC-029 §2's existing
note). Schema **v23**.

#### IN-054 — Move background selection / management to Asset activity

**Request.** "Move background selection / management to asset activity."

**Classification.** **Deceptive.** Changes SPEC-016's stated behaviour ("management lives
in the GM UI" — Session settings today) and moves the `session-background-*` testids
`session-config.spec.ts` depends on (RULE-005).

**Justification.** A stated-behaviour and testid-location change, not a proximity touch.

**Disposition.** Scheduled → SPEC-038 §5, WI-081. SPEC-016 is annotated superseded in
place, never deleted (RULE-019).

#### IN-055 — Profile Template defaults → HP: Number, To Hit: Roll d20, Initiative: Roll d6

**Request.** "Setting Defaults - remove all existing Profile Template settings, add HP:
Number, To Hit : Roll d20, Initiative : Roll d6."

**Classification.** **Simple.** `STARTER_PROFILE_TEMPLATE`
(`apps/web/src/lib/profile/starter-template.ts`) is read in exactly one place —
`Lobby.svelte`'s create-room call. No migration reads it, no stored field changes meaning,
and the fields are referee-chosen labels, so RULE-002's no-mechanics guarantee is
untouched by construction.

**Justification.** A seed-constant edit read at exactly one call site.

**Disposition.** Scheduled → WI-073 (Initiative as the dedicated `initiative` field type,
per the user's answer — see IN-056).

#### IN-056 — Encounter Template default → Initiative: Roll d6 only

**Request.** "Encounter Defaults - remove all existing, add Initiative: d6."

**Classification.** **Deceptive.** `DEFAULT_ENCOUNTER_TEMPLATE`
(`packages/shared/src/types.ts`) is **also** the v13→v14 migration's backfill value, whose
stated purpose is "hands an old room the widgets it already had" — editing the constant
would silently change what that migration produces for a room migrating today, years after
v14 shipped.

**Justification.** The same identifier serves two roles — a live default and a frozen
migration input — and the request only means to change the first. Redefines the
migration's output unless decoupled (RULE-007).

**Disposition.** Scheduled → WI-074 (DEC-065: the migration is pinned to a new
`LEGACY_ENCOUNTER_TEMPLATE_V14` frozen literal before `DEFAULT_ENCOUNTER_TEMPLATE`
changes). Initiative is the dedicated `initiative` field type in both the Profile and
Encounter templates (user, 2026-08-11), wiring Call for Initiative in both Individual and
Side-based modes.

#### IN-057 — Snap selector on the Label and Symbol tools

**Request.** "Add snap selection to Label, Symbol and Door tools."

**Classification.** **Simple.** Door already has the control (`SNAP_TOOLS = [...CARVE_TOOLS,
'wall', 'door']`, `MapToolbar.svelte`). Label and Symbol already **honour** the snap mode
(WI-068, IN-014) — only the UI control is missing. Adding them to `SNAP_TOOLS` surfaces a
control for behaviour that already exists; no testid moves, no contract changes.

**Justification.** Door's precedent in the same array, plus WI-068's confirmed
already-honoured behaviour, makes this the smallest possible instance of "add a control."

**Disposition.** Scheduled → SPEC-028 §1 (a one-line clarification that the control now
covers all vertex/cell-anchored tools uniformly), WI-075.

#### IN-058 — Edit/View map-tools button becomes binary; default View on session join

**Request.** "Make Edit/View map tools button binary - a single button that alternates
between the two states - default for session join should be view."

**Classification.** **Deceptive (reversal).** The button merge alone is mechanical, but the
default flip **reverses WI-053**, whose completion record states `MapToolController
.mapMode`"Defaults to `'edit'`, unchanged from every prior session's behaviour." A reversal
must find the original entry and supersede it (`CLAUDE.md` Shape-A rule), not silently
overwrite it.

**Justification.** The default is the substantive half of the request and it is a stated
reversal of a shipped decision, which the trigger list treats as Deceptive regardless of
how small the code diff is.

**Disposition.** Scheduled → WI-076. DEC-064 names and supersedes WI-053's default. Still
per-viewer client state, still not a resolution of DEC-001.

#### IN-059 — Move BattleMap capture tool to the battle-map quick sheet

**Request.** "Move BattleMap capture tool from map tool quick sheet to battle map quick
sheet."

**Classification.** **Deceptive.** Changes SPEC-029 §1's stated behaviour on a spec marked
**Completed**, and moves `vector-tool-capture` — four Playwright assertions across
`battle-map-capture.spec.ts` and `battle-map-lifecycle.spec.ts` (RULE-005).

**Justification.** A Completed spec's stated authoring path changes, plus a testid
relocation — both explicit triggers.

**Disposition.** Scheduled → SPEC-029 §1 (amended in place, spec reopens then closes again
on landing), WI-077 (DEC-066). The battle-map quick sheet's button arms the same canvas
gesture; `capture` leaves `TOOL_GROUPS` entirely, with `tool-groups.test.ts`'s
every-`MapToolId`-in-a-group invariant carrying a named exemption for it.

### Backgrounds / creature naming / local-runtime batch (2026-08-17)

Seven items from one request. Three are the background transform model (IN-060 – IN-063),
one is creature identity (IN-064), and two are the local-runtime pair (IN-065, IN-066) —
which is the largest architectural request the project has taken since the vector-map
cutover, and the first that a **RULE** stands in the way of.

**Nothing in this batch is Simple.** Every item either changes a stored schema, reverses a
shipped spec clause, or asks for a second backend. That is unusual and worth stating
plainly rather than hunting for something to schedule quickly: the four blocking questions
(DEC-068, DEC-072, DEC-073, DEC-075) were put to the user in the planning session and all
four were answered, which is what let the work items below be written at all.

#### IN-060 — Background move/resize: uncover the runtime errors

**Request.** "Investigate background movement resizing - uncover run time errors."

**Classification.** **Investigation.** Produces findings, not edits (DEC-027). Its host
work item is **WI-083**; each finding it confirms becomes its own intake item rather than
being fixed inside the investigation.

**Justification.** The request names no behaviour to change — it asks what is broken. An
investigation that quietly fixes what it finds is an out-of-chain change (RULE-015).

**Leads to start from** (read during triage, unverified — the investigation confirms or
discards each):

1. **`applyBackgrounds` fails as a batch.** `VectorMapView.applyBackgrounds` awaits
   `Promise.all(bgs.map((bg) => PIXI.Assets.load(...)))`. One unloadable ref — a dead
   saved URL, a host that refuses the cross-origin read, a 404 — rejects the whole
   settlement, so the pass throws before it syncs **any** sprite. It is called as
   `void applyBackgrounds(...)` from an `$effect`, so the throw surfaces as an unhandled
   rejection and every other background silently stops updating: removed images keep their
   sprites, new ones never appear, and a committed transform never re-renders. The
   single-sprite predecessor could only ever fail for the one image it was drawing.
2. **A selected background swallows the whole canvas.** `handleBackgroundPointerDown` runs
   before every tool in `wireStagePointerEvents`, and `backgroundHitTest` returns `'body'`
   for any point inside the rect. A background that has been **Fit** to the grid — the
   default placement, and what the v22→v23 fold gives every upgraded room — therefore
   covers the entire map, so with it selected _no_ map tool can be used anywhere. This is
   the defect IN-061 – IN-063 are the fix for; the investigation should confirm the
   mechanism rather than assume it.
3. **`nativeAspect` reads a texture that may not be the image.** It falls back to
   `rect.w / rect.h` when the texture reports no size, and a `Texture.EMPTY` placeholder
   reports 1×1 — an aspect of exactly 1, which would snap a resize to a square.
4. **The alignment overlay on a hex map.** `renderBackgroundAlignment` is called from
   `renderAll` unconditionally, and draws in square-lattice units. A hex map's backgrounds
   are stored in the same lattice fields but the map has no square lattice (RULE-006).
   Whether that is reachable — whether a hex map can hold a background at all — is worth
   settling one way or the other.
5. **Any console error reproduced by an actual drag.** The three leads above came from
   reading; the investigation must also _run_ the gesture (dev server plus the existing
   `backgrounds.spec.ts` battery) and record what the console says, which is what the
   request literally asks for.

**Disposition.** Scheduled → WI-083, ahead of WI-084 – WI-086, whose scope its findings may
change.

### Findings from the IN-060 background move/resize investigation (WI-083)

Reported, not fixed (DEC-027). Ran the actual move/resize gesture (dev server + emulator,
plus a scratch two-client Playwright repro deleted after use) with console/page-error
capture, and read every code path the five leads named.

#### IN-067 — A second GM removing a background crashes the first GM's in-progress drag

**Finding.** Live-reproduced (lead 5). `VectorMapView.handleBackgroundPointerUp` awaits
`store.setBackgroundTransform(...)` with nothing to catch a rejection. `FirebaseStore`'s
implementation is a bare `updateDoc`, which the real backend (and the emulator) rejects
with `NOT_FOUND: no entity to update` if the document is gone. Two GMs, or one GM with two
tabs: GM1 selects a background and starts dragging it; GM2 clicks **Remove** on that same
background before GM1 releases the pointer; GM1's release throws an uncaught
`FirebaseError`, visible in the console exactly as a runtime error. `MemoryStore`'s
`patchBackground` silently no-ops on a missing doc instead of throwing — a store-parity gap
(RULE-001 requires both stores to honour the same contract) that also means the
`campaign-store.contract.ts` suite, which runs identically against both, could never have
caught this divergence.

**Classification.** Deceptive candidate — touches the `CampaignStore` write path's
guarantee (RULE-001) if the fix is "align the two stores' behaviour on a missing doc" (as
opposed to guarding only the caller). Triage should decide which.

**Disposition.** Awaiting triage.

#### IN-068 — `applyBackgrounds` reloads every background's texture on any one change, and stops the whole layer if one image is unloadable

**Finding.** Confirmed by code reading (lead 1); not force-reproduced live in this
session — the Assets activity's "By URL" add flow already validates the image loads
(`<img>` `onload`/`onerror`) before it lets the referee save the ref, so a persistently-dead
ref can't be placed through today's UI. The hazard is real regardless:
`applyBackgrounds` (`VectorMapView.svelte:884`) `await Promise.all`s a `PIXI.Assets.load`
per background, every time the `orderedBackgrounds` effect fires — which is every add,
remove, and committed move/resize, for every background, not just the one that changed. It
has no try/catch and is invoked as `void applyBackgrounds(...)`, so if a saved ref that
validated fine at add time later goes dead (the referee's host taken down, a revoked
link), the `Promise.all` rejects before any sprite in that pass is touched: every other
background on the map silently stops updating — new ones never appear, removed ones keep
their sprites, a committed drag never re-renders — until some later change happens to
succeed. Separately, `subscribeBackgrounds`'s listener (`VectorMapView.svelte:607`) sets
`backgrounds = b` unconditionally, unlike the floor/fog/wall/door listeners beside it which
guard their `renderAll()` behind `if (!activeDrag)`; a background change from _any_ client
re-runs `applyBackgrounds` for the whole set even while a `bgDrag` gesture is active
locally, and since each surviving sprite's position/size is reset from the _stored_ rect,
that can snap an actively-dragged sprite back to its last-committed placement mid-gesture.

**Classification.** Deceptive candidate — touches the background render pipeline's
guarantee (SPEC-038 §§2–3: a committed transform always renders). Triage should decide.

**Disposition.** Awaiting triage.

#### IN-069 — Backgrounds are placeable on hex-grid maps, in a coordinate space RULE-006 never defined for them

**Finding.** Confirmed by code reading (lead 4, extended). Nothing in `BackgroundsPanel`
or in `VectorMapView`'s background gesture (`handleBackgroundPointerDown/Move/Up`,
`renderBackgroundAlignment`) checks `hexGrid`. Every `GameMap` — hex or square — still
carries a `grid: { w, h, cellSize }` field (`packages/shared/src/types.ts:175`, commented
"Square grid only — v1"), and `VectorMapView` derives `cellSize` from it unconditionally,
so a referee can add, select, move and resize a background on a hex crawl exactly as on a
square map. The stored `x, y, w, h` rect is nominally lattice cell units (RULE-006), a
space a hex map does not have — RULE-006 states outright that "a square-lattice
consumer... is undefined on a hex map and must not be reached from one." Nothing throws;
it silently "works" against a coordinate space the hex spec (SPEC-030) never defined,
which is a spec gap rather than a console error.

**Classification.** Deceptive candidate — touches RULE-006's coordinate-space guarantee.
Triage should decide whether backgrounds need a hex-native placement story or should be
hidden/disabled on hex maps until they get one.

**Disposition.** Awaiting triage.

**Discarded.** Lead 3 (`nativeAspect` falling back to a `Texture.EMPTY` 1×1 read) does not
hold up: unlike door sprites, a background sprite is only ever created _after_
`applyBackgrounds` has awaited its real texture — there is no placeholder-texture phase for
`nativeAspect` to observe. When `bgSprites` has no entry yet, it falls back to
`rect.w / rect.h`, which for a freshly placed image is already the correct native-fit
aspect `fitBackgroundToGrid` computed at add time, not a spurious 1. Lead 2 (a Fit-to-grid
background swallowing the whole canvas for every map tool) is confirmed but not
re-investigated in depth here — it is already IN-060's own note that this is the exact
defect IN-061–063/WI-084–086 are fixing, so no new intake item is needed for it.

**Baseline.** A plain, single-user move-then-resize gesture — the same shape as the
passing `backgrounds.spec.ts` acceptance test — produces zero console or page errors. The
one console line captured during the investigation's baseline run was an unrelated 404
resource-load message present on every page in this environment, not specific to
backgrounds. The reported runtime errors need either a concurrent multi-client edit
(IN-067) or one of the other two conditions above; they are not visible from ordinary
single-referee use.

#### IN-061 — Backgrounds are marked locked or unlocked, from the Assets page

**Request.** "Mark backgrounds as locked or unlocked on the asset page."

**Classification.** **Deceptive.** Adds a stored field to `MapBackground`, so it needs a
schema bump, a migration and a `.vttcamp` round-trip test (RULE-007), and a new
`CampaignStore` method on the shared contract suite against both `MemoryStore` and
`FirebaseStore` (RULE-001). Two explicit triggers.

**Justification.** Not "touches the store" — _changes_ the store contract and the stored
shape. The carve-out does not reach it.

**Disposition.** Scheduled → SPEC-039 §1, WI-084. DEC-068 answers where the flag lives and
DEC-069 what existing backgrounds migrate to (**locked** — user, 2026-08-17).

#### IN-062 — The Select tool picks up, moves and resizes an unlocked background

**Request.** "Normal object selection tool can select, move and resize unlocked
backgrounds."

**Classification.** **Deceptive.** Changes the stated behaviour of two Completed/Active
specs at once: SPEC-037's selection model gains an object kind, and SPEC-038 §3's gesture
stops being armed by the Assets panel. It also retires the `background-adjust-{id}` control
and the `MapToolController.selectedBackgroundId` bridge that `backgrounds.spec.ts` drives
(RULE-005).

**Justification.** "What Select can grab" is the contract SPEC-037 states; adding a kind to
it is redefinition, not proximity.

**Disposition.** Scheduled → SPEC-039 §2, WI-085. DEC-070 records what survives of the
Assets-panel control (an agent default: the panel keeps add / lock / Fit / remove and loses
"Adjust on map").

#### IN-063 — Corners preserve the aspect ratio; edges change it

**Request.** "Dragging from diagonals preserve aspect ratio, dragging from edges changes
aspect ratio - change from previous behavior."

**Classification.** **Deceptive (reversal).** SPEC-038 §3 states the opposite in as many
words — "a resize **always** preserves the image's native aspect ratio … There is exactly
one resize handle interaction, not independent width/height handles." The user's own
wording ("change from previous behavior") acknowledges it. A reversal must name and
supersede the original clause, never overwrite it silently.

**Justification.** A shipped spec clause is being inverted. That is Deceptive regardless of
how small the diff to `background-transform.ts` turns out to be.

**Disposition.** Scheduled → SPEC-039 §3, which names and supersedes SPEC-038 §3 in place;
WI-086. DEC-071 records the reversal.

#### IN-064 — Creatures get real names, and their symbols read A–Z

**Request.** "Change names of creatures, instead of generated string - add a number when
adding multiple automatically, token symbol reads A-Z. For example: user presses plus sign
and selects generated tokens, enters the name Goblin, enters quantity 3, three goblin
tokens are created within that group, tokens are named goblin 1 goblin 2 goblin 3, tokens
are labeled with the symbols A B and C respectively."

**Classification.** **Deceptive.** A creature has **no stored name today** — `Token` has no
`name` field, and `creatureLabel()` derives a display string from `imageRef` by stripping
the path and extension, which is exactly the "generated string" being complained about
(`gen:disc:a1:%23aabbcc`). Giving a creature a name is a new stored field: schema bump,
migration, `.vttcamp` round-trip (RULE-007). It also changes the meaning of the symbol —
`defaultCreatureRefs` currently bakes a lowercase _type_ letter plus a within-batch index
(`a1`, `a2`, `a3`) into the ref, and A/B/C is a different scheme with different uniqueness
(DEC-072).

**Justification.** New stored field plus a changed meaning for an existing derived value.
Two triggers.

**Disposition.** Scheduled → SPEC-040, WI-087. DEC-072 scopes the letters **per group,
restarting at A** (user, 2026-08-17).

#### IN-065 — Local-only mode: the `.vttcamp` is the live document

**Request.** "Local storage - make use of the .vttcamp and allow local usage completely
circumventing firebase as a dependency, may lock features or drop us to single user mode if
necessary. Allow selecting (or creating a new) .vttcamp within the lobby screen."

**Classification.** **Complex (Shape A).** A second backend, a second identity model, and a
second lobby flow. It is also the first request in the project's history that a **RULE**
forbids as written: RULE-009 states the backend as fact — "Firebase serverless on the
**Spark** tier … Anonymous Auth (+ optional Google link) = identity". A build with no
Firebase at all contradicts it, so RULE-009 must be amended in a standalone
`RULE-AMENDMENT:` change before any of the implementation lands (RULE-017).

What makes it tractable rather than speculative: **RULE-001 was built for exactly this.**
`MemoryStore` is a complete, contract-tested `CampaignStore` implementation that already
passes the same suite `FirebaseStore` does, and `packages/shared/src/portability/vttcamp.ts`
is a pure, Firebase-free archive core. The local store is those two joined by a file
handle — not a rewrite. The Postponed "PocketBase second backend" entry in `DECISIONS.md`
records the same bet; this is the first time it is being cashed.

**Justification.** Architectural, and rule-blocked. No other classification applies.

**Disposition.** Scheduled → SPEC-041, WI-088 (the standalone RULE-009 amendment) then
WI-089 (the implementation). DEC-073 chose the `LocalStore`-over-a-`.vttcamp` shape (user,
2026-08-17) and DEC-074 records what a local build gives up.

#### IN-066 — Packaging and distributing a local build

**Request.** "Local run time packaging - how to package and distribute for someone looking
to run locally - no tie ins to our existing firebase project, this would rely on the local
.vttcamp execution above."

**Classification.** **Investigation.** The request is a question — _how_ — and its answer
depends on what IN-065 actually builds. It produces a written distribution spec plus
findings; anything it turns up that needs code becomes its own intake item (DEC-027).

**Justification.** Scheduling an implementation for a shape not yet chosen would be
guessing. The shape was chosen at the gate (DEC-075: a static bundle plus a launcher
script, no new runtime dependency), but the packaging details — what a build with no
Firebase config must strip, how the launcher behaves per platform, what the release
artefact is — are findings, not a diff written in advance.

**Disposition.** Scheduled → SPEC-042, WI-090. **Blocked on WI-089**: there is nothing to
package until the local runtime exists.

### Findings from the IN-066 packaging investigation (WI-090)

Reported, not fixed (DEC-027). Built both bundles for real (`pnpm build:local`,
`pnpm build`), grepped and measured them, built and ran a real standalone launcher, zipped
and re-served the bundle to simulate a downloaded release, and drove it in headless
Chromium (console/page-error/network capture) through campaign creation, session render,
and a manual save/download round-trip. Answers SPEC-042 §4's five questions in order.

**§4.1 — The launcher, concretely.** Three candidates were tried against the constraint
"no new runtime dependency the user must install first":

- `npx serve` / `npx http-server` — works instantly, but only if Node and npm are already
  on the machine. For the audience this exists to serve (someone who downloaded a zip, not
  a developer), that is itself the dependency the constraint rules out.
- A documented one-liner (`python3 -m http.server 8000`) — zero shipped artefacts, but the
  spec's own prediction ("most friction") held up: Python 3 is not on stock Windows, the
  command differs (`python` vs `python3`) across platforms that do have it, and "know the
  right incantation for your OS" is exactly the barrier a launcher exists to remove.
- A Node 22 **Single Executable Application** (`node --experimental-sea-config` +
  `postject`) — built one for real in this session: a self-contained binary embedding the
  Node runtime plus a ~40-line static file server, requiring **zero** installed
  dependencies to run. It served `dist-local` correctly (verified — see §4.4) and needs
  nothing beyond "double-click" or "run this file" on the target machine.

  The real cost: **119 MB raw, 44 MB zipped**, measured on this Linux build — against the
  1.4 MB zipped app it serves, a ~30× multiplier from bundling a full Node runtime. Three
  platforms (GitHub Actions already runs `ubuntu-latest`/`macos-latest`/`windows-latest`
  matrices for other repos, so building each is not new infrastructure) would put a
  release in the ~50–150 MB range depending on how the zips are split.

  **Recommendation:** the SEA binary, one per platform, built on a GitHub Actions runner
  matrix — it is the only candidate that actually satisfies "no new runtime dependency,"
  and the size, while real, is still a single flat download with no signing story, unlike
  Electron/Tauri (which SPEC-042 §1 already rejected for exactly that maintenance cost).
  The size tradeoff should be a conscious decision, not a surprise at release time — that
  is IN-070's job, not this investigation's.

  Only exercised on Linux in this sandbox. macOS Gatekeeper (unsigned binary quarantine)
  and Windows SmartScreen (unsigned-executable warning) both plausibly add a click-through
  step on first run; neither was verified here and both are real risk to carry into
  IN-070.

**§4.2 — Does the strip actually strip?** Yes, re-confirmed with fresh numbers, not just
cited from WI-089. `apps/web/dist-local`: 133 files, 4.4 MB unpacked, 1.4 MB zipped.
`grep -rlE "firebase|firestore|osr-vtt|appspot|identitytoolkit|firebaseio" dist-local` →
**0 files, 0 matches**. No `*.map` files in either build (sourcemaps are off by default
project-wide — not a local-specific win, but confirms nothing leaks through one). A raw
`AIza[0-9A-Za-z_-]{35}` API-key-shaped grep also came back empty. For contrast, the same
grep against `apps/web/dist` (hosted, same commit) hits one chunk with **179** total
occurrences (`firestore` 87, `firebase` 76, `firebaseio` 7, `osr-vtt` 4,
`identitytoolkit` 4, `appspot` 1). Main-chunk size: local 3,618.62 kB vs hosted
4,382.65 kB — matches WI-089's 3.62 MB / 4.38 MB exactly.

**§4.3 — How the release is produced.** Nothing today builds or ships one.
`.github/workflows/deploy.yml` triggers only on push to `main` and only ever builds the
hosted bundle (`pnpm --filter @osr-vtt/web build --mode production`) for Firebase Hosting
and GitHub Pages; `.github/workflows/ci.yml` triggers only on PRs to `main`, and its
`build` job runs `pnpm build` (hosted), never `pnpm build:local`, and greps nothing.
Recommendation: a **new** workflow, triggered on a version-tag push (`v*`), building the
launcher matrix plus `pnpm build:local`, zipping, and attaching to a GitHub Release
(DEC-075) — independent of both existing workflows, so the hosted pipeline is untouched by
construction rather than by discipline. Separately, `ci.yml` should gain a cheap PR-time
job — `pnpm build:local` plus the §4.2 grep — so a strip regression fails a pull request
instead of being discovered at release time; SPEC-042 §3 calls this out by name as "the
one thing here that must be mechanically checked in CI."

**§4.4 — What breaks when it is actually run**, from a zip, by someone who did not build
it, on a machine with no toolchain. Simulated for real: unzipped `dist-local` into a fresh
directory, served it with the SEA binary from §4.1 (a binary carrying nothing of this
build environment beyond the app files it was pointed at), and drove it with headless
Chromium with console, page-error, failed-request and out-of-origin-request capture.

- Initial load: **0** console messages, **0** page errors, **0** failed requests, **0**
  requests to anything but `localhost` — confirms SPEC-041 §4's "bundled assets need no
  network" is actually true of the shipped artefact, not just the source.
- Full flow on the **non-Chromium fallback path** (simulated by deleting
  `window.showSaveFilePicker`/`showOpenFilePicker` before load, standing in for
  Firefox/Safari): fill campaign name → **New campaign…** → session renders → the
  campaign-file pill correctly reads "Unsaved — press Save" → **Save** → a real
  888-byte `.vttcamp` downloads. Zero page errors anywhere in the sequence.
- The **Chromium-autosave path** (`showSaveFilePicker`) could not be driven headlessly at
  all: it opens a native OS file dialog outside the page's DOM, which no Playwright input
  action can see or resolve, so the flow simply stalls waiting on a human. Not a defect —
  the feature needs a real user gesture by design — but worth naming: this path has no way
  to get a headless regression test the way the fallback path just did, and nothing in the
  current Playwright suite appears to exercise it.
- Nothing else broke: no missing asset, no MIME-type surprise from the launcher's
  naive extension→content-type map, no CORS issue.

**§4.5 — Versioning.** Two sub-questions, both answered.

_How a user knows which build they have:_ **they don't, today.** `apps/web/package.json`
and the workspace root `package.json` both carry `"version": "0.0.0"`, unbumped, and
nothing in the built output or the UI surfaces a version string, a commit hash or a build
date. There is no `data-testid`, no footer, nothing a referee could point to in a bug
report or a support conversation.

_What happens opening a `.vttcamp` written by a newer build_ — SPEC-042 §4.5's "the
reverse direction needs an answer too," relative to the already-guarded older-archive
case. **Confirmed live, not just by reading.** `archiveToSnapshot`
(`packages/shared/src/portability/vttcamp.ts:296`) runs the imported room through
`migrateRoom(rawRoom)`, defaulting the target to the _running build's_
`CURRENT_SCHEMA_VERSION`. `migrateRoom`'s walk
(`packages/shared/src/migrations/index.ts:713`, `while (version < targetVersion)`) simply
never enters its loop body when the archive's `schemaVersion` is _above_ the target — the
room doc returns unchanged, future `schemaVersion` and all. Reproduced with a real
artefact: saved a campaign (`schemaVersion: 28`, this build's `CURRENT_SCHEMA_VERSION`),
hand-edited the exported `campaign.json`'s `room.schemaVersion` to `999`, re-zipped it, and
opened it through the live "Open campaign…" file-input flow — it opened cleanly: no error
banner, no console error, full session render, room name and all. Contrast with the
**older**-archive direction, which genuinely is guarded:
`assertSupportedFormatVersion` (`vttcamp.ts:422`) rejects any `formatVersion` below
`VTTCAMP_FORMAT_VERSION` with an explicit "unsupported .vttcamp archive" error. The
asymmetry is real and RULE-014-relevant: an older build gives no signal that a campaign
was written by a newer one, that fields it doesn't understand may be present, or that
re-saving from the older build could silently drop or corrupt them.

#### IN-070 — Ship the packaged local release

**Finding.** Per §4.1–§4.3: build the SEA launcher binaries on a GitHub Actions
ubuntu/macos/windows matrix, write the distribution `README` SPEC-042 §2 specifies (what
local mode is/isn't, the browser-support split, URL-vs-bundled assets, where the campaign
file lives), and add a new workflow on a version-tag push that runs `pnpm build:local`,
bundles it with the matching-platform launcher, zips, and attaches to a GitHub Release
(DEC-075) — independent of `deploy.yml` and `ci.yml`.

**Classification.** Simple (proposed) — new build/release tooling; touches no store
interface, schema, security rule, coordinate semantics, auth path, write routing, testid
or documented spec behaviour.

**Disposition.** Awaiting triage.

#### IN-071 — CI mechanical check for the Firebase strip

**Finding.** Per §4.2–§4.3: SPEC-042 §3 calls the strip check "the one thing here that
must be mechanically checked in CI." Add a PR-time job — `pnpm build:local` plus the grep
this investigation ran — so a regression (an import that drags Firebase back into the
local bundle) fails CI instead of surfacing only at release time.

**Classification.** Simple (proposed) — a new CI job asserting an already-documented
guarantee; no contract changes.

**Disposition.** Awaiting triage.

#### IN-072 — No guard against opening a `.vttcamp` newer than the running build

**Finding.** Live-reproduced (§4.5). `migrateRoom`'s forward walk silently no-ops when an
archive's `schemaVersion` exceeds the running build's `CURRENT_SCHEMA_VERSION`, unlike
`assertSupportedFormatVersion`'s explicit rejection of an archive older than
`VTTCAMP_FORMAT_VERSION`. A fix needs a symmetric guard — reject or clearly warn before
opening, rather than rendering a campaign with fields the build cannot interpret.

**Classification.** Deceptive candidate — touches the portability/migration contract
RULE-014 states ("`.vttcamp` export/import must round-trip identically"). Triage should
decide whether the fix is a hard rejection (matching the older-archive case) or a
warn-and-proceed path.

**Disposition.** Awaiting triage.

#### IN-073 — No build/version identifier; `package.json` stuck at `0.0.0`

**Finding.** Per §4.5: nothing in the build or the UI tells a user which build they are
running, and both `package.json`s carry the placeholder version `"0.0.0"`, never bumped.
Needed for a referee to report a bug against a specific build, and for any future guard on
IN-072 to have something concrete to name in its error message.

**Classification.** Simple (proposed) — a version stamp and a UI surface for it; no
contract changes.

**Disposition.** Awaiting triage.

### Icon system revamp (2026-08-28)

Arrived as a design request rather than a playtest finding: replace the in-game icon set
with a deliberately-designed one, usable on both mobile and desktop, mono- or bi-colour,
"high user discoverable". Three overall style directions were drawn as a design canvas
before anything was classified, and the user picked one. The canvas is
`https://claude.ai/code/artifact/b26abf12-6395-40ce-9234-948cac7c5e61` (Direction A ·
Implement, approved 2026-08-28); the decision is recorded as DEC-076.

#### IN-074 — Redraw the icon set under a stated depiction rule

**Request.** All 34 `IconId` glyphs in `apps/web/src/lib/components/shell/Icon.svelte`
redrawn under **Direction A · Implement**: draw the object a person holds or points at.
24 × 24 grid, stroke 1.75, round cap and join, no fills, `currentColor` only — the same
technique SPEC-001 §4 already puts in force, applied to a _subject_ rule the set has never
had. Three glyphs were specifically called out as unreadable at palette size and are the
reason the request exists:

- `dice` read as a crate — the d20's facet sat at the top of the hexagon, which is where a
  cube's top face goes. It becomes a true d20: hexagon, centred up-facet, three spokes.
- `tools` read as an unidentifiable wedge — a chisel drawn on the diagonal. It becomes a
  latched toolbox with a carry handle.
- `ruler` read as a rhombus — the silhouette of a ruler with every cue that said _ruler_
  removed. It becomes a straightedge lying flat, with graduations.

The request also asks for a stated rule for the **map-tool family** specifically, which is
the half of the set with no labels and the most tools competing in one strip.

**Classification.** **Simple.** It redefines nothing on the trigger list: no
`CampaignStore`/`AssetStore` method or guarantee, no `GameMap`/`Room`/`PlayerSeat` field,
no `firestore.rules`/`database.rules.json`, no coordinate space, layer order or carve
pipeline stage, no auth or join path, no change to which store a write goes to, and no
`data-testid` moved, renamed or removed — `Icon.svelte` renders an `aria-hidden` `<svg>`
and carries no testid, and every button that wraps one lives in another component that is
not touched. The `IconId` union itself is unchanged: 34 ids in, 34 ids out, no additions
and no removals, so no consumer's type changes. What changes is the path data inside one
fixed `MARKUP` record.

It is also **conformant to** rather than a change of the one spec that governs icons:
SPEC-001 §4 (still in force) states "icons are simplistic single-colour stroke SVGs drawn
as `currentColor`", which is precisely Direction A. **This is load-bearing to the
classification** — the two rejected directions would not have been Simple. Direction B
(duotone) adds a second tone and Direction C (solid woodcut) replaces stroke with fill;
either would have contradicted SPEC-001 §4 in as many words and needed that spec amended
before it could be scheduled.

**Disposition.** WI-091. New behaviour — the depiction rule — is specified in SPEC-043;
the direction choice is DEC-076.

#### IN-075 — No focus or disabled state on any shell icon control

**Finding.** Raised at WI-091's approval gate, from a question about the design canvas
rather than from play. The canvas showed five button states; the codebase has three.

- **There is no `:focus-visible` rule on any shell icon control.** Not on `QuickSheetRail`'s
  toggles, not on `MainViewTabs`, not on `MapToolbar`. `--focus` is consumed in exactly two
  places — `EncounterBoard.svelte`'s `outline: 3px solid var(--focus)` and the
  `--group-world` alias in `tokens.css` — so every icon-only control in the shell falls
  back to whatever outline the UA draws over a `border: 1px solid transparent` button, which
  on a dark panel is close to invisible. A keyboard user cannot see where focus is.
- **A disabled treatment was also reported missing. That half was wrong** — see the
  correction below.

> **Corrected at triage, 2026-08-28.** The disabled half of this finding did not survive
> being checked, and the original wording above is left in place rather than rewritten
> (RULE-019 — entries are annotated, not silently repaired). `MapToolbar.svelte` **does**
> disable icon controls and **does** style them: tool buttons carry `disabled={locked}`
> under the Edit/View soft lock, and `button:disabled { opacity: 0.4; cursor: default }`
> covers them. `QuickSheetRail.svelte` and `MainViewTabs.svelte` contain no `disabled` at
> all — a view or sheet that should not be reachable is not rendered (the
> `availability: 'gm'` gate), so there is no unstyled state to find. **There is no disabled
> work to do**, and SPEC-044 §3 records that finding so it is not rediscovered.
>
> The focus half stands, and is stronger than first written: `--focus` is used in exactly
> two places, neither of them a focus ring — `EncounterBoard.svelte`'s `.card.selected`
> **selection** outline, and the `--group-world` alias. The token named `--focus` is not
> used for focus anywhere in the application.

**Classification.** **Simple.** One `:focus-visible` rule per component, in the components
that already own the button anatomy. Redefines nothing on the trigger list: no store method
or guarantee, no schema field, no security rules, no coordinate space or layer order, no
auth or join path, and no `data-testid` moved, renamed or removed — this adds CSS and no
markup. It is one item, not two.

**Explicitly not part of WI-091.** SPEC-043 §5 states that chrome is untouched, and the
focus ring is chrome. Folding it into the icon redraw would be the "while I was in there"
edit RULE-015 exists to prevent, and would put an accessibility fix behind a cosmetic one.
SPEC-043 §5 is annotated to point at SPEC-044 so the two are not read as contradicting.

**Disposition.** WI-092, specified as SPEC-044. Gate cleared by the user 2026-08-28.

#### IN-076 — `room-uploads.emulator.test.ts` still times out on CI at a 30s budget (third occurrence)

**Finding.** Raised at WI-092's PR (#131) — a CSS-only change (`:focus-visible` on shell
icon controls) that touches no Storage, Firestore, or upload code. `test-emulators` failed
twice in a row on the same test: `deleteRoom sweeps uploaded objects (SPEC-034 §4) >
removes the room's objects, and leaves another room's alone`, timing out at the 30000ms
budget after `RESOURCE_EXHAUSTED: Received message larger than max` on the Firestore
`Listen` stream. `pnpm verify:all` passed clean locally against the same commit, including
this test.

This is the same test WI-085's PR #123 and WI-086's PR #124 hit — the budget has already
gone 5s → 15s → 30s and is timing out again. Whatever the emulator is doing on a cold CI
runner (Storage jar warm-up, or the specific `RESOURCE_EXHAUSTED` gRPC message this time)
is not something a fourth timeout bump is likely to fix for good; worth an actual look at
what's driving the message size or the backend load in that test rather than another blind
bump.

**Classification.** Not yet triaged.

**Disposition.** Awaiting triage.

### Selectable 3D die models (2026-09-02)

Arrived as a design request: let the roller pick which 3D die model the tumble renders,
rather than the one procedural set every roll uses today. The user has a model in hand,
downloadable as **FBX, USDZ, glTF or GLB**.

Of those four only **glTF/GLB** is a web format worth carrying: `GLTFLoader` ships with
`three` (already a dependency), it is the format Three's own pipeline is built around, and
it embeds materials and textures in one file. `FBXLoader` exists but is heavier and lossy;
USDZ is Apple's AR container and has no place in a browser canvas here. So the request
reads, concretely, as **"import a GLB and render dice from it."**

#### IN-077 — Selectable 3D die models

**Request.** A user-selectable die model — the procedural set stays available, and an
imported mesh becomes a second choice alongside it.

**What it collides with.** The dice renderer is not a mesh viewer with a swappable mesh.
`geometry.ts` is a generator whose output is consumed in four ways that an imported model
does not supply, and the collision is with `RULE-013` at the centre:

1. **`locators` + the face→value remap (RULE-013).** The seed decides the value; the
   renderer makes the die _land_ on it, by remapping each face's material so the face that
   physics puts on top carries the required number. A GLB has its numerals **baked into its
   own texture atlas** — face 7 is permanently a "7" — so there is nothing to remap. Unless
   the model's face↔value correspondence is recovered, the die lands showing a number that
   disagrees with the Roll doc, which is a RULE-013 violation, not a cosmetic regression.
   It is recoverable (see the two paths below), but not for free and not automatically.
2. **`hullPoints`.** Rapier builds a convex hull from the generated vertex cloud. An
   imported mesh can supply one, but a bevelled/rounded production die is thousands of
   triangles, so the hull wants decimating rather than using raw.
3. **Per-face material groups.** Every downstream effect addresses a die _by face index_:
   the d100 tens half darkened, the d4's three composed corner glyphs, the `DIM_OPACITY` /
   `DIM_DESATURATE` treatment on advantage-dropped dice. A GLB arrives as one mesh with one
   material and no face grouping — it is triangle soup, and coplanar-face recovery is a
   real algorithm, not a loader flag.
4. **Die colour has exactly one source: the roller's character colour**, and it is baked
   into the face **texture** precisely because a `material.color` tint over a coloured
   texture renders `pick × texture` rather than the picked hex — the long-standing "the
   dice are never the colour I chose" bug, fixed by SPEC-031 and stated in `README.md`
   § "Dice (II.6)". An imported model brings its own coloured albedo, so tinting it
   reintroduces exactly that bug. **A model with a pre-coloured body cannot carry the
   per-roller colour cue.** A model with a neutral white albedo and numerals on a separate
   channel could.

**The two honest paths.**

- **(a) Model supplies shape only; numerals stay procedural.** Load the GLB, group its
  triangles into coplanar faces, derive locators and a decimated hull, re-UV each face for
  our number square, and keep the runtime-generated colour-baked textures. Everything above
  survives — RULE-013, the colour guarantee, d4, d100, dimming. The cost is a mesh analyser
  that has to be right about what counts as a "face" on a bevelled die, and the model's own
  material (the thing the user presumably liked about it) is discarded.
- **(b) Model supplies shape and material; numerals stay baked.** Ship a hand-authored
  per-model manifest — a face→value table (4–20 entries), locator directions, hull points,
  scale. The remap is then replaced by **pre-rotation**, which `README.md` already names as
  the equivalent operation, so RULE-013 holds. Cheaper to build, and it looks like the
  model the user chose. The casualty is the per-roller colour cue, plus d100 tinting, the
  d4's composed corners, and the dimming pass, each of which needs a per-model answer.

Path (b) is the realistic one and it is what "selectable" is worth having for: the
procedural set stays the default and keeps the colour identity, and an imported set is an
opt-in trade of that cue for a nicer-looking die.

**The scoping fork that decides how large this is.** _Whose model does a viewer see?_

- **Per-viewer, local.** The choice lives in `localStorage`; everyone sees their own
  preference on every die in the room. No stored field, no migration, no shared asset.
- **Per-seat, shared.** The choice lives on `PlayerSeat`/`ProfileInstance`, and my dice
  look like _my_ dice on your screen — which is the version that pairs with the colour cue.
  It is a stored schema field (RULE-007 migration + `.vttcamp` round-trip), and every
  client must be able to fetch the model, so it is bundled, not uploaded — an upload path
  would be an `AssetStore` contract change (RULE-001) and a Blaze cost surface (RULE-010).

**Licensing and build weight.** SPEC-003 §5 bars assets from `owlbear-rodeo/dice`
specifically and states procedural generation as how we comply; a cleanly-licensed
third-party model is not barred by it, but it needs its licence checked for redistribution
in **both** the hosted and the local build, and an `ATTRIBUTION.md` entry — a file SPEC-003
§5 cites and that does not exist (IN-078). A GLB plus `GLTFLoader` also adds to a local
bundle already at 3.62 MB, and the local build ships as a file the user carries.

**Classification.** **Complex (Shape A).** It is an architectural change to the dice
render pass and a reversal of a stated premise — SPEC-003 §2 / R3.2's real _generated_
polyhedra, and `geometry.ts`'s "no imported meshes, no traced assets". It is not a
reversal of SPEC-003 §5, which is a licence constraint scoped to one GPL repository and
stays in force untouched. **No `RULES.md` amendment is required**: RULE-013 is satisfied by
either path above, and RULE-007/RULE-001 bind only under the per-seat half of the fork.
SPEC-003 and SPEC-020 would need amending in place, and a new SPEC written, once the
decision below is answered.

**Disposition.** Not scheduled. Blocked on **DEC-077**, which is Blocking on three counts:
a new asset in the shipped bundle, a possible stored schema field, and the reversal of a
Completed spec's stated behaviour.

#### IN-078 — `ATTRIBUTION.md` is cited by SPEC-003 §5 but does not exist

**Finding.** Surfaced while triaging IN-077. SPEC-003 §5 — a permanently binding standing
constraint — ends "See `ATTRIBUTION.md`", and `docs/archive/VTT_Master_Plan.ORIGINAL.md`
R3.5 says the same. There is no `ATTRIBUTION.md` at the repository root or anywhere else.
Nothing is currently mis-attributed (every dice asset is generated at runtime, which is the
point §5 makes), so this is a dangling reference rather than a licence problem today — but
it becomes a real gap the moment any third-party asset ships, which is exactly what IN-077
proposes.

**Classification.** **Simple** (proposed). Creating a documentation file that no code
reads redefines nothing on the trigger list: no store method or guarantee, no schema field,
no security rule, no coordinate space or layer or pipeline stage, no auth or join path, no
change to which store a write goes to, and no `data-testid`. It does not change SPEC-003
§5's stated behaviour — it satisfies a reference §5 already makes.

**Disposition.** Awaiting triage.

### Dice presentation and die-to-die collision (2026-09-02)

Arrived in the IN-077 gate conversation, once DEC-077 resolved to alternative (c) —
"decline the imported model, spend the effort on the generated set." The user's own words:
the shapes are "still off just a little bit", "several of the numerals still oriented
wrong", the dice are a "core mechanic of the game" and deserve visual work, and — a
separate request — dice in one roll should "physically bounce off of each other."

`3d-dice/dice-box` remains what the user called it: an **open-licensed reference point**
(MIT code, CC0 companion models), not a dependency and not an asset source. The evaluation
is recorded under DEC-077.

These five are logged individually per Shape B, and each is classified on its own.
**All five classifications were approved by the user on 2026-09-02**, together with DEC-078
and DEC-079 as recommended; the batch is specified as SPEC-045 §1–§5 and scheduled as
WI-093 – WI-097.

#### IN-079 — Numeral orientation is arbitrary per face

**Finding.** SPEC-020 §5 states the numeral's U axis is "derived from a face **edge**
(`pts[0]→pts[1]`) rather than a corner so numerals sit square to their faces". Square to
_that_ edge, yes — but which edge is `pts[0]→pts[1]` is whatever order the face happens to
carry in `geometry.ts`'s hand-written index table, and those orders are not coherent across
a shape's faces:

- **d20 / d8** (triangles) — the icosahedron table lists `[0,11,5]`, `[0,5,1]`, `[0,1,7]`
  … each face starting from whichever vertex the table author wrote first, so each
  numeral's "up" is effectively a random one of three directions.
- **d12** (pentagons) — the faces come out of `orderRing`, whose starting corner falls out
  of an `atan2` sort against a basis picked by `Math.abs(n.x) < 0.9`. Rotation varies by up
  to 72° face to face.
- **d6** — checkable by hand: the `+x` face `[1,2,6,5]` gives a U axis of `+y`, while `-x`
  `[0,4,7,3]` gives `+z`. Two adjacent faces, two unrelated numeral orientations.

On a physical die the numerals of a shape belong to one family — each reads upright, in a
consistent relation to the solid, when its face is up. That is the property the edge rule
cannot express, because it has no notion of the _die_, only of one face's first edge. The
d10 already needed an escape hatch for a related reason and got `Polyhedron.faceUp`
(SPEC-020 §5's 2026-07-30 amendment); this is the same gap, wider.

**Classification.** **Deceptive.** It changes **the stated behaviour of an existing
`SPEC-nnn`** — an explicit trigger. SPEC-020 §5 names the edge rule in as many words, and
the fix replaces it with a die-global orientation rule, generalising the d10's `faceUp`
escape hatch into the normal path. It is not merely a re-tune within the stated rule.

**The conversation that must happen.** What the replacement rule _is_ — the choice is a
design decision, not an implementation detail. Candidates: glyph-up points from the face
centroid toward whichever of the face's own vertices is most aligned with a fixed die-local
axis (deterministic, works for every shape, gives one coherent family); or per-shape
`faceUp` tables authored by hand (exact, matches a chosen reference die, but is twelve to
twenty hand-written vectors per shape and unverifiable by test). Also: whether the d10's
existing `faceUp` becomes redundant or stays as a documented exception.

**Disposition.** DEC-078 answered as recommended (user, 2026-09-02). SPEC-045 §1, WI-093.

#### IN-080 — Die sizing and aspect

**Finding.** `SCALE` multiplies a **unit-normalised** polyhedron, so every entry sets the
die's _circumradius_. `d4: 0.56` and `d20: 0.56` therefore give a tetrahedron and an
icosahedron the same circumscribed sphere — but a tetrahedron fills that sphere far less
evenly, so at equal circumradius the d4 reads as the largest, sharpest object on the table
rather than the smallest die in the set. Real dice sets are sized by a face or edge
convention, not by circumradius. The d10's `apexZ` is a second candidate: it went 1.15 →
0.85 to kill a "spike" reading, and 0.85 (height ÷ width) may now overshoot into squat.

**Classification.** **Simple.** `SCALE` is a tuning table and `apexZ` is documented in
`geometry.ts` as "the aspect knob, and it is the _only_ one that may move". Re-tuning them
redefines nothing on the trigger list: no store method or guarantee, no schema field, no
security rule, no coordinate space, layer order or carve-pipeline stage, no auth or join
path, no store routing, no `data-testid`. SPEC-020 §4 records that a ~10% reduction
happened; it does not fix the numbers as a rule. **One hard constraint carries in:** the
d10's `ringZ = apexZ·tan²(π/10)` planarity relation is non-negotiable and pinned by a test —
`apexZ` may move, `ringZ` is always derived.

**Disposition.** SPEC-045 §2, WI-094.

#### IN-081 — Material pass on the generated dice

**Request.** The visual improvement the user asks for, in the half that needs no geometry
change: `MeshStandardMaterial` tuning beyond the current roughness ~0.30 / metalness ~0.10,
an environment map so the gloss has something to reflect, and — the substantive one —
replacing `textures.ts`'s canvas **emboss pass** (numerals drawn to _look_ incised) with a
real **normal map**, so the numerals are lit as incised from whatever direction the key
light happens to be. This is where the reference-point comparison actually lands: what
reads as expensive in a good dice renderer is material and lighting, not mesh provenance.

**Classification.** **Simple.** Material parameters and an additional texture channel
redefine nothing on the trigger list. Specifically, it does **not** touch the one guarantee
in this area that is load-bearing: die colour still comes solely from the roller's
character colour, still baked into the face texture rather than applied as
`material.color`. A normal map is a separate channel and does not reintroduce the
`pick × texture` bug SPEC-031 fixed. Face count, groups, locators and hull are untouched.

**Disposition.** SPEC-045 §3, WI-095.

#### IN-082 — Bevelled die edges

**Request.** Every real die has rounded or bevelled edges and corners. The generated set is
sharp-edged with `flatShading: true`, which reads as a faceted gem rather than a die, and
is the likeliest single contributor to "the shapes are still off just a little bit."

**Classification.** **Deceptive.** Bevelling adds geometry that is **not a value face**,
and the whole renderer indexes dice _by face index_: `buildDieGeometry` emits one material
group per face with `faceIndex` as the group id, `locators[faceIndex]` is what
`topFaceIndex` scans, and `scene.ts` remaps `faceIndex → value` to make the die land
correct (RULE-013). Today `groups.length === locators.length === faceCount === the number
of values`. A bevel breaks that 1:1 relation, so it redefines what a "face" means to every
consumer of `DieGeometry` — the d100 tens tint, the d4's composed corner glyphs and the
advantage `DIM_OPACITY` pass all address dice through it. It also changes `hullPoints` and
so the physical die.

**The conversation that must happen.** Whether bevel geometry is carried as separate,
unnumbered material groups outside the value range (keeping the 1:1 relation intact for
value faces, at the cost of a documented split in what a "group" is), or whether
`DieGeometry` grows an explicit value-face count and every consumer is updated. Also
whether `flatShading` survives at all, since a bevel wants smooth normals on the bevel
strips and flat ones on the faces.

**Disposition.** DEC-079 answered as recommended (user, 2026-09-02), sequencing included.
SPEC-045 §4, WI-097 — blocked on WI-095 and WI-096.

#### IN-083 — Dice in one roll rarely touch

**Finding — the collisions are already on.** Worth stating plainly, because the request was
phrased as adding them. In `DiceScene.simulate` every die is a `RigidBodyDesc.dynamic()`
carrying a `ColliderDesc.convexHull` in **one shared Rapier world**, with default collision
groups and no filtering. Rapier resolves die-against-die contacts exactly as it resolves
die-against-floor. Nothing is disabled.

What suppresses them is the **throw geometry**. Dice spawn on a ring of radius 1.4–2.6 at
independent random angles, from a height of 5.5–7.0 under gravity 18 — about 0.75 s of
fall — with an inward velocity of only `0.7 ×` the spawn radius, so a die travels roughly
one unit inward before it lands. Two dice at unrelated angles on that ring simply land
apart, inside a tray of radius 4.4. The dice do not fail to collide; they are thrown so as
not to meet.

So the fix is throw tuning in `simulate()` — a tighter spawn arc, more inward velocity, a
staggered release, or a smaller effective tray — not a physics change.

**Classification.** **Simple.** It redefines nothing on the trigger list. In particular it
does **not** threaten RULE-013: the sim runs headlessly first and the face→value remap is
applied to whatever it produced, so the die still lands on the seeded value no matter how
chaotic the tumble. Cross-client float divergence is already declared harmless in
`README.md` — each client pre-rotates against its own sim — and collisions only amplify a
divergence that was already irrelevant.

**One constraint the work item must specify rather than leave emergent:** what happens when
a die comes to rest **on top of another die**, which is a state the current settle logic has
never had to handle. `topFaceIndex` still returns the correct value there — it takes the
most-up locator, and the remap guarantees that face carries the right number — but a die
resting on a slope is visibly tilted and may partly hide the die beneath it. A settle rule
for stacked dice (nudge apart, extend the step budget, or accept it) belongs in the spec,
not in whatever the physics happens to do.

**Disposition.** SPEC-045 §5, WI-096.

---

### Hex-map tools, snap vocabulary, and the transient view tools (2026-09-02)

A playtest batch (Shape B) of eleven items, arriving with a zip of 37 `.svg` files. It
splits cleanly in two, and the split is the important thing about it:

- **Four items are about the square map and the view tools** — IN-084 – IN-087. Two are
  independently schedulable.
- **Seven items are one programme** — IN-088 – IN-094, "a hex crawl becomes authorable".
  They are logged individually per Shape B, and each is classified on its own, but they
  **cannot be scheduled as seven independent work items**: every one of them stores or
  draws geometry on a map whose coordinate space is axial, and SPEC-030 §5 closed that
  door deliberately. They need one spec and one settled coordinate-space design first,
  the way SPEC-028 served the 2026-08-02 map-tools batch.

SPEC-030 §5 anticipated exactly this request and named the price:

> Re-opening any overlay tool for hex maps means giving it an axial-space form first,
> and is a new intake item.

IN-088 – IN-094 are that intake item, arriving as seven. Nothing in the hex half is
scheduled here; five decisions (DEC-080 – DEC-084) are logged Open in `DECISIONS.md`.

The supplied art is parked, inert and unwired, at `docs/intake/hex-symbols/` with a
README describing what it is and the three facts about it that shape IN-089. Placing it
there is not a step toward shipping it — the files are referenced by nothing — it just
keeps the user's material from being lost between the gate and the work item.

#### IN-084 — `snap = grid`: a fourth mode centring content on the grid lines

**Request.** A snap mode in which content snaps _centred on the grid lines_, rather than
into a cell, applying to every tool that offers a snap selector.

**Where it lands.** `VectorSnapMode` is `'free' | 'full' | 'half'`
(`packages/shared/src/map/vector/snap.ts`); the toolbar labels them Cell · Half · Free.
The request is only meaningful for some tools, because the three tool families already
anchor differently under the _same_ mode:

| Family                              | Tools                              | What `full` does today                                                       |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| Intersection-anchored (`snapPoint`) | Wall, Door, Polygon                | Rounds to the nearest lattice **intersection** — already "on the grid lines" |
| Cell-anchored (`snapCellCenter`)    | Room, Corridor, Path, N-gon, Carve | Centres in the **cell** the pointer is inside                                |
| Cell-floored (`snapCell`)           | Symbol, Label                      | Floors to the **cell** the pointer is inside                                 |

So `grid` is a **no-op for Wall/Door/Polygon** and a real change for the other seven. That
asymmetry is not a detail to settle during execution: it decides whether the selector
offers a mode that does nothing on three of the ten tools it appears on.

**Classification.** **Deceptive.** Two triggers, either sufficient:

- It changes **what a coordinate means** — SPEC-028's "Cells, not intersections" is a
  reasoned position, not an implementation accident, and it argues at length that rounding
  to the nearest vertex "crosses a cell boundary for three quadrants out of four". A mode
  that deliberately reinstates intersection anchoring for the cell-anchored five qualifies
  the stated behaviour of an existing `SPEC-nnn`.
- It widens a union that is consumed exhaustively — `DEFAULT_BAND_WIDTH` is a
  `Record<VectorSnapMode, number>`, `snapCursorColors` is keyed the same way, and every
  `snapAngle`/`snapSpan`/`snapCellSize` branch is a two-way `mode === 'half' ? … : …`
  that silently treats a fourth member as `full`.

It is **not** a schema change: `MapToolController.snapMode` is per-viewer client state and
is never written to a document, so no migration is in scope (RULE-007 is not engaged).

**Disposition: ⏸ Postponed (user, 2026-09-02).** It stays listed in `PLAN.md` §2 rather
than being scheduled or removed. DEC-080 narrows to its hex half (IN-090), and is written
so that `grid` slots into the mechanism chosen there without redesigning it.

**The conversation that must happen when it is revived.** DEC-080. In short: does `grid`
join Cell/Half/Free as a fourth member, or replace one; what it means for each of the three families above;
what `DEFAULT_BAND_WIDTH['grid']` is; and whether the targeted-cell indicator and the
Corridor/Path band indicator gain a `grid` form or suppress like they do under Free.

**Disposition.** ⏸ **Postponed** (user, 2026-09-02) — see the note above. DEC-080 answered only
its hex half (IN-090), and was written so `grid` slots into the same mechanism later.

#### IN-085 — Snap audit: does every mode draw the same shape class?

**Question, verbatim in substance.** "Do all of our snap modes draw the same shapes
regardless of snap mode? An outlier is fine, but want to confirm we don't have any
unintended ones. In free snap is the snapping to vertex active for all tools?"

**The second half is answerable now, from the code, and the answer is no.**
`attractsToVertex` (`apps/web/src/lib/map/vector-tools.ts:316`) returns true for **Wall,
Door and Polygon only**. `VectorMapView` adds one further case — an **in-progress Select
vertex-handle drag** — and nothing else: not Select's initial pick, not a whole-object
drag, not the five cell-anchored tools (whose anchor is a cell, so a vertex is not a thing
they could be pulled onto), and not Symbol or Label, which under Free pass the raw point
through with no candidate list at all. `vector-tools.test.ts:918` pins all of that. This is
SPEC-028 §12 as designed; the open question the audit should answer is whether **Symbol and
Label** ought to join the attracting set, since they are point-placement tools like
Polygon and there is no geometric reason they could not.

**The first half needs a real audit,** and the documented picture already shows three
outliers, all of which trace to a spec or a decision:

1. **Carve** paints whole lattice cells under Cell/Half and buffers the sampled polyline
   under Free — a square footprint versus a round brush. Deliberate: DEC-032 records Carve
   as "the only organic floor tool — knowingly".
2. **Corridor and Path** cap flat under Cell/Half and round under Free (SPEC-028 §9).
3. **The Corridor/Path band indicator** follows suit — a width×width square under
   Cell/Half, a circle under Free — and **Room's targeted-cell indicator is absent
   entirely** under Free.

So the honest state is "three known outliers, each with a citation". What the docs cannot
establish is whether the _code_ holds any further ones, because `README.md` records intent
per tool and the question is about behaviour across ten tools × three modes. That is a
table someone has to build by reading `vector-tools.ts` and the `buildFloorStroke` path.

**Classification.** **Investigation.** It produces findings, not edits (DEC-027); each
finding becomes its own intake item.

**Why it should run before DEC-080 is answered.** IN-084 adds a fourth column to exactly
this table. Deciding what `grid` means per family, without first knowing what `full`,
`half` and `free` actually do per tool, is deciding on a picture assembled from prose.

**Disposition.** WI-098.

#### IN-086 — Eye and Ping expire on a countdown

**Request.** Both should disappear after a countdown, so they do not clutter the map.

**Where it lands.** The two halves are not symmetrical:

- **Ping already expires.** `PING_TTL_MS = 3000` in both `firebase-store.ts` and
  `memory-store.ts`, and the contract comment already reads "Self-expires from RTDB". What
  is missing is that the expiry is _invisible_ — `renderPings` draws a fixed
  `circle(0, 0, 14)` at full opacity that vanishes without warning. The request, read
  against what exists, is a **visible** countdown: a fade, a shrinking ring, or both.
- **The Eye does not expire at all.** `eye` is a `$state<Point | null>` in
  `VectorMapView`, set on click and cleared only by clicking elsewhere or changing tool.
  A timer is genuinely new behaviour.

**Classification.** **Simple.** It redefines nothing on the trigger list: no store method
or guarantee (`publishPing`/`subscribePings` keep their signatures, and "self-expires" is
already the stated guarantee), no schema field, no security rule, no coordinate space,
layer order or carve-pipeline stage, no auth or join path, no change to which store a write
goes to, no `data-testid` moved or removed. The Ping half is a change to `renderPings`; the
Eye half is a timer over local component state.

**One consequence the work item must specify rather than leave emergent.**
`mapCtrl.canRevealFromEye` is true exactly while an eye is placed and fog is on, and it is
what enables "reveal what the eye can see". An auto-clearing eye turns that action off
underneath the referee mid-decision. The spec has to say what happens — the countdown
pauses while the reveal is available, the countdown is long enough not to matter, or the
reveal button is accepted as transient — rather than letting the timer decide.

**If the TTL itself moves**, it moves in both store implementations together, and
`rtdb-leaks.test.ts` asserts against the Firebase one.

**Disposition.** SPEC-046 §1, WI-099.

#### IN-087 — Eye and Ping can be aimed at a token or object

**Request.** Either tool may pick a token or a map object instead of open floor, and that
thing becomes the focus. Plus the user's own open question: _how do we visually indicate a
ping on a token?_

**Where it lands.** The Eye half is local — hit-test at the click point, hold a reference
instead of a `Point`, read the token's position each frame. On its own it would be Simple.

The **Ping half is not local**, and that is what classifies the item. A ping is published
over RTDB and rendered by every client, so "this ping is on that token" has to travel with
it. `PingPos` is `{ id, uid, x, y, ts }` and `publishPing(roomId, pos: { x: number; y:
number })` takes a bare point. Carrying a target means a new field on the published shape
and a changed `publishPing` signature.

**Classification.** **Deceptive.** RULE-001 names it outright — "a new method, or a changed
signature or guarantee" on the `CampaignStore` interface is a trigger — and any new store
method or changed guarantee must be added to `campaign-store.contract.ts` and pass against
`MemoryStore`, `FirebaseStore` **and** `LocalStore` (RULE-009's amendment made the local
store a third implementation of the same contract).

RULE-003 is _not_ threatened: a ping is high-frequency ephemeral and stays on RTDB.

**The conversation that must happen.** DEC-084. What a target _is_ (a token id only, or any
pickable map object); what happens when the target moves, is deleted, or is on a group that
collapses while the ping is live; whether the ping follows the token (it has to, or the
feature is just a click-time snap); and the visual language, which is the user's question.

**Disposition.** ✅ **Scheduled — WI-112, SPEC-046 §2.** **DEC-084 closed 2026-09-07: (b),
with a drop-on-move rider.** The recommendation — an optional target id resolved at render —
was **not** taken. The target is resolved at **click time** and the ping is published at the
token's current point, so `PingPos` keeps its shape and `publishPing` keeps its signature. The
rider answers (b)'s own objection by inverting it: the ping does not follow a moving token, it
is **dropped** once the token moves, because the gesture only means anything while the token
stays put. That drop is decided locally by each client (hit-test on first sight, remember,
stop drawing when it moves off) — nothing published, nothing deleted early, the RTDB node
still expiring on its unchanged `PING_TTL_MS`.

**Reclassified Deceptive → Simple.** The classification above rests entirely on the sentence
"carrying a target means a new field on the published shape and a changed `publishPing`
signature" — and under (b) neither happens. No new store method, no changed guarantee,
`campaign-store.contract.ts` untouched, so RULE-001's trigger is not reached and the contract
suite does not grow a case. RULE-003 was never threatened. What remains is the Eye's local
hit-test, a click-time hit-test in the ping path, and a render change — the concentric,
inward-pulsing ring — none of which redefines anything.

**One consequence to record.** DEC-084 (d) — targeting any pickable object — stays deferred,
and is **no longer additive**: since nothing about the target is published, widening later is
a fresh design rather than a new optional field.

**Closed — WI-112 (2026-09-09).** See `docs/completed/WI-112.md`.

#### IN-088 — Hex maps get their own tool palette

**Request.** A new set of tools for the hex map — explicitly _not_ a reuse of the square
map's palette.

**Where it lands.** `HEX_TOOL_IDS` is derived, not authored: it is
`TOOL_GROUPS.filter(g => g.id === 'select' || g.id === 'view').flatMap(g => g.tools)` —
Select plus Pan/Eye/Measure/Ping, and nothing else. A hex-specific palette means new
`MapToolId`s, a new group or a hex-specific catalog, and a `TOOL_GROUPS` structure that
stops being one flat list shared by both grid kinds. `tool-groups.test.ts` asserts every
`MapToolId` is in exactly one group, so the shape of that catalog is pinned by test.

**Classification.** **Deceptive.** It changes **the stated behaviour of an existing
`SPEC-nnn`** — SPEC-030 §5's annotation states the palette _is_ Select plus the View tools,
"no overlay tools at all", and gives the reason. It also changes what a tool group means:
today a group is a gesture family shared by every map; afterwards it is that, per grid kind.

**The conversation that must happen.** DEC-081, jointly with IN-092 – IN-094 — the palette
is only a palette once there is something for it to hold, and everything it would hold is
blocked on the same coordinate-space question.

**Disposition.** DEC-080 and DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §3,
WI-104 — where `HEX_TOOL_IDS` stops being a filter over the square map's groups and becomes an
authored list.

#### IN-089 — Hex symbol/terrain art upgrade from the supplied pack

**Request.** 37 supplied `.svg` files become the hex map's terrain and symbol palette.

**Where it lands.** `HEX_TERRAIN_CATALOG` (9 kinds + unknown) and `HEX_CONTENTS_CATALOG`
(10 kinds + unknown) in `packages/shared/src/map/hex/catalog.ts`, against files at
`apps/web/public/assets/hex/{terrain,contents}/*.svg`. The pack is parked at
`docs/intake/hex-symbols/`; its README has the full inventory.

**Three facts decide the classification.**

1. **Additive is cheap; replacing is not.** A hex stores `kind` and nothing else, which is
   why the catalog's own header says "re-drawing the whole terrain set is a change to this
   file rather than a migration". That holds for _re-drawing_. It does not hold for
   _renaming or retiring_ a kind: a stored `terrain: 'mountains'` whose catalog entry has
   become `mountain-major` resolves to `UNKNOWN_HEX_KIND` and the hex renders grey. That is
   a stored field's meaning changing — RULE-007, a migration and a `.vttcamp` round-trip
   test.
2. **The art is authored dark, and the pipeline requires white.** Every glyph inks at
   `#111111`. `catalog.ts` states the requirement and the reason: "The art is authored
   white … both overlays are tinted at the render boundary … and a tint multiplies, so
   black art could not be tinted lighter." Terrain overlays are tinted to whichever of
   `HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT` contrasts with the hex's own colour (SPEC-030
   §2); a `#111111` glyph tinted light stays `#111111` and disappears on dark terrain.
   Either the pack is re-authored white, or the render-boundary tint rule changes — and
   that rule is what SPEC-030 §2 relies on to keep contrast from going stale when a terrain
   is re-coloured.
3. **`sym-water.svg` is two-tone** (`fill="#a8c4d0"`, `stroke="#111111"`). One multiply
   tint cannot express two tones. Either that file loses its fill, or the pipeline gains a
   notion of art that is not tinted at all.

**And one that gates shipping rather than design.** The pack carries no licence or
authorship metadata. SPEC-003 §5's licence discipline is a permanent standing constraint
and cites an `ATTRIBUTION.md` that does not exist (IN-078, still Open). Provenance has to
be established before these files land in `apps/web/public/`.

**Classification.** **Deceptive.** Fact 1 is a schema trigger the moment the answer to
"replace or extend" is _replace_, and facts 2–3 change what the render boundary does with
an overlay — the tint contract SPEC-030 §2 states.

**The conversation that must happen.** DEC-083.

**Disposition.** DEC-083 answered as recommended (user, 2026-09-02) — extend and alias, never
rename in place; the pack is re-authored white; `sym-water.svg` becomes single-tone. SPEC-047
§6, WI-101, gate cleared.

**Provenance answered (user, 2026-09-02): no third-party source.** The owner states the files
were generated by Claude in a separate session for a separate project of their own. That is the
answer SPEC-003 §5's licence discipline needs — the risk it contains is ingesting licensed or
GPL art, and there is none here. WI-101 creates `ATTRIBUTION.md` and records it in those terms.
IN-078 stays Open for the rest of that file's scope.

#### IN-090 — Hex maps offer exactly two snap modes: Hex and Free

**Request.** A hex map has two snap modes and only two — Hex and Free.

**Where it lands.** `VectorSnapMode` is one union, `MapToolbar`'s `SNAP_MODES` is one
unconditional array, and `MapToolController.snapMode` is one field with no idea what kind
of map is on stage. Making the offered set depend on grid kind is the small half; deciding
what `hex` _is_ is the large one — a new member of the union (honest, but every exhaustive
`Record<VectorSnapMode, …>` and every `mode === 'half' ? … : …` branch has to answer for
it), or `full` reinterpreted per grid kind (closed union, but "full" then means two
different quantizations depending on the map, which is the ambiguity RULE-006's amendment
was written to prevent).

**Classification.** **Deceptive.** Same trigger as IN-084 — what a coordinate means — and
sharper here, because RULE-006 is explicit that axial coordinates are _not_ lattice units
and that "a square-lattice consumer … is undefined on a hex map and must not be reached
from one". A snap mode is exactly such a consumer.

**The conversation that must happen.** DEC-080, jointly with IN-084 — one union, one
decision. Taking them separately is how the union ends up with a `grid` member that is
meaningless on hex maps and a `hex` member that is meaningless on square ones, with nothing
in the type saying so.

**Disposition.** DEC-080 answered as recommended (user, 2026-09-02) — `'hex'` joins the union
and the offered set becomes per-grid-kind. SPEC-047 §3, WI-104.

#### IN-091 — Hex terrain tool

**Request.** A tool that paints terrain — a colour _and_ a terrain symbol — in two modes:

- **Hex snap** — paint whole hexes; as the user paints, union adjacent similar cells into
  one shape. Open question from the user: _add a border colour?_
- **Free snap** — a hex-sized circular brush painting a free-form region, with terrain
  icons scattered "randomly but at a consistent density".

And the user's own question, which is the item's real content: _can we support both drawing
modes in the same map, and how do we reconcile them?_

**Where it lands.** The Hex-snap half is nearly the existing feature: `hexTiles`, one
document per painted hex carrying `terrain`, rendered by `renderHexTiles` as a per-hex fill
plus a tinted overlay. What is new there is the **union** — merging like-terrain
neighbours into one shape with one outline instead of drawing 40 separate hexes with 40
visible seams.

The Free half has **no storage at all**. A free-form painted region is a polygon, and a hex
map has nowhere to put one: `hexTiles` is keyed by `axialKey`, which is the whole point of
its addressing. It needs a new collection or field, a schema bump, a migration, rules
(RULE-004, `hexTiles` is member-or-GM write today and a new collection needs its own tested
rule), and `.vttcamp` round-trip coverage (RULE-014 — and RULE-009's amendment makes that
non-negotiable, since locally the `.vttcamp` _is_ the database).

**Classification.** **Deceptive**, and the heaviest item in the batch. It changes the
`GameMap`/hex schema (RULE-007), adds a store surface (RULE-001), needs security rules
(RULE-004), and introduces geometry in axial space (RULE-006).

**The conversation that must happen.** DEC-082, which is the user's own question restated:
one representation or two layers. It cannot be deferred to execution, because the answer
decides whether there is a migration at all.

**One thing worth settling in the same breath**, since it is cheap once the above is
decided: the icon scatter. "Randomly but at a consistent density" needs a _seed_, or the
icons re-scatter on every render and every client draws a different field. Deriving the
seed from the region id, the way RULE-013 derives dice faces from a roll seed, is the
established pattern here.

**Disposition.** ✅ **Scheduled — WI-111, SPEC-047 §7.** DEC-082 was postponed (user,
2026-09-02) pending **WI-100**'s investigation, which ran (2026-09-03) and recommended (b).
**DEC-082 closed 2026-09-07: (b), narrowed.** Terrain is locked to single hexes — one click,
one hex — and the free-draw conversation (brush, organic edge, region layer) is **postponed**
as a body of work alongside IN-084 rather than denied piece by piece. The union outline and
the border colour are **dropped** (IN-105 Denied).

**Reclassified Deceptive → Simple.** Every trigger this item carried came from the Free half
and the union, and all of them are now gone: no new collection or field (RULE-007), no store
surface — the tool is a second caller of the existing `setHexTerrain` (RULE-001) — no security
rules (RULE-004), and no geometry in axial space, since the tool addresses whole hexes by
`Axial` and never reaches §1's `HexPoint` lattice (RULE-006). `setHexTerrain`'s stated
guarantee is untouched _because_ the gesture is a click: its contract already says "one settled
write per painted hex … this is a click, not a drag frame", which a drag-brush would have
broken (RULE-003). What is left redefines nothing — it adds a `MapToolId`, a toolbar row entry
and a new `data-testid` (added, not moved — RULE-005).

#### IN-092 — Hex symbol tool

**Request.** Places a map symbol; under Free snap it need not snap to the grid.

**Where it lands.** SPEC-030 §5 names this exact blocker: "every overlay tool stores
square-lattice units multiplied by `grid.cellSize` — `MapSymbol.cell` … A hex map's
multiplier is `hex.size`, so placing one would put a second space on the map." A hex symbol
needs an axial-space position, and under Free snap a _fractional_ one — which `HexTile`,
keyed by an integer `axialKey`, structurally cannot hold.

**Classification.** **Deceptive** — new schema, and a coordinate space RULE-006 has not
declared for symbols on hex maps. Note that IN-069 (backgrounds placeable on hex maps in an
undefined space) is the same defect already logged from the other direction, and the two
should be answered by one rule about what fractional axial position means.

> **Answered in principle (2026-09-02).** DEC-081 declares that space — `HexPoint`, in
> thirds of a hex step, where a snapped point is integer-valued and a free point is not.
> A Free-snap symbol is the free-valued case and needs nothing further; IN-069 is settled
> by the same declaration rather than by a second one. **No RULE-006 amendment is
> required** — thirds are axial coordinates, and the rule never says integer.

**Disposition.** DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §§1–2 and §4 —
WI-102, WI-103, WI-105.

#### IN-093 — Hex label tool

**Request.** Adds detail tied to that hex's address; under Free snap, find which hex the
pointer is inside and attach the label to it.

**Two observations, and they pull in opposite directions.**

First: **most of this exists.** `HexTile.note` is per-hex markdown, shown on hover through
the same `map-label-tooltip` a room label uses, authored in the hex-tile sheet (SPEC-030
§4, schema v26). "Find which hex we are within" is `hexMap.pixelToAxial`, which the Select
tool already calls. Read narrowly, the request is a _gesture_ — a tool that places a note
without going through the sheet — over storage that is already there and already exports.

Second: **it reverses a stated position, twice.** SPEC-030 §1 makes the coordinate the
addressing scheme, "replacing the labels a referee used to invent", and §5 says "Label is
doubly out". A Label tool on a hex map is not obviously the same thing as a note.

**Classification.** **Deceptive** — changing the stated behaviour of an existing
`SPEC-nnn`, on the narrowest reading of what the tool does.

**The conversation that must happen.** DEC-081, but with a specific question inside it:
**is this `HexTile.note` under a new gesture, or a second thing?** If it is the note, this
item is nearly free and needs no schema at all. If it is a placed, named, movable label
like a `MapRoom` label, it is IN-092 again with different art.

**Disposition — answered: it is the note.** SPEC-047 §5, WI-106. The Label tool resolves the
pointer to a hex and opens that hex's `HexTile.note`; Hex and Free snap differ in nothing here,
because a note belongs to a hex by definition and there is no fractional position for it to
occupy. **No new schema, no new collection, no migration** — the cheapest of the seven. It stays
Deceptive because it qualifies SPEC-030 §§1 and 5, which are annotated in place.

#### IN-094 — Hex road and river tools

**Request.** Roads: three shades of brown, three increasing widths, hard angles at the
vertices. Rivers: three shades of blue, three increasing widths, round at the vertices.

**Where it lands.** Nowhere yet — this is new geometry on a map with no line storage.
Two properties make it more than "a `Drawing` with a colour":

- **The vertices are the feature.** Mitred joins for roads and round joins for rivers is a
  stroke-join choice, and it is the same distinction the square map already draws between a
  snapped Corridor's flat caps and a free Path's round ones (SPEC-028 §9). Whatever axial
  polyline type this introduces has to carry the join style, not infer it from the tool
  that made it.
- **They run along hex edges and through hex centres**, which looked at first like a third
  address kind: not an integer `axialKey`, not a free pixel position, but the hex lattice's
  _corners_ — which the axial helpers do not currently expose.

**Classification.** **Deceptive** — new schema (RULE-007), new store surface (RULE-001) and
new rules (RULE-004).

> **The third address kind turned out not to exist (2026-09-02).** Every hex corner is an
> exact third of an axial coordinate — offsets `(⅔,−⅓) (⅓,⅓) (−⅓,⅔) (−⅔,⅓) (−⅓,−⅓) (⅓,−⅔)`
> from the centre, constant at every hex and every size — so corners and centres are one
> integer lattice at 3× resolution, separated by `(Q + R) mod 3`. DEC-081 has the
> derivation and the numeric check. A road's vertices are `HexPoint`s like everything
> else's, they meet **exactly** rather than to within a float tolerance, and **no RULE-006
> amendment is required**. What is left for this item is genuinely just the tool: three
> browns and three blues in the catalog, three widths, and mitre versus round joins carried
> on the document rather than inferred from which tool drew it.

**Disposition.** DEC-081 answered as recommended (user, 2026-09-02). SPEC-047 §§1–2 and §4 —
WI-102, WI-103, WI-105.

### The 2026-09-03 snap-audit batch (IN-095 – IN-103)

Nine items, all from one source: **WI-098**, IN-085's snap audit, which ran on 2026-09-03
and produced findings rather than edits (DEC-027). The full table — ten geometry-placing
tools × three snap modes, with each tool's anchor and whether its **shape class** changes
with the mode — is `docs/completed/WI-098.md` §1, and every item below cites a finding
there rather than restating it.

**What the audit settled, so these items are read against it.** Only **two** tools change
shape class with the snap mode, and both changes are cited: Path's caps (SPEC-028 §7) and
Carve's brush (DEC-032). Everything else that differs per mode is quantization. The
structural surprise was that the code has **three** anchor families, not the two §2
describes — lattice vertex (`snapPoint`: Wall, Door, Polygon), cell **centre**
(`snapCellCenter`: Corridor, Path, N-gon, Carve) and cell **corner**
(`snapCell`, floored: Room, Symbol, Label) — and that only the first attracts to a vertex
under Free.

> **Classifications approved and scheduled (user, 2026-09-03).** All ten are approved as
> proposed, with two rulings recorded in place: **IN-097 is answered** — keep the Euclidean
> disc and document it, rather than reshaping the brush footprint (the disc is what "a round
> brush, quantized to cells" means, and DEC-032 already commits Carve to being the organic
> tool) — and **IN-102 is raised as DEC-085** rather than scheduled, because it is a
> stated-behaviour change to SPEC-028 that the hex tools will inherit. Eight of the ten ride
> in **WI-107**; **IN-099** takes **WI-108** on its own. **IN-104 was added at approval
> time** — see its entry below for why it was missing.

#### IN-095 — Corridor's Free indicator advertises a cap the tool never draws

**Finding.** `targetedBandFor` (`apps/web/src/lib/map/vector-tools.ts:370`) returns a
circle under Free for **corridor and path alike**, on the stated grounds that it matches
"the round cap a free-snap Path produces". `corridorPoly`
(`packages/shared/src/map/vector/primitives.ts:372`) has **no Free branch**: every mode
goes through `bandRect`, and `bandSpan`'s Free branch (`:278`) returns the raw span — flat
caps, square joints, in all three modes. Under Free the Corridor therefore shows a circle
in front of a rectangle.

**Classification.** **Simple** (proposed) — a one-line predicate change in
`targetedBandFor`, no contract, schema, rules or coordinate-space change. It does alter a
visible indicator, so it wants the `snap-band-readout` testid's existing coverage extended
rather than a new surface.

**Disposition.** **WI-107.** Pairs with IN-096, which is the same defect in the spec. Note the interaction with DEC-085: if the Corridor's Free zero-length gesture comes to commit a `bandWidth` square, the indicator this item fixes should be that same square — one fix, reached from two directions. Pairs naturally with IN-096, which is the same defect in the spec.

#### IN-096 — SPEC-028 attributes the cap change to the Corridor as well as the Path

**Finding.** SPEC-028 §7's "Terminations" paragraph and §6's WI-052 amendment both read as
though Corridor and Path share the flat/round cap split. Only Path rounds. IN-085's own
rationale repeats the error, as finding (2). The Corridor's genuine Free difference is
narrower: unquantized endpoints and an unquantized band centre, same shape class
throughout.

**Classification.** **Simple** (proposed) — a documentation correction to §6 and §7. It
does not change any stated _behaviour_, only a mis-statement of it, so it is not a §-8
"changes the stated behaviour of an existing SPEC" trigger. IN-085's prose record is
preserved as written per §1's reading note; the correction belongs in the spec.

**Disposition.** **WI-107**, alongside IN-095 — the code fix and the doc fix are one story. Should land with IN-095 — the code fix and the doc fix are one story.

#### IN-097 — The snapped Carve dab is a disc of cells, not a block

**Finding.** `buildBrushStroke` (`vector-tools.ts:483`) paints every cell whose **centre**
lies within `radius = max(width / 2, step / 2)` of the anchored path. Under Cell snap a
single dab gives 1 cell at width ≤ 1; at width 2 (radius 1) the anchor **plus its four
cardinal neighbours — a plus, not a 2×2 or 3×3 block**, because the diagonals sit at
√2 ≈ 1.414; at width 3 (radius 1.5) the full 3×3. The footprint alternates plus-shaped and
square-ish as the width climbs. SPEC-028 §2's WI-042 note calls it "a block".

**Classification.** **Simple** (proposed) if the resolution is to document the disc, and
the disc is defensible — it is what "a round brush, quantized to cells" means. It becomes
**Deceptive** if the resolution is to change the footprint to a Chebyshev square, which
redefines what the Carve width _means_ and would need a decision first.

**Disposition.** **WI-107**, and the choice this entry names is **answered (user, 2026-09-03): keep the disc, document it.** The disc is what "a round brush, quantized to cells" honestly means, and DEC-032 already commits Carve to being the organic tool; reshaping the footprint to a Chebyshev square would redefine what the Carve width means and needs a decision it does not warrant. That ruling is what keeps this item **Simple**. The work is correcting SPEC-028 §2's WI-042 note, which calls it "a block". The choice between those two is the item.

#### IN-098 — Carve widths 0.5 and 1.0 are one stroke under Cell snap

**Finding.** The `step / 2` floor in the same expression. `MapToolbar`'s Width control is
`min="0.5" step="0.5"` (`apps/web/src/lib/components/MapToolbar.svelte:359-366`), so the
control's first two stops are indistinguishable under `full`. Under `half` the floor is
0.25 against a minimum width of 0.5, so nothing collapses there.

**Classification.** **Simple** (proposed) — the floor itself is deliberate and correct
(IN-012: a sub-cell brush that committed nothing at all). What is missing is either a
control that reflects it or a line of documentation that admits it.

**Disposition.** **WI-107.** Lowest-value item in the batch, carried because the file is already open — not worth a session of its own. Lowest-value item in the batch; listed for completeness.

#### IN-099 — Symbol and Label offer a Snap selector and no snap feedback

**Finding.** `MapToolbar`'s `SNAP_TOOLS` includes `label` and `symbol`
(`MapToolbar.svelte:250`, from IN-057/WI-075), but `VectorMapView`'s `SNAP_CURSOR_TOOLS`
(`VectorMapView.svelte:338`) excludes both, and `targetedCellFor` is Room-only by
construction (`vector-tools.ts:332-345`). The two tools whose placement _is_ "which cell
did you click" are the only snap-mode tools with neither a snap dot nor a cell highlight.
`SNAP_CURSOR_TOOLS`'s own comment gives the reason as "`symbol` places by cell-floor, not
vertex-snap" — which argues for giving it Room's **cell** indicator, not for giving it
nothing.

**Classification.** **Simple** (proposed) — widening `targetedCellFor`'s tool test from
`room` to the cell-corner family. It touches SPEC-028 §6, which is currently written as
"Room highlights the cell", so the spec moves with it (RULE-018).

**Disposition.** **WI-108**, on its own. The only finding in the batch that changes what a referee sees, and it touches SPEC-028 §6's "Room highlights the cell" wording, so it earns its own gate and its own diff. The most user-visible item in the batch.

#### IN-100 — Under Free, Symbol and Label store an unquantized anchor

**Finding.** `snapCell(p, 'free')` returns the raw point
(`packages/shared/src/map/vector/snap.ts:91`), so `MapSymbol.cell` and
`MapRoom.labelAnchor` hold arbitrary lattice floats under Free. This is RULE-006-legal —
lattice units are floats and nothing is stored in pixels — and is almost certainly
intended. The mismatch is nominal: the field is called `cell`, and `anchorCellFor`'s doc
calls it "the cell … containing the raw pointer position", which reads as a cell address.

**Classification.** **Simple** (proposed) — a doc note on `anchorCellFor` and on the two
fields. **Not** a schema change and explicitly not a migration: no stored value's type or
meaning moves.

**Disposition.** **WI-107.** A one-sentence doc note, carried with the rest.

#### IN-101 — SPEC-028 §6's dot rule contradicts itself

**Finding.** The WI-048 amendment says the dot "is drawn _in addition to_ the cell
highlight … so Room under Cell or Half snap shows a dot in the middle of the tile it
already highlights", and two sentences later says "Where a tile or shape indicator
supersedes the point, the point is no longer drawn." The code implements the second:
`if (input.cursorSnap && !input.cursorCell && !input.cursorBand)`
(`apps/web/src/lib/map/vector-engine.ts:1895`). Room shows no dot; N-gon, Carve, Wall, Door
and Polygon keep theirs. The first sentence was superseded by WI-052 and never struck.

**Classification.** **Simple** (proposed) — strike the stale sentence and annotate it as
superseded in place, per the amendment convention §6 already uses.

**Disposition.** **WI-107.**

#### IN-102 — "A click with no drag" has five different answers under Free

**Finding.** Under Cell/Half every floor tool commits **exactly one cell** for a
zero-length gesture, and it falls out of five separate mechanisms rather than one rule:
`snapSpan`'s floor, `cellRectPoly`'s inclusive rect, `corridorPoly`'s kept first leg,
`pathPoly`'s single-cell branch and `buildBrushStroke`'s radius floor. Under Free the same
gesture gives **Room — nothing** (`rectPoly` rejects zero area), **Corridor — nothing**
(both legs degenerate), **N-gon — nothing** (`snapSpan` is identity under Free, so
`acrossFlats` is 0), **Path — a round dot** of `bandWidth`, and **Carve — a round dot** of
`width`. Three silent no-ops and two dots. Only Room's half of this is cited (SPEC-028 §1,
§3).

**Classification.** **Deceptive** (proposed) — deciding what a zero-length Free gesture
commits changes the **stated behaviour** of SPEC-028 §3, and a "one rule for all five
tools" answer is a change to what the cell-anchored family guarantees. It also lands
squarely on the `grid` column DEC-080 scheduled (below), so it should not be settled twice.

**Disposition.** **Raised as DEC-085 (Open), not scheduled** (user, 2026-09-03). WI-098's
record and this entry both said this should be settled "alongside DEC-080" — that was
wrong, and the error is worth stating rather than quietly fixing: **DEC-080 was answered
and closed on 2026-09-02**, before WI-098 ran, so it cannot absorb this. DEC-085 carries the
same question with a recommendation (one rule in SPEC-028 §2; four tools endorsed unchanged,
the Corridor moved from "nothing" to a `bandWidth` `cornerBlock` square). It **blocks nothing
that is already scheduled**, but it should be answered **before WI-104 and WI-105**, which
add a `hex` snap mode and three more tools that would otherwise each invent a sixth answer.

#### IN-103 — §12 excludes Symbol and Label by omission

**Finding, and the audit's answer to IN-085's second half.** `VERTEX_ATTRACT_TOOLS` is an
**allowlist** (`vector-tools.ts:314`), and SPEC-028 §12 states its exclusions as "the
cell-anchored tools (Room, Corridor, N-gon, Carve, Path — §2's list)". Symbol and Label are
on neither list and are not `FloorPrimitiveTool`s; they never reach `toLatticeSnapped` at
all (`VectorMapView.svelte:2169`, `:2178`). So nothing in the spec or the suite says why
they do not attract.

**The audit's answer is No, they should not join** — `docs/completed/WI-098.md` §3 has it
in full. In short: attraction moves the anchor to the _nearest_ vertex, which can be past
the click, breaking the "the placed footprint must contain the clicked point" invariant
both tools exist to hold (IN-014's bug, through a different door); the anchor is the
footprint's **top-left**, so attracting it to a wall endpoint puts the symbol's corner on
the wall and its body down-and-right of it; and the want behind the request — flush
placement against existing geometry — is Cell snap, one control away and already offered on
both tools.

**Classification.** **Simple** (proposed) — restate §12's exclusion as an allowlist
rationale naming Symbol and Label, and extend `vector-tools.test.ts:918`'s third case with
`symbol` and `label` so the answer is pinned rather than implied by an allowlist's silence.

**Disposition.** **WI-107.**

#### IN-104 — SPEC-028 §2 describes two anchor families; the code has three

**Finding, added at approval time (2026-09-03).** WI-098 recorded this as its §1 structural
result and gave it **no `IN-` id**, which was a logging mistake rather than a judgement: it
is the single most load-bearing thing the audit found, and it belongs in the ledger like
everything else.

SPEC-028 §2 frames the world as cell-anchored versus vertex-snapped. The code has three:

| Anchor          | Function            | Tools                        | Free's vertex attraction? |
| --------------- | ------------------- | ---------------------------- | ------------------------- |
| Lattice vertex  | `snapPoint`         | Wall, Door, Polygon          | **Yes** (§12)             |
| Cell **centre** | `snapCellCenter`    | Corridor, Path, N-gon, Carve | No                        |
| Cell **corner** | `snapCell`, floored | Room, Symbol, Label          | No                        |

`CELL_ANCHORED_TOOLS` (`apps/web/src/lib/map/vector-tools.ts:290`) merges the last two,
which is correct for the plumbing — from `buildFloorStroke`'s point of view they share one
property, points arrive raw — and incomplete as a description of behaviour. Room floors to a
corner; its four list-mates centre on a cell; Symbol and Label floor to a corner without
being on the list at all, because they are not `FloorPrimitiveTool`s and take their own path
through `placeSymbolAt` / `placeLabelAt`.

**Why it matters more than its size suggests.** §2 is a **standing constraint on any new
floor tool** (DEC-012), and it is the text WI-102 – WI-106 will be read against while the hex
programme decides what each hex tool's `grid` anchor is. A standing constraint that describes
a two-way split the code does not have is the wrong thing to inherit.

**Classification.** **Simple** — a correction to §2's framing plus the table above. No
behaviour changes; `CELL_ANCHORED_TOOLS` keeps its membership and its purpose, and gains a
comment saying which of the three families each member belongs to.

**Disposition.** **WI-107**, and it is that work item's most important line rather than an
afterthought.

#### What the batch hands to the hex programme

DEC-080 closed on 2026-09-02, before this audit ran, so the handoff is to the work it
scheduled — **WI-102 – WI-106**, which add `grid`/`hex` as a fourth column to WI-098 §1's
table. Three results bear on them:

- The column it joins has **three** anchor families, not two. A hex map's tools will each
  have to say which of hex-vertex, hex-centre or hex-address-floor their `grid` behaviour
  resembles; WI-098 §1's second table is the shape of that question.
- **Only two tools change shape class per mode today, and both are cited.** A `grid` mode
  that adds a third uncited one is a new outlier, not a continuation of a pattern.
- **IN-102 is the thing most likely to be got wrong per mode**, because the zero-gesture
  answer falls out of five floors and identity functions rather than one rule. It is now
  **DEC-085**, and answering it before WI-104/WI-105 is the point: whatever `grid` does, "a
  click with no drag" should be answered once, explicitly, for all of them.
- **IN-104's three anchor families** are what a hex tool's `grid` anchor has to be chosen
  from. WI-107 corrects §2 to say so; scheduling WI-107 ahead of WI-102 is therefore worth a
  little, though nothing blocks on it.

### The 2026-09-03 terrain-investigation batch (IN-105, IN-106)

> Both came out of **WI-100** (`docs/completed/WI-100.md`), the investigation DEC-082 was
> postponed for. Neither depends on how DEC-082 is answered: both are about how a painted
> hex is **drawn** today, under SPEC-030 §2, and both would be wanted under alternatives
> (a) and (b) alike. Classifications are proposed, not approved.

#### IN-105 — Like-terrain hexes have no drawn boundary, and no border colour to draw one with

**Request.** A block of hexes sharing a terrain kind should read as one region with an edge.
Today it reads as an undifferentiated blob.

**What the code does.** `renderHexTiles` (`vector-engine.ts:1185`) fills each painted hex's
polygon into a single `Graphics` and draws **no stroke at all** — no per-hex outline, no
group outline. The hex grid is drawn separately, under the fills. `HexTerrainEntry`
(`map/hex/catalog.ts:27`) carries `kind`, `label`, `color` and `ref`; there is no border
colour for an outline to use, and DEC-082 argues at length that if one is added it belongs
there, beside the fill, for the same reason the fill is not on the document.

**Why it is Simple.** It adds a field to a catalog whose whole point is that it is art
rather than data — "re-drawing the whole terrain set is a change to this file rather than a
migration" — and one pass to a render function. Nothing stored changes, no store method
changes, no coordinate meaning changes. WI-100 §2 measured the pass: **0.18 ms at 300
painted hexes, 0.65 ms at 1200**, with the boundary keyed by exact integer axial _thirds_
(SPEC-047 §1's `HexPoint`) rather than by float or string, and it is skippable for any kind
that declares no border colour.

**Disposition.** ❌ **Denied — user, 2026-09-07**, with DEC-082's answer, and the row has
moved to §1.2. The union outline and the border colour are dropped together: DEC-082 had
answered the user's own parenthetical _(add a border colour?)_ with "**so yes**", and that is
**withdrawn**. Like-terrain hexes are not merged at render time and `HexTerrainEntry` gains no
border field.

**What that costs, recorded rather than glossed:** 40 painted hexes keep their 40 visible
seams, which is the blob this item opened by describing. Accepted. No `WI-` id was ever
reserved, so none is retired (RULE-019). Reviving this means reviving DEC-082 with it.

#### IN-106 — Per-hex seeded scatter as the terrain texture

**Request.** Terrain should read as a texture — scattered trees, not a tree icon centred in
each hex. IN-091 asked for this inside the terrain tool, "randomly but at a consistent
density"; WI-100 found it is neither tool-shaped nor storage-shaped.

**What the code does.** Each painted hex gets exactly one overlay sprite, centred, at
`hexTerrainArtPx(size) = size × 1.1`, at 55% alpha. At `DEFAULT_HEX_GRID_CONFIG`'s size 48
that reads as a grid of repeated icons — see `docs/completed/wi-100/scatter.svg`, bottom row.

**The finding.** Seeded **per hex from that hex's own axial key** —
`mulberry32(hashSeed("q,r"))`, RULE-013's exact pattern — at a fixed count per hex, the
scatter is continuous across hex boundaries with no visible hex-shaped clumping, is
zoom-invariant by construction, is stable under editing (painting one more hex moves nothing
already drawn), and **stores nothing**: no region, no seed field, no schema.
`docs/completed/wi-100/perhex.svg` is the render, at sizes 20, 32 and 48.

**Why Deceptive rather than Simple.** It changes what a terrain overlay _means_ at the render
boundary — one addressable sprite per hex becomes a derived field of many — and the sprite
path it replaces is `syncHexArt`'s keyed node reuse, so it is a render-pass change rather
than a catalog one. It also needs a density number per kind, which is a second field on
`HexTerrainEntry` beside IN-105's border colour. Conservative classification per `CLAUDE.md`.

**Disposition.** **Open**, and now standing alone. DEC-082 closed 2026-09-07 and **IN-105 was
denied with it**, so the "pairs with IN-105 — one render pass, two catalog fields" framing no
longer holds: this item is the only one of the pair left, and its density field is the only
field it would add.

**It survives the answer intact** (user, 2026-09-07). Nothing in it depended on free-form
painting or on a region: it is seeded per hex from that hex's own axial key and stores
nothing, so it is wanted under SPEC-047 §7's click-per-hex tool exactly as it was under a
brush. It is deliberately **not** bundled into WI-111 — §7 ships the tool and leaves the
single centred overlay as it is. Still awaiting triage on its own merits; the Deceptive
classification stands, since it is a render-pass change to what a terrain overlay means.

### The 2026-09-04 e2e-helper finding (IN-107)

#### IN-107 — `switchToEditMode`'s conditional click is a race

**Request.** Raised by WI-103's verification run, not by a user. `pnpm verify:all` failed on
`hex-map.spec.ts:176` ("a hex with a note shows it on hover"), which timed out for the full
180s waiting to click `vector-tool-select` — still `disabled`, `title="Select (locked —
switch to Edit)"`, i.e. the map was in `mapMode === 'view'` for the whole test. Re-running
that spec alone passed all four cases. WI-103's diff contains no `apps/web` file.

**What the code does.** `apps/web/tests/e2e/helpers.ts`:

```ts
export async function switchToEditMode(page: Page): Promise<void> {
  await openMapToolSheet(page);
  const toggle = page.getByTestId('map-mode-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await closeQuickSheet(page, 'maptools');
}
```

**The finding.** The helper reads `aria-pressed` once and clicks conditionally, then closes
the sheet without ever asserting the mode it was called to establish. Both halves are
unguarded: a `getAttribute` on a control Svelte has rendered but not yet wired returns the
attribute without the handler behind it, so the click is swallowed and nothing notices.
Every spec that calls it — `hex-map`, and it is imported widely — then runs its whole body
against a palette where every non-view tool is `disabled`, and fails 180s later somewhere
that has nothing to do with the cause. The other three `hex-map` cases run the identical
preamble, which is why this surfaces as an intermittent failure in one arbitrary spec rather
than a reproducible one.

**The fix is one line**, and is the pattern the rest of `helpers.ts` already uses: assert the
toggle reached `aria-pressed="true"` before closing the sheet, so a swallowed click fails at
the helper with an accurate message instead of 180 seconds later at an unrelated locator.
`expect(toggle).toHaveAttribute('aria-pressed', 'true')` auto-retries, which also removes the
stale-read half of the race.

**Why Simple.** Test-helper only. It adds an assertion to a helper; it changes no `data-testid`
(RULE-005), no store contract, no schema, and no application code. It does not redefine
anything a caller may assume — every current caller already intends the post-condition it
would start asserting.

**Disposition.** ✅ **Simple approved — user, 2026-09-07. Scheduled as WI-109**, and first in
the order. It was not fixed in WI-103 because that item is hex overlay storage and a flaky e2e
helper is outside it (RULE-015). The "before WI-104 – WI-106" argument has been overtaken —
all three shipped — but the reason behind it stands and now applies to WI-110 – WI-112: they
run these same specs, and a swallowed click that fails 180 seconds later at an unrelated
locator will cost more to diagnose than the assertion costs to add.

**A note for the execution session on verifying it.** The bug is intermittent, so a green run
proves little. The post-condition worth demonstrating is that the helper now fails **fast and
at the right place** when the click is swallowed — an induced failure, not just a passing
suite.

### The 2026-09-04 DEC-085 closure (IN-108)

#### IN-108 — Implement DEC-085's Corridor and Free-indicator change

**Request.** Raised while executing WI-104: DEC-085 ("what does a zero-length gesture
commit, per tool and per snap mode?") was still Open, and WI-104 needed its answer so the
`hex` snap mode's own zero-length case would inherit a settled rule rather than invent a
sixth one. The user answered DEC-085 alternative (a) — one rule in SPEC-028 §2 — as
recommended (2026-09-04, see `docs/decisions/DEC-085.md`).

**What DEC-085 leaves undone.** The answer settles the _rule_; it does not itself change
`corridorPoly`. DEC-085's own Impact section says the Corridor's Free zero-length branch
moving from "nothing" to a `bandWidth` square (`cornerBlock`) is a stated-behaviour change
to SPEC-028 — Deceptive by the trigger list — and it interacts with **IN-095** (the
Corridor's Free indicator should draw that same square once it commits one). Neither the
code change nor the SPEC-028 §2 rewrite is part of WI-104: WI-104 touches only the hex
tools (SPEC-047 §3), and the Corridor is a square-grid tool untouched by that item
(RULE-015).

**Disposition.** ✅ **Deceptive approved — user, 2026-09-07. Scheduled as WI-110**, after
WI-109. Two-line code change (`packages/shared/src/map/vector/primitives.ts`'s `corridorPoly`
Free zero-length branch, plus the Free-indicator draw call IN-095 already identifies) and a
SPEC-028 §2 rewrite stating the rule DEC-085 settled. No schema, no store contract, no rules
file, no coordinate-space change. The classification is right on the trigger, not the size: it
rewrites the stated behaviour of an existing `SPEC-nnn`, and §2 is a standing constraint on
any new floor tool (DEC-012).

**One thing the planning session must re-read rather than assume.** WI-107 (2026-09-05) landed
after this item was written and rewrote both the text and the code it names — SPEC-028 §2
around the three-anchor-family table (IN-104), and `targetedBandFor`'s predicate, which already
took IN-095's Free-snap circle out. **Read §2 and `targetedBandFor` as they now stand**, not as
this entry describes them, and confirm what is actually left of the Free-indicator half before
scoping it.

### The 2026-09-08 token-letter batch (IN-109 – IN-111)

One request from the user, logged as three items because they have three different
blockers. Read together they are "the letter overlay becomes a first-class label on every
token, styled by who made it, editable by its player".

#### IN-109 — The letter becomes a `Token` field, drawn over any art

**Request.** Allow the letter overlay on all tokens — those with no image _and_ those with
an image.

**What the code does.** There is no letter _overlay_. The letter is **inside the art**:
`imageRef` may be a `gen:disc:{label}:{colorToken}` recipe, which `AssetStore.resolve`
renders to an SVG data URI — a coloured disc with the letterform already drawn into it
(`renderGenTokenSvg`, `asset-store.ts:140`). `VectorMapView` then loads that data URI as the
token sprite's texture like any other image. So "a token with an image" and "a token with a
letter" are **the same slot with two different values**, and a token showing an uploaded
image has nowhere to put a letter. No text is drawn over a token anywhere in
`vector-engine.ts` today.

**Where it lands.** The letter has to stop being art and become data: a new optional field on
`Token` (alongside `name` and `color`, which are the two precedents for exactly this move),
plus a **new render pass** in the token layer that draws it over the sprite — the first text
ever drawn on a token.

**Classification.** **Deceptive**, on three triggers at once. It changes the `Token` schema,
so RULE-007 wants a migration, a migration test and a `.vttcamp` round-trip test. It changes
what `imageRef` _means_ — today it is the sole carrier of the letter, afterwards it is only
art — which is a stored field's meaning changing even though its type does not. And it adds a
render pass, which SPEC-028's own history says is never as local as it looks.

**Two consequences the spec will have to state rather than let emerge.**

- **The letter would be drawn twice on existing letter tokens** — once baked into the
  `gen:disc:` texture, once by the new pass — unless the migration or the renderer picks one.
  Whether the migration lifts the baked label out into the new field (and rewrites the ref) or
  the renderer suppresses its pass for `gen:disc:` refs is a real fork, and the first is a
  rewrite of stored refs.
- **`nextCreatureLetters` only counts `gen:disc:` refs.** README ("Creature names and
  symbols"): _"Only plain-letter `gen:disc:` refs of seatless members consume a letter: seat-owned
  tokens, bundled/URL art, hand-typed labels … do not."_ Once an image token can carry a
  letter, that rule is wrong — auto-assignment has to count the new field instead, or two
  creatures in a group silently share a letter.

**It owns the store surface, deliberately.** The new field's store method — the
`setTokenLetter`-shaped call that `CharacterDock` will drive — belongs to **this** item, not to
IN-111. That is what keeps RULE-001's contract-suite work (a case in
`campaign-store.contract.ts` passing against `MemoryStore`, `FirebaseStore` and `LocalStore`)
in one place, and it is why IN-111 classifies Simple. The split must not be redrawn.

---

### Rescoped 2026-09-08 — this is a reversal, and it is Shape A

The user's follow-up — _"remove the existing mechanic and migrate the automatic lettering and
anything else that depends upon token letters"_ — changes this item from _add a field beside the
ref_ to _retire the ref scheme and move every dependant onto stored data_. That is **Shape A**
(reversal), not Deceptive, and per the intake chain a reversal must **name what it supersedes**
rather than quietly replace it.

**What it supersedes, in the source's own words.** `usedGroupLetters`
(`apps/web/src/lib/tokens/labels.ts`) documents the design being reversed:

> Reads them back out of each member's `gen:disc:{LABEL}:` ref, **which is where the symbol
> actually lives — there is no separate stored letter, and adding one would be a second source
> of truth for something the art already encodes.**

So "no separate stored letter" was a deliberate choice, not an oversight. **SPEC-040 §4** is the
spec text that states it and is what this item rewrites. **DEC-072 is _not_ reopened**: its
answer — uppercase, unique within the group, restarting at A — survives intact. What changes is
only _where the letter lives_, which DEC-072 never ruled on.

**The dependency surface, complete.** Ten places read or write a letter through a ref:

| #   | Where                                    | What it does                                              |
| --- | ---------------------------------------- | --------------------------------------------------------- |
| 1   | `Token.imageRef`                         | stores the letter, as `gen:disc:{LABEL}:{color}`          |
| 2   | `usedGroupLetters`                       | parses letters back out via `/^gen:disc:([A-Z]+):/`       |
| 3   | `nextCreatureLetters`                    | lowest-unused assignment over #2                          |
| 4   | `defaultCreatureRefs`                    | writes a batch's refs                                     |
| 5   | `creatureBatchColor`/`genColorToken`     | the batch colour, `hsl()`, baked into the ref             |
| 6   | `defaultPortraitRef`/`seatLetterFor`     | **seat portraits** use the same scheme, room-wide         |
| 7   | `TokenPickerDialog`                      | the "Generate default" tab, for creatures _and_ portraits |
| 8   | `CharacterDock`                          | rebuilds the ref on a colour pick, keeping the label      |
| 9   | `renderGenTokenSvg`/`resolveGenTokenRef` | the renderer and the `AssetStore` resolve path            |
| 10  | migration + `.vttcamp`                   | every stored ref must move, or stop resolving             |

**Row 6 is the one that makes this a decision rather than an execution detail.**
`gen:disc:` is not a token mechanism — it is the fallback art for **`ProfileInstance.portraitRef`**
as well, and a portrait is not a token. "Remove the existing mechanic" therefore has to say
whether portraits come too. **DEC-087** asks it.

**Three migration consequences that must be settled in the spec, not discovered:**

- **The colour formats disagree.** A ref bakes `hsl(...)`; `Token.color` is validated
  `#rrggbb`. Every migrated token needs an hsl → hex conversion, and the two must not diverge.
- **`imageRef` is required today** (`imageRef: string`, not optional). A letter-only token needs
  it optional or empty-meaning-none — itself a schema change.
- **Pre-v28 `a1`/`a2` refs are the awkward case.** They render as "a1" and, being lowercase,
  **never consumed a group letter** (SPEC-040 §4, and `CREATURE_GEN_RE` is uppercase-only).
  Migrating them into a `letter` field either changes what they display or makes them start
  consuming a letter they never held. Either way an existing map's lettering shifts, which is
  exactly the kind of silent change RULE-007 exists to force into the open.

**Classification.** **Complex (Shape A)**, superseding SPEC-040 §4. Multi-phase: schema +
migration, the letter-assignment rewrite, the render pass, and the picker/dock surfaces are
four separable pieces, and the last three all depend on the first.

**Disposition.** ✅ **Scheduled — WI-113, WI-114 and WI-116, SPEC-048 §§1–3 and §5.** DEC-087
answered **(a)** (user, 2026-09-08): the scheme is retired as stored data for tokens **and**
portraits, `renderGenTokenSvg` survives demoted to a pure helper, and deleting the `gen:` branch
of `AssetStore.resolve` is the acceptance test. Split across three work items so every
intermediate state is shippable — WI-113 backfills and leaves the refs alone, so nothing changes
visibly until WI-115's render pass exists to draw the letter another way.

#### IN-110 — Letter colours key off who created the token

**Request.** Black text with a white border for referee-created tokens; white text with a
black border for player-created ones.

**What the code does.** `discStyle` (`asset-store.ts:125`) picks the text colour from the
**disc's own lightness** — `lightness > 55 ? '#1a1a1a' : '#f6f1e6'` — so the letterform stays
legible whatever hue the disc is. There is no border on the text at all; the stroke in the SVG
is the _disc's_ ring, not the letter's.

**The blocker was that nothing records who created a token** — `createToken(roomId, token)`
takes a whole `Token` and stores no author; `Token` carries `ownerSeatId`, which is
_ownership, not authorship_; and `firestore.rules` makes `tokens` `isMember() || isGM()`,
with `DECISIONS.md` → Postponed ("Member write scope inside a room") stating plainly that any
member may write tokens, so "the player dropped this creature" is a real case.

**DEC-086 answered it (a)** (user, 2026-09-08): derive the distinction from `ownerSeatId` and
store nothing. A token **with** a seat is somebody's character and takes **white text with a
black outline**; a token **without** one is a creature or scenery and takes **black text with
a white outline**. The spec states the rule as _"is this somebody's character?"_ rather than
as authorship, and accepts that a player-dropped creature reads as a creature. **No schema
change, no migration** for this half.

**Classification.** **Deceptive.** It replaces a stated behaviour — R7.1's lightness-aware
contrast flip, documented in `README.md` §II.7 — with a rule that ignores lightness, and
depending on DEC-086's answer it changes the `Token` schema too.

**The outline is load-bearing, not decorative** — and this is the line the spec must not lose.
Fixed black or white text _ignores_ the disc colour, so black-on-a-dark-disc and
white-on-a-light-disc are both reachable. The border is the only thing keeping the glyph
legible, so it must be a genuine outline **on the glyph** — stroked text with paint-order, or a
second offset draw — never the disc's existing ring. Alternative (d) (keep the lightness flip,
add only the outline) was offered to the user directly and declined, so this cost is chosen
knowingly rather than overlooked.

**Disposition.** ✅ **Scheduled — WI-115, SPEC-048 §4.** Unblocked by DEC-086 (a). Behind
WI-113, whose field it styles. It is the first item in the programme that changes what a referee
sees, and it carries the outline constraint: a genuine stroke on the glyph, never the disc's
ring.

#### IN-111 — Edit the letter from the character sheet, at the existing cap

**Request.** Allow changing the text from the token/colour selection screen in the character
sheet. The request said "up to 2 characters"; **the user superseded that on 2026-09-08** —
_"make the render cap 3 globally so we aren't changing the existing standard"_ — so the field
caps at **3**, the value `GEN_TOKEN_LABEL_CAP` already holds, and nothing about the cap
changes anywhere.

**What the code does.** `CharacterDock.svelte` has that screen — `token-color-control`
(line ~390), a swatch row plus a custom picker. It already reaches into the letter machinery:
picking a colour calls `parseGenTokenRef` and rebuilds the ref with `buildGenTokenRef`,
**keeping the existing label**. So the field this item asks for sits directly beside controls
that already know the label; the UI half is small.

**The cap question is settled, and settling it removed this item's only Deceptive trigger.**
`GEN_TOKEN_LABEL_CAP` is **3**, and `README.md` §II.7 documents the Generate-default tab's
character field as accepting _arbitrary text (letters, digits, symbol/emoji glyphs — not
restricted to A–Z, with a ~2–3 glyph render cap)_. Capping the new field at 2 would have
**reversed** that and truncated existing 3-glyph labels. The user's ruling keeps the cap at 3
everywhere, so **no stated behaviour changes and no stored label becomes invalid**.

**One scope limit to state rather than discover.** The character sheet edits _my_ token.
Referee creatures are lettered from the Generate-default tab and the encounter board, so this
item gives the referee no way to retype a creature's letter — which IN-109's "all tokens"
framing invites. Accepted as out of scope here; a second surface would be its own item.

**Classification.** **Simple**, and the justification is the split with IN-109: **IN-109 owns
the schema and the store method**, so what is left here is a text input in
`CharacterDock.svelte` beside `token-color-control` calling a method that already exists by
then. It adds no `data-testid` that anything moves (a new one, not a moved one — RULE-005), no
store surface, no schema, no rules, no coordinate meaning, and now no cap change. **If the
split were drawn the other way** — this item shipping the store method — it would be Deceptive
on RULE-001, so the split is load-bearing and the two items must not be re-divided.

**Disposition.** ✅ **Scheduled — WI-117, SPEC-048 §5.** Behind WI-113, whose store method it
drives. Simple stands only while WI-113 owns that method; re-dividing the two makes this item
Deceptive on RULE-001.

### The 2026-09-08 token render-path findings (IN-112, IN-113)

Raised by the user while SPEC-048's gate was open — _"we are now drawing multiple things for
each token, will they all move together?"_ — and split in two once the answer came back: a
**confirmed defect** that exists today, and the **structural change** that would have prevented
it. They are separable, they classify differently, and only the first is urgent.

#### IN-112 — A dragged token leaves its decorations behind

**Confirmed by the user, 2026-09-08** — _"it does lag"_ — against a running table, which
discharges the "unconfirmed by inspection" caveat SPEC-048 §4 was written with. **This is a
live defect and it has nothing to do with the letter work**; it is visible today, on every drag,
to everyone at the table.

**What the code does, and it is uniform.** A token is drawn as five display objects with no
per-token container: `spritesByToken` (art), `backgroundsByToken` (the colour disc),
`ringsByToken` (the status ring), `awayBadgesByToken` and `brokenImageBadgesByToken`, plus
`badgesByGroup` for a collapsed group. **All five read their position from the sprite**, not
from `token.pos` — `const bx = sprite ? sprite.position.x : token.pos.x`, repeated identically
at every site, and `background.position.copyFrom(sprite.position)` for the disc. That convention
is correct: `token.pos` is stale mid-drag, because `syncSprites` skips repositioning a token in
`draggingIds` and the stored position does not change until drop.

**The defect is when, not where.** The convention only pays out when a sync pass runs, and the
drag handler runs exactly one:

```ts
sprite.on('globalpointermove', (e) => {
  const local = engine.world.toLocal(e.global);
  sprite.position.set(local.x, local.y);
  store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
  if (collapsedGroupAnchoredBy(tokenId)) syncCollapsedBadges(); // <- the only one
});
```

`syncTokenRings`, the disc's copy in `syncSprites`, `syncAwayBadges` and `syncBrokenImageBadges`
are all reached only from `renderAll`, which nothing calls during a drag. **The handler already
knows decorations need re-syncing — it does it for one of the five.** That asymmetry is the whole
bug.

**The fix.** Re-sync the dragged token's decorations on each move, beside the
`syncCollapsedBadges()` call that is already there. The honest shape syncs **only the dragged
token** rather than re-running four whole-list passes per pointer frame: the existing syncs
iterate every token, which is affordable at a table's token count but is needless work on a
per-frame path, and a single-token variant keeps the drag as cheap as it is now.

**Why Simple.** It changes **when** an existing sync runs, not what is drawn, where it is drawn,
or in what order. No store contract, no schema, no security rules, no `data-testid`, no
coordinate meaning, and no Pixi layer order — every object stays a direct child of
`engine.layers.tokens`, exactly as today. Visible behaviour does change, which is not itself a
trigger: IN-099 was classified Simple on the same basis and shipped as WI-108.

**Disposition.** ✅ **Scheduled — WI-118**, classification and gate both cleared (user,
2026-09-08). **Runs before WI-115**: with this fixed first, WI-115's letter inherits a drag that
already works and needs no Deviation.

#### IN-113 — A token is five parallel maps with no container

**Request.** The structural end state: make the sprite, disc, ring, letter and badges children
of one `PIXI.Container` per token, positioned once. Everything then moves together **by
construction** rather than by every call site remembering to read the sprite, and the five
parallel maps collapse to one.

**Why it is worth having even after IN-112.** IN-112 fixes the symptom and leaves the shape that
produced it. Every future per-token drawing — the letter is the sixth — must remember the
convention, and the drag handler must remember to sync it. A container makes forgetting
impossible.

**Why Deceptive.** It changes what a Pixi layer contains: direct children become one container
per token, which is a change to layer composition and z-ordering semantics — `CLAUDE.md`'s
"what a layer means" trigger. Three things depend on the present shape: the **sprite** carries
the pointer handlers, `cursor` and `eventMode` (a container would intercept or reorder hit
testing); the **disc's z-order** comes from being inserted into the layer before the sprite; and
**`export-layers.ts`** walks these objects for the PNG path.

**Disposition.** Awaiting triage. **Not** a prerequisite for anything scheduled — IN-112 makes
the current shape correct, and SPEC-048 §4 is written so that adopting a container later changes
_where positions are set_ without changing what §4 says is drawn.

### The 2026-09-08 terrain art replacement (IN-114)

#### IN-114 — Obsolete WI-101's terrain art in favour of the Worldographer icon sets

**Request.** The project owner supplies two public-domain icon sets by **Inkwell Ideas,
Inc.** — `bw-icons` (37 PNG) and `multicolored-classic` (60 PNG), the free downloads from
Worldographer's extra-icon-sets page — to replace the hex **terrain** art WI-101 landed on
2026-09-04. His stated direction: the B&W set is the primary source because it suits the
white-authored, multiply-tinted pipeline; the multicoloured set is pulled from only where the
B&W set has no equivalent shape (his example: farmland). **Terrain only** —
`HEX_CONTENTS_CATALOG` and its 26 icons are out of scope. He characterises it as "no huge
change here".

**It supersedes IN-089's art choice, and reaffirms DEC-083's terms.** IN-089 asked for the
owner's own 37-file pack to become the hex palette; WI-101 landed it. This request replaces
the terrain half of that outcome four days later. What it does **not** touch is the three
things DEC-083 settled about _how_ a pack lands — extend and alias, re-author white,
single-tone only — all of which this pack satisfies more comfortably than WI-101's did. Named
here rather than silently overwritten: **IN-089 stays closed**, its `ATTRIBUTION.md` entry
stays true of the 26 contents files it also landed, and the terrain paragraph of that entry is
corrected by this item rather than deleted.

**Measured, not assumed** (2026-09-08, against the supplied files):

- **B&W: 37 PNG, 300×300 RGBA, every one a single flat `#484848` ink with the antialiasing
  entirely in the alpha channel.** True single-tone silhouettes — re-authoring to white is an
  RGB substitution preserving alpha, which is DEC-083 (ii)'s "substitution, not a redraw"
  exactly. A `black_white.properties` names 25 of the 37 with label, category and scale factor;
  12 are unreferenced extras. **No water/ocean glyph** — Worldographer renders those as a
  background colour with no icon, which is what `HexTerrainEntry.color` already is.
- **Multicoloured: 60 PNG, 250×250, 55 of them multi-tone** (2–5 inks) and therefore a redraw
  under a multiply tint, not a substitution. **Six are single-tone** and usable as-is:
  `cultivatedfarmland`, `deadforest`, `grassyhills`, `reefs`, `sandydesert`, `snowfields`. The
  owner's own example lands inside that six.
- **Coverage against the current 20 kinds.** B&W covers 13 of them. It has **no equivalent for
  `water`, `tundra`, `ice-floe`, `palm`, `plateau`**; `grass` collapses onto `plains`;
  `snowfields` covers `tundra`/`ice-floe`. B&W adds ~20 shapes with no current kind.
- **`volcano` exists as a B&W terrain glyph and as an existing contents kind.** Not a
  collision in code — two catalogs, two lookups — but one for a reader.

**Why Deceptive rather than Simple.** Under DEC-083's alias rule this is, in the end, a
catalog-file edit plus asset files: no store method, no schema, no migration, no rules block,
no coordinate space, no `data-testid`. That reading argues Simple, and the owner's "no huge
change" is a fair description of it. Three things pull it back:

1. **SPEC-030 §2's normative text says "a background colour plus an SVG overlay".** The
   supplied art is raster. Landing it as PNG changes the stated behaviour of a Completed spec;
   tracing it to SVG does not. That is a trigger either way until it is decided which.
2. **The terrain palette roughly doubles**, from 20 kinds to ~40, and the WI-041 hex-tile
   sheet has never been shown that many.
3. **IN-089, the identical request shape, was classified Deceptive** and the classification
   held up — it raised DEC-083, which is the reason this item is as cheap as it is.
   Classifying conservatively is what made that true.

**Disposition.** **DEC-088 answered, user, 2026-09-08** — trace to SVG; all 37 B&W shapes
become kinds; four single-tone additions from the colour set (`cultivatedfarmland`,
`snowfields`, `deadforest`, `reefs`); kinds with no equivalent leave the palette but keep
resolving, so no migration; `water` becomes three blues with no glyph; names come from the
filenames minus `bw-`; `volcano` stays in both catalogs deliberately. Kind-string continuity
was never among the questions — DEC-083 (i) and SPEC-047 §6 answer it, and this item did not
reopen it.

**That answer changed the colour model and raised DEC-089, which is Open.** Contents stay
black, terrain background is a colour, and **terrain ink becomes a colour contrasting with
that background** rather than one of two greys. This needs no pipeline change — `sprite.tint`
is a multiply — and the art is _still authored white_, white being the multiply identity that
makes ink a render-time decision at all. What is open is whether the ink is authored per row
behind a contrast test or derived from the background. It retires
`HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT` and amends SPEC-030 §2. It was first written as
converging with IN-105's border colour on the same interface; **DEC-082 Denied that item**
(user, 2026-09-07), so `ink` is the only field `HexTerrainEntry` gains.

**Scheduled as two work items: WI-119, then WI-120.** WI-119 is the reference sheet —
findings and figures, no production code, the WI-100 precedent — and its output is WI-120's
input. The palette is the irreversible half of this work and gets approved against something
visible.

**Housekeeping the execution session inherits.** The two zips arrived as session uploads and
are ephemeral. They are parked at `docs/intake/worldographer/` on the IN-089 precedent, and
the provenance recorded in `ATTRIBUTION.md` must say what is actually known: the sets are
attributed to **Inkwell Ideas, Inc.** and released to the public domain, credit appreciated
but not required — **on the project owner's confirmation in session, plus a web-search
summary**. `worldographer.com` and `hexographer.com` are both blocked by the session's egress
proxy, so the licence statement **could not be fetched verbatim** and must not be recorded as
a verified quote.

---

### Review of the WI-120 art landing (2026-09-10)

Three observations from reviewing the landed terrain pack against SPEC-047 §8 and against
the picker as it actually renders (`docs/completed/WI-120.md`; the review sheet built in the
same session shows every row's glyph, filename and colour pair).

#### IN-115 — split on triage

The item was logged as one line by WI-120's own completion summary. On triage its two halves
are not the same size of change and are separated here, per the "log each item separately"
rule; the id is not renumbered (RULE-019).

**The picker half is a defect against SPEC-047 §8, not a new feature.** §8 already states the
behaviour in normative terms — *"A kind the pack cannot draw leaves the palette; it does not
leave the catalog"*, and, of `palm` and `plateau` specifically, *"They leave the palette and
keep resolving to the nearest shape"*. WI-120 landed the resolution half (all six aliases
redirect to another kind's art) and not the palette half. Both authoring surfaces still offer
all six: `HexTilePanel.svelte:40` filters only `unknown`, and `MapToolbar.svelte:314`'s
`HEX_TERRAIN_KINDS` filters nothing at all — so the Terrain tool's `<select>` offers `unknown`
as well.

**The render-box half is a render-pass change and stays Open.** 1.1× → 1.8× cannot land on its
own: `vector-engine-hex.test.ts` asserts the art box's half-diagonal stays inside the hex's
inradius, which 1.8× violates by design, and there is no `Sprite.mask` precedent anywhere in
`vector-engine.ts`. What the box means, and what bounds it, is the question — DEC-090.

#### IN-116 — the contents catalog has the terrain catalog's problem

`apps/web/public/assets/hex/contents/` carries both generations. Exactly three files predate
the WI-101 pack (`danger.svg`, `ruins.svg`, `tower.svg` — the three with no `aria-label`,
WI-040-era filled `<path>` geometry against the pack's stroked `sym *` files), and the pack
added near-neighbours beside two of them: `ruin`, `tower-keep`. All 26 rows are pickable.

This is the same shape as IN-115's picker half but **not** the same disposition, because §8's
sentence does not reach it: both §6 and §8 put contents explicitly out of scope, so there is no
stated behaviour to hold the catalog to and nothing to call a defect. It needs its own spec
section and one decision first — `danger` has no pack equivalent to redirect to, so retiring it
would remove a contents kind SPEC-030 §3 names in its own prose (DEC-091).

#### IN-117 — replacement `danger` art

Raised out of DEC-091 (c). `danger` keeps its slot because the Worldographer pack has no
"something dangerous here" glyph to redirect it to; the project owner is authoring one, so
`danger.svg` stops being the odd file out without costing a kind. Not blocking WI-123 — that
item retires `ruins` and `tower` and names `danger` as its stated exception; this one swaps a
`ref` when the art exists.

---

### Hex-crawl playtest batch (2026-09-11)

Twelve items, arriving as one list from a session spent authoring a hex crawl. Shape B, so
each is logged and classified on its own (RULE-016's sibling rule at the intake end). One of
the twelve — the 1.8× terrain box — is **not** a new item: it is IN-118, raised by WI-122 on
2026-09-11 and still Open, so it is annotated in place rather than given a second id
(RULE-019). One more, "the terrain picker still shows retired types", does not reproduce
against `main` and is answered below rather than logged. The remaining ten are IN-119 – IN-129
minus the one id (IN-122) that came out of checking that answer.

**Five of the ten are Deceptive and none of them is scheduled.** They are not hard; they are
items whose one-line statement hides a contract. Three of the five share a cause worth naming
once: a hex map's authoring surfaces were built alongside the square map's and inherited its
vocabulary — a snap mode, a measurement per square, a shade index — and each request is really
"stop borrowing the square map's meaning here". That is RULE-006's subject matter, which is
why they stop at triage rather than at a CSS change.

#### IN-119 — an `.svg` token renders as a black square

Bundled symbol and door art is SVG and draws correctly, so this is not "Pixi cannot do SVG".
The two paths differ: symbols and doors load through `PIXI.Assets.load` (`vector-engine.ts`'s
`loadCachedTexture`), which runs the SVG through Pixi's own parser, while a **token** loads
through `loadImageElement` + `PIXI.Texture.from(img)` (`apps/web/src/lib/tokens/texture-load.ts`,
IN-008/WI-032) — a plain `HTMLImageElement`, chosen deliberately so a pasted extensionless CDN
URL still works. An `HTMLImageElement` holding an SVG with no intrinsic `width`/`height` has a
`naturalWidth` of 0, and uploading that to WebGL is what produces an untextured quad rather
than a failed load — which is why it shows as a square instead of raising the broken-image
badge `loadTokenTexture` already has.

The two bundled tokens (`fighter.svg`, `goblin.svg`) both carry `width="128" height="128"`, so
they are not the reproduction; an SVG pasted by URL, or bundled without those attributes, is.
**Simple:** the fix lives in the token art path — no store method, no schema, no rule, no
coordinate meaning, no `data-testid`. Note for the execution session: it must **not** widen
`ALLOWED_UPLOAD_CONTENT_TYPES`. SVG's absence from that list is a deliberate containment
decision (SPEC-034 §2, and the type's own comment), and an uploaded SVG is rejected by
`storage.rules` before it can ever reach this code — so no reproduction of this bug can
involve one.

#### IN-120 — a hex map's token snap still offers Cell/Half/Free

`CharacterDock.svelte`'s `token-snap-mode` `<select>` is three hard-coded `<option>`s and is
not a function of the map's grid kind, unlike `MapToolbar`'s own Snap selector, which WI-104
already made one (SPEC-047 §3, DEC-080).

**Deceptive, and not for the dropdown's sake.** The vector tools' `VectorSnapMode` and the
token layer's `SnapMode` (`packages/shared/src/map/snap.ts`) are two different types with two
different jobs: the first quantizes in lattice units, the second in **world pixels by
`cellSize`**. Giving the second a hex member means deciding what a hex-snapped token position
*is* — a hex centre resolved through `axialToPixel`, presumably, but `snapTokenPosition` also
honours token size (a 2×2 lands on the corner between four cells), and "a 2×2 token on a hex
grid" has no answer inherited from the square map. That is a coordinate-space decision under
RULE-006, and it is the conversation this item needs before it can be written down.

#### IN-121 — entering a hex map leaves the Snap selector blank

`MapToolController.snapMode` initialises to `'full'` and `setHexMap` does not touch it, while
`MapToolbar`'s offered set becomes `HEX_SNAP_MODES` (`hex`, `free`) the moment `isHexMap` is
set. A `<select>` whose `value` matches no `<option>` renders empty, so the control reads as
unset until the referee picks something — and the tools are meanwhile running on `'full'`, a
mode the hex map does not offer.

**Simple.** `'hex'` already exists in the union and `DEFAULT_BAND_WIDTH` already answers for
it (WI-104), so this is a coercion in `setHexMap`, reusing the `setSnapMode` path that already
carries the band width along with the mode. It redefines nothing: no new member, no new
meaning for an existing one, no stored field.

#### IN-122 — the hex Symbol tool's kind picker offers `unknown`

Found while checking item 5 (below). `MapToolbar.svelte`'s `HEX_SYMBOL_KINDS` is
`HEX_CONTENTS_CATALOG.map(e => e.kind)` with no filter, while `HexTilePanel.svelte`'s
`CONTENTS` filters `UNKNOWN_HEX_KIND` out. So the same catalog is offered two different ways,
and one of them lets a referee author `unknown` — the value that exists so an *unrecognised*
kind still draws, never a pick. This is the exact defect WI-121 fixed on the terrain side, on
the contents side, and it is why item 5's report was worth checking rather than dismissing.

**Simple.** Contents has no `paintable` flag and needs none — a single `!== UNKNOWN_HEX_KIND`
filter, matching what the quick sheet already does. Not folded into WI-123, which is gated on
a different question (DEC-091) and must stay the change its gate describes (RULE-015).

#### IN-123 — per-hex measurement

Two requests in one sentence, and the second is the load-bearing one.

**The surface half.** `SessionActivity.svelte`'s Grid & measurement section reads "Per square"
and `DEFAULT_MEASURE` is `{ perSquare: 10, unit: 'feet' }`. On a hex crawl the referee wants
"Per hex" and a default of 6 miles.

**The half that makes it Deceptive.** The Measure tool does not currently measure a hex map at
all. `VectorMapView`'s `toLatticeRaw` is `world / cellSize`, and `cellSize` is
`map.grid.cellSize` — a square-lattice multiplier that a hex map **does not declare**
(`hex.size` is its multiplier, RULE-006 as amended by WI-037). So the ruler on a hex map is
reporting a span in units of a lattice the map does not have, and `measureSpanText` then
multiplies that by `perSquare`. Relabelling the field would make a wrong number wear a right
unit. What a hex map's ruler should report is hex steps — `axialDistance`, which
`axial.ts` already has and whose own comment says in as many words that the `perSquare`
arithmetic does not apply to it.

And `GameMap.measure` would then carry a different default depending on the map's grid kind,
for existing hex maps as well as new ones. That is **DEC-093**, and it is where this stops.

#### IN-124 — remove the Eye tool from the hex palette

The Eye asks what an eye at a point can see, which is a question about **walls**. A hex crawl
has no walls and no carved floor — that is the stated reason every carve tool is excluded from
`HEX_TOOL_IDS` — so the Eye on a hex map can only ever answer "everything", and
`canRevealFromEye` can only ever be false because fog has no geometry to occlude.

**Simple.** One id leaves `HEX_TOOL_IDS`; `isHexTool` then makes `setHexMap`'s existing
fall-back-to-Pan rule cover a referee who enters a hex map holding it. The Eye itself, its
`TOOL_GROUPS` membership, its cursor, its testid and all of its square-map behaviour are
untouched, and no e2e spec exercises the Eye on a hex map. This narrows the palette SPEC-030
§5 describes, which WI-041 has already done once for the same RULE-006 reason; SPEC-047 §11
records the narrowing rather than leaving it to a code comment (RULE-018).

#### IN-125 — Road/River: one selector, not two

The request is that width alone be chosen and the shade follow from it — darker meaning
thicker — with the colour "defaulting from the selection".

**Deceptive on the stored side.** SPEC-047 §2 states that a hex line document carries *a kind
and an index*, deliberately, so that re-drawing the palette stays a catalog change rather than
a migration; §4 states shades and widths as two independent fixed sets. Deriving one from the
other means `HexLine.shade` either stops being independently meaningful or stops being stored
— and every line already drawn carries a shade chosen independently of its width. What happens
to those is the question, and it is a stored-field-meaning question (RULE-007).

**And one phrase needs a reading before anything can be specified.** "Color defaults from the
selection" has at least two: the shade follows the width the referee just picked (the
darker-is-thicker rule, with no colour control at all), or the road/river *kind* fixes the hue
family and only the width varies within it. These are different specs. Asked at the gate.

#### IN-126 — the river tool draws hard edges

`renderHexLines` draws a river as a Pixi stroke over the document's vertices with
`join: 'round'`, which rounds the **corner** at each vertex but leaves the run between two
vertices dead straight. A river drawn click-to-click therefore reads as a chain of segments,
which is what "hard edges" names.

**Deceptive.** Smoothing is not a stroke option; it is a decision that the drawn curve is no
longer the polyline the document stores. Every consumer that assumes "the line passes through
its points" — a future hit test, a future vertex edit, the `.vttcamp` round-trip test that
pins vertices exactly (WI-103) — is answering to that. It also contradicts SPEC-047 §4's own
table, which states the river's vertex treatment as "round" and puts join style on the
document precisely so it is not inferred from the tool. Whether the smoothing is a render-time
spline through the stored points (nothing stored changes) or a resampling at commit
(everything downstream does) is the conversation.

#### IN-127 — Road/River draw with no in-progress preview

Not a discovery: WI-105 recorded it as a **Deviation** in its own completion summary, and
SPEC-047 §4's work-item block says so — "§4 only specifies the gesture and the committed line,
not a live ghost … Shipped without one." The referee clicks vertices and sees nothing until
the double-click commits.

**Simple.** The points are already collected in `hexCollecting` as `HexPoint`s; the preview
draws what is already there, in the space it is already in, and commits nothing. It is a
transient render addition in the same family as the Wall tool's `buildWallPreviewSegs` the
Deviation named — no store method, no schema, no rule, no change to what any coordinate means.
Specified as SPEC-047 §12, and it is the one item in this batch that wants `opus`: it adds a
render pass to `vector-engine.ts`.

#### IN-128 — a hex-only tool stays armed after leaving the hex map

`setHexMap(true)` falls the active tool back to Pan when it holds a tool a hex map does not
offer. `setHexMap(false)` has no matching rule, and the five hex-only ids (`hexTerrain`,
`hexSymbol`, `road`, `river`, `hexLabel`) are deliberately **not** `TOOL_GROUPS` members — so
on a square map the palette can render no button as active while the canvas still has the
Terrain tool armed, with nowhere to click to get out of it.

**Simple.** The mirror of a rule that already exists, in the same method, using the
`isHexTool` predicate that is already there. `setBattleMap` and `setHexMap(true)` are both
precedents for the shape.

#### IN-129 — the Letter control runs off the quick sheet

`.token-color` is `display: flex` on one row holding the "Color" label, six swatches, the
custom-colour input **and** (since WI-117 added it) the Letter control. At the sheet's docked
width the last of those is pushed past the right edge.

**Simple.** A CSS change inside `CharacterDock.svelte`: the row becomes a column so the Letter
control sits below the swatches, where the request asks for it. `token-letter-control` and
`token-letter-input` keep their testids and their DOM position within the block, so RULE-005
is satisfied by not moving them rather than by updating a spec.

#### Item 5 — "the terrain picker and dropdown still show retired terrain types"

**Does not reproduce against `main`, and is answered rather than logged.** This is IN-115's
picker half, and **WI-121 closed it earlier the same day** (commit `7f2e85b`, 2026-09-11):
`paintable?: boolean` and `paintableHexTerrainCatalog()` landed in `catalog.ts`, the six
aliases (`grass`, `ice-floe`, `palm`, `plateau`, `scrub`, `tundra`) all carry
`paintable: false`, and **both** authoring surfaces now read through that one function —
`HexTilePanel.svelte`'s `TERRAINS` and `MapToolbar.svelte`'s `HEX_TERRAIN_KINDS`. The two
surfaces the request names are exactly the two that were fixed.

The likely explanation is a build predating that merge. Two things worth separating from it,
neither of which the report is wrong about:

- **Contents is a different catalog and is still unretired.** `danger`, `ruins` and `tower`
  remain pickable; that is IN-116, and **WI-123 is gated and waiting** to retire two of the
  three (DEC-091 answered (c) — `danger` stays until IN-117's replacement art exists). A
  referee looking at the hex Symbol tool would see exactly what this report describes.
- **The Symbol picker really does offer a value it should not** — `unknown`. Logged as
  IN-122 above.

Confirmed at the gate rather than assumed.

---

### Dispositions on the 2026-09-11 batch (same day)

**WI-124 – WI-128 cleared their gate** (user, 2026-09-11) and are scheduled as proposed.

**Both Open decisions were answered the same day, and each unblocked one Deceptive item.** A
Deceptive classification is not a verdict that an item is unwanted — it is a statement that the
one-line request hides a contract decision — so an answered decision returns the item to the
queue with the contract written down, which is what happened to all three below. None is
reclassified; each is scheduled *because* the thing that made it Deceptive now has an answer.

#### IN-118 → WI-130 — DEC-092 answered (b), exact hex

The bake is taken, the inscribed circle is not (a circle inscribed in a hex clears the corners,
which is the area the exercise is for). Four detractors were named in the decision and are
carried into SPEC-047 §13 rather than left as execution-time surprises. **One of them changes a
number this spec had already written down:** with a clip in place, `size * 1.8` stops being the
right box. `size` is the circumradius, so a corner sits at `1.0 * size` while an
`1.8 * size` box has a half-width of `0.9 * size` — it overflows the flats, which the clip
trims, but it leaves the east and west corner tips bare. 1.8× was WI-119's answer to "how much
fits with no clip"; §13 specifies **`size * 2.0`** and says why the older figure does not carry
over.

#### IN-123 → WI-131 — DEC-093 answered (a), **with a backfill**

The answer is (a) as recommended — one field, read against the map's grid kind — but the
backfill changes what the item costs. The recommendation said "no migration; a referee
re-enters 6 and miles once". Backfilling every existing hex map's `measure` is a data migration
whatever the field's shape does, so WI-131 is a RULE-007 item: schema bump, migration,
migration test, `.vttcamp` round-trip test. **That is a change to the item's own gate**, not a
detail of executing it, which is why it is written here and in DEC-093 rather than discovered
by the execution session.

The migration's guard is the part worth restating: it touches a hex map **only** where
`measure` is still exactly `{ perSquare: 10, unit: 'feet' }`. A referee who set 24 leagues
deliberately keeps it. A backfill that cannot tell "never touched" from "set to that value on
purpose" is the single case where yes-to-backfill costs the user something they chose.

It is now **SPEC-049**, not a SPEC-047 section: it changes how `RoomMeasure` is read on *every*
map and ships a migration, which is wider than hex-crawl authoring.

#### IN-125 → WI-129 — the ambiguity read, and the reading makes it Simple

"Colour defaults from the selection" resolved to: **no colour control at all; the shade is the
width** — thin river light blue, medium road medium brown, the kind still fixing the hue family.

That reading is what dissolves the Deceptive trigger, and it is worth being explicit about why,
because the triage note argued the opposite. The concern was that deriving shade from width
changes what a stored `HexLine.shade` means and strands every line already drawn with an
independently-chosen shade. Under this reading it does neither: `shade` stays a stored index
into the kind's three shades, with exactly §2's meaning, and only **what the tool commits**
changes. Lines drawn before this render identically afterwards. No migration, no schema change,
RULE-007 untouched — a UI simplification that does not become a data change.

The alternative reading — stop storing the shade and derive it at render time — *would* have
been the migration the triage note feared. It is not taken, and is not offered: it buys nothing
and costs a stored field.

#### Still unscheduled and unanswered

**IN-120** (a hex map's token snap still offers Cell/Half/Free) and **IN-126** (the river tool's
hard edges) remain Open. Neither was answered in this round and neither is blocked on the other.
IN-120 wants a coordinate-space decision — what a hex-snapped token position *is*, including
what a 2×2 token does on a hex grid, which the square map's size-aware snap has no answer for.
IN-126 wants a decision on whether smoothing is a render-time spline through the stored points
(nothing stored changes) or a resampling at commit (everything downstream does).


---

### Second round of answers, same day (2026-09-11)

Four responses, two of which amend decisions already answered. Recorded here because an
amendment that arrives an hour after an answer is still an amendment, and the first answer's
reasoning stays on the record rather than being quietly replaced.

**DEC-092 — 1.8×, not the 2.0× recommended.** The recommendation came from the arithmetic; the
answer comes from the reference material, which is the better authority on what reads well.
Nothing about mechanism (b) changes — the bake is still the clip, and the clip is still
load-bearing at 1.8× because the *box corners* sit at `1.27 * size`, far outside the hex. What
is accepted along with it is that the hex's east and west corner tips, at `1.0 * size`, stay
bare `color`. SPEC-047 §13 states that as a property rather than leaving it to be re-found.

**DEC-093 — the backfill is dropped**, which reverses the previous round's answer and takes the
migration with it. This is the second time this item's cost has moved, in both directions, so
the sequence is worth stating plainly: recommended without a migration → answered *with* a
backfill, which made it RULE-007 → amended back, which makes it a label, a default and an
arithmetic fix with no stored change at all. WI-131 drops from `opus` to `sonnet` accordingly.
The RULE-006 half never moved and is still the part of the item that is not optional: a hex
ruler must stop dividing world pixels by `grid.cellSize`.

#### IN-120 → WI-132 — DEC-094 answered (a)

"Just center on the hex, a 2x token will just overflow and that is fine." The overflow is the
whole reason this was Deceptive — the square map's snap is size-aware precisely so a 2×2 covers
whole cells, and a hex lattice has no point where four tiles meet for that rule to hang off.
Accepting the overflow **dissolves the problem rather than solving it**: one anchor, every size,
no parity cases, no construction to invent at 3×. It is written into SPEC-047 §15 as intended
behaviour so that a later playtest note reading "big tokens stick out of their hex" finds an
answer instead of filing a bug.

#### IN-126 → WI-133 — DEC-095 answered by the condition, not by a pick

The request was conditional: *"smoothing just should come at the end as one final pass unless
render time is vastly easier."* The condition fires. Render time is easier, and more to the
point it is safer: `HexLine.points` keeps the vertices the referee actually clicked, so nothing
migrates, every river already drawn improves, and a later vertex edit does not smooth an
already-smoothed line. A commit-time resample makes the stored run a derived artifact and
compounds on every edit — that is the failure mode the literal reading buys.

**And the literal reading's *intent* is kept, as a UI rule rather than a storage one.** §12's
in-progress preview draws the raw polyline — straight segments, exactly the clicks so far — and
the smoothing appears when the gesture commits. The referee still sees smoothing arrive at the
end.

Flagged at the gate as an agent reading of a conditional rather than an explicit choice, since
the mechanism chosen is not the one the wording suggests.

#### Nothing from this batch is Open, and every gate is cleared

All twelve requests are resolved: one answered without logging (the terrain picker, fixed by
WI-121 the same day), one folded into an existing id (IN-118), and ten logged as IN-119 – IN-129
with IN-122 found alongside. Every Deceptive item has an answer and a work item. Four decisions
were raised and four were answered.

**All ten work items — WI-124 – WI-133 — cleared their gate on 2026-09-11** (user, "approve
everything"). Five of the ten come from items that were Deceptive at triage and are scheduled
only because the contract each hid now has an answer written down, which is the classification
doing its job rather than being overridden.

**Worth carrying into execution: clearing ten gates at once is not permission to bundle.**
RULE-016 holds — one session, one work item — and several of these sit in the same files.
WI-126 (the Road/River preview) and WI-133 (the river's smoothing) both live in
`renderHexLines`; WI-129 touches the same toolbar WI-126 previews from; WI-124's palette edits
and WI-132's token-snap edits are adjacent but disjoint. Whichever of an overlapping pair runs
second reads the other's landed diff rather than the spec it was written against
(`CLAUDE.md`'s precedence: present-day code outranks the spec on present-day behaviour).

### Initiative-system alignment batch (2026-09-15)

An investigation of the initiative system as it stands — what `README.md` §§II.3/II.6 says it
does, against what `CombatTracker.svelte`, `packages/shared/src/encounter/` and
`firebase/firestore.rules` actually do — followed by the project owner's statement of the
intended behaviour in nine points. Four of the nine are already true in code and are not
logged (three modes; simultaneous seeded resolution; results shown to every client; the
referee's `acted` tracking), and a fifth — results carried into the tracker — is true only once
IN-130 is fixed. The four gaps below are logged.

**Nothing here is scheduled.** Two of the four are Deceptive, one is Unclear and waits on an
answer, and the Simple one carries an open design question of its own.

There is no `SPEC-nnn` for the encounter/initiative revamp: it arrived from the Master Plan
(R3.6, "the revamp §§1/4/6" as the code comments cite it) and is documented in `README.md`
§"Encounter board (II.3)" and §"Dice (II.6)". `SPEC-008` is Completed and defers to the README.
So the README is the contract these four are measured against, and any of them that lands will
update it in the same pull request (RULE-018).

#### IN-130 — a player cannot stage their own side's initiative

`initiativeSlotId()` keys a **side**-mode slot by bare `groupId`. `firestore.rules`'s
`sharedRoll/current/slots/{slotId}` allows a non-GM write only when
`slotId.split(':')[0] == request.auth.uid`, so a player pressing their card's die during a
side-mode Call for Initiative writes `slots/{groupId}` and is denied. `initiative-call.ts`'s
own doc comment says a player-owned group means "a human will stage the slot", so the code's
two halves disagree. Side is the **default** mode, which is what makes this the first of the
four.

No test catches it: `shared-roll.spec.ts`'s side-mode call is GM-only (both groups unowned, so
the referee's client stages everything), `combat-modes.spec.ts` covers individual and free, and
the rules tests cover bare-uid and `{uid}:{tokenId}` slots but not a group slot written by a
player.

**Deceptive.** Whichever way it is fixed, it changes a contract: either `firestore.rules`
(RULE-004 — rule changes ship rule tests) or the slot-id scheme itself, which the rules' prefix
check and `applySharedRollToInitiative`'s candidate list both read. The conversation to have
first is **which** — re-key a side slot to `{uid}:{groupId}` and leave the rule alone, or widen
the rule to admit a group slot and pay a `get()` or a looser check for it. The first keeps the
rule a pure string comparison; the second keeps one slot per side no matter who stages it.

#### IN-131 — no "initiative has been called" indicator, and the Caller is unreachable

Two halves of the same gap, which is why they are one item.

The only signal that a call is open is `combat-staging-note` inside `CombatTracker`, which
renders on the Encounter board alone. A player sitting on the Map view sees their die button
behave differently with no explanation. `TurnStrip` — the one component already on every stage,
in `SessionTab` and `MobileTopBar` — renders only once an order has a current entry and says
nothing about a call in progress.

The Caller is worse off: `Encounter.callerSeatId` is in the schema, `setCaller`/`rotateCaller`
write it, `caller-select`/`caller-rotate` exist — and all of it sits inside `CombatTracker`'s
`free` branch, which `EncounterBoard.svelte:965` never renders, because free mode renders no
tracker at all. The feature is intact in code and unreachable in the app. `README.md:1672`
still lists "free/caller (rotating Caller marker)" as a tracker mode, which is stale against
both the code and `combat-modes.spec.ts`; `types.ts:731`/`:760` and `CombatTracker.svelte:34`
still call free and `callerSeatId` "Phase 4". Those doc corrections ride whichever work item
lands this, under RULE-018, rather than being logged separately.

**Simple.** It renders `Encounter.callerSeatId` and the existing `sharedRoll` subscription in a
component that already receives `encounter`; no store method, no schema change, no migration,
no rule, no coordinate or layer meaning. It *adds* testids and moves none, so RULE-005 is
satisfied by not moving anything.

**The open question it carries.** The agent's recommendation (2026-09-15) is that the Caller
stop being free-mode-only and become room-scoped — rendered in `TurnStrip` in all three modes,
settable from the Encounter board in all three — on the grounds that a party spokesperson is
just as useful under side-based initiative, and that binding it to `mode === 'free'` is what
buried it the first time. That is a behaviour change the project owner has not ruled on. It is
not a Deceptive trigger (no spec states it; the README line stating it is already wrong), but
it should be settled at the gate, not in execution.

#### IN-132 — a player's own initiative slot is unreachable from the Dice tray

`SharedRollStaging.svelte:56` derives `mySlot` as `sharedRoll?.slots[myUid]` — the bare uid. A
Call for Initiative keys slots by `{uid}:{tokenId}` (individual) or `groupId` (side), so during
a call the Dice tray's staging panel shows a player nothing of their own staged die. Their only
route in is the card's die button on the Encounter board, via `rollOrStage`. The project
owner's "one clear workflow once initiative has been called — play has stopped until this is
resolved" is not met while the tray and the board disagree about where a player's initiative
lives.

**Deceptive.** Fixing it means the tray resolves "my slots" through the same keying the rules
enforce and `applySharedRollToInitiative` reads back — one player may legitimately hold several
slots during an individual-mode call, so `mySlot` becomes plural and the panel's shape changes
with it. That is the slot-id contract, not a display tweak. It also overlaps IN-130: if that
item re-keys side slots, this one reads the new scheme. **Sequence them** — IN-130 first.

#### IN-133 — the tracker shows id fragments when a thing has no name

`refLabel` falls back to `Side {refId.slice(0, 6)}` for a group with no name, and `tokenLabel`
to `Token {id.slice(0, 6)}` or `{basename} · {id fragment}` for a token with no `name`. The
project owner's "use what faces the players, not internal ids" is met for named groups and
post-SPEC-040 creatures and missed for everything else.

**Unclear — this wants an answer before it is classified.** The question is what an unnamed
group or token should read as instead, and the honest options differ in kind:

1. **A derived display name** — "Goblin A", the group's index, the token's letter (SPEC-048
   makes the letter stored data, so it is available). Nothing new is stored.
2. **Require a name** — a group or creature cannot exist unnamed; the promote-to-group flow and
   the creature picker both already ask for one.
3. **Leave the fallback and fix the sources** — the id fragment stays as the last resort it was
   designed to be, and the work is making sure nothing reaches it.

Option 1 brushes **SPEC-040 §5** and the annotation `WI-087` left on it: the fallback's current
shape was chosen deliberately, and §3's migration pointedly does **not** invent names, because
freezing a generated string into storage makes it permanent instead of merely displayed. A
derived *display* name does not store anything, so it is probably compatible — but "probably"
is why this is Unclear rather than Simple, and the answer decides whether it is Simple or
Deceptive.

#### Answers, same day (2026-09-15)

**IN-131 — the Caller is room-scoped.** One caller per room, held on the encounter doc's
existing `Encounter.callerSeatId`, visible to everyone and settable by the referee in **all
three** initiative modes — not one per group, and not free-mode-only. The recommendation is
taken; the classification stays **Simple** and the item stays unscheduled. `README.md:1672`'s
"free/caller (rotating Caller marker)" line and the "Phase 4" comments on `types.ts:731`/`:760`
and `CombatTracker.svelte:34` are corrected by whichever work item lands this, under RULE-018.

**IN-133 — reclassified Simple, and none of the three options is needed.** The answer offered
was "if only tokens created earlier are affected, consider it resolved". Checked against the
code, and it is not only legacy:

- **Groups are never unnamed, as the answer assumed.** `commitRename` returns early on a blank
  name (`if (!name || !isGM) return;`) and the Unassigned-bin promote is the only creation path,
  so no UI route produces one. An imported `.vttcamp` could carry one; nothing in the app does.
- **A seat's token is unnamed *by design*, today.** `CharacterDock` and `VectorMapView` both
  create a seat-owned token with no `Token.name`, exactly as SPEC-040 §3 requires — "a seat's
  name is the seat's `displayName`". But `refLabel(entry, groups, tokens)` never receives
  `players`, so it cannot read that `displayName`. Every player character's row in **individual
  mode** reads `Token 4f2a1c` or an image basename, on new rooms, now.
- **The letter never reaches the tracker.** `tokenLabel` reads `name` → `imageRef` basename →
  id fragment, and never `Token.letter`. The picker also still permits a blank name —
  `creatureBatchNames`: "an empty one yields no names at all, leaving `Token.name` absent" — so
  an unnamed creature is creatable today.

So the item becomes: a seat-owned row reads the seat's `displayName`, an unnamed creature reads
its stored `letter`, and the id fragment survives only when a token has neither. **Simple** —
it passes `players` into a label function and reads two fields that already exist. It stores
nothing and invents nothing, so SPEC-040 §3/§5 and WI-087's annotation are satisfied by
*obeying* them rather than by amending them, and the migration still does not backfill a name.

Still not scheduled: the classification is settled, the work item is not.

#### Dispositions — all four scheduled (2026-09-15)

Two decisions were raised and both were answered the same day, so the batch goes from triage to
schedule in one sitting. The four are specified as **SPEC-050**, which is the
encounter/initiative revamp's first spec: the revamp arrived from the Master Plan (R3.6) and has
lived in `README.md` §§II.3/II.6 ever since, with SPEC-008 Completed and deferring to it.
SPEC-050 does not restate the revamp — only the four things that were missing.

**DEC-096 — a side's slot is keyed `side:{groupId}` (answered (a), as recommended).** The
investigation's finding is that the obvious fix is unavailable: a bare `groupId` and a bare
`uid` are indistinguishable opaque strings to a Security Rule, so admitting group slots by
loosening the predicate would also let player A write player B's slot — the one boundary the
rule enforces, pinned by an existing rule test. Distinguishing them needs a `get()` on the
group doc, a billed read on every slot write, which is exactly what the rule's comment says the
prefix check exists to avoid. So the **shape** of the id changes. `side` becomes a reserved
prefix, the rule gains one pure-string clause beside the uid one, and a side keeps **exactly
one** slot — which the alternative (`{uid}:{groupId}`) would have broken, producing two slots
for one row whenever a side holds two player-owned tokens. → **WI-134**, `opus`, for the
Security Rules work.

**DEC-097 — a staging call blocks every other die control (answered (b), against the agent's
recommendation).** The agent advised (a), keep rolling normally, because (b) catches the
referee's own mid-call adjudication. The user chose (b) as the literal reading of their own
"play has stopped until this is resolved", knowing that cost, and the referee is **not** exempt.

**That answer forces a Cancel, and it is in scope rather than optional.** `SharedRollStatus` is
`'staging' | 'resolved'` — there is no cancel — and `combat-roll-initiative` is disabled at zero
ready slots, so under (b) a call opened by mistake with nobody staged would disable every die in
the room with no way out. The referee-only Cancel sets the staging doc `resolved` without
writing a `Roll` and without touching the tracker, so no status value is added and nothing is
migrated. Logged as an agent default under Default-and-notify and surfaced at the gate. →
**WI-136**, blocked on WI-134, which it reads the slot keying from.

**IN-131 → WI-135** and **IN-133 → WI-137** needed no decision beyond the answers already
recorded above.

#### All four gates cleared (2026-09-15)

**WI-134 – WI-137 are approved** (user, "all are approved"). Nothing in this batch is Open: two
Deceptive items have their answers written down (DEC-096, DEC-097) and are scheduled because of
it, which is the classification doing its job rather than being overridden, and the two Simple
items were answered the same day.

The rows above move to §1.2 as each work item lands, one at a time, in the pull request that
closes it — never renumbered, never deleted (RULE-019).

#### What this batch deliberately does not log

Three further findings from the same investigation, left unlogged pending a decision by the
project owner:

- **A Firestore write per keystroke.** `combat-init-input-*` fires `oninput` →
  `setInitValue` → `writeEncounter`, so typing "12" is two full encounter-doc writes. Not a
  RULE-003 breach at tabletop scale — nobody types many times a second — but it is the pattern
  the rule exists to prevent, and `onchange` is the settled-write shape.
- **`removeRefFromEncounter` filters on `refId` alone**, while `setInit`, `toggleActed` and
  `addRefToEncounter` all discriminate on `refType` too — the same double-write hazard those
  three were hardened against.
- **`callForInitiative` and `actors` read the configured `initiativeMode`** while reconciliation
  and `expectedActiveIds` read `selectedMode` (`encounter?.mode ?? initiativeMode`). Change the
  setting mid-fight without re-calling and the "X of N ready" note counts actors in the new mode
  against an order built in the old one.

### Icon audit batch (2026-09-18)

Arrived as a design request, the same way the 2026-08-28 revamp did: "looking specifically at
UI element icons, any opportunities for discoverability and consistency by improving our
existing icons?", asked of both desktop and mobile, with a comparison page of the old set, the
missing slots and a redraw requested as the deliverable. The audit is
`docs/mockups/icon-audit-2026-09-18.html` — every "old" glyph on it is rendered straight from
the live `MARKUP` record, so it cannot drift from the code it describes — and is published at
`https://claude.ai/artifact/XYv6tg4C4TGEVnu3tvoVLP`. Six findings, logged below as IN-134 –
IN-139 in the audit's own order of impact.

The batch's through-line: **SPEC-043 governs the icon set, and about forty controls are not in
it.** They draw their icon by typing a Unicode character into a `<button>`, where no spec
reaches them and no rule can be violated — the same shape of gap SPEC-043 itself was written to
close for the subject rule, one layer out. Three of the six findings are consequences of that;
the other three are ordinary drift inside the set.

#### IN-134 — Roughly forty controls type a Unicode character instead of using the record

**Request.** Across seventeen components — `QuickSheetCard`, `Dialog`, `ShellOverlay`,
`MapsPanel`, `RoomsPanel`, `BackgroundsPanel`, `AssetsActivity`, `HandoutPanel`, `MacroList`,
`RollSheet`, `ProfileTemplateEditor`, `SessionActivity`, `CombatTracker`, `TensionBar`,
`CharacterDock`, `MarkdownEditor`, `MobileTopBar` and `SessionTab`'s referee marker — the
close, expand, collapse, confirm, rename, undo, redo, reorder, pin, lock, unlock, step,
navigate, increment, decrement and roll affordances are literal characters in the markup:
`✕ × ⤢ ⤦ ✎ ✓ ↶ ↷ ⋮⋮ ▲ ▼ ◀ ▶ ↑ ↓ 📌 🔒 🔓 🎲 ⏺ ♦ ⟨ ⟩ • ¶ − +`. Replace each with a
record glyph.

Four distinct failures, not a style preference: the same control is a different shape on every
OS; six are emoji-presentation code points (`📌 🔒 🔓 🎲 ◀ ▶`) and render as colour emoji on
iOS, against the record's own "no emoji in UI chrome" comment; three (`⤢ ⤦ ⋮⋮`) have no glyph
in common system fonts and fall back to a notdef box; and none is drawn at 1.75 stroke, so a
typed cross beside a drawn icon is visibly the wrong weight.

**Classification.** **Simple.** It redefines nothing on the trigger list. No
`CampaignStore`/`AssetStore` method or guarantee; no `GameMap`/`Room`/`PlayerSeat` field; no
`firestore.rules`/`database.rules.json`; no coordinate space, layer order or carve-pipeline
stage; no auth or join path; no change to which store a write goes to. **No `data-testid` is
moved, renamed or removed** — every affected control keeps the testid it has and what changes
is the content inside it, and the e2e suite selects all of them by testid: its only
text-matching selectors (`rooms-manager`, `encounter-board-v2`, `hex-map`, `group-ownership`,
`helpers`) match user-authored room and group names and the "Hex" map badge, never a glyph or a
toolbar verb. The `IconId` union grows, which is additive — no consumer's type narrows, the
same reasoning IN-074 used when it kept the union fixed.

**The one thing that makes it more than a swap**, and why it is not classified Investigation:
several of these buttons have no `title` and no `aria-label`, so their accessible name *is* the
typed character — `TensionBar`'s two step buttons, `ProfileTemplateEditor`'s two move buttons
and `CharacterDock`'s two counter buttons at least. Replacing the character with an
`aria-hidden` SVG would leave them nameless, which is a regression rather than a partial
delivery. SPEC-043 §5 already forbids it; SPEC-051 §3 makes it work.

**Disposition.** The glyphs are WI-139 (they are record entries like any other); the swap and
the accessible-name audit are WI-140. Specified as SPEC-051 §§1, 3, 5.

#### IN-135 — The mobile quick-sheet chips are icon-only at 16px with a hover-only name

**Request.** On a phone the six quick sheets are a row of 16px glyphs in 44px chips whose only
name is a `title` attribute, and touch has no hover. A new player is shown six unlabelled marks
and can learn them only by tapping each. Give the chips a word.

The answer is one row away in the product: `MainViewTabs` renders icon *and* label in both its
variants, and the desktop rail has `ActivityDrawer` for exactly this reason — README: the
drawer carries icon and label "since being readable is the point". The chip rail is the only
icon-only navigation surface in the app with no hover, no drawer and no label.

**Classification.** **Simple.** One `<span>` inside an existing button in `QuickSheetRail`'s
`chips` variant. The `quick-sheet-toggle-*` testids are untouched, and `mobile.spec.ts` selects
them by testid alone with no text or geometry assertion. No trigger is redefined, and no spec
states the chips are icon-only — SPEC-043 §5 names the chip's 2px underline as chrome it does
not govern, which scopes that spec rather than fixing the chip.

**The cost to measure rather than assume:** the rail grows roughly 10px against the
bottom-pinned chrome SPEC-033 §§1–3 works to keep on screen. Recorded in DEC-099 with its
fallback (the word at 9px, glyph staying 16px).

**Disposition.** WI-141. Specified as SPEC-051 §4; the choice of affordance is DEC-099.

#### IN-136 — Road, River and Terrain wear another tool's glyph

**Request.** In `MapToolbar`'s hex-only row, `road` and `river` both render `path`, and
`hexTerrain` renders `shapes` — the **Shapes group** icon, so a tool wears a group glyph, which
SPEC-043 §3 keeps apart deliberately ("a group icon names the gesture, a tool icon follows
§2"). Draw the three, and a fourth for the "new hex map" button in `MapsPanel`, which is
text-only beside "new map".

**Classification.** **Simple.** Four additive `MARKUP` entries and four `icon:` field values in
`MapToolbar`'s `HEX_TOOL_META` and `MapsPanel`. No tool id, no group membership, no cursor, no
coordinate space, no testid — `hex-tool-road`, `hex-tool-river`, `hex-tool-terrain` and
`maps-add-hex` all keep theirs.

**Disposition.** WI-139. Specified as SPEC-051 §5.

#### IN-137 — Four silhouettes collide at 16px, and two more are drawn wrong

**Request.** Six redraws, listed with their failures in SPEC-051 §6: `encounter` is an X and
sits in the same bar as the close glyph; `session` is a sun or an asterisk at the 14px the
mobile top bar renders it at; `room` is a door with a knob and the palette has a `door`;
`corridor` reads as a return arrow; `ngon` is a regular hexagon, the same silhouette as the
`dice` d20; and `polygon` is a regular pentagon for a tool that produces irregular shapes.

The last two are the pair worth naming: **`ngon` and `polygon` are drawn the wrong way round
relative to each other.** N-gon is the regular one and Polygon is the irregular one, and the
glyphs say the opposite.

**Classification.** **Simple**, on exactly the reasoning IN-074 was classified Simple: what
changes is the path data inside one fixed record. Same ids in, same ids out for these six; no
chrome, no schema, no rules, no testids. Conformant to SPEC-043 §2 rather than a change to it —
each redraw is the same subject rule applied better.

**Disposition.** WI-139. Specified as SPEC-051 §6.

#### IN-138 — Six render sizes for one stroke weight

**Request.** Thirteen call sites pass `Icon.svelte` six different `size` values — 14, 15, 16,
18, 19, 20 — and the prop's own default of 20 is used by nobody. At 14 the 1.75 stroke is about
one device pixel and the session gear's teeth close up, which is the mechanical reason that
glyph reads as an asterisk on a phone. Settle on a small number of stops.

**Classification.** **Simple.** Presentational: two new tokens in `theme/sizing.css` beside the
existing `--hit`, a changed default on one prop, and thirteen call sites dropping or changing a
number. No trigger is redefined. It follows the split `sizing.css` already makes — pointer
coarseness, never screen width (SPEC-033 §7, DEC-052) — rather than inventing a second rule.

**Disposition.** WI-139. Specified as SPEC-051 §2; the stops are DEC-098.

#### IN-139 — The map toolbar's actions are words only

**Request.** Undo, Redo, Edit/View, Reveal all, Reset fog, Rotate 90°, Flip 180°, Download PNG,
Export/Import `.vttcamp` and "+ Add creature" are text buttons with no glyph. In the docked
desktop palette that is fine; in the phone's Map tools sheet each takes a full row. Give them
glyphs so the pairs can share a row and the Edit/View latch has a state visible from across the
sheet.

**Classification.** **Simple.** Additive record entries plus an `<Icon>` beside an existing
label. **No button becomes icon-only** — a labelled button that gains a glyph keeps its label,
stated in SPEC-051 §7 so a later reading cannot take this as licence to strip the words. No
testid moves.

**Disposition.** Glyphs in WI-139, application in WI-141. Specified as SPEC-051 §§5, 7.

### Project introspective — development process (2026-09-18)

Arrived as the fourth lens of a whole-project review at commit `d176331`
(`docs/INTROSPECTIVE-2026-09-18.md` §4), asked as "how is the process itself working?". The
review carries its own stable ids — `INT-PR-01` … `INT-PR-10` — and this batch logs one
intake item per finding, in the review's order. Its §§1–3 (user experience, architecture,
next steps) are **not** triaged here: this session is one batch (RULE-016), and those rows
are a later one.

The batch's through-line: **the chain produces an auditable record and pays for it four
times.** Three items are about that duplication (IN-140, IN-141, IN-148), three about a
session that cannot verify its own work or waits half an hour to find out (IN-143, IN-144,
IN-149), and four about rules and defaults that were right when they were written and are
now the friction (IN-142, IN-145, IN-146, IN-147). The last four are Shape A — each one
either amends a `RULE-` or reverses an entry that already exists — so each carried a blocking
decision, and all four were answered at the same gate (DEC-100 – DEC-103, user, 2026-09-18).
The two that amend a rule still land as standalone `RULE-AMENDMENT:` changes (RULE-017).

#### IN-140 — A closed work item's summary is written four times

**Request.** `INT-PR-01`. A closed item's summary exists as the record in
`docs/completed/WI-nnn.md`, as a "**WI-nnn has now run and closed**" paragraph in `PLAN.md`
§2, as a row in `PLAN-COMPLETED.md` §3, and as a prose cell in `INTAKE.md` §1.2 — before the
commit message and the README delta. `PLAN.md` is 1,142 lines with three items queued;
`INTAKE.md`'s two index tables are ~105 KB before the per-item prose. `/work-item` reads
both. Adopt one rule — a fact has one home — and apply it retroactively in one mechanical
pass.

**Classification.** **Simple.** Documentation only, and it redefines nothing on the trigger
list: no store method or guarantee, no schema field, no rules file, no coordinate space or
layer order, no auth or join path, no `data-testid`, and no existing spec's stated behaviour
— SPEC-035 §1 already calls `PLAN.md` "in place (small)", so restoring that is conformance,
not amendment. **RULE-019 is untouched**: no id is deleted, renumbered or reused; what goes
is prose that restates a record the index already points at, and DEC-107 enumerates exactly
what may go and what may not.

**Disposition.** WI-144. Specified as SPEC-052 §§1–2; the deletion bounds are DEC-107.

#### IN-141 — Rationale is restated at four altitudes

**Request.** `INT-PR-02`. The README paragraph restates the decision, the decision restates
the spec, the work item restates all three, and the code comment restates the work item —
`HEX_TOOL_IDS`' 60-line doc comment in `tool-groups.ts` is the type case. Rationale is
valuable exactly once. Write the split down as a house rule and stop paying for it four
times.

**Classification.** **Simple.** A style budget in a new spec section; it changes no
document's structure, no id and no existing spec's stated behaviour, and it is explicitly
forward-only — trimming a passage is not licensed by a work item that happens to open the
file (RULE-015 unchanged). The one retrospective pass is this item's own work item and is
prose only.

**Disposition.** WI-146, behind WI-144 — deduplicating first means the style pass reads
half as much. Specified as SPEC-052 §3.

#### IN-142 — Simple items have no batch lane

**Request.** `INT-PR-03`. WI-127 (22 lines of CSS) and WI-128 (no code change at all) each
consumed a planning session, an execution session, a `docs/completed/` file, a `PLAN.md`
entry, an `INTAKE.md` row move, a README touch, a pull request and ~30 minutes of CI. A
ten-item playtest batch is twenty sessions. Give RULE-016 a second lane: one session may
execute all Simple items in one approved batch, as one pull request with one combined
summary.

**Classification.** **Complex (Shape A)** — rule-blocked, on the same footing as IN-065.
RULE-016 says one session, one work item; the request cannot be scheduled as written without
amending it, and RULE-017 puts the amendment in its own change, its own commit and its own
approval. No classification below Shape A applies to a request whose deliverable is a rule.

**Disposition.** WI-148, a standalone `RULE-AMENDMENT:` change (RULE-017). **DEC-100 answered
(b)** (user, 2026-09-18): the batch lane, without the trivial lane — the `docs/completed/` file
stays per item, being the one artefact SPEC-052 §1 makes a fact's single home.

#### IN-143 — CI is 28–35 minutes per pull request

**Request.** `INT-PR-04`. Measured over the last eight runs: 28, 33, 33, 34, 35, 35, 27, 33
minutes. The cause is `playwright.config.ts` — `workers: 1`, `fullyParallel: false`,
`retries: 2` on CI — running ~100 emulator-backed flows serially, plus three jobs that each
pay their own `pnpm install`. Shard the suite, merge the static jobs, drop a retry.

**Classification.** **Simple.** Workflow and test-runner configuration. It redefines no
contract on the trigger list and **no `data-testid` moves** (RULE-005); the same specs run in
the same two projects, and the spec makes "nothing skipped, quarantined or `fixme`'d to make
a shard green" normative so a later reading cannot take sharding as licence to trim the
suite. The one thing it does change is the concurrency a test runs under, which is why
DEC-105 chooses shard-per-job — the schedule changes, the isolation story does not.

**Disposition.** WI-143. Specified as SPEC-053 §2; the parallelism shape is DEC-105.

#### IN-144 — The emulator battery never runs in a session

**Request.** `INT-PR-05`. Every recent completion record says "the emulator battery could not
run locally (no `firebase` CLI in the sandbox)", so the rules, store and e2e suites are first
exercised by CI — after the session that wrote them has ended, which is the most expensive
failure mode the project has. `firebase-tools` is already a `devDependency` and Java is in
the image; the missing step is `pnpm install` plus the emulator jars.

**Classification.** **Simple.** Harness configuration and a shell script; no application
code, no test changes, nothing in `apps/` or `packages/`. It adds a hook, which `CLAUDE.md`
gates on a work item plus a `DECISIONS.md` entry — DEC-106 is that entry, and it reads the
count per event (three `PreToolUse` guards, one `SessionStart` bootstrap) rather than
quietly making it four of the same thing.

**Disposition.** WI-142, first in the batch: it is what makes every item behind it cheaper to
verify. Specified as SPEC-053 §1; the hook's admission is DEC-106.

#### IN-145 — The `PLAN.md` freshness hook churns a tracked file

**Request.** `INT-PR-06`. `remind-plan-status.sh` denies any build, e2e, emulator or subagent
call unless `PLAN.md` was touched in the last 15 minutes. Its purpose — surviving a
compaction mid-operation — is now largely served by the harness's own summarisation, and its
cost is `PLAN.md` churn in every pull request plus "WI-nnn step X of Y" edits that are
cleaned up before merge. Move the state off a tracked file, or drop the hook.

**Classification.** **Complex (Shape A)** — a reversal. DEC-029 was approved by the user
directly (2026-08-02, out of IN-020) and DEC-016 was already superseded once to admit the
hook. Prior discussion is input, not approval: the entry is named and reconsidered in a new
one, never overwritten.

**Disposition.** WI-150. **DEC-102 answered (b)** (user, 2026-09-18): relocate the state to a
gitignored `.claude/status.local` — the guard, its trigger surface and its 15-minute window all
stay, and the `PreToolUse` count stays at three. Stated as SPEC-053 §3: the guard set is what
`CLAUDE.md` enumerates, and no guard exists that it does not name.

#### IN-146 — Every planning turn runs on `opus`

**Request.** `INT-PR-07`. Model routing is honoured on execution, but `/work-item` is `opus`
by rule and is also the session with the largest reading list. Shape B triage is
pattern-matching a request against a fixed trigger list; reserve `opus` for Shape A and for
gates that touch a `RULE-`.

**Classification.** **Complex (Shape A)** — it changes the stated behaviour of an existing
spec. SPEC-035 §4 reserves `opus` for "schema, migration, render-pass, auth and
security-rules work **and for planning turns**", and that clause is binding, not advisory.
Classified conservatively for exactly the reason the trigger list names specs at all: the
cheaper reading — "it is only a model target" — is the one that would let a rule be relaxed
without anyone deciding to relax it.

**Disposition.** WI-151, behind WI-144. **DEC-103 answered (b)** (user, 2026-09-18): `opus` for
Shape A, for any gate touching a `RULE-`, and for a decision the user will answer; `sonnet` for
Shape B triage and for scheduling already-classified items. Ordered behind the dedupe pass
because the saving is model weight × context and the two halve different factors.

#### IN-147 — An executor may not fix a one-line defect in a file already open

**Request.** `INT-PR-08`. RULE-015 admits one exception — a change genuinely required to
unblock the current item — so a real defect noticed in a file the work item is already
editing has to become its own intake item, its own gate and its own session. WI-128 spent a
full work item to establish that a reported defect had already been fixed. Bound a
**Deviations budget** instead: ≤ 20 lines, in a file the item already changes, covered by a
test, recorded under Deviations.

**Classification.** **Complex (Shape A)** — rule-blocked. RULE-015 is the rule the whole
chain rests on; nothing below Shape A may propose loosening it, and RULE-017 makes the
amendment a standalone change with its own approval.

**Disposition.** WI-149, a standalone `RULE-AMENDMENT:` change (RULE-017). **DEC-101 answered
(b)** (user, 2026-09-18) with all three conditions binding, not any two — the file bound keeps
the diff reviewable, the line bound keeps it a fix, the test bound makes it auditable by
something other than trust.

#### IN-148 — An index disagreeing with its entry is a recurring work item

**Request.** `INT-PR-09`. IN-044, IN-045 and IN-046 are three instances of the same class:
an index row that disagrees with the file it points at. Each cost a work item. Assert it
instead — every `SPEC-`, `DEC-`, `WI-` id in an index has a file and a matching status, and
every `IN-` appears in exactly one of §1.1/§1.2.

**Classification.** **Simple.** A new `scripts/` check and a line in `pnpm verify`; it reads
documents and exits non-zero, touching no application code and no test. It asserts structure
only — SPEC-052 §3's prose budgets are for a human reader and are explicitly not
machine-enforced, so the lint cannot start failing a pull request over a sentence.

**Disposition.** WI-145, behind WI-144 — the lint should first pass against the shape the
dedupe pass leaves, not against the one it is about to remove. Specified as SPEC-052 §4.

#### IN-149 — There is no release mechanism

**Request.** `INT-PR-10`. No tag workflow, no published artefact, and no version a user can
quote in a bug report. SPEC-042 §4 left both questions (3: how the release is produced; 5:
versioning) to findings, and the findings were logged as IN-070 and IN-073 and never
scheduled.

**Classification.** **Simple**, and it **closes IN-070 and IN-073**, which are triaged with
it here rather than left "awaiting triage" behind an item that answers them. A release
workflow, a `VITE_APP_VERSION` define and one render site: no store method, no schema, no
rules, no join path, no testid. It touches the hosted deploy pipeline not at all, which
SPEC-042 §4.3 makes a constraint rather than a preference. `VTTCAMP_FORMAT_VERSION` is a
separate number with a separate job (RULE-014) and is not touched; the newer-than-this-build
archive question stays IN-072's.

**Disposition.** WI-147. Specified as SPEC-042 §5 (new); the identifier is DEC-104.

### CI findings logged directly to §1.1, without a batch (2026-09-19)

Both surfaced from a running CI job rather than a triage session, and were logged straight
into §1.1's index with their disposition in the row itself. This section exists only so
each has the cross-reference SPEC-052 §1 expects; the row is still the full record.

#### IN-150 — `session-config.spec.ts` Gate 6 flake on CI (PR #193)

**Request.** Surfaced on CI, not a user ask. Gate 6's first test ("every Session setting
round-trips and syncs to a second client") opens a third tab (`gm2`) in the GM's browser
context, `goto`s straight to the room URL, and asserts `room-name`. `RoomShell.svelte`
renders "Loading room…" while `room === null` — before `onMount`'s `await
store.ensureAuth()` resolves and `subscribeRoom`'s first snapshot lands. Both known
occurrences (PR #193) timed out stuck there. Surfaced by WI-143's `retries` 2→1
(SPEC-053 §2.3) — a pre-existing sensitivity that used to get a second retry to paper over
it, not something WI-143's own change touches. Both failures happened while
`test-e2e (3)`'s sharding was silently broken (see `PLAN.md`'s WI-143 note), running the
full 100-test suite — one ordinary shot at this test each time, same odds as pre-WI-143
CI, not evidence that CI-shard load specifically reproduces it. Reopened 2026-09-23 after
tripping an unrelated PR (`osr-vtt#207`, WI-173) on an ordinary re-run.

**Classification.** **Investigation**, replacing the conservative Deceptive placeholder
first logged. Nothing here is known to redefine a contract yet: the candidate causes span
a pure test-timeout tightening (Simple), CI-emulator latency with no code fix available at
all (nothing to schedule), and a genuine multi-tab auth-restore race worth hardening in
`ensureAuth()`/`RoomShell` (plausibly Deceptive — touches listener-readiness timing
RULE-001's contract suite would need to cover). Picking one without reading the actual
gating chain (`ensureAuth`'s `authStateReady()` wait, `RoomShell`'s subscription order in
`onMount`, whether the two known failures share anything reproducible) is a guess, not a
diagnosis. The investigation reads that chain and produces a finding — named cause plus a
recommended fix, classified on its own terms as a new intake item — rather than a patch.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-197.
**Closed 2026-09-23** — findings delivered in `docs/completed/WI-197.md`, findings only,
no code changes. One finding logged as IN-208 below.

### Findings from the IN-150 CI-flake investigation (WI-197)

Reported, not fixed (RULE-015). The full reasoning is in `docs/completed/WI-197.md`; this
is the one item it raises.

#### IN-208 — `session-config.spec.ts`'s `gm2` `room-name` assertions use the global 8s timeout

**Finding.** Tracing `IndexedDBLocalPersistence` (`@firebase/auth@1.13.3`) shows the
initial auth restore `ensureAuth()` waits on is a single un-polled `IndexedDB` read with
no cross-tab wait and no network call — nothing in the SDK's own restore path explains a
multi-second stall for a second, same-context tab, which rules out the "genuine multi-tab
auth-restore race" candidate IN-150's classification named. What both known occurrences
are consistent with instead: `RoomShell`'s `ensureAuth()` → `subscribeRoom` → first
snapshot chain runs three uninstrumented, un-timed-out steps serially inside a fixed 8s
`expect` budget (`playwright.config.ts:66`), on a CI runner also carrying the Vite dev
server and three Firebase emulators — and WI-143's `retries` 2→1 removed the safety
margin that used to paper over an occasional slow tick. `signInAsReferee` already budgets
15s for the equivalent first-restore moment on the GM's own tab (`helpers.ts:597,601`);
`gm2`'s two `room-name` assertions (`session-config.spec.ts:61,144`) do not.

**Classification note.** A test-only timeout number — no production code, no testid, no
contract touched.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-198.

**Disposition.** Awaiting triage.

#### IN-151 — `INTAKE.md` §1.2's "Closed via" cells are prose, not one line

WI-144's remainder: DEC-107 scoped the retroactive one-home-per-fact pass to `PLAN.md` only
(Deviations, `docs/completed/WI-144.md`), leaving §1.2's ~120 "Closed via" cells as the
multi-sentence prose SPEC-052 §1 says should be a one-line pointer. **Open**, awaiting
triage.

### Project introspective — user experience, architecture, next steps (2026-09-23)

The remaining three lenses of `docs/INTROSPECTIVE-2026-09-18.md` (§§1–3), the "later triage"
IN-140's batch deferred. One intake item per finding, in the review's order, with its
`INT-` id cited. Three findings are pointers to others and are folded rather than logged
twice: **INT-NX-04** (into IN-166/IN-167), **INT-NX-11** (into IN-152) and **INT-AR-12**
(into IN-176). **INT-AR-08** rides with INT-AR-07 (IN-179), as the review asks. Two findings
are split where their halves classify differently: **INT-UX-04** (IN-155/IN-156) and
**INT-UX-16** (IN-168/IN-169); **INT-AR-02** and **INT-NX-12** are split as the review's
seed table splits them. The first `TokenLayer` extraction the review proposes is **already
IN-113** and is not re-logged.

Classifications were reviewed one item at a time and **approved as proposed** (user, 2026-09-23), except IN-185, IN-188 and IN-189, which the user **postponed** at classification. Seven items are Shape A because each reverses an
existing entry or touches a rule's wording: IN-156, IN-162 (DEC-097), IN-165 (Postponed:
room password), IN-174 (RULE-001), IN-175 (Postponed: full-viewport-diff), IN-185
(Postponed: auto-reveal fog), IN-187 (Postponed: in-app image uploads).

#### IN-152 — A first-time referee lands on a blank grid with no empty-state cue; the empty board likewise

**Request.** `INT-UX-01 (+ INT-NX-11)`. No first-run tour, no empty-state copy on a blank map or an empty Encounter board, and the `?` sheet is not advertised. Wanted: a dismissable empty-map hint card ("Draw with Map tools · Add a background in Assets · Invite players") shown until the map has floor or a background, an empty-board hint, and a "Show me around" entry in the `?` sheet. INT-NX-11 (a demo room) is folded in here as a note only: a sample room built from the bundled `.dd2vtt` fixture needs an importer that does not exist (IN-186).

**Classification.** Presentation only: new copy and new `data-testid`s (adding is not a trigger), the dismissal persisted in per-viewer `ShellState`, which is not a stored schema. No store method, no schema field, no testid moved. The sample room is **not** in scope — it waits on IN-186.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-152.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-152.md`.

#### IN-153 — A referee who creates a room is then asked to join it

**Request.** `INT-UX-02`. `createRoom` (`Lobby.svelte:219`) navigates, and the referee meets the same Display name / Join room gate a player does. The local build already auto-seats (`RoomShell.svelte:280`, `joinRoom(roomId, 'Referee')`); the hosted build should seat the creator too, with a name taken from the account or asked on the create form.

**Classification.** Calls the existing `joinRoom`, exactly as the local build already does; `joinRoom`'s contract is unchanged. The **player** join path is untouched and gains no prompt (RULE-011), and room creation's sign-in requirement (SPEC-025 §1) is unchanged. No testid moves — the gate's testids still exist for players.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-153.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-153.md`.

#### IN-154 — Icon-only rail; two of three main views are behind a hover drawer

**Request.** `INT-UX-03`. The rail shows only the current view's icon; the other two sit behind a hover-only `ActivityDrawer`, and the six sheet toggles carry only a `title` tooltip — none on touch. Cheapest first: show all three view icons in the rail; reveal labels beside icons on first visit; a persistent "labels on" toggle in `ShellState`.

**Classification.** Layout and copy inside the shell; every existing `data-testid` stays on its control (RULE-005) — the condition this classification rests on. A plan that must move a testid is re-triaged as Deceptive.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-154.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-154.md`.

#### IN-155 — Clicking a disabled drawing tool under View does nothing and says nothing

**Request.** `INT-UX-04 (hint half)`. Under the View lock the palette renders every drawing tool disabled; a first-time referee who clicks one gets no response. Show a one-line "Switch to Edit to draw" hint pointing at `map-mode-toggle`.

**Classification.** Adds a hint and a testid; the lock's semantics, its default and `isViewTool` are unchanged.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-155.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-155.md`.

#### IN-156 — Persist the Edit/View choice per room instead of resetting to View every session

**Request.** `INT-UX-04 (persistence half)`. Every referee flips the lock every session. Remember the choice per room in `ShellState`.

**Classification.** **Shape A — a reversal.** README states "Defaults to `'view'`: every freshly joined session lands with the palette locked", itself a deliberate reversal of WI-053's `'edit'` default (IN-031, DEC-064). Remembering Edit across sessions undoes that sentence for every returning referee. Prior discussion is input, not approval: this needs a decision entry naming what it reverses.

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-189 (SPEC-057).

#### IN-157 — Map configuration lives on three surfaces

**Request.** `INT-UX-05`. A referee configuring one map visits Assets (maps, backgrounds, colour), the Session settings modal (grid, cell size, half-grid, measurement, fog on/off) and the Map tools sheet (snap, simplify, export). Grid and fog are per-map properties shown under a session-wide modal. Find the one home.

**Classification.** **Investigation.** Produces a placement proposal, not edits. The consolidation it will propose moves testids a spec depends on (RULE-005), so each resulting move is its own **Deceptive** intake item (DEC-027).

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-173.
**Closed 2026-09-23** — plan delivered in `docs/completed/WI-173.md`, findings only, no
code changes. Two findings logged as IN-206, IN-207 below.

### Findings from the IN-157 map-configuration investigation (WI-173)

Reported, not fixed (RULE-015). The full reasoning is in `docs/completed/WI-173.md`;
these are the two items it raises.

#### IN-206 — Fold Grid & measurement and Fog of war out of Session settings into the Assets activity

**Finding.** `grid`, `gridSettings`, `measure` and `fog` are all `GameMap` fields — GM-set,
synced, per-map — yet their controls sit in the session-wide Session settings modal
(`SessionActivity.svelte`'s `session-grid`/`session-fog` sections), while `MapsPanel` and
`BackgroundsPanel` already moved the same kind of per-map concern into the Assets
activity, on record as doing so for exactly this reason (`AssetsActivity.svelte:31-34`,
`BackgroundsPanel.svelte:18-24`). Fog's own comment (`SessionActivity.svelte:616-618`)
already frames it as "a per-map session setting, not a drawing tool" — the same axis, one
surface behind. The proposal: a new panel in Assets, between `MapsPanel` and
`BackgroundsPanel`, carrying both sections unchanged in content. No store or schema
change — `setMapGridDimensions`/`setMapGridSubdivide`/`setMapMeasurement`/
`setMapFogEnabled` are already map-scoped `CampaignStore` calls. Map tools sheet
(snap/simplify/export) is untouched: those are `MapToolController` `$state`, never
persisted to `GameMap`, a different category from what IN-157 asked about.

**Classification note.** Moves `session-grid-w/h/cellsize/apply` and the `session-grid`
section id, which `session-config.spec.ts` (grid-set assertions, Gate 13 section-nav
list) and `backgrounds.spec.ts` (`setSmallGrid` helper) both read directly — RULE-005.
`grid-subdivide-toggle`, `measure-per-square/unit/apply` and `fog-enabled-toggle` carry
no `session-` prefix and can keep their ids.

**Disposition.** Awaiting triage.

#### IN-207 — `README.md`'s Session settings section states a stale `room.settings` shape

**Finding.** The Session settings write-up gives `room.settings = { theme, measure: {
perSquare, unit }, grid: { subdivide }, defaultPlayerGroup }`. `RoomSettings`
(`packages/shared/src/types.ts:298`) has no `measure` or `grid` field — both were moved
to `GameMap` (`types.ts:175,190,192`) before this was noticed; the comment at
`types.ts:141` records the move. Independent of IN-206/WI-173's proposal — true whichever
surface ends up showing the controls.

**Classification.** Doc-only correction, no behavior or contract at stake.

**Disposition.** Awaiting triage.

#### IN-158 — Handouts, a play-time action, live inside the Session settings modal

**Request.** `INT-UX-06`. Handouts are a section of the GM-only Session settings modal (`SessionActivity.svelte`); party notes are the Log modal's second tab; tables are a quick sheet. Move handouts beside Tables in the referee quick-sheet group.

**Classification.** **Deceptive**, conservatively: relocating the handout controls moves `data-testid`s out of the surface the existing Playwright specs open to reach them — a moved testid is on the trigger list whether or not it carries its id. The conversation needed: which specs follow the move, in the same change.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-177 (SPEC-056).

#### IN-159 — Add creature and PNG export exist only in the expanded Map tools sheet

**Request.** `INT-UX-07`. "Add creature" — the referee's commonest play-time map action — and PNG export render only when the Map tools sheet is expanded (`MapToolsSheet.svelte`, `expanded`). Make them reachable from the docked palette.

**Classification.** Renders existing controls in one more state; each keeps its testid, and the expanded sheet keeps them too, so no spec loses a control. Calls existing store methods only. If both states could render at once, the plan must avoid a duplicate testid — that is the check the gate reviews.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-159.

#### IN-160 — "Room" names both the campaign room and map rooms; "Referee" and "GM" are both used

**Request.** `INT-UX-08`. The Room quick sheet (`activities.ts`) manages *map* rooms; "Room" everywhere else is the campaign room. User-facing copy uses both "Referee" and "GM". Rename the sheet (Areas / Locations / Labels) and pick one word for the referee.

**Classification.** Visible copy only. Testids, ids (`'room'` activity key) and code identifiers such as `isGM` are unchanged.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-160.

#### IN-161 — No single-key tool hotkeys

**Request.** `INT-UX-09`. The canvas key handler knows Ctrl+Z, Enter, Escape, Backspace and Alt. Add single-key tool switching (V, H, R, W, D, M, E, P…) to `TOOL_GROUPS` so the palette, the shortcut sheet and the handler read one catalog.

**Classification.** Additive input bindings over existing tool ids; no tool's behaviour changes. Must not collide with the existing digit view keys or `?`, and must be inert while a text field has focus — both stated in the plan.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-161.

#### IN-162 — An open Call for Initiative locks every die on the table

**Request.** `INT-UX-10`. During a Call for Initiative every die control outside the call disables (WI-136, SPEC-050 §3), the referee's included. A call left open by a player away from the keyboard blocks wandering-monster and reaction rolls. Softer options: disable only staging-eligible controls, or auto-resolve after a timeout.

**Classification.** **Shape A — reverses DEC-097** (answered (b), user) and the stated behaviour of SPEC-050 §3. Needs a new decision entry naming DEC-097 and superseding it or not; a timeout that defaults unstaged seats must also be checked against RULE-002 (it resolves an order, not a value).

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-190 (SPEC-057).

#### IN-163 — Token snap and drawing snap are two selectors on two sheets with nothing saying so

**Request.** `INT-UX-11`. `map-snap-mode` (Map tools) governs drawing; `token-snap-mode` (Character sheet) governs token drops. Different by design, but unlabelled, and the Alt override is undiscoverable. Label the token control "Token snap" with a hint naming Alt.

**Classification.** Copy and a hint beside an existing control; both testids stay where they are and neither setting's meaning changes. Showing the token mode read-only on the Map tools sheet is a further, separate option, not in this item.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-162.

#### IN-164 — Hex authoring palette shows two paths per field without saying they write the same thing

**Request.** `INT-UX-12`. Terrain: Select + `HexTilePanel` swatch, or the `hexTerrain` tool. Note: Select + panel, or the `hexLabel` tool. Group them visually (a Paint row and an Inspect row).

**Classification.** Visual grouping of existing buttons in `TOOL_GROUPS`; no tool, testid or hex-space consumer changes.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-163.

#### IN-165 — The room password is plaintext, readable by any signed-in user, and never checked

**Request.** `INT-UX-13`. The create form stores "Room password (optional — stored for later, not enforced yet)" (`Lobby.svelte:409`) onto the room doc (`firebase-store.ts:299`), readable by any signed-in user under RULE-012. Recommendation in the review: remove the field and `Room.password` with a migration, and close the door in a decision entry.

**Classification.** **Shape A — a reversal.** `DECISIONS.md` Postponed holds "Room `password` field. Stored, unenforced, dormant." — reversing that is a decision. Removing the field is also a schema change (RULE-007: migration + `.vttcamp` round-trip test) and sits on the create/join path (RULE-011/012). `opus`.

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-191 (SPEC-057).

#### IN-166 — Undo covers geometry edits but not deletes, token moves or group changes, and dies on map switch

**Request.** `INT-UX-14 (+ INT-NX-04)`. Floor, fog, wall and door edits are undoable; symbol/label/door/drawing deletes, token moves and group changes are not; the stack lives in `VectorMapView` and is discarded on map switch. A room-scoped undo service over entity operations is the baseline users expect.

**Classification.** **Deceptive**: it changes what undo means (README → "The selection model", SPEC-037's stated Backspace behaviour). Related: IN-184 (the Room sheet's separate undo stack) — one design conversation should cover both.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-178, WI-179, WI-180 (SPEC-056).

#### IN-167 — No multi-token selection or group move outside a collapsed group

**Request.** `INT-UX-15 (+ INT-NX-04)`. The lasso collects vertices and objects, never tokens. Add Shift-click and lasso for tokens, committing with the already-batched `moveTokens` on release (RULE-003-clean).

**Classification.** **Deceptive**: changes the selection model's stated behaviour (SPEC-037).

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-181 (SPEC-056).

#### IN-168 — A wrong room id shows "Loading room…" forever; a dropped connection shows nothing

**Request.** `INT-UX-16 (states half)`. `room === null` renders "Loading room…" indefinitely (`RoomShell.svelte`). Add a room-not-found state and a reconnecting banner. Related: IN-150's flake is stuck on the same "Loading room…" screen — the not-found state may make that failure legible.

**Classification.** Presentation of states the client can already observe; new testids only. No store method or listener semantics change — if detecting "not found" needs one, that half is re-triaged.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-156.
**Closed 2026-09-23** — Batch 1, states half only. The reconnecting banner needs a
`CampaignStore` connectivity read no store exposes today; re-triaged as **IN-215** rather
than widening this item (RULE-015). See `docs/completed/WI-156.md`.

#### IN-169 — Enable Firestore offline persistence on the hosted build

**Request.** `INT-UX-16 (cache half)`. No `persistentLocalCache` anywhere; a dropped connection blanks live data. Consider it for the hosted build.

**Classification.** **Deceptive**: it changes what a subscriber may assume about a snapshot (cached vs server) and is configured in `client.ts`, the sole concrete-store touchpoint (RULE-001). RULE-009's local-build text excludes a cache *for that build* only; the hosted reading still wants a decision entry, including multi-tab behaviour.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-186 (SPEC-056).

#### IN-170 — The Map tools palette is ~50 controls in a half-height phone sheet

**Request.** `INT-UX-17`. `MapToolbar` is the most control-dense sheet and on a phone is a half-height bottom sheet. Playtest before designing.

**Classification.** **Investigation**, and its first step is a **`[HUMAN]`** phone playtest. Findings become their own intake items.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-176.

#### IN-171 — The hosted build shows no version, and there is no "report a problem" affordance

**Request.** `INT-UX-18`. WI-147 (DEC-104) stamped `VITE_APP_VERSION` and renders it on the **local** lobby only (`local-app-version`). The hosted build shows nothing a user can quote, and nothing links to where to report a problem.

**Classification.** One more render site for an existing define, plus a link; no store, schema or testid change. The local half is already closed by WI-147.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-157.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-157.md`.

#### IN-172 — `VectorMapView.svelte` is 4,095 lines and the whole map application

**Request.** `INT-AR-01`. ~25 subscriptions, ~30 `$effect`s, 42 `renderAll()` call sites. The file's section comments already mark the seams: `TokenLayer`, `SelectionGesture`, `BackgroundGesture`, `CollabPresenter`, `HexAuthoring`, `LabelTooltip`. Produce the extraction plan.

**Classification.** **Investigation** (`opus` for the plan). Each extraction becomes its own intake item, one controller per work item; the first is **already logged as IN-113** (the `TokenLayer` container) and is not duplicated here. An extraction that changes Pixi layer composition is Deceptive (RULE-006).

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-171. **Closed 2026-09-23** — plan delivered in `docs/completed/WI-171.md`, findings only, no code changes. Nine extraction findings logged as IN-197 – IN-205 below.

#### IN-173 — `FirebaseStore` hand-writes ~20 near-identical `subscribeX` methods

**Request.** `INT-AR-02 (primitive)`. `MemoryStore` has a generic `ReactiveCollection`; `FirebaseStore` does not. A `collectionOf<T>(path, converter)` primitive would turn the per-collection methods into one-liners (~800 lines) with no interface change.

**Classification.** **Deceptive (proposed), classified conservatively.** The `CampaignStore` shape does not change, so by the letter it is not a trigger — but it rewrites every listener in the concrete-store touchpoint, where error, metadata and ordering behaviour are guarantees callers rely on. The review itself flagged it. The conversation: whether the contract suite covers those guarantees well enough to call it Simple.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-183, WI-184 (SPEC-056).

#### IN-174 — Split `CampaignStore` into per-domain interfaces and contract suites

**Request.** `INT-AR-02 (split)`. ~150 methods; the contract is 3,318 lines and runs whole for every feature. Compose `RoomStore`, `MapStore`, `EncounterStore`, `DiceStore`, `PresenceStore`, `CollabStore`.

**Classification.** **Shape A**: an interface change (RULE-001) and possibly a RULE-001 wording question ("the shared contract suite" → suites). A decision entry first; any amendment is standalone (RULE-017). Best sequenced after IN-173.

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-194 (SPEC-057).

#### IN-175 — Every change redraws every layer, and a vertex drag rebuilds LoS per pointer-move

**Request.** `INT-AR-03`. `renderAll()` redraws grid, hex layers, scene, doors, overlay, annotations, fog, alignment and preview each call; during a vertex drag it also runs `buildVectorScene`. Add per-layer dirty tracking behind one rAF-coalesced flush; measure with WI-122's `apps/web/bench/`.

**Classification.** **Shape A — reverses a Postponed entry** ("Full-viewport-diff rendering optimizations", `DECISIONS.md`) and is render-pass work (`opus`). Best sequenced after IN-172's plan.

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-192, WI-193 (SPEC-057).

#### IN-176 — Once-per-room-open backfills are a second, unversioned migration system

**Request.** `INT-AR-04 (+ INT-AR-12)`. `ensureActiveMap`, `migrateMapBackgrounds` and `migrateTokenLetters` each read a whole subcollection on every room open, forever. Consolidate behind a `Room.collectionsMigratedTo` stamp and one store method so room-doc and collection migrations share one ledger. INT-AR-12 (migration knowledge split four ways) is folded in.

**Classification.** **Deceptive**: a new stored `Room` field, a new store method (RULE-001 contract suite) and migration work (RULE-007).

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-185 (SPEC-056).

#### IN-177 — Yjs state is one RTDB node rewritten whole on every edit

**Request.** `INT-AR-05`. `mergeYUpdate` decodes, merges, re-encodes and writes the entire doc per local edit in a transaction that serialises writers. Fine today; `room-notes` grows for the life of a campaign. Measure a 50 KB doc at 10 edits/s before choosing append-and-compact or snapshot-plus-tail.

**Classification.** **Investigation**: measurement first. A transport change would be Deceptive (RTDB layout, RULE-003).

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-174.

#### IN-178 — No code splitting — three.js, Rapier and the hex art load before the join gate

**Request.** `INT-AR-06`. No `manualChunks`, no dynamic `import()`; main chunk 4.38 MB hosted. Dynamic-import the dice renderer and the hex art loader first, and add a bundle-size assertion to CI beside IN-071's Firebase-strip grep.

**Classification.** Build configuration and load timing only: dice authority is the seed and animation is decorative (RULE-013), so a lazily loaded renderer changes no result. No store, schema or testid change. The local build's Firebase strip is a resolver alias and unaffected.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-166.

#### IN-179 — Reads, writes and listeners per session are unmeasured

**Request.** `INT-AR-07 (+ INT-AR-08)`. `isGM()`/`isMember()` cost a read per evaluated write; each client holds ~25 listeners and a map switch re-subscribes twelve. RULE-003's "comfortably inside 20k writes/day" is an intent, not a measurement. One emulator run with the request log produces the number for `README.md`.

**Classification.** **Investigation**: produces a measured figure and, if warranted, findings. Rules changes that follow would be Deceptive (RULE-004).

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-172. **Closed
2026-09-23** — measured against the Firestore/RTDB emulator: for the two-seat Phase 0
vertical slice, 5 Firestore reads, 11 Firestore writes, 49 Firestore listeners, 0 RTDB
reads, 30 RTDB writes, 10 RTDB listeners. Number and method in `docs/completed/WI-172.md`
and `README.md` §II.8. No findings raised.

#### IN-180 — The e2e introspection readouts ship to every production user

**Request.** `INT-AR-09`. Dozens of hidden DOM mirrors (`token-pos-*`, `selection-count`, …) render in `VectorMapView` for Playwright. Gate them on a build flag, on in dev/test, off in production.

**Classification.** Playwright runs against the Vite dev server (`apps/web/playwright.config.ts` `webServer`), where the flag stays on, so **no testid a spec depends on disappears from where the specs look**. Moving readouts to a `window.__vtt` object instead would remove testids and is **not** this item.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-167.

#### IN-181 — Three snap vocabularies — `SnapMode`, `VectorSnapMode` and the hex snap

**Request.** `INT-AR-10`. Tokens (`tokens/drag.ts`) and tools (`map/vector/snap.ts`) each switch on their own mode type. One `snapFor(kind, mode, point)` would serve both and stop the selectors drifting (see IN-163).

**Classification.** A refactor with identical outputs: neither mode is a stored field (both are per-viewer client state), and what a snapped point means (SPEC-028 §2) is unchanged. Any output difference found on the way is a separate item, not a fix inside this one.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-168.

#### IN-182 — Actor name, letter and colour are resolved in five places

**Request.** `INT-AR-11`. `creatureLabel`, `creatureDisplayName`, `tokenLabel`/`refLabel`, `resolveCharacterColor`/`assignedCharacterColor`, `letterStyleFor`. One `actorPresentation(actor, players, groups)` returning `{ name, letter, color, portrait }`.

**Classification.** Pure-function consolidation with identical answers on every surface; no stored field. If two of the five disagree today, that disagreement is logged as its own item rather than resolved silently here.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-169.

#### IN-183 — Three modal mechanisms with a hand-rolled Escape priority

**Request.** `INT-AR-13`. `DialogService`, `ShellState.dialog` and `ShellState.overlay` each run modals; `onGlobalKey` orders Escape by hand. One modal stack with focus trapping.

**Classification.** **Deceptive**, conservatively: it changes keyboard and focus behaviour that specs and e2e flows assert, and may move dialog testids.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-182 (SPEC-056).

#### IN-184 — Deleting a map label is undoable from the Room sheet but not from the canvas

**Request.** `INT-AR-14`. Labels are created on the canvas and managed in the Room sheet, which keeps its **own** undo stack (`RoomsPanel.svelte`). Backspace on the canvas is not undoable; delete in the sheet is. Same operation, two behaviours.

**Classification.** **Deceptive**: undo semantics. Belongs to the same design conversation as IN-166.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-178, WI-179 (SPEC-056).

#### IN-185 — Token vision and automatic fog reveal

**Request.** `INT-NX-01`. Each player-owned token becomes an eye: `visibilityPolygon` per token on drag-end, unioned into `fogRegions` in one settled write (RULE-003). A profile-independent `Token.vision: { radius }` keeps RULE-002 intact.

**Classification.** **Shape A — reverses a Postponed entry** ("Auto-reveal fog from token LoS. Deferred…"). Also a `Token` schema change (RULE-007) and render-pass work. Best after IN-175.

**Disposition.** ⏸ **Postponed** — user, 2026-09-23, at classification. Stays in §1.1 for later reconsideration.

#### IN-186 — Import walls, doors and image from `.dd2vtt`/`.uvtt`

**Request.** `INT-NX-02`. `source: 'imported'` is reserved and a `.dd2vtt` fixture is bundled, but no importer exists. The walls/doors half stands alone; the image half depends on IN-187.

**Classification.** **Deceptive**: a new input path writing `imported` geometry, whose coordinate conversion into lattice units is exactly RULE-006's territory; square maps only.

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-187 (SPEC-056).

#### IN-187 — Small images (token portraits) stored as bytes in Firestore, inside Spark

**Request.** `INT-NX-03`. A 96×96 WebP is ~6–15 KB. `rooms/{roomId}/images/{id} = { bytes, mime, w, h }` with a rules size check gives token art and small handouts with no Storage, billing or function.

**Classification.** **Shape A**: sidesteps the Postponed "In-app image uploads" entry by another route, so it needs a decision naming that entry. Also rules (RULE-004), a new collection and store methods (RULE-001), and RULE-010 §1's per-write-only containment.

**Disposition.** Classification approved — user, 2026-09-23. Decided by the user and scheduled as WI-195 (SPEC-057).

#### IN-188 — Conditions / status markers on tokens

**Request.** `INT-NX-05`. A referee-defined list (`room.settings.conditions`) and `Token.conditions: string[]`, drawn as badges. No interpretation, no duration ticking.

**Classification.** **Deceptive**: `Token` and room-settings schema (RULE-007). The RULE-002 guard test must stay green — markers are displayed, never acted on.

**Disposition.** ⏸ **Postponed** — user, 2026-09-23, at classification. Stays in §1.1 for later reconsideration.

#### IN-189 — Whisper to the referee

**Request.** `INT-NX-06`. Hidden rolls exist; private messages do not. `/w` writing into `gmPrivate` mirrors the hidden-roll path.

**Classification.** **Deceptive**: rules and the `gmPrivate` boundary (RULE-004).

**Disposition.** ⏸ **Postponed** — user, 2026-09-23, at classification. Stays in §1.1 for later reconsideration.

#### IN-190 — Multi-point path measurement and a live distance chip on token drag

**Request.** `INT-NX-07`. Measure is a single span. Add click-to-click path totals and a distance readout while dragging a token, both on `measureSpanText`.

**Classification.** Display only, over the existing measure formatter, which already answers per grid kind (WI-131); no stored field, no write. New testids only.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-164.

#### IN-191 — No tool writes a text drawing, though `Drawing.kind === "text"` renders

**Request.** `INT-NX-08`. `DrawingKindSchema` already includes `'text'` and the engine draws it; nothing creates one. Add a Text tool to the Overlay group.

**Classification.** Writes an existing schema value through the existing drawing write path; no schema, store method or layer change. New testid only.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-165.

#### IN-192 — Fog on hex maps

**Request.** `INT-NX-09`. Fog is square-lattice only; hex crawls have no unexplored state. A per-hex `revealed` on `HexTile` needs no polygon math.

**Classification.** **Deceptive**: `HexTile` schema (RULE-007) and a hex-space consumer (RULE-006).

**Disposition.** Classification approved — user, 2026-09-23. Designed with the user and scheduled as WI-188 (SPEC-056).

#### IN-193 — No "Now on: <map>" notice when the referee switches the active map

**Request.** `INT-NX-10`. Every client follows an active-map switch, silently. Show a transient toast.

**Classification.** Presentation of a change every client already observes; new testid only.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-158.
**Closed 2026-09-23** — Batch 1. See `docs/completed/WI-158.md`.

#### IN-194 — Contrast of `parchment-dark` and `keyed-blue` has never been measured

**Request.** `INT-NX-12 (audit)`. Focus rings and ARIA names exist; theme contrast is unmeasured.

**Classification.** **Investigation**: a measured audit; each failing pair becomes its own item.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-175.
**Closed 2026-09-23** — audit delivered in `docs/completed/WI-175.md`, findings only,
no code changes. Four findings logged as IN-211 – IN-214 below.

### Findings from the IN-194 theme-contrast investigation (WI-175)

Reported, not fixed (RULE-015). The full method and every measured pair are in
`docs/completed/WI-175.md`; these are the four items it raises.

#### IN-211 — Presence-chip initials are near-illegible for Referee/Records seats in both themes

**Finding.** `SessionTab.svelte`'s presence chip paints its initial in `--bg-root`
over a per-seat `--group-*` background (`chipColor()`). Two of the five group colors
— `--group-records` and `--group-referee`, both aliased to panel *border* colors
(`--panel-table-line` / `--panel-referee-line`) — sit close in lightness to
`--bg-root` in both themes: **1.84:1** / **1.43:1** in `parchment-dark` (both
essentially unreadable), **2.97:1** / **3.95:1** in `keyed-blue` (both under the
4.5:1 a 0.62rem/700-weight initial needs). The same two tokens, used as designed (a
1px divider against their own `--panel-*-bg`), also read as near-invisible borders in
`parchment-dark` (1.32–1.65:1) — one root cause behind both symptoms.

**Classification note.** A token-value fix in `tokens.css`, or a different token
choice for chip text — either stays inside the existing chip/token contract, no
`CampaignStore` or schema surface.

**Disposition.** Awaiting triage.

#### IN-212 — `--accent-text` fails WCAG AA broadly in `keyed-blue`

**Finding.** `--accent-text` is real body/heading text in ten-plus components
(`AccountControls`, `MarkdownView`, `TensionBar`, `RollSheet`, `CharacterSheet`,
`SessionTab`, `PresentationToggle`, `MobileTopBar`, and others). It holds up in
`parchment-dark` (10.5–12.1:1) but fails in `keyed-blue`: **3.70:1** on
`--bg-panel`, **2.88:1** on `--bg-inset` (under AA even for large text in the second
case).

**Classification note.** Token-value fix in `tokens.css` only; no component logic
changes.

**Disposition.** Awaiting triage.

#### IN-213 — Two feedback-color text pairs dip under AA, one per theme

**Finding.** `--complication`/`--failure` against their own `-bg-strong` chip
background (the pairing `ActionLog`, `RollStrip` and `DiceOverlay` all use) score
**3.81:1** / **4.05:1** in `keyed-blue` (fine in `parchment-dark`, 5.2–6.7:1).
Separately, `--danger` as a text color — one site, `EncounterBoard.svelte`'s
group-delete button — scores **3.69:1** on `--bg-panel` in `parchment-dark` (fine in
`keyed-blue`, 5.44:1).

**Classification note.** Token-value fix(es) in `tokens.css`; the `EncounterBoard`
half could instead pick a different existing token for that one button.

**Disposition.** Awaiting triage.

#### IN-214 — `--text-dim` on `--bg-panel-alt` fails AA in `keyed-blue`

**Finding.** `--text-dim`, a common secondary-text color, scores **3.99:1** against
`--bg-panel-alt` in `keyed-blue` — under the 4.5:1 normal-text threshold (fine
everywhere else it's used, 4.89–6.45:1 across both themes).

**Classification note.** Token-value fix in `tokens.css` only.

**Disposition.** Awaiting triage.

#### IN-195 — Every user-facing string is inline

**Request.** `INT-NX-12 (strings)`. Extract strings to a `strings.ts` so translation is possible later.

**Classification.** Mechanical move of literals; rendered text and testids are unchanged. Large diff, so the plan should split it per component group.

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-170.

### Process request (2026-09-23)

#### IN-196 — `PLAN.md` "Effort" column holds T-shirt sizes, not effort levels

**Request.** (user, 2026-09-23) `PLAN.md` §2's Effort column reads `XS / S / M / L`, which
match no effort setting. Replace it with the effort levels Claude offers — `low`, `medium`,
`high`, `xhigh`, `max` (platform docs, "Effort") — assigned per open row as a guide to the
setting an execution session should run at. Size is dropped: every open item is already
scheduled. Define the allowed values in the workflow docs so the column cannot drift again.
The column already drifted once: `PLAN-COMPLETED.md` carries 30 rows of `medium` beside 35 of
`XS–L`, with no decision recorded for the switch.

**Classification.** **Simple** — edits `PLAN.md`, `CLAUDE.md` and
`.claude/commands/work-item.md` only; no code, no `RULES.md`, no store, schema, rules, testid
or layer, and no `SPEC-` statement changes (SPEC-035 §4 binds the *model*; effort is recorded
as advisory, beside it).

**Disposition.** Classification approved — user, 2026-09-23. Scheduled as WI-196, before WI-171. Assignment heuristic: DEC-120 (agent
default).

### Findings from the IN-172 `VectorMapView` extraction investigation (WI-171)

Reported, not fixed (DEC-027). The plan, its measurements and its ordering argument are in
`docs/completed/WI-171.md`; these are the items it raises. Every line figure is measured
from `VectorMapView.svelte` at `6cd2461` (4,095 lines), not estimated, and each "lines out"
is **net** of IN-198, which lifts the pure functions out first.

Two seams IN-172 named do not appear as fresh items on their current schedule: **undo**,
which WI-178 lifts out of this file outright (SPEC-056 §2.1), and the **`TokenLayer`
container**, which is already IN-113 and is not duplicated here. Nothing below reorders
WI-178 – WI-181, WI-188 or WI-192; where an ordering matters it is stated as a dependency
for triage to schedule against.

Common to all nine: **all 39 `data-testid`s in the file are in the markup**, which stays in
the component, so no item below moves one (RULE-005 is satisfied by construction) and every
one of them is verifiable by running the existing Playwright suite unchanged. Also common:
**zero unit tests reach anything in this file today** — its only coverage is e2e, through
those 39 readouts. The value of each item is the tests it makes possible, not the lines it
moves.

#### IN-197 — `renderAll` has 42 call sites and no inputs, so no seam can be extracted cleanly

**Finding.** `renderAll` (lines 3,585–3,765) reads free variables belonging to every seam
in the file — `hexTiles`/`hexSymbols`/`hexLines`/`hexCollecting` (hex), `regions`/`walls`/
`doors`/`activeDrag`/`selectedHandles`/`selectedObjects`/`lasso`/`hoverHandle` (select),
`selectedBackground` (background), `measureDrag`/`measureHexDrag`/`livePings` (collab),
`editingLabelId`/`noteDotRoomIds` (label), and the whole stroke-state block. Its 42 call
sites distribute as: pointer dispatch 13, `onMount` subscriptions 11, hex/label/collab 7,
the effect block 4, floor and fog commits 3, Select 2, the Eye timer 1. Move any seam's
state into a module and the render pass can no longer see it, so the module must be
imported back — a worse shape than today, with the cycle now explicit and the render pass
depending on eight modules instead of on itself. The fix: an explicit input object composed
from per-seam render slices, and a `requestRender()` callback handed to each seam in place
of a direct call. Two constraints the file already documents and that are easy to break —
`renderAll` **must not write reactive state** (several `$effect`s call it; assigning there
re-invalidates them every frame, `effect_update_depth_exceeded`), and the
`strokeMeasureText_`/`snapCellText_`/`snapBandText_` mirrors are assigned only on the
pointer path, never from `renderAll`.

**Classification.** Deceptive candidate — it changes the render pass's inputs, which is a
pipeline-stage contract even though nothing it draws changes. Identical-outputs refactor;
the existing e2e suite is the oracle. It is also the item that makes WI-193 (per-layer
dirty tracking, SPEC-057 §4.2) a small change rather than a rewrite: one `requestRender()`
funnel is where a dirty-layer mask goes. If WI-192 comes in over budget and WI-193 is
built, the two should be decided together at WI-193's gate.

**Disposition.** Awaiting triage. Prerequisite for IN-199 – IN-205; runs after WI-181.

#### IN-198 — Thirteen pure helpers sit inside `VectorMapView` where nothing can unit-test them

**Finding.** `displayState`, `displayOverlayState`, `annotationsWithLiveStroke`,
`objectHighlightBBox`, `latticeThreshold`, `resolvePingsForRender`, `hexLinePreview`,
`backgroundRect`, `liveBackgroundRect`, `nativeAspect`, `tokenRadiusPx`, `revealedAt` and
`isAway` are functions of their arguments — no Pixi, no store, no reactivity. They are
already the shape of `background-transform.ts` and `battle-map.ts` and are simply in the
wrong file. ~190 lines: 74 belong to no seam, 116 come out of IN-199 – IN-202 ahead of
them. `displayState`/`displayOverlayState` alone are 64 lines of drag-preview substitution,
run on every pointer-move of a Select drag, never tested.

**Classification.** Simple — a move, no contract, no testid, no schema, no layer. The only
item in this set with no prerequisite, and the one that produces the file's first unit
tests. It touches lines later items will also touch, but only by removing code they were
going to move anyway, so it shrinks those diffs rather than competing with them.

**Disposition.** Awaiting triage. No prerequisite — can run ahead of everything else here.

#### IN-199 — The token/encounter layer is 783 lines of `VectorMapView`

**Finding.** Lines 1,070–1,852: sprite sync, away badges, broken-image badges, rings,
letters, collapsed-group badges, texture load and rasterize, the drag handlers, `addCreature`
and the quick-sheet drop path. Its seven private lookup maps (`spritesByToken`, `refsByToken`,
`backgroundsByToken`, `ringsByToken`, `lettersByToken`, `badgesByGroup`, `draggingIds`) are
touched **only** inside that range and in `onDestroy`'s teardown — the cleanest seam in the
file by that measure. Target: a `TokenLayerController` in `map/token-layer.svelte.ts` on the
`MapToolController` pattern, constructed in `onMount` with `{ engine, store, roomId, mapId,
requestRender }`. 766 lines net of IN-198.

**Classification.** Deceptive candidate — the largest single move in the file, and it
changes who owns a Pixi sprite map even though it redefines nothing about what the layer
contains.

**Disposition.** Awaiting triage. **After IN-113**, which is the other change to these same
lines: IN-113 changes what the `tokens` layer *contains* (five parallel maps become one
container per token); IN-199 changes only where the code lives. Extracting first means
extracting five sprite maps and a drag handler that reads them and then immediately
rewriting all of it.

#### IN-200 — Background sprite lifecycle and transform gesture are 171 lines of `VectorMapView`

**Finding.** Lines 1,003–1,048 (`applyBackgroundColor`, `applyBackgrounds`, the `bgSprites`
map) and 3,065–3,189 (hit-test, begin/update/end the move-or-resize gesture). `bgSprites` is
referenced from both halves and nowhere else, so the two belong in one controller. 150 lines
net of IN-198.

**Classification.** Deceptive candidate — it owns the placed-background write path.

**Disposition.** Awaiting triage, and **triage should look at IN-067, IN-068 and IN-069
first**: those three untriaged Deceptive candidates from the WI-083 investigation sit in
exactly these lines, so extracting ahead of them means writing the same code twice. Schedule
them with the extraction or before it.

#### IN-201 — Hex authoring is 230 lines of `VectorMapView`

**Finding.** Lines 2,587–2,655 (hex symbol placement, road/river vertex collection and
preview) and 2,822–2,982 (hex pick, per-hex note hover, terrain paint, the hex tooltip).
207 lines net of IN-198.

**Classification.** Deceptive — RULE-006. The axial-space boundary is precisely what this
controller would own, so a mistake in it is a coordinate-space mistake rather than a layout
one, and a square-lattice consumer reached from a hex map is undefined behaviour, not a bug
with a wrong pixel.

**Disposition.** Awaiting triage. **After WI-188** (hex fog, SPEC-056 §9), which adds
`HexTile.revealed` and a Reveal/Hide hex tool to these same lines behind a schema bump —
same argument as IN-200.

#### IN-202 — Pen, ping, measure and cursor publishing are 158 lines of `VectorMapView`

**Finding.** Lines 2,983–3,064 (live pings, ping resolution, the freehand stroke, the
throttled cursor publish) and 3,190–3,265 (their three pointer handlers). 103 lines net of
IN-198. `measureDrag`/`measureHexDrag` leak into `renderAll` and `cancelStroke`, which is
IN-197's problem to solve first.

**Classification.** Deceptive candidate — it owns the RTDB half of RULE-003 (cursors, pings,
in-progress strokes) and the multiplayer-only guard that keeps a local build from opening
those listeners at all (SPEC-041 §3). It does not change which store a write goes to, so it
may well land Simple; triage should decide.

**Disposition.** Awaiting triage. After IN-197.

#### IN-203 — The label editor, tooltip and note dot are 166 lines of `VectorMapView`

**Finding.** Lines 2,656–2,821: place a `MapRoom`, open and commit the inline editor, the
hover/pinned tooltip, the coarse-pointer note dot, and the anchor maths. Four `$state`s, two
of which back markup that stays in the component.

**Classification.** Simple candidate — no store contract, no schema, no coordinate space,
and its testids (`label-edit-input`, `map-label-tooltip`, `maproom-note-dot-*`) are all in
the markup and do not move.

**Disposition.** Awaiting triage. After IN-197, and **recommended as the first controller
extracted**: its pointer hook (`handleNoteDotPointerDown`) is already written in the target
"return whether it consumed the event" shape, so it is the cheapest shakedown for the
controller protocol — if the protocol is wrong, it is wrong on 166 lines rather than 766.

#### IN-204 — Stage pointer dispatch is a 464-line if-ladder over seams that should own their own branches

**Finding.** Lines 2,426–2,570 (`wireStagePointerEvents`, plus the lattice conversions) and
3,266–3,584 (`onPointerDown`/`Move`/`Up`, the key handlers, `cancelStroke`).
`wireStagePointerEvents` is a ladder of `if (handleXPointerDown(worldPx)) return;` — the
"did this seam consume the event" protocol every controller in this set would implement, but
written out by hand, one branch per seam, with the ordering comments that justify each
branch's position inline.

**Classification.** Deceptive candidate — pointer routing decides which coordinate space each
seam is handed (`toLatticeRaw` vs `toLatticeSnapped` vs raw world pixels), and that ordering
is load-bearing under RULE-006.

**Disposition.** Awaiting triage. **After IN-199 – IN-203**: every one of those removes a
branch from the ladder, so extracted last the router dispatches over a list of controllers
the component already holds and the ladder becomes a loop. Extracted first it would have to
import every seam it dispatches to.

#### IN-205 — The Select gesture is 313 lines of `VectorMapView`

**Finding.** Lines 587–640 (selection state) and 2,060–2,318 (vertex gesture, then whole
objects: pick, drag, rotate, delete, lasso). The last of IN-172's six named seams.

**Classification.** Deceptive — it owns the `ObjectSelection` shape, the `selected-object`
and `selection-count` readouts' backing state, and the vertex-handle protocol.

**Disposition.** Awaiting triage, **hard-blocked on WI-181** (multi-token select, SPEC-056
§3), which rewrites this gesture to add Shift-click, a tokens-win lasso and set drag.
Extracting first would be rewriting the same 313 lines twice and would collide head-on with
the larger of the two changes; landing WI-181 first means this extracts a settled gesture.
Last of the ten, after IN-204.

### Finding from WI-156 (SPEC-054 §10)

Reported, not fixed (RULE-015). Surfaced while executing WI-156 (Batch 1); the full
context is in `docs/completed/WI-156.md`.

#### IN-215 — A dropped connection shows nothing

**Request.** IN-168's own classification anticipated this: "if detecting 'not found' needs
[a new store method], that half is re-triaged" — it turned out to be the *reconnecting*
half, not the not-found half, that needs one. `RoomShell`'s room-not-found state
(SPEC-054 §10) was buildable from what `subscribeRoom` already reports (a `roomLoaded`
flag distinguishing "no snapshot yet" from "snapshot says gone"); the reconnecting banner
was not — nothing in `CampaignStore` exposes RTDB's `.info/connected` or an equivalent, and
none of the three stores' existing subscriptions can stand in for it.

**Classification.** **Deceptive** (proposed) — a `CampaignStore` connectivity read is a new
method on the shared contract (RULE-001), needing `MemoryStore`/`FirebaseStore` support and
a contract-suite case for what "connected" means on a store that has no network at all.

**Disposition.** Awaiting triage.


### Test-harness feedback (2026-09-23)

Reported by the user, not fixed (RULE-015).

#### IN-216 — Playwright has no suite-wide timeout or failure cap

**Request.** `apps/web/playwright.config.ts` sets a per-test `timeout: 180_000` with `workers: 1`, but no `globalTimeout` and no `maxFailures`. When something systematic breaks (emulator down, app fails to boot), every test waits out its full timeout in sequence and the run takes hours rather than failing fast.

**Classification.** **Simple** (approved, user, 2026-09-23) — config-only; no test, testid or spec behaviour changes.

**Disposition.** Classification approved; not yet scheduled.

#### IN-217 — `pnpm verify:all` truncates a failing step to its last 40 lines

**Request.** `scripts/verify.mjs` prints only `TAIL_LINES = 40` of a failing step's output, which in practice hid which test had failed; `pnpm test:all:emulators` had to be rerun to see the full output. The failure summary should always name the failing test(s) — e.g. keep the full log on disk and point to it, or extract the reporter's failure lines rather than a blind tail.

**Classification.** **Simple** (approved, user, 2026-09-23) — developer tooling only.

**Disposition.** Classification approved; not yet scheduled.
