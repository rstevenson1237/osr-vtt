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
| WI-146 | **Rationale has one home.** The house-style split written into the documents that carry it: specs and decisions hold the why, `README.md` holds the what at ≤ 5 lines a fact with the id, a code comment holds the local invariant with the id, a completion record is ≤ 40 lines. Forward-only, plus one prose pass over the passages that already breach it. **Behind WI-144.** | SPEC-052 §3 | IN-141 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-18.** Prose only: no id, no structure and no assertion changes. RULE-015 is unchanged by it — a later work item that opens a file gains no licence to trim it. |
| WI-147 | **Release on tag.** A `v*` tag on `main` builds `pnpm build:local`, zips `apps/web/dist-local` with the launcher and distribution README, and attaches it to a GitHub release; the build stamps `VITE_APP_VERSION` from the tag and the app renders it in one place. SPEC-042 §3's Firebase-strip grep runs on the release artefact too. **Closes IN-070 and IN-073.** | SPEC-042 §§2, 5 | IN-149, IN-070, IN-073 | claude-code | `sonnet` | M | ✅ **Gate cleared — user, 2026-09-18.** DEC-104 approved as put: the tag is the version, `package.json` stays `0.0.0` and is documented as meaningless. The hosted deploy workflow is not touched, reused or triggered — SPEC-042 §4.3's constraint, and the one thing to check by eye in review. |
| WI-148 | `RULE-AMENDMENT` — **RULE-016 gains a batch lane**: "one session, one approved unit", where a unit is a work item or a batch of Simple items approved together at one gate, executed as one pull request with one combined summary naming each item. Deceptive, Investigation and rule-amendment items stay one per session. | — (rule) | IN-142 | claude-code | `opus` | S | ✅ **Gate cleared — user, 2026-09-18.** DEC-100 answered **(b)**: the batch lane, **without** the trivial lane — every item in a batch still gets its own `docs/completed/WI-nnn.md`. Standing constraint: a standalone `RULE-AMENDMENT:` change on its own branch, its own commit and its own approval (RULE-017), never bundled with an implementation, including the items in this batch. `CLAUDE.md` and SPEC-035 §3 move with the rule. |
| WI-149 | `RULE-AMENDMENT` — **RULE-015 gains a bounded Deviations budget**: an executor may fix a defect in a file the work item already changes when the fix is ≤ 20 lines, is covered by a test added in the same change, and is recorded under **Deviations**. All three conditions bind; anything outside them is still an intake item. | — (rule) | IN-147 | claude-code | `opus` | S | ✅ **Gate cleared — user, 2026-09-18.** DEC-101 answered **(b)**, with all three conditions binding rather than any two. Standing constraint: a standalone `RULE-AMENDMENT:` change (RULE-017), independent of WI-148 — neither amendment is a premise for the other, so either may land first or alone. |
| WI-150 | **The freshness hook.** Whichever DEC-102 answers: relocate `remind-plan-status.sh`'s durable state to a gitignored `.claude/status.local` (recommended), or retire the hook. `.claude/settings.json`, the `.gitignore` and `CLAUDE.md`'s harness paragraph move with it, and DEC-029 is annotated as superseded in place (RULE-019). | SPEC-053 §3 | IN-145 | claude-code | `haiku` | S | ✅ **Gate cleared — user, 2026-09-18.** DEC-102 answered **(b)**: relocate, not retire — the guard, its trigger surface and its 15-minute window all stay, and the `PreToolUse` count stays at three. DEC-029 is annotated as superseded in part, in place (RULE-019). |
| WI-151 | **Planning model routing.** SPEC-035 §4's planning clause scoped: `opus` for Shape A, for any gate touching a `RULE-`, and for a decision the user will answer; `sonnet` for Shape B triage and for scheduling already-classified items. `CLAUDE.md`'s Model paragraph and `.claude/commands/work-item.md` move with the spec. | SPEC-035 §4 | IN-146 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-18.** DEC-103 answered **(b)**. Amends a Completed spec's stated behaviour, so SPEC-035 §4 is annotated in place the way RULE-006 and RULE-009 were, never overwritten. **Behind WI-144**: the saving is model weight × context, and halving one factor while the other is still 1,142 lines is half a change. |

### The 2026-09-18 introspective — development-process batch

Ten findings, `INTAKE.md` IN-140 – IN-149, out of `docs/INTROSPECTIVE-2026-09-18.md` §4. All
ten cleared their gate (user, 2026-09-18), and the four Shape A items cleared their blocking
decisions with them — DEC-100, DEC-101 and DEC-103 answered **(b)** as recommended, DEC-102
answered **(b)** (relocate, not retire).

**Order, and why it is this one.** **WI-142 ran first** — a session that can run
`pnpm verify:all` makes every item behind it cheaper to verify, and it was the only one of
the ten that paid for itself on the very next work item. **WI-143 ran second**,
independent of everything: it changed CI's schedule, not its content. **WI-144, then
WI-146**, in that order and for one reason — the dedupe pass changes the shape of the
documents, so a style pass (WI-146) written before it is written against a shape that is
about to go. **WI-147** is independent of all five and may run at any point.

**The two rule amendments run outside that order.** WI-148 (RULE-016) and WI-149 (RULE-015) are
each a standalone `RULE-AMENDMENT:` change — own branch, own commit, own approval — and must
land ahead of anything that reads the amended rule (RULE-017). Neither is a premise for the
other, and nothing else in the batch depends on either, so they may run at any point and in
either order. **WI-151 is behind WI-144**, and **WI-150** is independent.

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

---

## Triage addendum — the WI-120 art review (2026-09-10)

`INTAKE.md` §1.1 carries the rows; this is what is and is not scheduled out of them. WI-121,
WI-122 and WI-123 were scheduled out of this batch and have since run and closed (see
`PLAN-COMPLETED.md` §3).

**Not scheduled: IN-117** — replacement `danger` contents art, which the project owner is
authoring (see `INTAKE.md` §1.1).
