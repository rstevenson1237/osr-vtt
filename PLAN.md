# PLAN

Work-item ledger. Source: `docs/VTT_Master_Plan.md` Part IV (archived verbatim at
`docs/archive/VTT_Master_Plan.ORIGINAL.md`).

Every change to this repository originates from an item in this file that has cleared
its approval gate (RULE-015). The workflow that fills these tables is in `CLAUDE.md`.

**ID schemes.** `IN-nnn` intake, `WI-nnn` work items. Numbers are permanent and never
reused (RULE-019). Historical work items keep their Master Plan numbers, zero-padded:
`WI-0` → `WI-000`, `WI-25` → `WI-025`; the vector series keeps its letters,
`WI-A`–`WI-D`. New work items start at **WI-028**.

**Pattern for every WI:** send the prompt → review PR → check the gate → `[HUMAN]`
Chromebook playtest → merge green → only then start the next.

---

## 1. Intake triage

Classified, not yet scheduled. Classification is itself an approval gate: nothing
advances out of this table until the user approves the classifications.

| IN     | Raw user request                                                                                                                                                                     | Classification         | Rationale                                                                                                                                                                                                                                        | Proposed disposition                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| IN-001 | "Refactor this repository's planning and instruction documentation." (Phases 0–4: baseline, split the Master Plan into five files, write CLAUDE.md, apply decided configuration, reconcile.) | **Complex (Shape A)**  | Large refactor spanning every planning document, plus new harness configuration (hooks, slash command, settings). Not a playtest item, so Simple/Deceptive triage does not apply; it arrived already discussed and multi-phase.                     | → **WI-028**. Phases 1–3 executed; Phase 4 reconciliation gates deletion of the source document. |
| IN-002 | Carried from the WI-025 ledger: "the remaining step is watching metrics through at least one full real session and then flipping to **enforcement**."                                    | **Deceptive**          | Touches **auth** — a Deceptive trigger by name. SPEC-025 §2 states outright that enforcing early "will lock out legitimate clients". Zero code changes, but the failure mode is a total outage for every player, and there is no in-app reversal path. | → **WI-029**, `[HUMAN]`. Its multi-phase plan already exists as SPEC-025 §2's monitoring-first rollout; the gate is your explicit go-ahead after reviewing console metrics. |

**Note on IN-002's classification.** Triage says Deceptive items "do not get scheduled;
they stop and become a conversation with the user, then a multi-phase plan with its own
specs." That conversation and that plan already happened — SPEC-025 §2 _is_ the
multi-phase plan, and monitoring mode is phase one, already live. WI-029 is phase two.
It is listed below rather than withheld because withholding it would lose the only
record that the rollout is half-finished.

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                           | Spec        | From   | Agent   | Effort | Gate                                                           |
| ---------- | --------------------------------------------------------------------- | ----------- | ------ | ------- | ------ | -------------------------------------------------------------- |
| **WI-029** | Flip App Check from monitoring to enforcement in the Firebase console | SPEC-025 §2 | IN-002 | `human` | low    | **Gate 029** — see below. Console-only; no code change, no PR. |

### Gate 029 — App Check enforcement

Console metrics reviewed across at least one full session with real players; the
verified-request ratio is high enough that flipping to enforcement will not lock out a
legitimate client. Nothing in the codebase changes.

### WI-029 — step-by-step (`[HUMAN]`)

Written for someone unfamiliar with the Firebase console. App Check is already
registered and running in **monitoring** mode; this only changes the enforcement switch.

1. Open <https://console.firebase.google.com> and select the OSR VTT project.
2. In the left sidebar, scroll to the **Build** section and click **App Check**.
3. Click the **Apps** tab. You should see the web app listed with a reCAPTCHA v3
   provider already attached. If it is not there, stop — registration was not completed,
   and that is SPEC-025 §2's first `[HUMAN]` step, not this one.
4. Click the **APIs** tab. You will see rows for **Cloud Firestore** and **Realtime
   Database**, each showing a percentage of **verified requests** over the last period.
5. **Read those percentages before changing anything.** You are looking for verified
   requests to be at or very near 100% across a period that includes at least one full
   session with real players on their own devices. If the number is meaningfully below
   100%, some legitimate client is not sending a valid App Check token, and enforcing
   now will lock that person out of the app entirely.
   - If it is below 100%, **stop here.** Note the percentage and which API, and report
     back. Do not enforce.
6. If both APIs read ~100%: click **Cloud Firestore**, then **Enforce**, then confirm.
7. Repeat for **Realtime Database**: click it, then **Enforce**, then confirm.
8. Verify immediately: open the deployed app in a normal browser window, create a room,
   join it from a second browser (or a phone), move a token, and roll a die. All four
   must work. If anything fails with a permission error, return to the same **APIs** tab
   and click **Unenforce** on both — the switch is reversible and takes effect within
   minutes.
