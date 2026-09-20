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
WI-146** ran in that order for one reason — the dedupe pass changes the shape of the
documents, so a style pass written before it would have been written against a shape that
was about to go; both have now landed.

**The two rule amendments run outside that order.** WI-148 (RULE-016) has landed
(2026-09-20). WI-149 (RULE-015) is a standalone `RULE-AMENDMENT:` change — own branch, own
commit, own approval — and must land ahead of anything that reads the amended rule
(RULE-017). Nothing else in the batch depends on it, so it may run at any point. **WI-151 is behind WI-144**, and **WI-150** is independent.

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
