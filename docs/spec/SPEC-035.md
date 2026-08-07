## SPEC-035 — Process & context-loading strategy

**Status: Completed** (2026-08-07) — WI-069. Crosswalk: none (process spec, no Master
Plan `R` number).

The agent framework is developed under a fixed monthly allocation. Allocation is consumed
as **(model weight) × (context size) × (number of turns)**, and this spec constrains all
three. It is a process spec: it governs how sessions read and run, not what the app does.

### §1 — Documents are indexes over per-entry files

Four documents exceeded the size at which they can be read whole. Each is now an index,
and its content lives one entry per file:

| Index                 | Entries           | Id → path                   |
| --------------------- | ----------------- | --------------------------- |
| `SPEC.md`             | `docs/spec/`      | `docs/spec/SPEC-nnn.md`     |
| `DECISIONS.md`        | `docs/decisions/` | `docs/decisions/DEC-nnn.md` |
| `PLAN-COMPLETED.md`   | `docs/completed/` | `docs/completed/WI-nnn.md`  |
| `PLAN.md`/`INTAKE.md` | in place (small)  | —                           |

The path is derivable from the id, so an index never needs to carry links to be usable.

`DECISIONS.md` keeps **`# Open` and `# Postponed` in full** — those are read to decide
whether work may start — plus the locked-defaults table and the accepted-limits list,
which are normative and short. Only `# Closed` is indexed out. The condensed vector-map
decision log moves verbatim to `docs/decisions/vector-map-log.md`.

**Nothing is deleted, renamed or renumbered** (RULE-019). Every `SPEC-`, `DEC-` and `WI-`
id that existed before the split resolves after it, and superseded or historical entries
keep their text verbatim, including stale in-heading annotations.

### §2 — Read by section, never whole

No file over ~300 lines is read entire. `Grep -n` for the id or symbol, then `Read` with
`offset`/`limit`. This applies to `README.md` and `INTAKE.md`, which remain single files.

### §3 — One session, one phase

RULE-016 gives one work item per session. This spec adds one **phase** per session:

- **Planning** — `/work-item`, steps 1–5. Reads the indexes; writes docs. Ends at the
  approval gate, and the session ends with the gate.
- **Execution** — `/execute-wi`, steps 6–8. Reads the work-item block, the cited spec
  file, the relevant `README.md` section, and the code. It does not read `INTAKE.md`,
  `PLAN-COMPLETED.md`, `docs/completed/`, or `DECISIONS.md` unless a specific `DEC-nnn`
  is named.

### §4 — The model target is binding

`PLAN.md` has always recorded a model target per work item. It is now binding on the
execution session: `sonnet` is the default, `opus` is reserved for schema, migration,
render-pass, auth and security-rules work and for planning turns, `haiku` for mechanical
bounded items. Running a `sonnet` item on `opus` spends several times the allocation for
no gain, and is the single largest avoidable cost in the framework.

### §5 — Turns are a cost, not just tokens

Every turn re-sends the whole session context, so a loop is quadratic in a way a long
command is not.

- **Verification is one command.** `pnpm verify` (lint + typecheck + unit) and
  `pnpm verify:all` (adds the emulator-backed rules/store/e2e battery) print **failures
  only** — a green step is one line. `scripts/verify.mjs` captures each step and emits at
  most the last 40 lines of a failing one.
- **Playwright reports on `line`**, not `list`: one progress line rather than one line per
  test.
- **CI is not polled in a loop.** The former 30s × 20 poll spent up to twenty
  full-context turns to learn one boolean. `/execute-wi` checks once, a couple of minutes
  after pushing, and ends the turn if CI is still running.
- **Subagents are not free.** A subagent keeps the parent context small but spends more in
  total — its own system prompt, its own reads, and its report. Prefer a targeted `Grep`
  unless the search would otherwise dump thousands of lines into the main thread.

### §6 — What this spec does not change

The chain itself. Every change still originates from an approved work item (RULE-015),
gates still carry four named sections, completion summaries are still written after the
suite passes, docs still move with code (RULE-018), and no rule amendment rides on an
implementation commit (RULE-017). Ceremony is cheap relative to re-work; only its prose
length was cut.
