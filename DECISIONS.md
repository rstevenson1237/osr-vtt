# DECISIONS

Decision log. Source: `docs/VTT_Master_Plan.md` Parts V and VI (archived verbatim at
`docs/archive/VTT_Master_Plan.ORIGINAL.md`).

**A decision never eliminates an option.** It only requires flagging the user before
proceeding down a path it touches. A Closed entry is a default, not a wall: reopening
one is an ordinary intake item, not an argument.

## Entry shape

Each entry records:

- **Question** — what was actually being decided.
- **Recommendation** — what the agent advised, or what was proposed.
- **Impact** — what it affects, including anything it makes harder to reverse.
- **Alternatives** — what else was considered, and why it was not chosen.
- **Answer** — the decision, once given, with who gave it and when.

**Format exception.** Two bodies of inherited material — the locked-defaults table and
the vector-map decision log — are preserved **verbatim as tables** rather than expanded
into five-field entries. Expanding them would mean inventing rationale and alternatives
the source never recorded, which is worse than a format inconsistency. New entries use
the five-field shape.

**IDs.** `DEC-nnn`, permanent, never reused (RULE-019). Severity tiers that route a
decision here are defined in `CLAUDE.md` step 3: **Blocking** (logged Open, work stops),
**Default-and-notify** (logged Closed as an agent default, surfaced in the completion
summary), **Silent** (not logged).

---

# Open

Blocking. Work that depends on these stops until they are answered.

## DEC-001 — Map-edit permissions: should players be able to carve the shared map?

- **Question.** The vector toolbar is shown to **every** room member, consistent with
  the "all room members can write" trust model; only `add-creature` is GM-gated. The old
  cellular map hid all editing tools from players. Should the toolbar be gated behind
  `isGM`?
- **Recommendation.** Leave it open to all seats. It matches RULE-008's trust model, and
  the referee's lever against a griefing member is removal, as everywhere else in the
  app.
- **Impact.** UI-visible for every player. Gating it is a small change (`isGM` around
  `MapToolbar`), but it changes who can build a dungeon collaboratively — some tables
  want exactly that.
- **Alternatives.** (a) Gate the whole toolbar behind `isGM`. (b) Gate only the
  destructive/structural tools (Carve, Wall, Door) and leave View/Overlay open. (c)
  Make it a room setting.
- **Answer.** _Awaiting the user's call._ Also annotated in `README.md` § "Map system —
  vector (II.2)" as "⚠️ Flagged, unratified".

**Source text, verbatim** (Master Plan Part VI §1 item 1):

> **Map-edit permissions.** The vector toolbar is shown to **every** room member,
> consistent with the "all room members can write" trust model; only `add-creature` is
> GM-gated. The old cellular map hid all editing tools from players. If players should
> not be able to carve/edit the shared map, the toolbar can be gated behind `isGM` — a
> small change, awaiting the call.

## DEC-002 — Theme engine: reachability, or authoring?

- **Question.** The theme select is wired and reachable (SPEC-017). Is a fuller theme
  _engine_ — editing and creating custom token sets — wanted?
- **Recommendation.** No, not now. SPEC-002 says the deliverable was the _system_, and
  "more themes are content, not code" is already a locked default.
- **Impact.** A theme authoring UI is a large, unscoped SPEC-002 extension: a token
  editor, persistence for user-defined token sets, and a sharing story. It touches
  `room.settings.theme`, which is GM-set and room-level.
- **Alternatives.** (a) Nothing further. (b) Ship more built-in themes as content only.
  (c) Full authoring engine.
- **Answer.** _Unscoped, awaiting a call._

**Source text, verbatim** (Master Plan Part VI §1 item 2):

> **Theme engine — reachability or authoring?** The theme select is wired and reachable.
> Whether a fuller theme _engine_ (edit/create custom token sets) is wanted is a larger
> R2 extension, unscoped.

The same question is noted at SPEC-002: "(Whether a fuller theme _authoring_ engine —
editing/creating custom token sets — is wanted remains open; see `DECISIONS.md` → Open.)"

---

The four entries below were requested as assessments only — **proposed, not
implemented.** Nothing in this refactor acts on them.

## DEC-003 — Plan mode as a supplement to the step-5 approval gate

- **Question.** Should Claude Code's plan mode be used alongside the four-section
  approval gate (What / Why / Impact / Alternatives)?
- **Recommendation.** **Yes, as a supplement — never as a replacement.** Enter plan mode
  to do the investigation, then present the four named sections as the gate itself. Plan
  mode's default output describes *what* will be done; it does not reliably cover *why*,
  *impact*, or *alternatives*, which are three quarters of the gate. Treat `ExitPlanMode`
  as "I have finished investigating", and the four sections as "here is the decision you
  are approving".
- **Impact.** Low and additive. It costs nothing, keeps investigation read-only before
  approval, and gives a second natural stopping point. The risk is drift: an agent that
  treats plan-mode approval *as* gate approval has skipped the gate, and the user will
  have approved a plan without ever seeing Impact or Alternatives.
- **Alternatives.** (a) Plan mode replaces the gate — rejected, it loses three of the
  four sections. (b) No plan mode, gate only — workable, but investigation then happens
  with write tools live, which sits badly with RULE-015. (c) Gate only for Deceptive and
  Complex items, plan mode alone for Simple ones — plausible, but it makes the gate
  format conditional, and a conditional gate is one people forget.
- **Answer.** _Awaiting the user's call._

## DEC-004 — Subagents for isolated or parallel work items

- **Question.** Should work items be dispatched to subagents, in isolation or in
  parallel?
- **Recommendation.** **Narrowly, and not for execution.** Subagents earn their keep for
  read-only fan-out — "find every consumer of `pointInFloorUnion`", "which specs cite
  SPEC-009" — where the answer matters and the file dumps do not. They are a poor fit for
  *executing* work items here, because RULE-016 says one session executes one work item,
  and a subagent that writes code is a second execution context with no gate of its own.
  Each spawn also starts cold and re-derives context this session already holds.
