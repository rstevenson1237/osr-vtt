# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

A browser-based virtual tabletop (VTT) for OSR/tabletop RPGs. Serverless on Firebase
(Spark tier) — no custom backend. See `README.md` for the full overview.

---

## Documents

Two files load in **every** session:

@RULES.md

@DECISIONS.md

Three more are **on-demand reads** — open them when the work calls for it:

| File        | Read it when                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `README.md` | Orienting on the project, or before touching any subsystem. Authoritative for present behaviour. |
| `SPEC.md`   | A work item cites a spec. Read the cited spec in full before implementing.                       |
| `PLAN.md`   | **Before starting any change.** It is the only legitimate source of work.                        |

`docs/archive/` holds the immutable originals: the pre-split Master Plan and the
completed-item ledgers for closed milestones. Never edit anything under it (RULE-020).

**Precedence.** `RULES.md` outranks everything. `README.md` outranks `SPEC.md` on
present-day behaviour. `SPEC.md` outranks improvisation.

---

## Standing rule: no out-of-chain changes

**Every change to this repository originates from a work item in `PLAN.md` that has
cleared its approval gate.** There are no side fixes, no opportunistic cleanups, and no
"while I was in there" edits.

**The one exception:** if a change is genuinely required to unblock the current work
item, make it, and record it in that work item's completion summary under
**Deviations**. Anything else gets logged as a new intake item and waits its turn.

This is RULE-015. Noticing a real bug outside the current work item is not a licence to
fix it — it is an intake item.

---

# The workflow

All user requests enter here, regardless of form. Two shapes are expected and both use
this same chain.

**Shape A, complex or reversing.** A large request involving refactoring, architectural
change, or reversal of a previous decision, typically arriving already discussed. Treat
any prior discussion as **input, not approval**. Reversals additionally require locating
the original decision in `DECISIONS.md`, and either reopening that entry or creating a
new entry that names and supersedes it. **A prior decision is never silently
overwritten.**

**Shape B, playtest batch.** A list of changes, behavior adjustments, or appearance
improvements. Log each item **separately** in the intake triage table.

## Step 1 — Intake triage

Classify every Shape B item as one of:

- **Simple.** Self-contained, touches one area, no spec change, no data model impact,
  reversible in a single commit. Simple items are **grouped by area into a single work
  item**.
- **Deceptive.** Appears small but **changes the contract** of shared state, the data
  model, persistence, rendering or layout systems, auth, or any existing spec — or has no
  clear reversal path. **Deceptive items do not get scheduled.** They stop and become a
  conversation with the user, then a multi-phase plan with its own specs.
- **Investigation.** Produces **findings, not edits** — "evaluate the other carving tools
  for inconsistencies". Simple/Deceptive does not apply, because it changes nothing. An
  Investigation is carried out **inside a host work item**, and **each finding it produces
  becomes its own intake item** rather than being fixed where it was found. Report first,
  fix separately (DEC-027).
- **Unclear.** Insufficient information to classify. **Ask the user.**

Shape A items are classified **Complex (Shape A)** and go straight to the multi-phase
treatment.

**Classify conservatively. If an item could plausibly be either, it is Deceptive.**

**For every item classified Simple, state in one line why it does not touch any of the
Deceptive triggers.** That justification is required and is what the user reviews.

Present the completed triage table and **obtain approval of the classifications before
any item advances. The classification is itself an approval gate.**

### Deceptive triggers, made concrete for this repo

The test is whether an item **changes the contract** of one of the following — its shape,
its meaning, or what callers are entitled to assume — **not** whether it happens to touch
a file that implements one. An item is Deceptive if it changes:

- The `CampaignStore`/`AssetStore` interface: a new store method, or a changed signature
  or guarantee on an existing one (RULE-001).
- The `GameMap`/`Room`/`PlayerSeat` schema, or the type or meaning of a stored field —
  anything needing a migration (RULE-007).
- `firebase/firestore.rules` or `firebase/database.rules.json` (RULE-004).
- What a coordinate, a layer or a pipeline stage **means**: lattice semantics, the Pixi
  layer order, or the carve pipeline's inputs and outputs (RULE-006).
- Auth, sign-in providers, App Check, or the join path (RULE-011).
- Which store a given write goes to (RULE-003).
- A `data-testid` a Playwright spec depends on — moved, renamed or removed (RULE-005).
- The stated behaviour of any existing `SPEC-nnn`.

**Touches but does not redefine.** Calling an existing store method, drawing on an
existing layer, *adding* a new `data-testid`, or changing one pure function inside the
carve pipeline without changing what its output means is **not** a trigger on its own.

