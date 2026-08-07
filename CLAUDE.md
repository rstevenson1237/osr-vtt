# CLAUDE.md

A browser-based virtual tabletop for OSR/tabletop RPGs. Serverless on Firebase (Spark
tier), no custom backend. `README.md` has the overview and the dev commands.

One file loads automatically in **every** session:

@RULES.md

Everything else is an on-demand read. **Read by section, never whole.**

---

## Reading budget

`SPEC.md`, `DECISIONS.md`, `INTAKE.md` and `PLAN-COMPLETED.md` are indexes. The content
sits in per-entry files, one id each:

| Need                                 | Read                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| A cited spec                         | `docs/spec/SPEC-nnn.md` (index: `SPEC.md`)                            |
| A decision, or reversing one         | `DECISIONS.md` §Open/§Postponed; closed → `docs/decisions/DEC-nnn.md` |
| Triage, classifying new requests     | `INTAKE.md` §1.1/§1.2                                                 |
| The current or next work item        | `PLAN.md`                                                             |
| Present-day behaviour of a subsystem | `README.md`, by section                                               |
| A closed work item's history         | `docs/completed/WI-nnn.md` (index: `PLAN-COMPLETED.md`)               |

**Never `Read` a file over ~300 lines whole.** `Grep -n` for the id or heading, then
`Read` with `offset`/`limit`. `README.md` and `INTAKE.md` stay whole files — section-read
them.

`docs/archive/` holds the immutable pre-split originals. Never edit it (RULE-020).

**Precedence.** `RULES.md` outranks everything. `README.md` outranks the specs on
present-day behaviour. The specs outrank improvisation.

---

## Sessions

**One session, one work item** (RULE-016) — and one _phase_:

- **Planning** (`/work-item`, steps 1–5) reads the indexes and writes docs. Ends at the
  approval gate, and the session ends with it.
- **Execution** (`/execute-wi`, steps 6–8) reads the WI block, the cited spec file, and
  the code. It does **not** read `INTAKE.md`, `DECISIONS.md` or `PLAN-COMPLETED.md`.

**Model.** Every work item names a target in `PLAN.md`, and it is binding: `opus` for
schema/migration/render-pass/auth/security-rules work and for planning; **`sonnet` is the
default for execution**; `haiku` for mechanical, bounded work. Running a `sonnet` item on
`opus` spends the month's allocation several times over for no gain.

**Cheap turns.** Batch verification into one `pnpm verify`. Don't re-read a file you just
edited. Prefer a targeted `Grep` over a subagent — a subagent keeps the main context small
but costs more in total. Never poll in a loop.

---

## Standing rule: no out-of-chain changes

**Every change originates from a `PLAN.md` work item that has cleared its approval gate**
(RULE-015). No side fixes, no opportunistic cleanups, no "while I was in there" edits.

**The one exception:** a change genuinely required to unblock the current work item —
make it, and record it under **Deviations** in the completion summary. Everything else is
an intake item and waits its turn. Noticing a real bug outside the current work item is
not a licence to fix it.

---

## The workflow

Steps 1–5 live in `.claude/commands/work-item.md`; steps 6–8 in
`.claude/commands/execute-wi.md`. Invoke `/work-item` and `/execute-wi` rather than
working from memory. The four things that hold whichever command is running:

1. **Every request is triaged before it is scheduled.** Shape A (complex or reversing)
   goes straight to multi-phase treatment; Shape B items are logged and classified
   **individually** as Simple / Deceptive / Investigation / Unclear.
2. **The gate has four named sections** — What, Why, Impact, Alternatives — and the agent
   stops there.
3. **The completion summary has four named sections** — Changes made, Visible behavior
   changes, How to verify, Deviations — and is finalised only after the suite passes. A
   summary written before verification is a prediction, not a record.
4. **Docs and code move together** (RULE-018), in one pull request.

### Deceptive triggers

The test is whether an item **changes the contract** — the shape, the meaning, or what
callers may assume — **not** whether it touches a file that implements one. Deceptive if
it changes:

- the `CampaignStore`/`AssetStore` interface: a new method, or a changed signature or
  guarantee (RULE-001);
- the `GameMap`/`Room`/`PlayerSeat` schema, or a stored field's type or meaning — anything
  needing a migration (RULE-007);
- `firebase/firestore.rules` or `firebase/database.rules.json` (RULE-004);
- what a coordinate, a layer or a pipeline stage **means**: lattice semantics, Pixi layer
  order, the carve pipeline's inputs and outputs (RULE-006);
- auth, sign-in providers, App Check, or the join path (RULE-011);
- which store a given write goes to (RULE-003);
- a `data-testid` a Playwright spec depends on — moved, renamed or removed (RULE-005);
- the stated behaviour of any existing `SPEC-nnn`.

**Touches but does not redefine** is not a trigger: calling an existing store method,
drawing on an existing layer, _adding_ a new `data-testid`, or changing one pure function
in the carve pipeline without changing what its output means.

> The test is redefinition, not proximity — "touches" over-fired on 6 of 12 items in the
> map-tools batch (IN-014 Simple vs IN-003–006 Deceptive, same files).

**Classify conservatively.** The carve-out narrows the triggers; it does not license
optimism about an item that plausibly sits on both sides.

---

## Conventions

**IDs** are permanent and never reused (RULE-019): `RULE-`, `SPEC-` (+ `docs/spec/`),
`WI-`, `IN-`, `DEC-` (+ `docs/decisions/`). Retired entries are annotated in place. New
work items start at **WI-028**; historical numbers are zero-padded (`WI-25` → `WI-025`).
**`[HUMAN]`** items — console setup, playtests, credentials, mockup approval — are never
delegated. **`external-agent`** items carry the spec text inline (`PLAN.md` §5).

**Rule amendments are standalone** (RULE-017): own commit, prefixed `RULE-AMENDMENT:`,
never bundled into an implementation. Ceremony in `RULES.md`'s header.

**Write `PLAN.md` status back before any long-running operation** — emulator suite,
Playwright, build, subagent. Compaction can land mid-operation and `PLAN.md` on disk is
the only state that survives it.

**Harness** (`.claude/`): `settings.json` pre-approves read-mostly git/`gh` and registers
exactly three `PreToolUse` hooks — `guard-protected-paths.sh` (RULE-020 archive writes,
RULE-017 commit prefix), `guard-git-push.sh` (no force-push, no push to `main`),
`remind-plan-status.sh` (the write-back above). No fourth without a work item and a
`DECISIONS.md` entry.
