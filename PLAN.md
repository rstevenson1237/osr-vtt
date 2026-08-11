# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                                                                   | Spec           | From   | Agent         | Model    | Effort | Gate                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-073** | Seed defaults — no starter map as a new map's default background; Profile Template → HP (Number) / To Hit (Roll d20) / Initiative (Initiative d6) | — | IN-051, IN-055 | `claude-code` | `haiku`  | low    | ✅ **Gate cleared — user, 2026-08-11.**                                                                                                                                                                                                                            |
| **WI-074** | Encounter Template default → Initiative (Initiative d6) only; v13→v14 migration pinned to `LEGACY_ENCOUNTER_TEMPLATE_V14` (DEC-065) | — | IN-056 | `claude-code` | `sonnet` | low    | ✅ **Gate cleared — user, 2026-08-11.** DEC-065 answered; the migration's backfill is decoupled from the live default before the default changes.                                                                                                                 |
| **WI-075** | Snap-mode selector on the Label and Symbol tools                                                              | SPEC-028 §1    | IN-057 | `claude-code` | `haiku`  | low    | ✅ **Gate cleared — user, 2026-08-11.** Both tools already honour the mode (WI-068); this surfaces the control.                                                                                                                                                    |
| **WI-076** | Edit/View as one binary button; default View on session join                                                  | —              | IN-058 | `claude-code` | `sonnet` | low    | ✅ **Gate cleared — user, 2026-08-11.** DEC-064 names and supersedes WI-053's `'edit'` default. Not a resolution of DEC-001.                                                                                                                                       |
| **WI-077** | Capture tool moves to the battle-map quick sheet; `capture` removed from `TOOL_GROUPS`                        | SPEC-029 §1    | IN-059 | `claude-code` | `sonnet` | medium | ✅ **Gate cleared — user, 2026-08-11.** DEC-066. `tool-groups.test.ts` needs a named exemption for `capture`. Reopens SPEC-029; closes it again on landing.                                                                                                       |
| **WI-078** | Selection consolidation: one Select tool (click + lasso), `selectEdge` retired, multi-select Backspace-delete, loop-preserving vertex removal | SPEC-037 | IN-049 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-11.** DEC-060. Edge-dragging is deliberately given up. New `VectorEditorOp` + inverse for vertex removal (undo).                                                                                                                |
| **WI-079** | Free snap attracts to an existing vertex (Wall/Door/Polygon + the lasso's vertex handles; not the cell-anchored tools) | SPEC-028 §12 | IN-050 | `claude-code` | `opus`   | medium | ✅ **Gate cleared — user, 2026-08-11.** DEC-061. Reopens SPEC-028 a third time; closes again on landing. Sequenced after WI-078 so the lasso's vertex index already exists.                                                                                       |
| **WI-080** | Multiple backgrounds — `backgrounds` subcollection, schema **v23** + migration, `.vttcamp` round-trip, `firestore.rules` + rule tests, new `CampaignStore` contract methods | SPEC-038 §§1–2 | IN-053 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-11.** DEC-062. RULE-001 ⇒ contract-suite methods against both stores; RULE-004 ⇒ rule tests; RULE-007 ⇒ migration + round-trip test. Gates WI-081.                                                                             |
| **WI-081** | Background transform UI in the Assets activity — move/resize with locked aspect ratio, the translucent-yellow alignment grid, GM-only (DEC-063); retires `session-background-*` | SPEC-038 §§3–5 | IN-053, IN-054 | `claude-code` | `opus` | high   | ✅ **Gate cleared — user, 2026-08-11.** Blocked on WI-080. Supersedes SPEC-016 (annotated in place). `session-config.spec.ts`'s background assertions move in the same PR (RULE-005).                                                                             |
| **WI-082** | Group card "Tidy" — explicit grid re-layout of members; collapse/expand keep restoring the stored formation    | —              | IN-027 | `claude-code` | `sonnet` | medium | ✅ **Gate cleared — user, 2026-08-11.** DEC-067. `Group.memberOffsets`'s meaning is unchanged; origin point and spacing are decided at execution.                                                                                                                  |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types            | SPEC-030       | IN-011 | `claude-code` | `opus`   | low    | ✅ **Gate cleared — user, 2026-08-01.** Still a **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)**; never bundled into an implementation PR. Nothing in WI-038+ may begin until it lands.                                 |
| **WI-038** | Hex crawl: axial coordinates, schema, migration                                                               | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-08.** Blocked on WI-037.                                                                                                                                                                                                         |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills                                                     | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-08.**                                                                                                                                                                                                                            |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons                                 | SPEC-030 §§2–3 | IN-011 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-08.** First per-region fill in the renderer.                                                                                                                                                                                    |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering                                            | SPEC-030 §§4–5 | IN-011 | `claude-code` | `opus`   | medium | ✅ **Gate cleared — user, 2026-08-08.**                                                                                                                                                                                                                            |
| **WI-065** | **`RULE-AMENDMENT`** — RULE-010's economic premise under Blaze                                                | SPEC-034 §1    | IN-037 | `claude-code` | `opus`   | low    | ✅ **Gate cleared — user, 2026-08-08.** DEC-049 answered (c) — 2026-08-03, so the amendment's content is settled. A **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)** — never bundled into an implementation PR. Nothing in WI-066 may begin until it lands. |
| **WI-066** | Blaze upload containment: `storage.rules` + rule tests, client-side friction, deletion, the `[HUMAN]` runbook | SPEC-034 §§2–4 | IN-037 | `claude-code` | `opus`   | high   | ✅ **Gate cleared — user, 2026-08-08.** RULE-004 ⇒ ships rule tests. Blocked on WI-065. App Check enforcement is `[HUMAN]` console work and is a precondition, not a nice-to-have.                                                                                |

Execution order: **WI-073 → WI-074 → WI-075 → WI-076 → WI-077 → WI-078 →
WI-079 → WI-080 → WI-081 → WI-082 → WI-037 → WI-038 – WI-041
→ WI-065 → WI-066**. (WI-029, WI-031, WI-032, WI-033, WI-034, WI-035, WI-036, WI-042, WI-043, WI-044,
WI-045, WI-046, WI-047, WI-048, WI-049, WI-050, WI-051, WI-052, WI-053, WI-054, WI-055, WI-056,
WI-057, WI-058, WI-059, WI-060, WI-061, WI-062, WI-063, WI-064, WI-067, WI-068, WI-070, WI-071
completed; see §3.)

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
**WI-037** cleared earlier (user, 2026-08-01). It still needs its own session and its own
branch — RULE-016 permits one work item per session, and RULE-017 forbids it from riding
on any implementation PR. WI-065 carries the same standalone-`RULE-AMENDMENT`-commit
requirement.

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

**One hard chain: WI-080 → WI-081.** The background transform UI has nothing to write to
until the `backgrounds` subcollection and its Firestore rules exist. WI-078 is sequenced
before WI-079 (preference, not a hard chain) because the lasso's vertex index is a natural
place to hang the vertex-attraction hit-test against. Everything else in the batch is
independent and could run in any order; the table above states one, for reproducibility.

**Edge-dragging is retired with WI-078.** `selectEdge` — the ability to grab a wall, door,
or floor-ring edge and drag both endpoints together — goes away when Select consolidates
(DEC-060). Recorded here because it is the one capability loss in this batch and does not
show up anywhere else in the ledger.
