# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order.

| WI  | Description | Spec | From | Agent | Model | Effort | Gate |
| --- | ------------ | ---- | ---- | ----- | ----- | ------ | ---- |
| WI-171 | **Investigation: `VectorMapView` extraction plan.** Findings become intake items; IN-113 is the first extraction. | — | IN-172 | claude-code | `opus` | M | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-172 | **Investigation: measured reads/writes/listeners per session** (emulator request log) → a number in `README.md`. | — | IN-179 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-173 | **Investigation: one home for per-map configuration.** A placement proposal; each move is its own Deceptive item. | — | IN-157 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-174 | **Investigation: Yjs transport cost** at 50 KB × 10 edits/s. | — | IN-177 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-175 | **Investigation: theme contrast audit** (`parchment-dark`, `keyed-blue`). | — | IN-194 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-176 | **Investigation: mobile Map tools.** Step 1 is a `[HUMAN]` phone playtest with a checklist; the agent turns notes into intake items. | — | IN-170 | human + claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-152 | **Empty-state hints** on a blank map and an empty board; "Show me around" in the `?` sheet. | SPEC-054 §1 | IN-152 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-153 | **Seat the creator** as `Referee` on hosted room creation. | SPEC-054 §2 | IN-153 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-154 | **Rail shows all three views; labels until first interaction.** | SPEC-054 §3 | IN-154 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-155 | **"Switch to Edit to draw"** hint on a disabled tool under View. | SPEC-054 §4 | IN-155 | claude-code | `haiku` | XS | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-156 | **Room not found; Reconnecting…** states. | SPEC-054 §10 | IN-168 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-157 | **Hosted version + Report a problem** link. | SPEC-054 §11 | IN-171 | claude-code | `haiku` | XS | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-158 | **"Now on: <map>"** notice on active-map change. | SPEC-054 §14 | IN-193 | claude-code | `haiku` | XS | ✅ **Gate cleared — user, 2026-09-23.** Batch 1 |
| WI-160 | **Keys + Referee**: rename the Room sheet; "Referee" in all copy. | SPEC-054 §6 | IN-160 | claude-code | `haiku` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 2a |
| WI-162 | **Token snap** label and Alt hint. | SPEC-054 §8 | IN-163 | claude-code | `haiku` | XS | ✅ **Gate cleared — user, 2026-09-23.** Batch 2a |
| WI-163 | **Hex palette Paint / Inspect rows.** | SPEC-054 §9 | IN-164 | claude-code | `haiku` | XS | ✅ **Gate cleared — user, 2026-09-23.** Batch 2a |
| WI-159 | **Add creature and Download PNG** in the docked palette. | SPEC-054 §5 | IN-159 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 2b |
| WI-161 | **Tool hotkeys** from `TOOL_GROUPS`. | SPEC-054 §7 | IN-161 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 2b |
| WI-164 | **Path measurement; drag-distance chip.** | SPEC-054 §12 | IN-190 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Batch 2b |
| WI-165 | **Text tool** in the Overlay group. | SPEC-054 §13 | IN-191 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 2b |
| WI-166 | **Lazy-load dice renderer and hex art; bundle-size budget in CI.** | SPEC-055 §§1–2 | IN-178 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Batch 3 |
| WI-167 | **E2E readouts behind `VITE_E2E_READOUTS`.** | SPEC-055 §3 | IN-180 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Batch 3 |
| WI-168 | **One `snapFor` resolver** (identical outputs). | SPEC-055 §4 | IN-181 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Batch 3 |
| WI-169 | **One `actorPresentation` resolver** (identical outputs). | SPEC-055 §4 | IN-182 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Batch 3 |
| WI-177 | **Handouts quick sheet**; handout controls and testids move out of Session settings; `portability.spec.ts` follows. | SPEC-056 §1 | IN-158 | claude-code | `sonnet` | S | Awaiting gate — single unit (Deceptive) |
| WI-178 | **Undo: one stack per client**, lifted out of `VectorMapView`, Keys-sheet stack folded in, cleared on map change. | SPEC-056 §2.1, DEC-108 | IN-166, IN-184 | claude-code | `sonnet` | M | Awaiting gate — single unit (Deceptive) |
| WI-179 | **Undo: object deletes** (canvas and Keys sheet). After WI-178. | SPEC-056 §2.2, DEC-108 | IN-166, IN-184 | claude-code | `sonnet` | S | Awaiting gate — single unit (Deceptive) |
| WI-180 | **Undo: token moves and group changes.** After WI-178. | SPEC-056 §2.3, DEC-108 | IN-166 | claude-code | `sonnet` | M | Awaiting gate — single unit (Deceptive) |
| WI-181 | **Multi-token select**: Select joins the View group (tokens + read-only geometry), Shift-click, tokens-win lasso, set drag. After WI-180. | SPEC-056 §3, DEC-109 | IN-167 | claude-code | `sonnet` | M | Awaiting gate — single unit (Deceptive) |
| WI-182 | **One modal stack**: Escape, focus trap, restore. | SPEC-056 §7 | IN-183 | claude-code | `sonnet` | M | Awaiting gate — single unit (Deceptive) |
| WI-183 | **Pin listener guarantees** in the contract suite, all three stores. | SPEC-056 §5.1 | IN-173 | claude-code | `sonnet` | M | Awaiting gate — single unit (Deceptive) |
| WI-184 | **`collectionOf<T>` in `FirebaseStore`**, methods migrated in slices. After WI-183. | SPEC-056 §5.2 | IN-173 | claude-code | `sonnet` | L | Awaiting gate — single unit (Deceptive) |
| WI-185 | **Migration ledger**: `Room.collectionsMigratedTo`, `migrateRoomCollections`. Schema bump. | SPEC-056 §6, DEC-111 | IN-176 | claude-code | `opus` | M | Awaiting gate — single unit (Deceptive) |
| WI-186 | **Firestore persistent multi-tab cache** (hosted); "Offline — changes will sync" banner. After WI-156. | SPEC-056 §4, DEC-110 | IN-169 | claude-code | `opus` | S | Awaiting gate — single unit (Deceptive) |
| WI-187 | **UVTT import** → new map of imported walls and doors. | SPEC-056 §8, DEC-112 | IN-186 | claude-code | `opus` | M | Awaiting gate — single unit (Deceptive) |
| WI-188 | **Hex fog**: `HexTile.revealed`, Reveal/Hide hex tool. Schema bump, after WI-185. | SPEC-056 §9, DEC-113 | IN-192 | claude-code | `opus` | L | Awaiting gate — single unit (Deceptive) |
| WI-170 | **Strings extraction** to `lib/strings`. After Batches 1–2, whose copy it moves. | SPEC-055 §5 | IN-195 | claude-code | `haiku` | L | ✅ **Gate cleared — user, 2026-09-23.** Single |