- **Impact.** Used for research: strictly positive, no chain implications. Used for
  execution: it fractures the approval chain, since the gate was presented for one work
  item and the subagent's writes are not separately approved. Parallel work items also
  collide on the same five documentation files, which RULE-018 requires every change to
  touch.
- **Alternatives.** (a) Subagents for execution, one work item each — rejected, see
  above. (b) No subagents at all — loses cheap parallel research for no gain. (c)
  Subagents for research plus `external-agent` work items with self-contained briefs
  (which `PLAN.md` already templates) — this is the shape I would actually recommend if
  you want delegated execution.
- **Answer.** _Awaiting the user's call._

## DEC-005 — Nested per-directory `CLAUDE.md` files

- **Question.** Should `apps/web/` and `packages/shared/` carry their own `CLAUDE.md`
  files?
- **Recommendation.** **Not yet.** The workspace has exactly two packages, and the
  boundary between them is already stated in one line in `README.md`'s repo map. A nested
  file earns its keep when a directory has conventions that contradict or refine the root
  — and here the strongest such convention, RULE-001's store abstraction, is precisely
  the one that must be visible from *both* sides at once.
- **Impact.** Nested files load only when files in that directory are touched, so they
  reduce root-context size — a real benefit as the root `CLAUDE.md` grows. The cost is
  drift: two places that describe the store contract will eventually disagree, and the
  one the agent happens to load wins. That is the exact failure this refactor was
  commissioned to fix.
- **Alternatives.** (a) One nested file per package, duplicating the relevant rules —
  highest drift risk. (b) Nested files that contain *only* pointers back to the root
  documents — near-zero value. (c) Revisit if the workspace grows a third package with
  genuinely local conventions (a second backend, per the PocketBase item below).
- **Answer.** _Awaiting the user's call._

## DEC-006 — Git worktrees for concurrent work items

- **Question.** Should concurrent work items run in separate git worktrees?
- **Recommendation.** **No, under the current chain.** RULE-016 permits one work item per
  session, so there is nothing concurrent to isolate. Worktrees would only matter if you
  chose to relax that rule.
- **Impact.** If adopted, worktrees do solve real problems — no branch thrash, no
  half-finished edits colliding — and this environment supports them directly. But every
  work item must touch the five root documentation files (RULE-018), so two concurrent
  items produce a guaranteed merge conflict in `PLAN.md` at minimum, and probably in
  `SPEC.md` and `DECISIONS.md` too. The isolation is real for code and illusory for docs.
- **Alternatives.** (a) Worktrees plus a rule that only one work item at a time may
  modify `PLAN.md` — workable, but that is most of RULE-016 back again with extra steps.
  (b) Worktrees for `external-agent` items only, where the brief is self-contained by
  construction and the agent never touches the docs — this is the one variant I would
  recommend if you want it. (c) Status quo: one session, one item, one branch.
- **Answer.** _Awaiting the user's call._

---

# Closed

## Decisions taken during this refactor (WI-028)

All of the following are **agent defaults** under the Default-and-notify tier, except
DEC-015 through DEC-018, which the user decided in advance, and DEC-007 through DEC-010,
which the user answered directly. Every one is reversible.

### DEC-007 — Milestone boundaries

- **Question.** Phase 3's archiving policy needs a milestone boundary. The source
  document has no milestone concept.
- **Recommendation.** Draw the boundaries on the document's own structural seams — the
  four bodies of work its retired-documents table already records.
- **Impact.** Determines how `PLAN.md`'s completed table is split, and produces four
  archive files instead of one. Fully reversible: merging archives is a file
  concatenation.
- **Alternatives.** (a) One milestone covering everything shipped to date — simpler, one
  archive file, but throws away a real structural distinction between the v2 build-out,
  the vector cutover, the polish pack and the access-control spine. (b) Leave everything
  inline in `PLAN.md` and close no milestone — keeps the archive mechanism untested.
- **Answer.** **User, 2026-08-01**, delegating: "I think add them as it makes sense based
  on the shape and size of the changes." Four closed milestones — `v2-core` (WI-000–012),
  `vector-map` (WI-A–D), `addendum-c` (WI-013–024 + the unnumbered follow-on passes),
  `access-lifecycle` (WI-025–027) — plus the open `docs-refactor`. Indexed in `PLAN.md` §4.

### DEC-008 — Repo map and dev commands live in README, not RULES

- **Question.** Part I maps to `RULES.md`, but Part I §3 (repo map) and §4 (dev commands,
  proxy trap) are descriptive orientation, which is README's brief.
- **Recommendation.** README. `RULES.md` takes only the normative content — Part I §1's
  seven golden rules and §2's trust/backend invariants.
- **Impact.** Content crosses the Part→file mapping the user specified. No text changes.
- **Alternatives.** (a) Literal mapping — makes "RULE-012: `pnpm dev` starts the Vite
  server" a rule nobody can violate. (b) Both files — two copies of the dev command list
  that will drift, which is the failure this refactor exists to fix.
- **Answer.** **User, 2026-08-01:** README; RULES gets only normative content.

### DEC-009 — Part 0 splits between CLAUDE.md and README

- **Question.** Part 0 ("How to use this document") has no destination in the five-file
  split.
- **Recommendation.** Split it. The `[HUMAN]`/`[AGENT]` conventions, model targets,
  effort levels and one-WI-per-prompt rule are workflow instructions → `CLAUDE.md`. The
  retired-documents table, companion mockup assets and reading order are provenance →
  `README.md`.
- **Impact.** Part 0 is the one part with no assigned home, so some split was required.
- **Alternatives.** (a) All into `PLAN.md` as a preamble — buries the mockup asset list.
  (b) All into `README.md` — puts agent workflow conventions in the newcomer overview and
  duplicates `CLAUDE.md`.
- **Answer.** **User, 2026-08-01:** split as recommended.

### DEC-010 — Historical work items are zero-padded, not renumbered

- **Question.** The new scheme is `WI-001` onward, but the ledger uses `WI-0`…`WI-27` and
  `WI-A`…`WI-D`, cited in PR titles and commit messages.
- **Recommendation.** Zero-pad in place — `WI-0` → `WI-000`, `WI-25` → `WI-025` — keeping
  the letters as letters. Numerically identical to history, so nothing is renamed, and no
  ID is ever reused. New items start at **WI-028**.
