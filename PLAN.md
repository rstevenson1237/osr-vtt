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
| WI-182 | **One modal stack**: Escape, focus trap, restore. | SPEC-056 §7 | IN-183 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-184 | **`collectionOf<T>` in `FirebaseStore`**, methods migrated in slices. After WI-183. | SPEC-056 §5.2 | IN-173 | claude-code | `sonnet` | L | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-185 | **Migration ledger**: `Room.collectionsMigratedTo`, `migrateRoomCollections`. Schema bump. | SPEC-056 §6, DEC-111 | IN-176 | claude-code | `opus` | M | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-186 | **Firestore persistent multi-tab cache** (hosted); "Offline — changes will sync" banner. After WI-156. | SPEC-056 §4, DEC-110 | IN-169 | claude-code | `opus` | S | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-187 | **UVTT import** → new map of imported walls and doors. | SPEC-056 §8, DEC-112 | IN-186 | claude-code | `opus` | M | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-188 | **Hex fog**: `HexTile.revealed`, Reveal/Hide hex tool. Schema bump, after WI-185. | SPEC-056 §9, DEC-113 | IN-192 | claude-code | `opus` | L | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Deceptive) |
| WI-189 | **Edit/View remembered for the tab session** (`sessionStorage`, per room). | SPEC-057 §1, DEC-114 | IN-156 | claude-code | `sonnet` | XS | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-190 | **Referee exempt during a call; Resolve now.** Amends SPEC-050 §3. | SPEC-057 §2, DEC-115 | IN-162 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-191 | **Remove the room password**: form field, schema, stores; migration deletes stored values. Schema bump. | SPEC-057 §3, DEC-116 | IN-165 | claude-code | `opus` | S | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-192 | **Render benchmark**: large-dungeon fixture + vertex drag on the WI-122 bench; number into README. After WI-171. | SPEC-057 §4.1, DEC-118 | IN-175 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-193 | **Per-layer dirty tracking** — only if WI-192 is over budget; otherwise denied at its gate with the number. | SPEC-057 §4.2, DEC-118 | IN-175 | claude-code | `opus` | L | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-194 | **Split `CampaignStore` by domain**; contract split, still run from `campaign-store.contract.ts`. After WI-184. | SPEC-057 §5, DEC-117 | IN-174 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-195 | **Portrait images in Firestore**: `images` collection, `img:<id>` refs, rules + rule tests, contract suite, `.vttcamp` round-trip. | SPEC-057 §6, DEC-119 | IN-187 | claude-code | `opus` | L | ✅ **Gate cleared — user, 2026-09-23.** Single unit (Shape A) |
| WI-170 | **Strings extraction** to `lib/strings`. After Batches 1–2, whose copy it moves. | SPEC-055 §5 | IN-195 | claude-code | `haiku` | L | ✅ **Gate cleared — user, 2026-09-23.** Single |
| WI-198 | **Explicit 15s timeout** on both `gm2` `room-name` assertions (`session-config.spec.ts:61,144`), matching `signInAsReferee`'s own restore budget, instead of the global 8s default. | — | IN-208 | claude-code | `haiku` | — | ✅ **Gate cleared — user, 2026-09-23.** Single |

### WI-196 — effort assignments (DEC-120)

Effort is **advisory**: a guide to the setting an execution session runs at, beside the
binding model target. `—` means the model takes no effort setting (Haiku 4.5). A batch runs
at the highest effort among its rows.

| Effort | Rows |
| ------ | ---- |
| `—` (haiku) | WI-160, WI-162, WI-163, WI-170, WI-196, WI-199, WI-200 |
| `medium` | WI-159, WI-161, WI-165, WI-167, WI-174, WI-175, WI-189, WI-192 |
| `high` | WI-164, WI-166, WI-168, WI-169, WI-177 – WI-183, WI-185, WI-186, WI-187, WI-190, WI-191, WI-194 |
| `xhigh` | WI-184, WI-188, WI-193, WI-195 |
| `max` | none |

Batches, by that rule: **Batch 1** `medium` · **Batch 2a** `—` · **Batch 2b** `high` ·
**Batch 3** `high` · **Batch 4** `—`.

### The 2026-09-18 introspective — UX and architecture (scheduled 2026-09-23)

The Simple and Investigation items out of IN-152 – IN-195. **Gate cleared — user, 2026-09-23**, for every row, with two changes to the proposal: the
investigations run **first**, and Batch 2 is **split** into 2a (copy only: WI-160, WI-162,
WI-163) and 2b (new behaviour: WI-159, WI-161, WI-164, WI-165). **Four batches** run under
RULE-016's batch lane, each one pull request with one combined summary; every other row is
its own unit.

