## SPEC-052 — One home per fact: the documentation ledger

**Status: Active**

_(New with the 2026-09-18 introspective — IN-140, IN-141, IN-148; DEC-107. Extends SPEC-035,
which made each oversized document an index over per-entry files. That split fixed where a
fact **lives**; it never said what an index may **repeat**, and the repetition is what grew
back. No `R`-number predecessor.)_

SPEC-035 §1 turned four documents into indexes and §2 said to read them by section. Six weeks
later the indexes are the largest files in the repository again, because a closed work item's
summary is written four times: as the record in `docs/completed/WI-nnn.md`, as a paragraph in
`PLAN.md` §2, as a row in `PLAN-COMPLETED.md` §3, and as a prose cell in `INTAKE.md` §1.2 —
before the commit message and the README delta. Measured at commit `d176331`: `PLAN.md` is
1,142 lines with three items queued, and `INTAKE.md`'s two index tables are ~105 KB before the
per-item prose begins. `/work-item` reads both, so a planning session starts tens of thousands
of tokens deep, on `opus`, before it reads a spec.

This spec states one rule — **a fact has one home** — and the lint that holds it there.

### §1 — Where a fact lives

| Fact                                                          | Home                                                  | What may appear anywhere else                                          |
| ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| What a closed work item changed, how it was verified, its deviations | `docs/completed/WI-nnn.md`                    | one line — id, title, date — in `PLAN-COMPLETED.md` §3                   |
| An open or scheduled work item                                | `PLAN.md` §2                                          | the originating `IN-nnn` row's Disposition cell names the WI id          |
| A request, its classification and the justification for it    | `INTAKE.md`'s per-batch prose section                  | one index line in §1.1 or §1.2 — id, title, classification, status, disposition |
| Why a behaviour is the way it is                              | `docs/spec/SPEC-nnn.md`, `docs/decisions/DEC-nnn.md`  | §3                                                                       |
| What the app does today                                       | `README.md`                                           | §3                                                                       |
| A local invariant a reader of one function needs              | the code comment beside it                            | the id it came from, and nothing else of the history                     |

The id is the link (SPEC-035 §1): a row that carries an id does not also need a path, a
summary or a sentence of rationale to be usable.

**Nothing here is deleted in the RULE-019 sense.** No `IN-`, `WI-`, `SPEC-` or `DEC-` id
disappears, is renumbered or is reused. What moves out of an index is prose that restates a
record the index already points at; the record itself is untouched, and the per-batch intake
prose that `INTAKE.md`'s own preamble protects ("never moved or trimmed") stays exactly where
it is. Only the two index tables above it shrink.

### §2 — `PLAN.md` §2 holds open work only

**A work item's paragraph is deleted from `PLAN.md` in the pull request that closes it** — the
same pull request that writes `docs/completed/WI-nnn.md`, which is the record the paragraph
would otherwise duplicate. `PLAN.md` keeps three things: the table of items not yet closed,
the ordering and constraint notes that still bind one of them, and the triage addenda that
explain what was *not* scheduled out of a batch. A closed item's constraint note goes with it.

The retroactive pass is mechanical and is one work item: every "**WI-nnn has now run and
closed**" paragraph goes, each one checked against the existence of its `docs/completed/`
file first — a paragraph whose record is missing is a finding, not a deletion. `INTAKE.md`
§1.2's prose cells and `PLAN-COMPLETED.md` §3's summary column reduce to the one-line shape
§1 gives them in the same pass.

**The measure of done:** `PLAN.md` is under 150 lines when nothing is queued, and
`INTAKE.md`'s index tables fit on a screen each.

### §3 — Rationale has one home

The house style writes the same rationale at four altitudes: the README paragraph restates the
decision, the decision restates the spec, the work item restates all three, and the code
comment restates the work item. Rationale is valuable exactly once — at the altitude where
someone deciding whether to change the thing will look for it.

- **Specs and decisions hold the why.** No budget; this is where the argument belongs.
- **`README.md` holds the what**: present-day behaviour, **five lines or fewer per fact**,
  carrying the `SPEC-nnn`/`DEC-nnn` id for the reader who wants the argument.
- **A code comment holds the local invariant** — what a reader of *this* function must not
  break — plus the id. Not the history of the work item that put it there.
- **A completion record is 40 lines or fewer**, in the four named sections.

This is a forward rule. Trimming an existing passage is not licensed by a work item that
happens to touch the file (RULE-015 is unchanged); the one retrospective pass is IN-141's
work item, and it is prose only.

### §4 — `pnpm docs:check`

An index that disagrees with its entry has been raised three times as an intake item —
IN-044, IN-045, IN-046 — and each time it cost a work item to fix by hand. It is a lint.

`pnpm docs:check` exits non-zero and prints one line per violation, and runs as the first
step of `pnpm verify` (`scripts/verify.mjs`), where a green step is one line (SPEC-035 §5).
It asserts:

1. every `SPEC-nnn` row in `SPEC.md` has a `docs/spec/SPEC-nnn.md`, and that file's
   **Status** line agrees with the index's status column;
2. every `DEC-nnn` listed under `# Closed` has a `docs/decisions/DEC-nnn.md`, and every entry
   under `# Open`/`# Postponed` has its body in `DECISIONS.md` itself;
3. every `WI-nnn` in `PLAN-COMPLETED.md` §3 has a `docs/completed/WI-nnn.md`, and no `WI-nnn`
   appears in both `PLAN.md` §2 and `PLAN-COMPLETED.md` §3;
4. every `IN-nnn` appears in **exactly one** of `INTAKE.md` §1.1 and §1.2, and has a prose
   section;
5. no id is duplicated, and every gap in a sequence is annotated as retired (RULE-019) rather
   than silent.

It checks structure, never prose: §3's budgets are a style rule for a human reader and are not
machine-enforced.