- **Impact.** The first new work item is WI-028, not WI-001. IDs 001–027 are permanently
  spoken for.
- **Alternatives.** (a) Leave IDs unpadded — mixes two spellings of one scheme. (b)
  Renumber everything from WI-001 — every historical ID changes meaning and git history
  stops resolving. Advised against.
- **Answer.** **User, 2026-08-01:** zero-pad, new items start at WI-028.

### DEC-011 — Specs renumbered SPEC-001+ with a permanent crosswalk

- **Question.** Part III's specs are `R1`–`R26` (plus `R9′`). The new scheme is
  `SPEC-001` onward.
- **Recommendation.** Renumber sequentially in source order, giving `R9′` its own number
  (SPEC-010) rather than a suffix, and publish a permanent old→new crosswalk at the top of
  `SPEC.md`. Sub-numbers are preserved: `R24.1` → `SPEC-025 §1`.
- **Impact.** Every `R`-citation in git history, PR titles and code comments now needs
  the crosswalk to resolve. That is a real cost, accepted because the alternative keeps a
  numbering scheme with a Unicode prime in it.
- **Alternatives.** (a) Keep `R` numbers and just relabel the file — no renumber, but the
  requested `SPEC-001` scheme is not implemented. (b) Renumber and delete the crosswalk —
  breaks history irrecoverably.
- **Answer.** Agent default. Crosswalk is in `SPEC.md`; archives cite both numberings.

### DEC-012 — Spec status vocabulary, and what "Active" means

- **Question.** Each spec carries one status of Active, Completed or Superseded. Most
  specs shipped but contain clauses that bind future work forever (SPEC-003 §5's licence
  discipline, SPEC-010's non-goals, SPEC-017's anchor rule).
- **Recommendation.** Define the three statuses explicitly in `SPEC.md`, and mark
  standing constraints inline rather than inventing a fourth status. **Active** means
  "something in it is still outstanding" — which today is only SPEC-025.
- **Impact.** Only one spec reads as Active. That is accurate: everything else has
  shipped.
- **Alternatives.** (a) A fourth "Standing" status — more precise, but the user specified
  three. (b) Mark every spec with a standing clause as Active — would make most of the
  file Active and drain the word of meaning.
- **Answer.** Agent default. Vocabulary table is at the top of `SPEC.md`.

### DEC-013 — Superseded specs may name a README section as successor

- **Question.** Phase 4 requires every superseded spec to name a valid successor.
  SPEC-001's successor is the Quick Sheets shell, which is described in `README.md` and
  has no spec of its own — it shipped as an unnumbered follow-on pass.
- **Recommendation.** Allow a successor to be either a `SPEC-nnn` ID or a named
  `README.md` section. Naming a section that exists is a resolvable reference; inventing a
  retroactive spec for shipped work is not.
- **Impact.** Referential-integrity checking must accept two successor forms.
- **Alternatives.** (a) Write a retroactive SPEC for the Quick Sheets shell — fabricates a
  specification that never governed the work. (b) Leave the successor blank — fails the
  Phase 4 check.
- **Answer.** Agent default. SPEC-001 → `README.md` § "Session shell — quick sheets
  (II.1)"; SPEC-009 → SPEC-010.

### DEC-014 — Legacy tables preserved verbatim rather than reshaped

- **Question.** Every decision entry is specified to carry question / recommendation /
  impact / alternatives / answer. The inherited locked-defaults table and vector-map
  decision log are terse table rows that record none of those fields.
- **Recommendation.** Preserve them verbatim as tables. Reshaping them would mean
  inventing rationale and alternatives the source never recorded.
- **Impact.** `DECISIONS.md` has two formats. Flagged at the top of the file.
- **Alternatives.** (a) Expand each row into five fields — fabricates history. (b) Drop
  the rows that do not fit — loses ratified decisions.
- **Answer.** Agent default. Format exception noted in the header.

### DEC-015 — Archiving policy

- **Question.** How do completed items and superseded specs age out?
- **Recommendation.** —
- **Impact.** `PLAN.md` stays short; history stays retrievable. Archives are immutable
  (RULE-020), so a mistake in one is corrected by a new file, not an edit.
- **Alternatives.** Considered and not chosen: keeping every completed item inline
  forever (PLAN.md grows without bound), and deleting completed items outright (loses the
  completion summaries, which are the only record of what was verified).
- **Answer.** **Decided by the user in advance.** `PLAN.md` retains completed items for
  the current milestone only. On milestone close they move to
  `docs/archive/PLAN-COMPLETED-<milestone>.md`, leaving a one-line index entry in
  `PLAN.md` §4. `SPEC.md` retains superseded specs **in place, permanently** — they are
  never archived, because a superseded spec is usually the reason the current design is
  right.

### DEC-016 — PreToolUse hooks: exactly two

> **Superseded in part by DEC-029** (2026-08-02): a third `PreToolUse` hook was added for
> WI-045 (IN-020). The "exactly two, no broader" default below no longer holds; the count
> is now three, fixed the same way — no more without a work item and a `DECISIONS.md`
> entry. This entry is kept in place per RULE-019, not edited away.

- **Question.** Which harness-level guards should exist?
- **Recommendation.** —
- **Impact.** Both hooks deny rather than warn. The push hook makes it impossible to
  push to `main` from a session, which is intended — `main` is also protected
  server-side.
- **Alternatives.** Considered and not chosen: a broader write-guard over all five
  documentation files (too noisy — every work item legitimately edits `PLAN.md`), and
  warn-only hooks (a warning an agent can ignore is not a guard).
