# OSR VTT — Master Plan (retired)

**This document has been split into five files at the repository root.** It is retained
only as a signpost; nothing here is authoritative.

| Was                                  | Is now                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Part I — invariants & golden rules    | [`RULES.md`](../RULES.md) — `RULE-001`…`RULE-020`               |
| Part II — the system as it stands     | [`README.md`](../README.md) — project overview + current system |
| Part III — reference specs `R1`–`R26` | [`SPEC.md`](../SPEC.md) — `SPEC-001`…`SPEC-027`                 |
| Part IV — work items                  | [`PLAN.md`](../PLAN.md) — intake, upcoming, completed           |
| Parts V & VI — decisions, open items  | [`DECISIONS.md`](../DECISIONS.md) — Open / Closed / Postponed   |
| Part 0 — conventions                  | [`CLAUDE.md`](../CLAUDE.md) — agent workflow and conventions    |

**Start at [`CLAUDE.md`](../CLAUDE.md)** if you are an agent, or
[`README.md`](../README.md) if you are orienting on the project.

## Finding old citations

- **`R`-numbers.** `R1`–`R26` and `R9′` map to `SPEC-001`–`SPEC-027` via the permanent
  crosswalk at the top of [`SPEC.md`](../SPEC.md). Sub-numbers are preserved:
  `R24.1` → `SPEC-025 §1`.
- **`WI` numbers.** Unchanged, zero-padded: `WI-25` → `WI-025`. The lettered vector
  series keeps its letters. Completed items live in `docs/archive/PLAN-COMPLETED-*.md`,
  indexed from [`PLAN.md`](../PLAN.md) §4.
- **"Part II §n".** Those section numbers are retained in the `README.md` headings —
  e.g. Part II §6 is `README.md` § "Dice (II.6)".

## The original text

The full pre-split document is preserved byte-for-byte at
[`archive/VTT_Master_Plan.ORIGINAL.md`](archive/VTT_Master_Plan.ORIGINAL.md). It is
**immutable** (RULE-020) and is the reconciliation reference for the split — a
`PreToolUse` hook blocks edits to it. Its earlier history, including the five documents
_it_ consolidated, remains in git.