> **Why this wording, and the worked example.** The earlier phrasing was *touches* rather
> than *changes the contract of*, and it stopped discriminating: six of the twelve items
> in the map-tools batch classified Deceptive on the single RULE-006 trigger, because any
> real map work touches the layer stack, the carve pipeline or lattice coordinates. What
> actually predicted difficulty was redefinition. IN-003–IN-006 redefined what "snap"
> means for three tools and were correctly Deceptive; IN-014 — the Symbol tool ignoring
> the snap mode — lives in the same files and is one pure function plus its call site, and
> was correctly Simple. A classifier that fires on nearly everything in the app's largest
> subsystem is not classifying.

**Classify conservatively still applies.** The carve-out narrows what counts as a
trigger; it does not license optimism about an item that plausibly sits on both sides.

## Step 2 — Integrate

Fold the request into the appropriate files: `RULES.md`, `README.md`, `SPEC.md`,
`PLAN.md`, `DECISIONS.md`.

These documents are updated in the same pull request as the implementation, not a
separate one (RULE-018).

## Step 3 — Decisions

Identify ambiguous design decisions and apply this severity threshold:

- **Blocking.** Data model, persistence format, new external dependencies, anything
  touching Firebase structure or auth, anything that changes a RULE. → Log as **Open** in
  `DECISIONS.md` with recommendation, impact, and alternatives, then **stop and ask the
  user.** Move to Closed when answered.
- **Default-and-notify.** Naming, file organization within an established pattern,
  choices internal to a module. → The agent decides, logs the entry as **Closed** noting
  it was an agent default, and **surfaces it in the completion summary** so the user can
  reverse it.
- **Silent.** Formatting, comment style, test naming. → No logging.

**When uncertain which tier applies, escalate to the tier above.**

## Step 4 — Create the work item

Add a numbered entry to the `PLAN.md` upcoming table with spec reference, originating
intake ID, agent (`human` | `claude-code` | `external-agent`), **model** (`opus` |
`sonnet` | `haiku`), effort, and gate.

- Items assigned **`human`** are written as detailed step-by-step instructions for
  someone unfamiliar with the platform.
- Items assigned **`external-agent`** must include a **self-contained brief**: the spec
  text **inline** rather than by reference, the acceptance criteria, and the file paths in
  scope — written on the assumption the external agent cannot read this repository's docs.
  `PLAN.md` §5 has the template.

## Step 5 — Approval gate

Present the gate and **wait for explicit approval.**

Do **not** rely on plan mode's default output, which describes what will be done without
covering why, impact, or alternatives. The gate must contain these named sections:

- **What.** The concrete changes, file by file.
- **Why.** The reasoning connecting the change to the referenced spec, intake item, or
  user instruction.
- **Impact.** What behavior, structure, or downstream work this affects, including
  anything it makes harder to reverse.
- **Alternatives.** The approaches considered and why they were not chosen.

## Step 6 — Execute

Execute the approved work item **and nothing else.**

## Step 7 — Completion summary

**Draft the summary during step 6, and finalise it only once the test suite has passed.**
A summary written before verification is a prediction, not a record. WI-030's claimed that
snapped strokes "move by up to half a cell" — true of the anchor, false of the extent,
since a Room grows by up to a full cell per axis. A failing e2e fixture caught it, not
review. Re-read every claim in the summary against what the suite actually did before
reporting it.

Close the work item with a summary containing these named sections:

- **Changes made.** Every file touched and what changed in each.
- **Visible behavior changes.** Anything the user can observe differently, including UI,
  CLI output, build behavior, and file locations. **State "none" explicitly** if there are
  none.
- **How to verify.** The specific steps, commands, or screens the user can check to
  confirm the work landed correctly.
- **Deviations.** Anything done differently from the approved plan, including unblocking
  changes made under the RULE-015 exception, and why.

**Record this summary in the `PLAN.md` completed-items entry as well as reporting it to
the user.**

## Step 8 — Pull request

Open a pull request and monitor CI.

- **Poll every 30 seconds, to a maximum of 20 attempts** (10 minutes).
- On failure, **read the CI log.**
- If the failure is **unambiguous and mechanical** — lint, formatting, a type error, or a
  test with an obvious fix — fix it and **re-push exactly once.**
- On any **second** failure, or any failure that is **not clearly mechanical**, **stop and
  report the log to the user.**
- **Never attempt to work around a permissions, auth, or branch protection failure.**
  Report it.

**CI in this repo:** `.github/workflows/ci.yml`, triggered on pull requests to `main`
(lint, typecheck, build, and the test suites). `main` is branch-protected; agent-opened
PRs from `claude/*` branches are accepted normally.

**Note:** the `gh` CLI is not installed in the remote execution environment — GitHub
access there is via the GitHub MCP server (`mcp__github__*`), including
`pull_request_read` with `method: "get_check_runs"` for CI status. `gh` commands are
pre-approved in `settings.json` for local sessions where it is present.

---

# Conventions

## ID schemes