- **Answer.** **Decided by the user in advance.** Exactly two, no broader:
  1. Block writes to `docs/archive/**` and to `RULES.md` unless the commit message
     carries a `RULE-AMENDMENT:` prefix.
  2. Block `git push --force` and any `git push` to the default branch.

  **Implementation note — a deviation worth reading.** A `PreToolUse` hook on `Write`/`Edit`
  cannot see a commit message, because at write time no commit exists. The guard is
  therefore split across the two moments where each half is actually observable:
  - `docs/archive/**` — **denied at write time, unconditionally.** The archive is the
    reconciliation reference and RULE-020 makes it immutable, so there is no message that
    should unlock it.
  - `RULES.md` — **denied at commit time** unless the `git commit` message carries the
    `RULE-AMENDMENT:` prefix. Editing the file is allowed; landing the edit without the
    ceremony is not.

  This is the closest faithful reading of the instruction; the literal one is not
  expressible. Flagged rather than silently reinterpreted.

### DEC-017 — `/work-item` slash command

- **Question.** Should the intake→gate chain be invocable as a command?
- **Recommendation.** —
- **Impact.** Makes the gate the default path rather than something to remember. The
  command deliberately **stops at approval and does not execute** — step 6 is a separate,
  human-initiated turn.
- **Alternatives.** Considered and not chosen: a command that runs steps 1–7 end to end
  (removes the approval gate, which is the point of the chain).
- **Answer.** **Decided by the user in advance.** `/work-item` runs steps 1–5: intake
  triage, integration, decision logging, work item creation, and presentation of the
  four-section approval gate. Installed at `.claude/commands/work-item.md`.

### DEC-018 — `settings.json` pre-approvals

- **Question.** Which commands should run without a permission prompt?
- **Recommendation.** —
- **Impact.** `git add` and `git commit` are pre-approved, so a session can stage and
  commit without prompting — but cannot push. Nothing destructive is pre-approved.
- **Alternatives.** Considered and not chosen: pre-approving `git push` (removes the last
  human checkpoint before code leaves the machine).
- **Answer.** **Decided by the user in advance.** Pre-approve `git status`, `git diff`,
  `git log`, `git add`, `git commit`, `git checkout -b`, `gh pr create`, `gh pr view`,
  `gh run list`, `gh run view`. `git push` and all destructive operations continue to
  require confirmation.

  **Note:** the `gh` CLI is **not installed** in the remote execution environment, where
  GitHub access goes through the GitHub MCP server instead. The `gh` entries are
  pre-approved anyway, for local sessions where it is present.

### DEC-019 — `DEC-nnn` ID scheme added

- **Question.** The specified ID schemes are `RULE-`, `SPEC-`, `WI-`, `IN-`. Decisions
  have none, but `PLAN.md`, `README.md` and `SPEC.md` all need to cite specific ones.
- **Recommendation.** Add `DEC-nnn`, under the same never-reuse rule (RULE-019).
- **Impact.** A fifth ID scheme beyond the four specified. Documented in `CLAUDE.md`
  alongside the others.
- **Alternatives.** (a) Cite decisions by heading text — brittle, breaks on any retitle.
  (b) No citations, prose references only — makes Phase 4's referential-integrity check
  unenforceable for this file.
- **Answer.** Agent default.

---

## Locked defaults

Verbatim from Master Plan Part V §1. Locked unless overridden at work-item start.
`R`-citations map through the crosswalk at the top of `SPEC.md`.

| Decision                 | Default (locked unless overridden at WI start)                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Shell model              | Quick Sheets (Part II §1). The R1 Option A rail shell is retired                                     |
| Measurement defaults     | `perSquare: 10`, `unit: "feet"` — applied to existing rooms by migration                             |
| Token snapping           | Cell-center default; Alt = half-grid; Alt+Shift = free                                               |
| Google auth              | Optional link for players; **required to create a room** (R24.1). Anonymous join stays zero-friction |
| Theming scope            | System + two themes (R2); more themes are content, not code                                          |
| Hex grid                 | Deferred                                                                                             |
| Log recording config     | View-side filters primary; room-level recording toggles only for future noisy types                  |
| Uploads (Blaze)          | `[HUMAN]` card decision unlocks `FirebaseStorageAssetStore`; the Assets view ships the disabled slot |
| Floor storage            | Model A — baked union, no construction history                                                       |
| Map schema mismatch      | Error, don't migrate ("unsupported map schema")                                                      |
| Advantage semantics      | Summed = (n+1) pool, 1 extra per kind for mixed; separate = +1 per die; dropped dice dimmed in both  |
| Circular walls           | Not a storage type — a `FloorRegion` ring or an `explicit` segment loop                              |
| Group membership         | A token belongs to **at most one** group                                                             |
| Group creation path      | Renaming the Unassigned bin — the only path                                                          |
| Room soft cap            | `MAX_ROOMS_SOFT = 12`, client-side friction, explicitly not a security boundary                      |
| Stale room threshold     | `STALE_ROOM_DAYS = 90`; surfaced, never auto-deleted                                                 |
| Abandoned seat threshold | `ABANDONED_SEAT_DAYS = 30`; GM-confirmed prune only                                                  |
| Presence heartbeat       | `PRESENCE_HEARTBEAT_MS = 45_000`; disconnected at 2× heartbeat                                       |
| Room activity throttle   | `ROOM_ACTIVITY_THROTTLE_MS` = 5 minutes, in-memory                                                   |

---

## Vector Map System — decision log (condensed)

Verbatim from Master Plan Part V §2. Ratified during the POC and the WI-A–WI-D build
(**user** = product direction; **rec** = Claude Code recommendation accepted).

**Framing (user, 2026-07-19):** full revamp, not an extension — a clean implementation
going forward beats preserving past decisions. Migration = simple error handling, no
scaffold, no dual-read. Runs are new-session-only. Fog removed from the POC entirely
(later rebuilt, see D6).

**Review conflicts and their dispositions:**

