# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order.

> **In flight (2026-08-08): WI-063**, step 8 of 8 — code and docs committed (`5ba7c04`,
> branch `claude/execute-wi-63-sqsmqv`). `pnpm verify:all` came back with lint, typecheck,
> unit, rules and store green and **one** e2e failure, the work item's own new
> `mobile.spec.ts` case: the second tap on a note dot left the tooltip open, because a
> coarse pointer's `pointermove` filled the hover slot for the same room and `activeLabel`
> fell back to it. Fixed by disabling the hover path entirely on a coarse pointer, which is
> what SPEC-033 §4 says. Re-running the `mobile-chromium` project alone. **No PR yet** — the
> gate-clearance attribution is an open question with the user (see `docs/completed/WI-063.md`).

| WI         | Description                                                                                                   | Spec           | From   | Agent         | Model    | Effort | Gate                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WI-064** | Full-screen and standalone: one presentation model                                                            | SPEC-033 §5    | IN-035 | `claude-code` | `opus`   | high   | Four-section gate. The Pixi stage must survive the resize with its camera intact. Sequenced after WI-058.                                                                                                                                                         |
| **WI-033** | Battle map: `GameMap` schema + migration + `.vttcamp` round-trip                                              | SPEC-029 §3    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Schema change ⇒ RULE-007 applies.                                                                                                                                                                                                              |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour)                                | SPEC-029 §1    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter                              | SPEC-029 §4    | IN-010 | `claude-code` | `opus`   | high   | Four-section gate. Needs a tool-subset prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`.                                                                                                                                                               |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit                                                           | SPEC-029 §5    | IN-010 | `claude-code` | `sonnet` | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types            | SPEC-030       | IN-011 | `claude-code` | `opus`   | low    | ✅ **Gate cleared — user, 2026-08-01.** Still a **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)**; never bundled into an implementation PR. Nothing in WI-038+ may begin until it lands.                                 |
| **WI-038** | Hex crawl: axial coordinates, schema, migration                                                               | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. Blocked on WI-037.                                                                                                                                                                                                                             |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills                                                     | SPEC-030 §1    | IN-011 | `claude-code` | `opus`   | high   | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons                                 | SPEC-030 §§2–3 | IN-011 | `claude-code` | `opus`   | high   | Four-section gate. First per-region fill in the renderer.                                                                                                                                                                                                         |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering                                            | SPEC-030 §§4–5 | IN-011 | `claude-code` | `opus`   | medium | Four-section gate.                                                                                                                                                                                                                                                |
| **WI-065** | **`RULE-AMENDMENT`** — RULE-010's economic premise under Blaze                                                | SPEC-034 §1    | IN-037 | `claude-code` | `opus`   | low    | DEC-049 **answered (c) — 2026-08-03**, so the amendment's content is settled. A **standalone change, its own branch, its own commit, `RULE-AMENDMENT:` prefix (RULE-017)** — never bundled into an implementation PR. Nothing in WI-066 may begin until it lands. |
| **WI-066** | Blaze upload containment: `storage.rules` + rule tests, client-side friction, deletion, the `[HUMAN]` runbook | SPEC-034 §§2–4 | IN-037 | `claude-code` | `opus`   | high   | Four-section gate. RULE-004 ⇒ ships rule tests. Blocked on WI-065. App Check enforcement is `[HUMAN]` console work and is a precondition, not a nice-to-have.                                                                                                     |
| **WI-070** | Un-quarantine and refactor portability.spec.ts e2e test                                                       | SPEC-036       | IN-043 | `claude-code` | `opus`   | high   | Four-section gate.                                                                                                                                                                                                                                                |

Execution order: **WI-064 → WI-033 – WI-036 → WI-037 → WI-038 – WI-041
→ WI-065 → WI-066**. (WI-029, WI-031, WI-032, WI-042, WI-043, WI-044, WI-045, WI-046,
WI-047, WI-048, WI-049, WI-050, WI-051, WI-052, WI-053, WI-054, WI-055, WI-056, WI-057,
WI-058, WI-059, WI-060, WI-061, WI-062, WI-063, WI-067, WI-068 completed; see §3.)

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
`isNarrow` untouched. **WI-064** still sequences after WI-058, which establishes the
viewport baseline it extends.

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

**One gate is already cleared** (user, 2026-08-01): **WI-037**. It still needs its own
session and its own branch — RULE-016 permits one work item per session, and RULE-017
forbids it from riding on any implementation PR.

---

### WI-070 — Un-quarantine and refactor portability.spec.ts e2e test

**Spec:** SPEC-036 (Portability Test & E2E Suite Stability)
**From:** IN-043
**Agent:** `claude-code`, model `opus`, effort `high`

#### Approval Gate

- **What:** Refactor `apps/web/tests/e2e/portability.spec.ts` into deterministic emulator assertions and remove `test.fixme` quarantine.
- **Why:** Un-quarantines the only flaky test in the e2e battery to restore 100% active coverage over `.vttcamp` export/import and concurrent handout reveals.
- **Impact:** Ensures Playwright CI suite catches portability regressions reliably without non-deterministic timing failures.
- **Alternatives:** Keep `portability.spec.ts` permanently disabled in `test.fixme` quarantine.