9. Report the outcome so WI-029 can be closed and SPEC-025 moved from **Active** to
   **Completed**.

**Do not** change the reCAPTCHA site key, add or remove app registrations, or touch any
other console section while doing this. Nothing here requires a billing card; App Check
enforcement is free on Spark (RULE-010).

---

## 3. Completed work items — current milestone (`docs-refactor`)

Each completed entry carries the four-section completion summary: **Changes made**,
**Visible behavior changes**, **How to verify**, **Deviations**.

| WI         | Description                                             | Spec        | From   | Agent         | Effort | Closed     |
| ---------- | ------------------------------------------------------- | ----------- | ------ | ------------- | ------ | ---------- |
| **WI-028** | Split the Master Plan into five documents; write CLAUDE.md; add hooks, `/work-item`, settings pre-approvals | — (process) | IN-001 | `claude-code` | high   | 2026-08-01 |

#### WI-028 — Documentation refactor

**Changes made.**

- `docs/archive/VTT_Master_Plan.ORIGINAL.md` — **new.** Byte-identical copy of the
  pre-split Master Plan (md5 `e75d27b3d3e1a7bb30bb7f1e1efcda75`). Immutable (RULE-020).
- `RULES.md` — **new.** Part I §1 (golden rules) and §2 (trust/backend) as
  `RULE-001`…`RULE-014`, plus `RULE-015`…`RULE-020` covering process (out-of-chain
  changes, one-session-one-item, amendment separation, docs-with-code, ID reuse, archive
  immutability). Carries the mandated amendment-ceremony header.
- `README.md` — **new.** Part II verbatim (11 subsystem sections, source order kept, Part
  II numbers retained in headings), plus Part I §3 repo map, §4 dev commands and the
  proxy trap, plus front-matter provenance and the companion-asset list.
- `SPEC.md` — **new.** Part III as `SPEC-001`…`SPEC-027`, each with a status of Active /
  Completed / Superseded, a status vocabulary, an index, and a permanent `R`-number
  crosswalk. Superseded specs retained in place naming their successors.
- `PLAN.md` — **new.** Intake triage (`IN-001`, `IN-002`), upcoming work items, completed
  work items, milestone archive index, and templates for `external-agent` briefs and
  completion summaries.
- `DECISIONS.md` — **new.** Parts V and VI as Open / Closed / Postponed, `DEC-001`…
  `DEC-020`. Locked defaults and the vector-map decision log preserved verbatim as
  tables (format exception, DEC-014).
- `docs/archive/PLAN-COMPLETED-{v2-core,vector-map,addendum-c,access-lifecycle}.md` —
  **new.** Four closed milestones (DEC-007).
- `CLAUDE.md` — **rewritten.** `@`-imports `RULES.md` and `DECISIONS.md`; routes to
  `README.md`/`SPEC.md`/`PLAN.md` as on-demand reads; documents the eight-step intake→gate
  →execute chain, ID schemes, and Part 0's work-item conventions.
- `docs/VTT_Master_Plan.md` — **replaced with a stub** pointing at the five files, with
  guidance for resolving old `R`/`WI`/"Part II §n" citations.
- `.claude/settings.json`, `.claude/hooks/guard-protected-paths.sh`,
  `.claude/hooks/guard-git-push.sh`, `.claude/commands/work-item.md` — **new.**
- `.prettierignore` — added `docs/archive/` (see Deviations).

**Visible behavior changes.**

- **Documentation locations moved.** `docs/VTT_Master_Plan.md` is now a stub; its content
  lives in five root files. Any bookmark, link or habit pointing at the Master Plan lands
  on the signpost.
- **New harness behaviour in Claude Code sessions.** Two `PreToolUse` hooks now deny:
  edits to `docs/archive/**`; `git commit` touching `RULES.md` without a
  `RULE-AMENDMENT:` prefix; `git push --force` in any spelling; and any `git push`
  targeting `main`. A `/work-item` slash command is available. Ten read-mostly git/`gh`
  commands no longer prompt.
- **No application behaviour changed.** No file under `apps/`, `packages/`, `firebase/`
  or `scripts/` was touched. No schema, rule, test or build change.

**How to verify.**

- `md5sum docs/archive/VTT_Master_Plan.ORIGINAL.md` → `e75d27b3d3e1a7bb30bb7f1e1efcda75`,
  matching `git show 440c01d:docs/VTT_Master_Plan.md | md5sum`.
- `ls RULES.md README.md SPEC.md PLAN.md DECISIONS.md` — all five present.
- Open `SPEC.md` and confirm the crosswalk resolves a citation you remember, e.g.
  `R24.1` → `SPEC-025 §1`.