**Order.** The investigations WI-171 – WI-176, WI-171 first because IN-175 and IN-113 wait on
it — **WI-171 closed 2026-09-23** (`docs/completed/WI-171.md`); **WI-172 closed
2026-09-23** (`docs/completed/WI-172.md`); **WI-173 closed 2026-09-23**
(`docs/completed/WI-173.md`, two findings logged as IN-206/IN-207); **WI-174 closed
2026-09-23** (`docs/completed/WI-174.md`, two findings logged as IN-209/IN-210); **WI-175
closed 2026-09-23** (`docs/completed/WI-175.md`, four findings logged as IN-211 – IN-214).
**WI-176 cancelled 2026-09-24** — the `[HUMAN]` phone playtest step was never performed;
see `docs/completed/WI-176.md`. **Batch 1
closed 2026-09-23** (WI-152 – WI-158, `docs/completed/WI-152.md` – `WI-158.md`; one finding,
IN-215, logged out of WI-156's states/reconnecting split). **Batch 2a closed 2026-09-24**
(WI-160, WI-162, WI-163 — `docs/completed/WI-160.md`/`WI-162.md`/`WI-163.md`). **Batch 2b
closed 2026-09-24** (WI-159, WI-161, WI-164, WI-165 —
`docs/completed/WI-159.md`/`WI-161.md`/`WI-164.md`/`WI-165.md`). **Batch 3 closed
2026-09-24** (WI-166 – WI-169 — `docs/completed/WI-166.md`–`WI-169.md`; one finding,
IN-218, logged out of WI-169's name-resolution disagreement). Next: WI-170 (strings,
which moves the copy Batches 1–2 write). A finding from an investigation becomes an
intake item; it does not reorder or widen the batches behind it.

**README obligations (RULE-018).** Batches 1, 2a and 2b update the shell, map-tools and hotkey
sections; Batch 3 recorded the bundle budget and the readout flag; WI-172 added the measured
session figure.

**Not scheduled here.** The Deceptive items are scheduled in the next section (WI-177 –
WI-188); the Shape A items are scheduled
as WI-189 – WI-195.
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
WI-186 (needs WI-156's banner) → WI-187 → WI-188 (its schema bump follows WI-185's). **WI-177
closed 2026-09-24** (`docs/completed/WI-177.md`). **WI-178 closed 2026-09-25**
(`docs/completed/WI-178.md`). **WI-179 closed 2026-09-25** (`docs/completed/WI-179.md`).
**WI-180 closed 2026-09-25** (`docs/completed/WI-180.md`). **WI-181 closed 2026-09-25**
(`docs/completed/WI-181.md`). **WI-183 closed 2026-09-26** (`docs/completed/WI-183.md`) —
executed ahead of WI-182 in this ordering at explicit request; WI-184 (After WI-183) is
unblocked. **WI-171's
extraction plan touches the same file as WI-178 – WI-181**; if it proposes an extraction that
should land first, that is a new intake item and a re-ordering at its own gate, not a change
made inside these. **It proposed none.** The plan (closed 2026-09-23) schedules all ten of its
items *behind* WI-178 – WI-181 and raises nothing that reorders them: undo is left to WI-178,
and the Select-gesture extraction is raised as IN-205, hard-blocked on WI-181 — now closed, so
IN-205 is unblocked whenever it is next scheduled. Nothing in this paragraph changes.

**README obligations (RULE-018).** WI-177 the shell's sheet list; WI-178 – WI-181 "The
selection model" and the Edit/View lock; WI-185 and WI-188 the schema-version history;
WI-186 the hosted-build data paragraph; WI-187 "Walls, doors, LoS" (the `imported` source
gains its writer); WI-188 "Fog of war".

### The 2026-09-18 introspective — Shape A items (decided 2026-09-23)

The six Shape A items, each decided by the user (DEC-114 – DEC-119) and specified as SPEC-057.
Every one names the entry it reverses or narrows: DEC-064 (WI-189), DEC-097 (WI-190), and the
Postponed entries for the room password (WI-191), full-viewport-diff rendering (WI-192/193)
and in-app image uploads (WI-195). **Each work item is its own unit.**

**Order and dependencies.** **WI-191 runs first of all implementation work**, straight after
the investigations — it stops a plaintext secret being written, and its schema bump then sits
ahead of WI-185's and WI-188's. WI-189 and WI-190 join the Deceptive run after Batch 3.
WI-192 follows WI-171 (closed 2026-09-23, so it is unblocked); WI-193 follows WI-192 and is
built only if WI-192 is over budget (DEC-118) — and if it is built, WI-171 §2.1 asks that
IN-197 (`renderAll` takes inputs, one `requestRender()` funnel) be decided at the same gate,
since that funnel is where a dirty-layer mask goes. WI-194 follows WI-184. WI-195 follows WI-188 (schema and `.vttcamp` changes in
order) and carries a stop condition on RULE-004 (SPEC-057 §6).

**README obligations (RULE-018).** WI-189 the Edit/View paragraph; WI-190 the initiative
section; WI-191 the create-room form and schema history; WI-192 the render budget and measured
figure; WI-194 the store-contract section; WI-195 the rules boundaries list, assets and
`.vttcamp` contents.

---

## Triage addendum — the WI-120 art review (2026-09-10)

`INTAKE.md` §1.1 carries the rows; this is what is and is not scheduled out of them. WI-121,
WI-122 and WI-123 were scheduled out of this batch and have since run and closed (see
`PLAN-COMPLETED.md` §3).

**Not scheduled: IN-117** — replacement `danger` contents art, which the project owner is
authoring (see `INTAKE.md` §1.1).
