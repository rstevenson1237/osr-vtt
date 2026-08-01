---
description: Run the intake→gate chain (workflow steps 1–5) and stop at the approval gate
argument-hint: [the request, or a playtest batch]
---

# /work-item

Run **steps 1 through 5** of the workflow in `CLAUDE.md` for the request below.

**Stop at the approval gate. Do not execute.** Steps 6 (execute), 7 (completion
summary) and 8 (pull request) are a separate turn, after the user has explicitly
approved. Producing the gate is the whole deliverable of this command.

## The request

$ARGUMENTS

---

## What to do

Read `PLAN.md` and `SPEC.md` before starting. `RULES.md` and `DECISIONS.md` are already
loaded.

### Step 1 — Intake triage

Determine the shape:

- **Shape A (complex or reversing)** — refactoring, architectural change, or reversal of
  a previous decision. Treat any prior discussion as **input, not approval**. If it
  reverses something, find the original entry in `DECISIONS.md` and either reopen it or
  create a new entry that **names and supersedes** it. Never silently overwrite one.
- **Shape B (playtest batch)** — a list of changes. Log **each item separately**.

Classify every Shape B item **Simple**, **Deceptive**, **Investigation**, or **Unclear**,
per `CLAUDE.md` step 1. Shape A items are classified **Complex (Shape A)**.

- **The Deceptive test is "changes the contract of", not "touches".** Read the trigger
  list in `CLAUDE.md` step 1 — it carries a "touches but does not redefine" carve-out, and
  the carve-out is doing real work.
- **Classify conservatively — if it could plausibly be either, it is Deceptive.** The
  carve-out narrows the triggers; it does not license optimism about a borderline item.
- **For every Simple item, give a one-line justification** naming why it redefines none of
  the Deceptive triggers. This is required; it is what the user reviews.
- **Deceptive items are not scheduled.** Say so, and say what conversation needs to
  happen.
- **Investigation items produce findings, not edits.** Name the host work item they run
  inside, and say that each finding becomes its own intake item (DEC-027).
- **Unclear items: ask.** Do not guess.

Add each item to the intake triage table in `PLAN.md` §1 with the next free `IN-nnn`.

**Present the triage table and note that classification approval is itself a gate.**

### Step 2 — Integrate

Fold the request into `RULES.md`, `README.md`, `SPEC.md`, `PLAN.md`, `DECISIONS.md` as
appropriate. Docs move before implementation (RULE-018). A change needing new specified
behaviour gets a new `SPEC-nnn` now, not later.

### Step 3 — Decisions

Apply the severity threshold from `CLAUDE.md` step 3:

- **Blocking** (data model, persistence format, new dependencies, Firebase structure,
  auth, anything changing a RULE) → log **Open** in `DECISIONS.md` with recommendation,
  impact and alternatives, then **stop and ask**.
- **Default-and-notify** → decide, log **Closed** marked as an agent default, and surface
  it in the gate.
- **Silent** → no logging.

**When uncertain which tier applies, escalate to the tier above.**

### Step 4 — Create the work item

Add an entry to `PLAN.md` §2 with the next free `WI-nnn` (never reuse; new items start at
WI-028), plus spec reference, originating intake ID, agent (`human` | `claude-code` |
`external-agent`), **model** (`opus` | `sonnet` | `haiku` — a release line, never a point
release), effort, and gate.

- `human` items get **detailed step-by-step instructions for someone unfamiliar with the
  platform**.
- `external-agent` items get a **self-contained brief** — spec text **inline**,
  acceptance criteria, file paths in scope — written for an agent that cannot read these
  docs. Template in `PLAN.md` §5.

### Step 5 — Approval gate

Present the gate with these four named sections, and nothing less:

- **What.** The concrete changes, file by file.
- **Why.** The reasoning connecting the change to the referenced spec, intake item, or
  user instruction.
- **Impact.** What behavior, structure, or downstream work this affects — including
  anything it makes harder to reverse.
- **Alternatives.** The approaches considered, and why they were not chosen.

Then **stop and wait.** Do not begin step 6.