| Prefix  | File           | Meaning                                                |
| ------- | -------------- | ------------------------------------------------------ |
| `RULE-` | `RULES.md`     | Hard rule. Violating one is a stop-and-flag event.     |
| `SPEC-` | `SPEC.md`      | Reference spec. Active / Completed / Superseded.       |
| `WI-`   | `PLAN.md`      | Work item. The only legitimate origin of a change.     |
| `IN-`   | `PLAN.md`      | Intake item. Classified, not yet scheduled.            |
| `DEC-`  | `DECISIONS.md` | Decision. Open / Closed / Postponed.                   |

**IDs are never reused** (RULE-019). A retired, superseded or abandoned entry keeps its
identifier and is annotated in place. A new entry always takes the next unused number.

Historical work items keep their Master Plan numbers, zero-padded (`WI-25` → `WI-025`);
new work items start at **WI-028**. Master Plan `R`-numbers map to `SPEC-` numbers via
the crosswalk at the top of `SPEC.md`.

## Work-item conventions

Carried forward from the Master Plan's Part 0.

- **`[HUMAN]`** — console setup, playtests, credential handling, mockup approval, option
  selection. Never delegate these to an agent.
- **`[AGENT]`** — one Claude Code prompt.
- **`[OTHER AGENT]`** — optional art/design passes outside Claude Code.
- Each work item names a **model target** and an **effort** (`high`/`medium`/`low`), both
  recorded in the `PLAN.md` tables. The model target is a **release line, not a point
  release** — a pinned ID goes stale on every release, which `claude-opus-4-8` and
  `claude-sonnet-4-6` both demonstrated:
  - **`opus`** — architecture-changing work: schema and data-model changes, new render
    passes, migrations, auth, and security rules.
  - **`sonnet`** — the default workhorse.
  - **`haiku`** — mechanical, bounded work.

  Effort is judged separately from the line: `low` for mechanical, bounded tasks.
- **One work item per Claude Code prompt.** Never batch. Every prompt ends with _"Stop
  after the gate; do not start the next work item."_
- A WI is done only when its PR passes CI and merges green. **If a gate fails, fix that
  WI — never move on broken.**
- Paste the relevant `SPEC-` section(s) plus the WI block verbatim into the prompt, name
  the files to read first, and keep `RULES.md` in the preamble.
- Plan reviews and spec amendments happen **in these documents**, before code sessions.

## One session, one work item

**A session executes exactly one work item.** A session that finds itself doing two has
violated the chain (RULE-016) and must **stop**, report, and log the second as a new
intake item.

## Rule amendments are standalone

Amending `RULES.md` and acting on the amendment **in the same turn is prohibited**
(RULE-017). A rule amendment is:

1. Its own change, in its own commit.
2. Prefixed `RULE-AMENDMENT:` in the commit message — a `PreToolUse` hook enforces this.
3. Never bundled into a work item's implementation commit.

The full ceremony is in `RULES.md`'s header: stop → flag (reason, impact, alternatives) →
get explicit approval → amend in a standalone change → only then resume.

## Docs and code move together

**Any code change updates the affected documents in the same pull request** (RULE-018).
A PR that changes behaviour without touching `README.md` is incomplete. A PR that
implements a spec without moving that spec's status is incomplete.

## Write `PLAN.md` status back before long-running operations

**Before any long-running operation** — a full emulator suite run, a Playwright run, a
build, a CI poll loop, a subagent dispatch — **write the current work-item status back to
`PLAN.md` first.**

Context compaction can land mid-operation. `PLAN.md` on disk is the only state that
survives it. If the file says "WI-031 step 3 of 5, tests running", the session recovers;
if it says nothing, the session restarts from a gate it already cleared, or worse,
re-executes work that already landed.

---

## Harness configuration

Under `.claude/`:

- **`settings.json`** — pre-approves read-mostly git and `gh` commands, and registers the
  two hooks. `git push` and destructive operations still prompt.
- **`hooks/guard-protected-paths.sh`** — blocks writes to `docs/archive/**`, and blocks
  `git commit` touching `RULES.md` without a `RULE-AMENDMENT:` prefix.
- **`hooks/guard-git-push.sh`** — blocks `git push --force`/`-f` and any `git push` to
  `main`.
- **`commands/work-item.md`** — `/work-item`, which runs steps 1–5 and **stops at the
  approval gate without executing.**

Exactly two `PreToolUse` hooks are registered. Do not add more without a work item and a
`DECISIONS.md` entry.

---

## Dev commands

Full list, with the `firebase-tools` proxy trap, is in `README.md`. The short version:

```sh
pnpm install                 # workspace install
pnpm dev                     # apps/web dev server
pnpm lint && pnpm typecheck  # before any PR
pnpm test:all:emulators      # full suite against the Firebase emulator
```
