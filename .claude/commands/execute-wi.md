---
description: Execute an approved work item (workflow steps 6–8) — implement, summarise, open the PR
argument-hint: WI-nnn
---

# /execute-wi

Execute **steps 6 through 8** for the approved work item below, **and nothing else**.
The gate has already cleared; do not re-litigate it. If no gate exists for this item,
stop and say so — run `/work-item` first.

## The work item

$ARGUMENTS

---

## Reading list — keep it short, this is the expensive half

`RULES.md` is loaded. Read, in this order, and nothing more:

1. The `WI-nnn` block in `PLAN.md`.
2. `docs/spec/SPEC-nnn.md` for the spec it cites, if any.
3. The `README.md` section covering the subsystem being touched.
4. The code.

**Do not read** `INTAKE.md`, `PLAN-COMPLETED.md`, `docs/completed/`, or `DECISIONS.md`
unless the work item names a specific `DEC-nnn` — then read only
`docs/decisions/DEC-nnn.md`. Never read a file over ~300 lines whole: grep for the id or
symbol, then read that range. Do not re-read a file you just edited — `Edit` fails loudly
if it did not apply.

**Model.** Honour the target in the work item. If you are running on a heavier line than
it names, say so in one line and continue; if lighter, stop and ask.

### Step 6 — Execute

Implement the approved work item and nothing else (RULE-015). A change genuinely required
to unblock it is permitted and goes under **Deviations**; anything else is a new intake
item. One session, one work item (RULE-016).

**Write the current status back to `PLAN.md` before any long-running operation** — the
emulator suite, Playwright, a build, a subagent. A `PreToolUse` hook denies those calls if
`PLAN.md` has not been written in the last 15 minutes, and compaction mid-run loses
everything not on disk.

Verify in **one** command, not three:

```sh
pnpm verify          # lint + typecheck + unit, quiet on success
pnpm verify:all      # the above plus rules/store/e2e against the emulator
```

Both print failures only. If you need more, re-run the single failing suite — do not turn
the reporter back up for the whole battery.

### Step 7 — Completion summary

Draft it while working; **finalise it only once the suite has passed.** A summary written
before verification is a prediction, not a record — re-read every claim against what the
suite actually did.

Four named sections, a few lines each:

- **Changes made** — every file touched, and what changed in it.
- **Visible behavior changes** — anything the user can observe: UI, CLI output, build
  behaviour, file locations. **State "none" explicitly** if there are none.
- **How to verify** — the specific commands or screens that confirm it landed.
- **Deviations** — anything done differently from the approved plan, and why.

Write it to `docs/completed/WI-nnn.md`, add the row to `PLAN-COMPLETED.md` §3, remove the
item from `PLAN.md` §2, move its `INTAKE.md` row from §1.1 to §1.2, and report the same
summary to the user.

### Step 8 — Pull request

Commit on the work item's `claude/*` branch and `git push -u origin <branch>`. Then open
the PR:

- **Local session:** `gh pr create`.
- **Remote session:** `gh` is not installed — use `mcp__github__create_pull_request`, and
  `mcp__github__pull_request_read` with `method: "get_check_runs"` for status.

**Do not poll in a loop.** The old 30s × 20 loop cost twenty full-context turns to learn
one boolean. Instead: check CI **once**, a couple of minutes after pushing. If it is still
running, say so and **end the turn** — report the PR URL and let the user or a later
session pick it up.

On a failure, read the log. If it is unambiguous and mechanical — lint, formatting, a type
error, an obviously wrong assertion — fix it and re-push **exactly once**. On a second
failure, or any failure that is not clearly mechanical, **stop and report the log**.
**Never work around a permissions, auth or branch-protection failure** — report it. There
is no automerge here by design: a human reviews the diff.

CI is `.github/workflows/ci.yml` on pull requests to `main`. `main` is branch-protected;
PRs from `claude/*` branches are accepted normally.