| ID  | Finding                                           | Disposition                                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| C1  | Coord-space mismatch (lattice vs pixel)           | One canonical space — **lattice units**, floats. Pixel conversion only at the render/LoS-build boundary            |
| C2  | "No migration" vs the portability hard rule       | Clean break with simple error handling; the portability rule is superseded _for this replacement_                  |
| C3  | `schemaVersion` is room-level → strands campaigns | Moot: nothing migrates, runs are new-session-only                                                                  |
| C4  | Emergent fog loses zero-storage derivation        | Dropped at the time (fog removed); superseded by the D6 rebuild                                                    |
| C5  | Multiple door homes                               | Single `doors/{doorId}` overlay collection; door↔wall resolved at **build time**                                   |
| M1  | `source` field only in prose                      | `source: 'perimeter'\|'explicit'\|'imported'` is a real field on `Segment`                                         |
| M2  | `deleteRoom` must enumerate new collections       | It walks `floorRegions` / `walls` / `doors`                                                                        |
| M3  | `.vttcamp` portability unassigned                 | New-schema round-trip test in WI-B                                                                                 |
| M4  | bbox consumers (grid-shrink guard, PNG export)    | Repointed to union-of-`FloorRegion.bbox`; the grid-shrink guard proved obsolete and was removed (D3)               |
| M5  | Token flood-fill depends on `isFloor`             | `pointInFloorUnion(point)`, called at interaction time — never per-frame                                           |
| M6  | Library offsetting gap                            | "Provides polygon offsetting" was a hard pass/fail gate; `polygon-clipping` failed it, hence `bufferPolyline` + DP |
| M7  | RTDB preview payload shape                        | Raw centerline ring only; never the offset polygon over the wire                                                   |
| M8  | Passage model loses perimeter source              | `blocksMovement` separate from `blocksSight`; perimeter defaults both true                                         |
| R1  | Undo granularity                                  | Snapshot-based, batch-of-snapshots for merge/split                                                                 |

**Model A (floor storage), user, 2026-07-19.** Floor is stored as a baked union of
boundary polygons; a committed shape does **not** retain its primitive type or params.
Model B (construction history / op list) is rejected.

| Axis            | Model A (chosen)                                             | Model B (rejected)                                            |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Source of truth | the union polygon itself                                     | an op list; the union re-folded on every load/edit            |
| Storage         | bounded ~11 KiB worst-case, **self-pruning** (erased = gone) | op list **grows unbounded**, freeform paths unsimplifiable    |
| Merge/split     | free from the boolean op                                     | dissolves the stored-region concept entirely                  |
| Edit locality   | local                                                        | early-op edits re-fold everything after → non-local surprises |
| Load cost       | union already stored                                         | re-fold whole history each open                               |
| Re-edit         | geometric (drag boundary vertices/edges)                     | parametric (n-gon remembers n + radius)                       |

Floor is a **field (union), not a set of objects** — the moment shapes touch, per-shape
identity fights the union model. The identity rules genuinely need already lives on the
object layer. Knowingly given up: n-gon "uniform scale on vertex drag" and rectangle
re-snap, both of which needed retained identity.

**WI-B calls (user).** Governing premise: if the POC is accepted, Firebase is wiped and
the pure vector system rolls out at WI-D — so there is no stored data to preserve and
every coexistence mechanism is a temporary _code_ crutch to delete at WI-D.

- **B1** `wallSegments` through WI-C to avoid colliding with the cellular `walls`
  collection, renamed to `walls` at WI-D. ✅ Done.
- **B2** **No `mapModel` discriminator.** A per-doc flag only earns its keep if both
  models coexist in one live deployment, which the wipe rules out. Cutover is a
  deploy-time event; during dev the two paths were gated by one build flag, never a
  per-map field. ⚠️ **Product ack:** safe only because no old cellular map need be
  openable after launch.
- **B3** `VTTCAMP_FORMAT_VERSION` bumped 1→2 at WI-D; `readManifest`/import reject
  pre-vector archives with an "unsupported" error rather than silently importing an
  unrenderable map. ⚠️ **Product ack:** users lose in-app access to old exported
  campaigns; archives are user-held, so this is a visible break.
- **B4** RTDB carve preview keeps the raw ring
  (`{ uid, tool, mode, points, ts }`). Freeform buffering is a commit-time op that must
  not run per-frame per-peer. If width fidelity is later wanted, add an optional
  `brushRadius?` and stroke a fixed-width line client-side — never ship the offset
  polygon over the wire.
