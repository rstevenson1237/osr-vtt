---
description: Run the intake→gate chain (workflow steps 1–5) and stop at the approval gate
argument-hint: [the request, or a playtest batch]
---

# /work-item

Run **steps 1 through 5** for the request below. **Stop at the approval gate. Do not
execute.** Steps 6–8 are `/execute-wi`, in a **separate session**. Producing the gate is
the whole deliverable of this command.

## The request

$ARGUMENTS

---

## Reading list

`RULES.md` is already loaded. Read `PLAN.md` and `INTAKE.md` §1.1/§1.2. Read
`docs/spec/SPEC-nnn.md` for any cited spec, and `docs/decisions/DEC-nnn.md` only for a
decision this request actually touches. **Never read a file over ~300 lines whole** —
grep for the id, then read that range.

### Step 1 — Intake triage

Determine the shape:

- **Shape A (complex or reversing)** — refactoring, architectural change, or reversal of a
  previous decision. Prior discussion is **input, not approval**. A reversal must find the
  original entry (`DECISIONS.md` Open/Postponed, or `docs/decisions/DEC-nnn.md`) and either
  reopen it or create a new entry that **names and supersedes** it. Never silently
  overwrite one.
- **Shape B (playtest batch)** — a list of changes. Log **each item separately**.

Classify every Shape B item **Simple**, **Deceptive**, **Investigation** or **Unclear**
against the trigger list in `CLAUDE.md`.

- **The test is "changes the contract of", not "touches"** — the carve-out there is doing
  real work.
- **Classify conservatively.** Plausibly either → Deceptive.
- **Every Simple item gets a one-line justification** naming why it redefines no trigger.
  This is what the user reviews.
- **Deceptive items are not scheduled.** Say so, and say what conversation must happen.
- **Investigation items produce findings, not edits.** Name the host work item; each
  finding becomes its own intake item (DEC-027).
- **Unclear: ask.** Do not guess.

Add each item to `INTAKE.md` §1.1 with the next free `IN-nnn`. When an item's work fully
closes, its row moves to §1.2 — never deleted, never renumbered (RULE-019).

**Present the triage table. Classification approval is itself a gate.**

### Step 2 — Integrate

Fold the request into `README.md`, `docs/spec/`, `PLAN.md`, `INTAKE.md`, `DECISIONS.md`.
Docs move with code, in one PR (RULE-018). New specified behaviour gets a new
`docs/spec/SPEC-nnn.md` now, plus its index row in `SPEC.md`. `RULES.md` is off-limits
here — a rule change is a standalone `RULE-AMENDMENT:` change (RULE-017).

### Step 3 — Decisions

- **Blocking** (data model, persistence format, new dependencies, Firebase structure,
  auth, anything changing a RULE) → log **Open** in `DECISIONS.md` with recommendation,
  impact and alternatives, then **stop and ask**.
- **Default-and-notify** → decide, write `docs/decisions/DEC-nnn.md`, add the index line
  under `# Closed`, mark it an agent default, and surface it in the gate.
- **Silent** (formatting, comment style, test naming) → no logging.

**When uncertain which tier applies, escalate.**

### Step 4 — Create the work item

Add an entry to `PLAN.md` §2 with the next free `WI-nnn` (new items start at WI-028),
spec reference, originating `IN-nnn`, agent (`human` | `claude-code` | `external-agent`),
**model**, effort, and gate.

**The model target is binding on the execution session.** `sonnet` is the default;
`opus` only for schema/migration/render-pass/auth/security-rules work; `haiku` for
mechanical, bounded items. Name a release line, never a point release.

`human` items get step-by-step instructions for someone unfamiliar with the platform.
`external-agent` items get a self-contained brief with the spec text **inline**
(`PLAN.md` §5).

### Step 5 — Approval gate

Present the gate — **What**, **Why**, **Impact**, **Alternatives**, each a few lines, not
an essay — then **stop**. End the session here; execution is a fresh one.