### The 2026-09-18 introspective — UX and architecture (scheduled 2026-09-23)

The Simple and Investigation items out of IN-152 – IN-195. **Gate cleared — user, 2026-09-23**, for every row, with two changes to the proposal: the
investigations run **first**, and Batch 2 is **split** into 2a (copy only: WI-160, WI-162,
WI-163) and 2b (new behaviour: WI-159, WI-161, WI-164, WI-165). **Four batches** run under
RULE-016's batch lane, each one pull request with one combined summary; every other row is
its own unit.

**Order.** The investigations WI-171 – WI-176, WI-171 first because IN-175 and IN-113 wait on
it; WI-176 waits on the user's phone playtest and may run whenever that has happened. Then
Batch 1 (first-run and shell, SPEC-054) → Batch 2a → Batch 2b (map palette, SPEC-054) →
Batch 3 (bundle and internals, SPEC-055) → WI-170 (strings, which moves the copy Batches 1–2
write). A finding from an investigation becomes an intake item; it does not reorder or widen
the batches behind it.

**README obligations (RULE-018).** Batches 1, 2a and 2b update the shell, map-tools and hotkey
sections; Batch 3 records the bundle budget and the readout flag; WI-172 adds the measured
session figure.

**Not scheduled here.** The Deceptive items are scheduled in the next section (WI-177 –
WI-188); the Shape A items (IN-156,
IN-162, IN-165, IN-174, IN-175, IN-187) each need a blocking decision logged and answered.
IN-185, IN-188 and IN-189 are postponed.