- **B5** `commitFloorRegions` is a **single atomic batch**; "≤500 ops per floor commit"
  is an invariant. Chunking is allowed only for a future non-atomic bulk op (e.g. "clear
  floor"), never for merge/split.
- **B6** Ring-wrap at the Firestore boundary (nested arrays are forbidden). **Permanent
  constraint, not a crutch.**

**WI-C calls (rec).** The store↔geometry bridge lives at `store/vector-los.ts`, not in
the store-free `map/vector/`. `subscribeVectorScene` does no debouncing. No adapter was
built between the vector and cellular LoS consumers — that would have been exactly the
compatibility scaffolding B2 rules out.

**WI-D calls (user, ratified and executed as one hard, scorched-earth cutover).**

- **D1** Pure-rollout cutover executed: `wallSegments`→`walls`; every cellular store
  method/converter/schema/collection (`FloorChunk`, `FogChunk`, `MapWall`, `SightWall`,
  `CircleWall`, `MapLight`, the cellular carve-preview channel) and the now-dead
  pure-geometry files deleted; `VTTCAMP_FORMAT_VERSION` bumped. No discriminator.
- **D2** Hard swap: `VITE_VECTOR_MAP_EDITOR` removed, `RoomShell` mounts
  `VectorMapView` unconditionally, cellular `MapView`/`tools.ts`/`engine.ts` deleted. The
  token/encounter layer the swap initially dropped was ported onto the vector engine in
  the same review pass.
- **D3** Soft bounded floor size with a visible error: `MAX_FLOOR_EXTENT = 2000`. The old
  `carvedBoundingBox` grid-shrink guard was removed — a vector floor has no cell-grid
  ceiling to shrink against; grid resize now only validates ≥1×1.
- **D4** Symbol/mapRoom label authoring reuses the existing tools inside the vector
  editor; doors stay vector-native; one shared overlay layer. The freehand `Drawing`
  layer gap this surfaced was closed the same day (`renderAnnotations` + the Pen tool).
- **D5** Secret/trapped door visibility: no-op. Every vector door renders identically to
  every viewer.
- **D6 (2026-07-27) Fog of war rebuilt** as a fresh vector-native layer, not a revival of
  the removed field. **Reveal is referee-authored, not derived from token LoS** — the
  user's framing was a rendering one ("a new layer, underneath tokens and the grid, over
  the majority of other drawing layers… black to players, lightly translucent grey to the
  referee"), so the reveal _model_ was chosen to match how a referee actually runs a
  table. Auto-reveal from token LoS was considered and deferred: it adds per-move
  geometry writes and an O(rays × segs) sweep per token, and the storage shape accepts it
  later without a migration. Two user-ratified z-order sub-decisions: the grid stays
  **below** fog (hoisting it above would put grid lines across door/symbol art
  everywhere), and fog sits **below `tokens`** (so tokens in revealed area still read;
  tokens in fog are dropped from a player's render set entirely).

**POC evidence (historical).** Proven against `polygon-clipping`, in lattice units:
five floor primitives with per-point snap/half/free; interior rock-carve holes with
automatic split on full bisection; the unified wall model; doors as build-time-reconciled
overlay objects; snapshot undo/redo across merge/split; live LoS; a direct-manipulation
Select tool. 11/11 geometry assertions passed; headless UI smoke passed with zero console
errors.

- **Library.** `polygon-clipping` (45 KB min / 15 KB gzip) handles union / difference /
  holes / split-on-bisection correctly but has **no offsetting and no simplify** —
  confirmed the gap that drove `bufferPolyline` + Douglas-Peucker.
- **Doc size.** 300 random carve + interior-rock ops on one map: worst-case single region
  ≈ 11 KiB even with simplification off — ~90× under Firestore's 1 MiB limit.
  Size-driven spatial splitting is not needed at realistic scale.
- **Simplification tolerance.** 0.10–0.15 lattice units reads visually clean on both
  grid-aligned and organic shapes while cutting ~25–35% of vertices; 0.25 started visibly
  rounding grid corners.
- **Performance.** ~0.6–1.1 ms average per carve/boolean/simplify commit across 300 ops.
- **Undo.** Snapshot-based undo (`structuredClone` of `{floor, walls, doors}`) handled
  merge/split cleanly; delta undo isn't well-defined across a split.
- **Select-tool identity finding** (which fed Model A): editing directly on the baked
  union boundary resolves the common cases cleanly — edge-drag on a rectangle keeps it
  rectangular, vertex-drag reshapes freely. What a baked union cannot do is
  primitive-specific behaviour needing retained identity.

---

## Known limits, accepted

Verbatim from Master Plan Part VI §3. These are closed decisions in the sense that the
limit was examined and accepted, not overlooked.

- **Fog is a presentation guarantee, not a secrecy boundary.** `floorRegions` stays
  readable by every member; only `fogRegions` is GM-write.
- **Group ownership is enforced client-side.** Expressing it in rules would need the
  owning seats denormalized onto every profile doc. Token ownership never had
  server-side teeth either.
- **The soft room cap is friction, not a boundary** (SPEC-025 §3).
- **A token belongs to at most one group** — the board cannot draw multi-group
  membership.
- **`seatId == uid` throughout.** Acceptable; new code must read `seatId` from the seat
  doc rather than assuming `uid`.
- **Pre-vector `.vttcamp` archives cannot be imported** (B3).

---

## DEC-020 — Firestore TTL on `rolls`

- **Question.** SPEC-006 §4 listed a TTL policy on a `ts`-derived field as optional
  belt-and-braces. Was it ever configured, and should it be?
- **Recommendation.** Leave it unconfigured (outcome 1 of the three SPEC-026 §4 sets out).
- **Impact.** The SPEC-006 §4 prune button (`pruneEntriesBefore`, Session → Maintenance)
  remains the only expiry mechanism for rolls and log entries — referee-driven, visible,
  already tested.
- **Alternatives.** (a) Add a companion `expiresAt: Timestamp` alongside `ts` in
  `writeRoll` and point a policy at it — a code change, and existing roll docs would
  never be swept. (b) Configure a policy naming `ts` — **does not work**: Firestore TTL
  requires a `Timestamp` field and `Roll.ts` is epoch-ms `number`. The console accepts
  such a policy and then silently deletes nothing, which is worse than no policy.
- **Answer.** **`[HUMAN]`, verified 2026-08-01:** no policy exists, and none is wanted.
  Closed. Full finding preserved in SPEC-026 §4.

---

## Decisions taken during the map-tools playtest batch (WI-030)

DEC-021 through DEC-027 were answered directly by the user during planning. DEC-028 is an
agent default under the Default-and-notify tier, surfaced in WI-030's completion summary.
All are reversible.

### DEC-021 — N-gon orientation: the drag points at a flat face

- **Question.** "Direction of the drag changes the orientation of the polygon" — does the
  drag vector aim at a flat face or at a vertex?
- **Recommendation.** At a **flat face's outward normal**, with the direction snapped to
  the four cardinals under cell snap, the eight compass points under half snap, and left
  raw when free.
- **Impact.** A square dragged east comes out grid-aligned, which is the common case and
  the reason the request asks for cardinal snapping at all. The cost falls on odd-sided
  shapes: a triangle dragged east presents an edge to the east rather than a point, which
  some referees will expect the other way round.
- **Alternatives.** (a) Drag points at a vertex — natural for triangles, but a
  cell-snapped square would come out rotated 45°, contradicting the stated intent.
  (b) Flat face for even side counts, vertex for odd — best-looking per shape, but it is
  two rules where the user asked for one, and an unpredictable one at that.
- **Answer.** **User, 2026-08-01:** flat face.

### DEC-022 — N-gon size snaps across the flats

- **Question.** "Snap diameter of the ngon to the nearest cell" — the inscribed diameter
  (face to face) or the circumscribed one (vertex to vertex)?
- **Recommendation.** **Across the flats.** It is what makes a snapped polygon sit flush
  inside a whole number of cells, which is the point of snapping it. The circle is its own
  inscribed circle and takes the same measure, so "diameter" means one thing for every
  side count.
- **Impact.** The dimension chip changes from `radius: n` to `⌀ n`, a visible readout
  change. The circumscribed radius is now derived (`R = (D/2) / cos(π/n)`) rather than
  taken straight from the drag length.
- **Alternatives.** Across the vertices — the smaller change, exact for the circle, but a
  snapped square's edges then land off-grid by a factor of `cos(π/4)`, which is precisely
  the misalignment this work exists to remove.
- **Answer.** **User, 2026-08-01:** across the flats.

### DEC-023 — Fixed option sets for the n-gon and corridor only

- **Question.** The dropdowns replace number inputs. Sides was 1–24; Width was 0.5–10 in
  half steps and was **shared** by Corridor, Path and Carve.
- **Recommendation.** N-gon gets Circle/3–8; Corridor gets its own ½/1/2 select. Path and
  Carve keep the free-form Width untouched.
- **Impact.** Sides 9–24 become unreachable — knowingly given up, since above 8 a polygon
  reads as a circle and the circle option is one click away. Corridor widths between and
  above ½/1/2 also go. Nothing Path or Carve could draw is lost.
- **Alternatives.** (a) Dropdowns everywhere — one consistent control, but the brush's
  arbitrary ribbon width is the whole point of the brush. (b) Selects with a "Custom…"
  escape hatch — keeps every capability but doubles the control surface in an already
  dense panel.
- **Answer.** **User, 2026-08-01:** n-gon and corridor only.

### DEC-024 — Snapped floor tools anchor to cell centres, not lattice vertices

- **Question.** Room, Corridor and N-gon snapped through `snapPoint`, which rounds to the
  nearest grid **intersection**. The request describes all three in terms of **cells**.
  Does "snap" change meaning for these tools?
- **Recommendation.** **Yes, for these three only.** They take raw lattice points and do
  their own snapping, because which cell the pointer is in is not recoverable from a point
  already rounded to the nearest vertex — that rounding crosses a cell boundary for three
  quadrants out of four.
- **Impact.** This is the reversal the whole work item exists for, and it is visible on
  every snapped stroke. `snapPoint` remains correct — and unchanged — for Wall and Door,
  whose geometry genuinely runs between intersections, and for Polygon, where the gesture
  is placing corners. Reversing it means reverting `cellRectPoly`, `ngonPoly` and
  `bandLo`, all of which are additive.
- **Alternatives.** (a) Change `snapPoint` itself to floor-and-centre — would silently
  move Wall and Door endpoints off the intersections they belong on. (b) Keep vertex
  snapping and offset each shape by half a cell after the fact — arrives at the same
  pixels through arithmetic nobody can later explain.
- **Answer.** **User, 2026-08-01**, implicitly in the request's own wording ("center the
  ngon in the middle of the selected cell", "center the corridor in the selected cell or
  half cell"). Recorded explicitly because it changes what an existing control means.

### DEC-025 — Battle map stores a rect, not an image

- **Question.** The request says the captured area "is then saved" as an image. Firebase
  Storage is disabled — uploads need a `[HUMAN]` Blaze upgrade, which RULE-010 currently
  forbids. Where does the image go?
- **Recommendation.** **Nowhere: store the rect.** Persist the bounding box in lattice
  units and re-render the live vector map clipped to it. Every client already holds the
  geometry, so there is nothing to transfer, nothing to store, and the battle map stays in
  sync with its source instead of freezing.
- **Impact.** No storage cost and no billing card. A raster would have been a true
  snapshot — edits to the source map after capture will show through on the battle map,
  which for a temporary one-fight map is more likely to be wanted than not.
- **Alternatives.** (a) A PNG data-URI in the map doc — the 1 MiB document cap makes any
  real region risky, and it bloats every read of that doc. (b) Blaze upgrade plus
  `FirebaseStorageAssetStore` — truest to the request, but needs a card.
- **Answer.** **User, 2026-08-01:** rect, **and leave the PNG wiring in place** so a
  future Blaze upgrade can persist a real capture without re-architecture. `exportPng`
  already renders an arbitrary world-space frame and is reused for the quick sheet's local
  preview.

### DEC-026 — The battle map is a temporary map in the same room

- **Question.** The request calls it a "room" that is "always temporary and always only
  one at a time". A `GameMap` inside the current room, or a separate `Room`?
- **Recommendation.** A `GameMap`, switched for everyone through the existing
  `Room.activeMapId`.
- **Impact.** Seats, tokens, encounter, dice and log all carry across untouched — which is
  what a battle map is *for*. It is still a `GameMap` schema change, so it ships a
  migration and a `.vttcamp` round-trip test (RULE-007), and the export must never carry a
  battle map.
- **Alternatives.** A separate temporary `Room` — isolates the fight completely, but every
  player re-joins and loses their seat and tokens, and the referee has to herd them across.
- **Answer.** **User, 2026-08-01:** a temporary map in the same room.

### DEC-027 — Carve-tool audit findings become intake items, not edits

- **Question.** "Evaluate other carving tools for inconsistencies" — fix what the audit
  finds inside WI-030, or report it?
- **Recommendation.** Report. Each finding is logged as its own classified intake item.
- **Impact.** Keeps WI-030 inside the scope that was approved (RULE-015, RULE-016). The
  cost is that real defects sit in the intake table for a round.
- **Alternatives.** Folding mechanical fixes into WI-030 — fewer round-trips, but the item
  grows past its gate, and two of the three findings turn out not to be mechanical.
- **Answer.** **User, 2026-08-01:** report first, fix separately. Findings are IN-012 –
  IN-014 in `PLAN.md`.

### DEC-028 — Changing snap mode resets the corridor width

- **Question.** The corridor width defaults to ½ under half snap and 1 otherwise. Should
  switching snap mode reset a width the referee has already chosen?
- **Recommendation.** **Yes, unconditionally.**
- **Impact.** A referee who sets ½ under cell snap, switches to half snap and back, finds
  the width at 1 again. Visible, and reversible with one click of the select.
- **Alternatives.** Reset only while the control is "untouched" — preserves a deliberate
  choice, but requires the controller to remember whether you have ever used a control,
  and produces a default that silently stops applying. A value that visibly moves when you
  change modes is easier to explain than one that mysteriously stops tracking.
- **Answer.** Agent default (Default-and-notify). Surfaced in WI-030's completion summary.

## Decisions taken while executing WI-045

### DEC-029 — A third `PreToolUse` hook: PLAN.md status write-back reminder

- **Question.** IN-020 found that CLAUDE.md's "write `PLAN.md` status back before
  long-running operations" rule has no trigger — WI-030 ran a 27-minute suite twice
  without one. The obvious fix is a third `PreToolUse` hook, which DEC-016 fixed the
  count against at exactly two. WI-045's gate note already anticipated this: "a third
  `PreToolUse` hook reopens DEC-016; that entry must be superseded by a new one, never
  silently overwritten" — so the count itself was pre-approved; what remained was the
  hook's actual detection design.
- **Recommendation.** A `deny`-style hook (matching DEC-016's own "a warning an agent can
  ignore is not a guard" reasoning), firing on: (a) `Bash` commands matching this repo's
  actual long-running scripts — `test:all:emulators`, `firebase-emulators.mjs`,
  `playwright test`, `pnpm … test:e2e`, `pnpm … build` / `vite build`, and a bare
  `sleep N` as a proxy for a CI poll loop — and (b) any `Agent` (subagent) dispatch. It
  denies only if `PLAN.md`'s mtime is older than 15 minutes, prompting a fresh status
  write-back before the operation proceeds.
- **Impact.** `.claude/hooks/remind-plan-status.sh` (new) and its registration in
  `settings.json` reopen DEC-016's "exactly two" default; the count is now three,
  documented in `CLAUDE.md`'s harness-configuration section. The 15-minute freshness
  window and the specific command patterns matched are both agent choices, not
  specified in WI-045's one-line brief — reversible by editing the hook's constants.
  A false trigger (a long-running command that isn't one of the matched patterns, or one
  that is but genuinely doesn't need a fresh write-back) is possible; the hook only
  denies, it never blocks silently or auto-edits `PLAN.md`.
- **Alternatives.** (a) Warn-only (print to stderr, exit 0) — rejected for the same
  reason DEC-016 rejected it. (b) Match on git state (`PLAN.md` has uncommitted changes)
  instead of mtime — weaker, since a stale edit from hours ago that was never committed
  would still count as "fresh". (c) A much shorter or longer freshness window — 15
  minutes was chosen as long enough not to nag between closely-spaced operations in one
  step, short enough to still catch a session that drifted for the length of a full
  emulator run.
- **Answer.** Agent default (Default-and-notify), within a gate the user already
  cleared for WI-045 (2026-08-01) and the reopening of DEC-016 it explicitly named.
  Implementation approved directly by the user, 2026-08-02, after the hook-creation and
  `chmod +x` calls were held by the environment's permission classifier.

---

# Postponed

Deferred by decision. Not rejected — each is revivable as an intake item.

Verbatim from Master Plan Part VI §2, except where a citation was remapped to the
current spec numbering.

- **Membership-gating room reads.** Blocked on deferring the `RoomShell` mount-time
  subscriptions (`groups`/`encounter`/`rolls`/`log`) until after join. A listener denied
  at subscribe time never recovers, which previously left clients with empty groups,
  permanently revealing hidden tokens. Until that is done, "the roomId is the capability"
  (RULE-012) stands and SPEC-025 §4's entropy requirement is load-bearing. **This earns
  its own work item and must not be attempted as a side effect of anything else** — it
  carries real regression risk.
- **Hard per-user room cap.** Requires a trusted writer. Revisit only if the group grows
  past the point where SPEC-025 §3's soft cap plus SPEC-025 §1's attribution is credible.
- **Member write scope inside a room.** Any member can write tokens, profiles, drawings
  and floor regions; the GM's only lever against a griefing member is manual removal.
  Acceptable within the stated trust model, but worth revisiting if "acquaintances" ever
  drifts toward "strangers."
- **Auto-reveal fog from token LoS.** Deferred (per-move geometry writes + an
  O(rays × segs) sweep per token). The `fogRegions` storage shape accepts it later
  without a migration; the Eye tool's `visibilityPolygon` is the machinery.
- **In-app image uploads** (`FirebaseStorageAssetStore`). Requires a `[HUMAN]` Blaze
  upgrade + budget alert; the interface slot already exists and the Assets tab ships
  disabled with an explanatory note. Unlockable any time.
- **Hex grid.** Deferred.
- **PocketBase second backend.** Kept alive by the contract suite; not scheduled.
- **Typed doors on an arc, elevation/multi-floor, animated effects, terrain cost, typed
  lighting/vision ranges.** Out of scope. (`.uvtt` import populates lights; they are
  stored, not used for vision.)
- **Map texture polish** (water/rubble/vegetation fills). Aspirational, non-gating.
- **Room `password` field.** Stored, unenforced, dormant.
- **SPEC-022 §3 owned-vs-selected ring split.** Both map to white today; the cheapest
  split is a glow/thicker stroke for selected. Not built unless asked.
- **Full-viewport-diff rendering optimizations.** `renderMap` redraws everything per
  change. **Watch item:** re-evaluate if maps grow large enough, or Chromebook playtests
  dip below budget.
- **Dice physics in a Web Worker + OffscreenCanvas.** Pre-approved fallback if the dice
  overlay drops below 30 fps on the Chromebook.

## Quarantined test

Verbatim from Master Plan Part VI §4.

`tests/e2e/portability.spec.ts` is `test.fixme`-quarantined (known-flaky). This heavy
two-context flow mounts/tears down the vector map's Pixi/WebGL stage across many activity
switches; under headless-CI resource pressure the tab intermittently goes unresponsive and
a later activity-tab click hangs to the 180s timeout (seen hanging at different tab clicks
across runs, always after the `.vttcamp` import + map churn). It is **not a
product-functionality failure** — every map feature passes in the other e2e specs, and the
`.vttcamp` round-trip is independently covered by the `CampaignStore` contract suite +
`portability/vttcamp.test.ts`. A force-release of the WebGL context on teardown and CI
`retries` did not clear it. **TODO:** investigate the map's WebGL-context lifecycle under
rapid mount/unmount (a shared/pooled Pixi app, or a reliable context release with a
real-browser repro) and un-quarantine.