- Test the hooks:
  `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"'"$PWD"'/docs/archive/x.md"}}' | .claude/hooks/guard-protected-paths.sh`
  → prints a `deny` decision;
  `echo '{"cwd":"'"$PWD"'","tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | .claude/hooks/guard-git-push.sh`
  → prints a `deny` decision.
- Run `/work-item` with a trivial request and confirm it stops at the four-section gate
  without editing anything.
- `pnpm lint && pnpm typecheck && pnpm build` — unaffected; no source file changed.

**Deviations.**

1. **The `RULES.md` write-guard could not be implemented literally.** A `PreToolUse` hook
   on `Write`/`Edit` cannot see a commit message. The guard is split: `docs/archive/**` is
   denied at write time unconditionally; `RULES.md` is denied at *commit* time without the
   prefix. Full reasoning in DEC-016.
2. **`.prettierignore` gained `docs/archive/`** — an out-of-chain change made under the
   RULE-015 exception. Without it, `pnpm format` rewrites the immutable baseline through
   Bash, bypassing the write-time hook and corrupting the reconciliation reference.
3. **Milestone boundaries were an agent judgement** within the user's delegation
   ("as it makes sense based on the shape and size"). Four boundaries drawn on the
   document's own structural seams; DEC-007.
4. **Two additions beyond the specified scope:** `RULE-015`…`RULE-020` derive from the
   workflow instructions rather than Part I; and a fifth ID scheme, `DEC-`, was added
   (DEC-019) because three files needed to cite specific decisions.
5. **Phase 4 found five fidelity defects in the Phase 1 output**, all reverted before
   this work item closed: a dropped requirement-scope statement, a softened
   `claude-opus-4-8` model pin with its `claude-sonnet-4-6` parenthetical dropped, two
   dropped words ("Claude Code", "Chromebook"), and Part VI §1 paraphrased rather than
   preserved. Post-fix: 676/676 backticked identifiers present, 60/60 sections mapped,
   22 residual altered units — all heading renames, structural splits or cross-reference
   remaps.
6. **The Phase 0 inventory was not presented for approval**, and Phase 2 began without
   explicit sign-off on Phase 1, because the user directed "complete phase 1 through 3
   and then stop." The inventory was built and used as the Phase 4 checklist regardless.

---

## 4. Milestone archive index

`PLAN.md` retains completed items for the **current** milestone only. On milestone
close, they move to `docs/archive/PLAN-COMPLETED-<milestone>.md` and leave a one-line
index entry here. See `DECISIONS.md` (archiving policy) for the rationale and for how
these four boundaries were drawn.

| Milestone            | Items                                 | Closed     | Archive                                        |
| -------------------- | ------------------------------------- | ---------- | ---------------------------------------------- |
| **v2-core**          | WI-000 – WI-012 (15 items, incl. WI-004b/005a/005b) | 2026-07-19 | `docs/archive/PLAN-COMPLETED-v2-core.md`          |
| **vector-map**       | WI-A – WI-D (4 items)                 | 2026-07-24 | `docs/archive/PLAN-COMPLETED-vector-map.md`       |
| **addendum-c**       | WI-013 – WI-024 (12 items) + 6 unnumbered follow-on passes | 2026-07-30 | `docs/archive/PLAN-COMPLETED-addendum-c.md`       |
| **access-lifecycle** | WI-025 – WI-027 (3 items)             | 2026-08-01 | `docs/archive/PLAN-COMPLETED-access-lifecycle.md` |
| **docs-refactor**    | WI-028 – (open)                       | —          | current (§3 above)                             |

---

## 5. Templates

### Upcoming entry — `external-agent`

An item assigned to `external-agent` must carry a **self-contained brief** immediately
below the table: the spec text **inline** rather than by reference, the acceptance
criteria, and the file paths in scope. Write it assuming the external agent cannot read
this repository's docs at all.

```md
### WI-nnn — <title> · brief for external agent

**Spec (inline, do not follow references):**
> <the full spec text, pasted — not "see SPEC-0nn">

**Acceptance criteria:**
1. <observable, checkable statement>
2. …

**Files in scope:**
- `path/to/file.ts` — <what may change in it>
- …

**Out of scope:** <everything else, named explicitly>
```

### Completion summary

```md
#### WI-nnn — <title>

**Changes made.** Every file touched and what changed in each.
**Visible behavior changes.** What the user can observe differently — UI, CLI output,
build behavior, file locations. State "none" explicitly if there are none.
**How to verify.** Specific steps, commands, or screens to confirm the work landed.
**Deviations.** Anything done differently from the approved plan, including unblocking
changes made under the RULE-015 exception, and why.
```