### The 2026-09-18 introspective — development-process batch

Ten findings, `INTAKE.md` IN-140 – IN-149, out of `docs/INTROSPECTIVE-2026-09-18.md` §4. All
ten cleared their gate (user, 2026-09-18), and the four Shape A items cleared their blocking
decisions with them — DEC-100, DEC-101 and DEC-103 answered **(b)** as recommended, DEC-102
answered **(b)** (relocate, not retire).

**Order, and why it is this one.** **WI-142 ran first** — a session that can run
`pnpm verify:all` makes every item behind it cheaper to verify, and it was the only one of
the ten that paid for itself on the very next work item. **WI-143 ran second**,
independent of everything: it changed CI's schedule, not its content. **WI-144, then
WI-146** ran in that order for one reason — the dedupe pass changes the shape of the
documents, so a style pass written before it would have been written against a shape that
was about to go; both have now landed.

**Both rule amendments have landed** — WI-148 (RULE-016) and WI-149 (RULE-015), each a
standalone `RULE-AMENDMENT:` change (RULE-017), 2026-09-20. **WI-151 is behind WI-144**,
and **WI-150** is independent.

**Each carries its own README obligation (RULE-018).** WI-142 and WI-150 update the
verification/harness section and `CLAUDE.md`'s harness paragraph; WI-143 updates what README
says about CI and the suite's wall clock; WI-144 and WI-146 update the reading-budget
description in `CLAUDE.md`; WI-147 adds the release and version story to the distribution
README of SPEC-042 §2.

**What this batch does not cover.** The introspective's §§1–3 — user experience, architecture,
and next steps against comparable products — are roughly forty further findings, among them the
plaintext room password (INT-UX-13), `VectorMapView`'s 4,095 lines (INT-AR-01) and the missing
token vision (INT-NX-01). One session, one batch (RULE-016): those are a later triage, and the
review document holds them until then.
They are now logged as `INTAKE.md` IN-152 – IN-195 (2026-09-23), classifications approved
(user, 2026-09-23; IN-185, IN-188, IN-189 postponed). The Simple and Investigation items are
scheduled below as WI-152 – WI-176.

---

### The 2026-09-18 introspective — Deceptive items (designed 2026-09-23)

The ten Deceptive items, each designed with the user and specified as SPEC-056, with
DEC-108 – DEC-113 recording the answers that change a contract. **Each work item is its own
unit** — Deceptive items are never batched (RULE-016). They run after Batch 3 and before
WI-170, so the strings pass moves their copy too.

**Order and dependencies.** WI-177 → WI-178 → WI-179 → WI-180 → WI-181 (undo before
multi-select, so a set drag lands as one undo entry) → WI-182 → WI-183 → WI-184 → WI-185 →
WI-186 (needs WI-156's banner) → WI-187 → WI-188 (its schema bump follows WI-185's). **WI-171's
extraction plan touches the same file as WI-178 – WI-181**; if it proposes an extraction that
should land first, that is a new intake item and a re-ordering at its own gate, not a change
made inside these.

**README obligations (RULE-018).** WI-177 the shell's sheet list; WI-178 – WI-181 "The
selection model" and the Edit/View lock; WI-185 and WI-188 the schema-version history;
WI-186 the hosted-build data paragraph; WI-187 "Walls, doors, LoS" (the `imported` source
gains its writer); WI-188 "Fog of war".

---

## Triage addendum — the WI-120 art review (2026-09-10)

`INTAKE.md` §1.1 carries the rows; this is what is and is not scheduled out of them. WI-121,
WI-122 and WI-123 were scheduled out of this batch and have since run and closed (see
`PLAN-COMPLETED.md` §3).

**Not scheduled: IN-117** — replacement `danger` contents art, which the project owner is
authoring (see `INTAKE.md` §1.1).
