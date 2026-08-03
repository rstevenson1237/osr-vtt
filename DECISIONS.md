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
  mode's default output describes _what_ will be done; it does not reliably cover _why_,
  _impact_, or _alternatives_, which are three quarters of the gate. Treat `ExitPlanMode`
  as "I have finished investigating", and the four sections as "here is the decision you
  are approving".
- **Impact.** Low and additive. It costs nothing, keeps investigation read-only before
  approval, and gives a second natural stopping point. The risk is drift: an agent that
  treats plan-mode approval _as_ gate approval has skipped the gate, and the user will
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
  _executing_ work items here, because RULE-016 says one session executes one work item,
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
  the one that must be visible from _both_ sides at once.
- **Impact.** Nested files load only when files in that directory are touched, so they
  reduce root-context size — a real benefit as the root `CLAUDE.md` grows. The cost is
  drift: two places that describe the store contract will eventually disagree, and the
  one the agent happens to load wins. That is the exact failure this refactor was
  commissioned to fix.
- **Alternatives.** (a) One nested file per package, duplicating the relevant rules —
  highest drift risk. (b) Nested files that contain _only_ pointers back to the root
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

## Open entries from the 2026-08-03 batch

Four entries raised in the mobile / Blaze / carve-artifacts batch are **Open** and are
written in full further down the file, alongside the rest of that batch, so the batch reads
as one piece. They are indexed here because this is where Open entries are looked for:

- **DEC-046** — reversing "a snapped band covers whole cells, both ends inclusive"
  (blocks WI-061).
- **DEC-047** — simplification tolerance bounded by the stroke's width (blocks WI-059).
- **DEC-048** — the corridor's bend axis latched from the gesture (blocks WI-062).
- **DEC-049** — **blocking:** Blaze inverts RULE-010's stated premise. Blocks SPEC-034
  entirely, and its resolution is a standalone `RULE-AMENDMENT:` change (WI-065).

---

# Closed

## DEC-001 — Map-edit permissions: should players be able to carve the shared map?

**Closed 2026-08-02.** Moved here from Open on the user's ruling; the entry is otherwise
unchanged, including its source text.

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
- **Answer.** **User, 2026-08-02: not GM-gated. Confirmed as the recommendation, with a
  stated goal — "our goal is to enable player mapping."** The toolbar stays open to every
  room member. The `⚠️ Flagged, unratified` annotation in `README.md` § "Map system —
  vector (II.2)" is replaced with the ratification.

  **This raises collaborative player mapping from an accident of the trust model to an
  intended feature**, which matters for future work: a change that would restrict a
  player's access to the carve tools now contradicts a stated goal, not merely an
  unratified default. WI-053's Edit/View toggle (IN-031) is explicitly _not_ an exception
  — it is a per-viewer latch a player flips for themselves, never an authority boundary.

**Source text, verbatim** (Master Plan Part VI §1 item 1):

> **Map-edit permissions.** The vector toolbar is shown to **every** room member,
> consistent with the "all room members can write" trust model; only `add-creature` is
> GM-gated. The old cellular map hid all editing tools from players. If players should
> not be able to carve/edit the shared map, the toolbar can be gated behind `isGM` — a
> small change, awaiting the call.

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

> **The corridor half is superseded by DEC-032** (user, 2026-08-02): the Corridor's
> ½/1/2 set becomes the shared ⅛/¼/½/1/2 set it now holds in common with the Path tool,
> and "Path and Carve keep the free-form Width untouched" no longer holds for Path. The
> n-gon half of this entry stands unchanged. Kept in place per RULE-019, not edited away.

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
  what a battle map is _for_. It is still a `GameMap` schema change, so it ships a
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

## Decisions taken during the quick-sheet / encounter / path-tool batch (2026-08-02)

DEC-030 and DEC-031 are **agent defaults** under the Default-and-notify tier, surfaced in
the gate for WI-046 and WI-047. DEC-032 is **Open** — it records a reversal that IN-028
requires and that only the user can ratify.

### DEC-030 — The quick sheet's name is the seat's `displayName`, and only its own seat may edit it

- **Question.** IN-024 asks the Character quick sheet header to show "the current name
  associated with that token" and to make it editable. Which name is that, and who may
  change it?
- **Recommendation.** **`PlayerSeat.displayName`**, edited through the existing
  `renamePlayer` store method, with the edit affordance shown **only when the sheet is the
  viewer's own seat, or the viewer is the referee**. Display is unconditional; editing is
  not.
- **Impact.** The name cannot be a profile field: RULE-002 and `CharacterDock`'s own
  header comment forbid per-field-id logic, and the `profileTemplate` is referee-defined,
  so a room may have no `name` field at all. `displayName` is already the answer
  `EncounterBoard.cardName()` gives, so the two views will agree. The gate on editing is
  forced by `firestore.rules`: `players/{uid}` is writable by that uid or the GM only,
  while group ownership lets a player open _another_ character's sheet editable — so
  without the gate that player would get an edit box whose save is denied. Consequence a
  referee will notice: renaming a character you are borrowing is a referee action, even
  though editing its stats is not.
- **Alternatives.** (a) Rename a designated profile field — matches "character name" more
  literally, but requires the app to single out a field by id, which RULE-002 forbids and
  which breaks in any room whose template omits it. (b) Show the edit box to anyone who
  may act as the character and let the write fail — produces a silent denial, the worst
  outcome. (c) Widen the `players/{uid}` rule to group owners — a `firestore.rules`
  change, which is a Deceptive trigger and far out of scope for a label.
- **Answer.** Agent default (Default-and-notify), reversible by changing one condition in
  `CharacterDock.svelte`.

### DEC-031 — A creature added from the encounter board spawns at the map's starter drop

- **Question.** IN-026's "+" card creates a token from the encounter board, which has no
  map camera and therefore no "where the referee is looking".
- **Recommendation.** Reuse `VectorMapView.addCreature`'s existing rule: the
  `STARTER_DROP_POS` staircase, offset one cell per existing token. Gate the card behind
  `isGM`, matching the existing `add-creature` control.
- **Impact.** A creature added from the board lands in the same place it would have landed
  had it been added from the map toolbar, which is the behaviour a referee already knows.
  It will not appear near whatever the referee last looked at, so on a large map they will
  have to go find it — acceptable, since the token is immediately draggable and the board
  card appears in the right group regardless.
- **Alternatives.** (a) Thread the map camera's centre into the encounter board — couples
  two views that are deliberately independent, and is undefined when the map has never
  been mounted this session. (b) Spawn at the group's existing members' centroid — nicer
  when the group is placed, undefined when it is empty, which is exactly the case the "+"
  card is for. (c) Prompt for a position — a modal for something the referee can fix with
  one drag.
- **Answer.** Agent default (Default-and-notify), reversible in one constant.

### DEC-032 — Reversing "the Path tool keeps its free-form ribbon"

> **Superseded in part by DEC-046** (2026-08-03): extension 2's centring rule stands, but
> the whole-cell _along-axis_ span it inherited from the Corridor is withdrawn for any leg
> end that meets another leg — it is what makes a sub-cell band spray floor into all four
> cardinals at a bend (IN-038). Terminal ends keep it. This entry is kept in place per
> RULE-019, not edited away.

- **Question.** IN-028 asks the Path tool to behave like the Corridor under snap: cell/half
  tile indicator, a fixed width option set, and squared 90° terminations. This directly
  reverses a disposition recorded during the WI-030 / IN-007 carve-tool audit.
- **Recommendation.** **Do not schedule it until the reversal is ratified, and then do it
  in phases.** The reversal is legitimate — the audit's reasoning was a judgement, not a
  constraint — but it must be named, not absorbed.
- **Impact.** `PLAN.md` §1's "Not findings, deliberately" paragraph states: "The Path tool
  keeps its free-form ribbon — it is the organic counterpart to the Corridor, and
  cell-aligning it would remove the only tool that is not grid-true." Ratifying the
  reversal means **Carve becomes the only organic floor tool**, and it drags three further
  contract changes with it: splitting `FloorToolOptions.width` (shared with Carve, exactly
  the surgery DEC-023 did for the Corridor), adding Path to `CELL_ANCHORED_TOOLS` and to
  `targetedCellFor` (whose comment currently restricts it to Room and Corridor on stated
  grounds), and giving `bufferPolyline` — also shared with Carve — a cap-style parameter.
  The requested ⅛ and ¼ widths are additionally new territory: every existing snapped width
  is a whole or half cell, and a "full or half tile" snap icon cannot truthfully show a ⅛
  width.
- **Alternatives.** (a) Ratify wholesale, Path becomes a second Corridor — simplest to
  build, but the request's own ⅛/¼ widths then have no honest indicator. (b) Ratify the
  squared caps and the tile indicator but keep the free-form width — gets the "identical to
  the corridor tool at right angles" behaviour the request is really after, with no shared
  contract split and no sub-half-cell indicator problem. This is the variant I would
  recommend. (c) Decline and leave Path organic — the status quo the audit chose, and
  contradicted by a real playtest, so not recommended.
- **Answer.** **User, 2026-08-02: ratified, wholesale (alternative a), with two
  extensions the user supplied that resolve alternative (a)'s stated weakness.** This
  entry **names and supersedes** the WI-030 audit disposition on the Path tool; that
  paragraph is annotated in place, per RULE-019, rather than rewritten. Carve becomes the
  only organic floor tool, knowingly.

  1. **The Corridor adopts the same option set** — ⅛, ¼, ½, 1, 2 — so the two tools share
     one width vocabulary rather than each having its own. This **supersedes DEC-023's**
     ½/1/2 corridor set, annotated there in place.
  2. **When `width` is smaller than the snap step, the carved band is centred inside the
     snapped tile.** This is the rule that makes the sub-half widths honest, and it makes
     `width = ½ · snap = cell` behave **distinctly** from `width = ½ · snap = half`: the
     first insets ¼ cell on each side of a full tile, the second fills a half-tile
     exactly. The snap indicator then shows the band that will actually be carved, not
     the tile it is centred in — which is what closes the "a tile icon cannot truthfully
     show a ⅛ width" objection.

  **Implementation note, found while verifying the ruling.** The centring rule is a
  _simplification_ of `bandLo`, not an addition to it. `bandLo` currently quantizes to
  `Math.round((cellCenter - width/2) / min(step, width)) * min(step, width)`; the
  ratified rule is plain `cellCenter - width/2` for every snapped mode. Every expectation
  the current doc comment claims still holds under the simpler form — width 1 under cell
  snap fills the pointed-at cell, width ½ under half snap fills the pointed-at half-cell,
  width 2 straddles evenly — and the quantization is precisely what was collapsing
  `width = ½ · snap = cell` onto a half-cell line instead of centring it. Sub-cell widths
  therefore land on ⅛/¼ lattice offsets, which RULE-006 permits (floats in lattice
  units); nothing is stored in pixels.

### DEC-033 — Every character always has a colour; there is no unset state

- **Question.** IN-025 asks for the quick sheet's **Clear** button to go. Clear is
  currently the only way to return `ProfileInstance.color` / `Token.color` to absent, and
  absent means something specific: the die renders one theme-wide neutral
  (`--dice-face`) rather than a per-seat value, and a letter token keeps its
  auto-assigned `gen:disc:` fill. Removing the button without addressing that makes the
  absent state permanently unreachable.
- **Recommendation.** —
- **Impact.** This is the larger half of the change and the reason IN-025 was Deceptive.
  Making colour always-present changes what an **absent** `color` field _means_ — from "a
  deliberate no-custom-colour choice" to "a seat written before this rule, needing
  backfill" — which is a stored-field meaning change under RULE-007 and ships a migration
  plus a migration test and a `.vttcamp` round-trip test. The `--dice-face` neutral
  fallback becomes dead for seats but must stay for any die with no seat behind it.
  `dice-overlay.spec.ts:171`, which clicks `token-color-clear`, is rewritten in the same
  change (RULE-005's "or update the spec in the same change"). Hard to reverse in one
  respect: once every existing profile is backfilled with a random colour, the
  information about which seats had _deliberately_ chosen no colour is gone.
- **Alternatives.** (a) Keep Clear — the status quo the user declined. (b) Keep the field
  optional and assign a colour only at read time, never writing one — no migration, but
  then two clients can render the same seat differently, and the die colour would not
  survive an export. (c) A "None" swatch in the palette row — preserves the unset state
  with a quieter control, but the user's framing is that the unset state should not exist
  at all, not that it needs a better button.
- **Answer.** **User, 2026-08-02:** "we can just always assign a color, at random if
  necessary. There should be no case where a roll does not have a color associated."
  Colour is assigned at seat creation, backfilled by migration for existing seats, and
  the Clear button is removed.

---

## Decisions taken during the creature-selection batch (2026-08-02)

DEC-034 and DEC-035 are **user-answered**. DEC-036 is an **agent default** under the
Default-and-notify tier, surfaced in the gate for WI-057.

### DEC-034 — Creatures get profiles; profiles are keyed by an actor, not a seat

- **Question.** IN-030's first open question: what does selecting a creature open, given a
  creature has no `ProfileInstance` and no seat to key one by?
- **Recommendation.** —
- **Impact.** This is the largest of the three readings I offered and it is a genuine
  schema change (RULE-007): a migration, a migration test and a `.vttcamp` round-trip
  test. `rooms/{roomId}/profiles/{seatId}` becomes keyed by an **actor id** that is either
  a seat id (a character) or a token id (a creature), and `ProfileInstance.seatId` is
  renamed or widened accordingly. Three consequences worth stating in advance:
  - **`deleteToken` currently cleans up nothing.** A token-keyed profile would leak on
    every creature deletion, so `deleteToken` must enumerate and remove it — the same
    collection-enumeration duty M2 imposed on `deleteRoom`.
  - **`firestore.rules` needs no change.** `profiles/{seatId}` is already member-writable
    rather than own-seat-only, precisely because group ownership demanded it, so a
    token-keyed doc in the same collection is already governed correctly. This is the
    strongest argument for widening the existing collection rather than adding a second.
  - **`encounterTemplate` is not the answer.** It is one instance per _room_
    (`Encounter.values`), not per actor, so it cannot carry per-creature fields.
    Creatures reuse `profileTemplate`.
- **Alternatives.** (a) Selection is a highlight only, no sheet — smallest, but leaves the
  request half-served. (b) A reduced sheet over the fields that already live on `Token`
  (name, colour, scale) with no profile — no schema change at all, and genuinely useful,
  but it means two different sheets and a creature can never hold a stat. (c) Synthetic
  seats for creatures — keeps one key type, but puts non-players in `players/{uid}`, which
  is the collection `firestore.rules` gates on `request.auth.uid`, and would corrupt
  presence, seat lettering and the abandoned-seat prune all at once. Rejected firmly.
- **Answer.** **User, 2026-08-02:** "lets go ahead and add the profiles, will be needed
  eventually anyways." Alternative (a)/(b) declined in favour of real profiles.

### DEC-035 — Ownership for a seatless token is group membership alone

- **Question.** IN-030's second open question: is "any card that belongs to a group we are
  a member of" a new rule or a restatement of `canSeatActAs`?
- **Recommendation.** —
- **Impact.** `canSeatActAs(groups, tokens, mySeatId, targetSeatId, isGM)` resolves a
  _seat_ by looking for a group that lists me and holds a token whose `ownerSeatId` is the
  target. For a seatless creature that inner test can never pass, so the check becomes one
  step shorter: **is this token in a group I own.** The existing function is not replaced —
  a character is still reached through its seat — it gains a token-keyed sibling, and both
  keep the referee's derived membership from `Room.gmUid`.
- **Alternatives.** (a) Require an explicit per-creature owner list — more precise, more to
  maintain, and it re-invents the group. (b) Leave creatures referee-only — contradicts the
  user's stated case directly.
- **Answer.** **User, 2026-08-02**, with the motivating case: "I'm thinking of an NPC
  situation that is a member of the players party (and included in the group). players
  should be able to manipulate this token in the same way they can any member of the group
  (and will have to since there is no player exclusively associated with that token)."
  Group membership is the whole rule for a seatless token.

### DEC-036 — Map drag is gated, and an ungrouped seatless token is referee-only

- **Question.** IN-030's third open question: should map token drag be gated on the same
  ownership predicate? The user's instruction was "gate the map drag if this is a
  straightforward change, leave it if its more complex."
- **Recommendation.** **Gate it — it is straightforward.** The check goes _inside_ the
  `pointerdown` handler, which closes over live reactive `tokens`/`groups` state, so it
  re-evaluates on every press and no sprite-cache invalidation is needed when group
  membership changes. `sprite.eventMode` and `cursor` are set alongside it in the existing
  `syncSprites` loop for the affordance. The collapsed-group anchor is tested by the same
  predicate, since dragging it moves every member.
- **Impact.** The mechanism is small. **The policy has one genuine gap, and it is a
  capability removal:** today `attachDragHandlers` has no ownership check at all, so any
  viewer can drag any token they can see. A token with no group _and_ no owning seat —
  scenery, and a single creature added alone, which `addCreature` deliberately leaves
  ungrouped — matches no ownership rule at all. Defaulted to **referee-only**, on the
  grounds that ungrouped seatless tokens are referee furniture. A player who could
  previously nudge a piece of scenery no longer can.
  This does **not** touch the carve tools and so does not cut against DEC-001's
  player-mapping goal: floor and wall editing stay open to every member.
- **Alternatives.** (a) Leave ungrouped seatless tokens draggable by anyone — preserves
  today's behaviour exactly and removes nothing, but makes the rule "everything is gated
  except the things that aren't", which is the kind of exception nobody remembers. (b)
  Don't gate map drag at all — permitted by the user's instruction if it had proved
  complex; it did not. (c) Gate drag but not selection — leaves a player able to open a
  sheet they cannot act on, which is the silent-denial shape DEC-030 rejected.
- **Answer.** Agent default (Default-and-notify) on the ungrouped-seatless case only; the
  decision to gate at all is the user's, conditional on straightforwardness, and the
  condition is met. Reversible in one predicate.

---

## Decisions taken while executing WI-053

### DEC-037 — The Edit/View soft lock gates tool selection only, not Undo/Redo or the occasional whole-map actions

- **Question.** IN-031 asks for "a soft lock on carving functions or editing functions."
  The map tools panel has more than the 18-tool draw palette: Undo/Redo, and — in the
  expanded sheet — Rotate selection, Add creature, PNG export, Reveal all, Reset fog.
  Which of these does `View` disable?
- **Recommendation.** Only the draw-tool palette: every `MapToolId` outside the existing
  `view` group (`map/tool-groups.ts`'s `Pan`/`Eye`/`Measure`/`Ping`, already documented as
  "everything that reads the map rather than changing it"). Entering `View` also forces
  the active tool back to Pan if it was holding a carve/edit tool, so a stroke already
  armed can't be finished by a stray click after locking.
- **Impact.** This is what closes the request's own framing — "prevent accidental edits
  when not intended" describes exactly the failure mode of clicking/dragging on the
  canvas with the wrong tool still selected, which is what tool selection controls.
  Undo/Redo stay live under `View`: reversing a change already made is not a new
  accidental edit, and disabling them would strand a referee who locks right after a
  misclick. The expanded sheet's occasional actions (Rotate, Add creature, PNG export,
  Reveal all, Reset fog) are each a deliberate button press behind its own precondition
  (a rotatable selection, `isGM`, fog enabled) rather than a pointer-drag gesture on the
  canvas — the accident IN-031 describes doesn't reach them, so they are left alone. Also
  agent default: `mapMode` is in-memory only, matching `activeTool`/`camera`'s existing
  precedent — no persistence across a full page reload, only across activity-switch
  mounts within the session.
- **Alternatives.** (a) Lock everything including Undo/Redo — simplest rule, but strands
  a referee mid-recovery from the very misclick the lock exists to prevent. (b) Also lock
  the expanded sheet's occasional actions — closer to "every editing function," but none
  of them fire from a stray pointer gesture, so it adds surface without addressing the
  reported accident. (c) Persist `mapMode` to `localStorage` — nicer across reloads, but
  no other per-viewer map-tool preference persists that way today, and it would be a new
  storage mechanism for one boolean.
- **Answer.** Agent default (Default-and-notify), reversible by widening the tool-group
  partition `isViewTool` reads or by adding more gates alongside it.

---

## Decisions taken while executing WI-051

### DEC-038 — What a _diagonal_ snapped Path leg does, which DEC-032 does not say

- **Question.** DEC-032 and SPEC-028 §7 pin the Path's snapped behaviour to the
  Corridor's, and the Corridor is always cardinal — its legs are axis-aligned by
  construction. A Path is not: any two clicks can be diagonal to each other. What is "the
  band, centred in the pointed-at tile, with squared caps" for a run that is not
  axis-aligned?
- **Recommendation.** A quad between the two cell centres, squared off at the path's two
  **ends** by half a snap step, with interior ends left flush and every interior vertex
  taking the Corridor's own `cornerBlock` (a square of side `width`, which contains the
  round join of radius `width / 2`, so it covers a turn at any angle). Half a step is the
  diagonal reading of the rule `bandRect` already applies on an axis: reach the edge of
  the cell you clicked.
- **Impact.** The right-angle case — the one the request and the spec actually describe —
  is _exactly_ the corridor's polygons, which a test asserts by differencing the two
  shapes both ways. Diagonals get a defensible answer rather than an accidental one. The
  visible consequence is that a diagonal run's band is centred on the cell centres rather
  than quantized to anything, so it will not tile flush against an axis-aligned
  neighbour; that is inherent to a 45° passage on a square lattice, not a choice.
  Extending interior ends too was rejected because a cap that overshoots an interior
  vertex spurs out past a sharp turn.
- **Alternatives.** (a) Refuse diagonals — force every snapped Path leg to the nearest
  cardinal, as the Corridor does. Truest to "identical to the corridor", but it removes
  the diagonal passage entirely, and the Path's whole reason to exist next to the Corridor
  is that it is a polyline. (b) Square-cap every segment end, interior ones included —
  one rule instead of two, at the cost of the spur. (c) Round the diagonal caps, square
  only the axis-aligned ones — mixes the two cap styles inside one stroke, which reads as
  a bug.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-051's completion summary.
  Reversible inside `pathPoly`.

### DEC-039 — The shared control is `bandWidth` / `band-width`, not `corridorWidth`

- **Question.** The width control the Corridor owned is now shared with the Path. Does it
  keep the `corridorWidth` field name and its `corridor-width` testid?
- **Recommendation.** Rename to `bandWidth` and `band-width` throughout —
  `FloorToolOptions.bandWidth`, `MapToolController.bandWidth`, `DEFAULT_BAND_WIDTH`,
  `BAND_WIDTH_OPTIONS` — because a control named after one of its two tools misleads at
  every future call site, WI-052's indicator included.
- **Impact.** Touches a `data-testid` a Playwright spec depends on, which RULE-005 governs:
  the spec (`map-draw-feedback.spec.ts`) is updated in the same change, which is the
  escape RULE-005 names. That spec had to change anyway — the option list and both
  defaults moved. Nothing else referenced either name.
- **Alternatives.** (a) Keep `corridorWidth`/`corridor-width` — zero churn, permanently
  wrong name. (b) Keep the old testid on a renamed field — the worst of both, since the
  DOM and the code would then disagree.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-051's completion summary.

---

## Decisions taken while executing WI-050

### DEC-040 — The colour backfill is a resolution rule, not a document rewrite

- **Question.** SPEC-031 §3 says existing profiles are "backfilled by the migration,
  deterministically from the seat id". `migrateRoom` only ever sees the **room** doc, and
  `ProfileInstance.color` lives on `profiles/{seatId}`, a subcollection doc. So what,
  concretely, is "the migration" here?
- **Recommendation.** Express the same deterministic derivation
  (`assignedCharacterColor(seatId)`, a `CHARACTER_COLOR_PALETTE` pick from an FNV-1a hash
  of the seat id) in the two places that between them cover every read, and make the
  v19→v20 room-doc step a no-op:
  - **`resolveCharacterColor(seatId, profiles)`** at resolution time — what
    `characterDiceColor` and the quick sheet's `myColor` both call.
  - **`migrateProfile(doc, seatId)`** applied to stored documents at the one boundary
    where documents genuinely are rewritten, `.vttcamp` import (`archiveToSnapshot`).
- **Impact.** The decisive fact is that **a seat may have no profile document at all** —
  one is created lazily by the first sheet/portrait/colour write, and `joinRoom`
  historically created none. A document-rewriting backfill cannot put a field on a
  document that does not exist, so it could never have delivered SPEC-031 §1's guarantee
  on its own. Making it a resolution rule delivers it for every seat, present or absent,
  with zero writes and no bulk migration pass — which also means there is no "migration
  has not run yet on this room" window. The cost is that the guarantee lives in a function
  rather than in the data: read a `profiles/{seatId}` document straight out of Firestore
  and it may still have no `color`, and anything that reads the field without going
  through `resolveCharacterColor` would see the old absence. Today `characterDiceColor`
  and `CharacterDock` are the only two such readers, and both go through it.
  The v19→v20 bump is kept even though it moves no room-doc data, on the v17→v18
  precedent: it stamps `.vttcamp` archives, so an archive whose profiles are guaranteed
  coloured is distinguishable from one that predates the rule.
- **Alternatives.** (a) A real bulk rewrite of every `profiles/*` document, run once by
  the GM's client the way `ensureActiveMap` does — faithful to the word "migration", but
  it is a write per seat per room, it still misses seats with no profile doc, and it needs
  a "has this run?" marker somewhere. (b) Assign at read in the **converter**
  (`profileInstanceConverter.fromFirestore`) instead — tempting, and it would persist
  through export, but `MemoryStore` does not use converters, so the two stores would
  disagree and RULE-001's contract suite could not hold them to the same behaviour.
  (c) Assign only at `joinRoom` and accept that pre-existing seats stay colourless —
  simplest, and exactly the outcome SPEC-031 §1 forbids.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-050's completion summary.
  Reversible: the derivation is one exported function with one call site per reader.

### DEC-041 — `setProfileColor` narrows to `string`; `setTokenColor` keeps its clearing overload

- **Question.** Removing the Clear button removes the UI path to the unset state. Should
  the **store contract** follow, or keep accepting `undefined` as dead surface?
- **Recommendation.** Narrow `setProfileColor(roomId, seatId, color: string)`. A method
  that can still delete the field is a second, invisible Clear button, and the next caller
  to reach for it re-creates the state SPEC-031 abolished. Leave
  `setTokenColor(..., color: string | undefined)` alone.
- **Impact.** A signature change on an existing store method, so RULE-001 applies: both
  implementations change (`FirebaseStore` drops its `deleteField()` branch, `MemoryStore`
  stops conditionally spreading the field) and the shared contract suite's colour case is
  rewritten from "sets and clears" to "sets and replaces", with a new case covering the
  `joinRoom` seed. The asymmetry with `setTokenColor` is deliberate and worth stating:
  `Token.color` belongs to a token, and a creature or a piece of scenery has no character
  behind it, so absence stays a legitimate state there.
- **Alternatives.** (a) Keep the `undefined` overload as dead surface — no contract
  change, but the invariant then rests entirely on nobody calling it. (b) Narrow both —
  would make it impossible to un-colour a creature token, which no decision asked for.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-050's completion summary.

---

## Decisions taken while executing WI-054

### DEC-042 — SPEC-031's colour guarantee stays a _character_ guarantee; it does not follow the actor key

- **Question.** `PLAN.md` §2 flagged this one in advance: "WI-054 re-keys the document id
  from a seat id to an actor id — so its actor key becomes the input to that colour
  derivation for a creature, which is a question its gate must answer rather than
  inherit." Now that `profiles/{id}` may be keyed by a token id, does "every character
  has a colour" (SPEC-031, DEC-033, DEC-040) extend to creature profiles?
- **Recommendation.** **No.** Scope the guarantee to seat-keyed actors and leave it there.
  Concretely: `resolveCharacterColor(seatId, profiles)` keeps taking a **seat** id and is
  documented as doing so; `migrateProfile` keeps deriving from a seat id, and its only
  caller — `.vttcamp` import — now applies it **only** to profiles whose id appears in the
  archive's own `players` roster; nothing seeds a colour for a creature at creation, the
  way `joinRoom` does for a seat.
- **Impact.** The `players` roster becomes load-bearing on the import path, which is the
  one visible behaviour change: an archive whose profile has no matching seat document is
  no longer backfilled. That is a narrow case — a profile for a seat that does not exist —
  and the conservative direction, since the alternative is painting a colour onto a
  document we cannot identify as a character. It also decides something for WI-056 rather
  than leaving it open: when the quick sheet renders a creature, its colour row has no
  always-present value to show, so WI-056 must either offer a colour and store it on
  first pick or omit the row. Reversible in one predicate plus one call site, and nothing
  is written either way, so reversing repaints nobody.
- **Alternatives.** (a) Extend the guarantee to every actor — one rule instead of two, and
  it would give WI-056's sheet a colour for free. Rejected because it contradicts
  SPEC-031 §5's own reasoning, which kept `Token.color` clearable precisely on the grounds
  that "a creature or a piece of scenery has no character behind it": a creature would then
  have a guaranteed profile colour and a clearable token colour, which is worse than
  either rule alone. (b) Derive a colour for a creature at read time but never store one —
  no writes, but it is the same contradiction with an extra branch, and two views could
  disagree about whether a creature "has" a colour. (c) Leave `migrateProfile` applied to
  every profile document, as today — simplest diff, but an import would silently invent a
  character colour for every creature in the archive, which is exactly the data-invention
  the "no usable id" guard already exists to prevent.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-054's completion summary.

---

## Decisions taken while executing WI-055

Both are **agent defaults** under the Default-and-notify tier, surfaced in WI-055's
completion summary. Both are reversible.

### DEC-043 — The §3 predicate has two faces, and an unknown id is not a creature

- **Question.** SPEC-032 §3 describes one rule, but its two consumers hold different
  keys: WI-057's map drag has a **token id** (`attachDragHandlers` closes over one),
  while the selection spine WI-055 re-keys carries an **actor id** (a seat id for a
  character, a token id for a creature). One exported function cannot take both without
  the caller guessing which it has. And whichever it takes, it must answer a second
  question the spec does not: what an id that matches **no** token means.
- **Recommendation.** **Two exports over one shared internal** —
  `canActOnToken(…, tokenId, …)` and `canActOnActor(…, actorId, …)`, plus
  `actorIdForToken(token)` so the `ownerSeatId ?? id` fallback is written once. And an
  unknown id is **not** a creature: `canActOnActor` treats an id as creature-keyed only
  when a **seatless token answers to it**, and sends everything else to `canSeatActAs`.
- **Impact.** The unknown-id rule is the load-bearing half. `canSeatActAs` grants "a seat
  may act as itself" unconditionally, and a seat that has not claimed a token yet holds
  an id no token answers to — so routing unknown ids into the creature branch would make
  a brand-new player's own sheet read-only until they claimed a token, which is a
  regression with no failing test to catch it (the e2e suite claims a token first).
  Routing them to `canSeatActAs` also means a _character's token id_ is not a creature
  key, which is what stops `t-b` reading as a creature just because it is seatless-looking
  from the wrong end. `canActOnToken` answers the opposite way — an unknown **token** id
  is `false` for anyone but the referee, because there is genuinely nothing to own. Both
  are tested directly.
- **Alternatives.** (a) One function taking a discriminated union
  (`{kind: 'seat'|'token', id}`) — unambiguous, but every call site then has to construct
  the discriminator from the same guess, moving the problem rather than solving it.
  (b) One function keyed by token id only, with the selection spine resolving actor →
  token before calling — fails for a seat with no token, the case above. (c) Treat any id
  no seat answers to as a creature — inverts the test and needs the player roster threaded
  into a module that currently takes only groups and tokens.
- **Answer.** Agent default (Default-and-notify). Reversible: the two faces are eight
  lines each over one shared `tokenIsInOwnedGroup`.

### DEC-044 — `selected-seat` becomes `selected-actor`

- **Question.** `VectorMapView`'s e2e readout is `data-testid="selected-seat"`. After the
  re-key it renders an actor id, which is a token id whenever a creature is selected —
  from WI-056 onward. Rename it, or leave it?
- **Recommendation.** **Rename to `selected-actor`**, on DEC-039's reasoning: a readout
  named after one of the two things it can now hold misleads at every future call site,
  and the cost of renaming is one line in one spec.
- **Impact.** RULE-005 governs this — the testid moves, so
  `apps/web/tests/e2e/group-ownership.spec.ts` is updated in the same change, which is the
  escape RULE-005 names. `README.md`'s introspection-readout list is updated with it. The
  readout's _value_ does not change in WI-055: nothing dispatches a token id yet, so the
  spec's two assertions ("empty before a pick-up, non-empty after") hold unchanged and
  the rename is the whole diff.
- **Alternatives.** (a) Leave `selected-seat` — zero churn now, a permanently wrong name
  from WI-056 on. (b) Rename it in WI-056 instead, when the value actually widens —
  defensible, but it splits one contract change across two pull requests, and WI-056's
  diff is already the larger one.
- **Answer.** Agent default (Default-and-notify).

---

## Decisions taken while executing WI-056

### DEC-045 — A creature's card selectability drops the ownership gate rather than gaining one

- **Question.** SPEC-032 §4 reads "any card, player or creature, that belongs to a
  group the viewer owns is selectable." Taken literally, that would newly gate
  _character_ selectability on group ownership too — but `group-ownership.spec.ts`'s
  existing, already-shipped test ("Player Two owns no group, so Player One's character
  is a read-only view") proves a non-owned character's card is already clickable today;
  only editing is ownership-gated. Which does WI-056 implement for a creature: the
  literal §4 predicate, or parity with how a character already behaves?
- **Recommendation.** **Parity.** Drop `EncounterBoard`'s `Boolean(token.ownerSeatId)`
  gate on `selectable`/`role`/`tabindex` entirely, for every card, and keep authority
  exactly where `dockReadOnly` (`canActOnActor`) already puts it. §4's sentence reads as
  loose motivating prose for _why_ a creature's card needs to stop being unresponsive,
  not as a new narrower predicate — the literal reading would be a silent behaviour
  change to every character card in the game, which nothing asked for and which the
  existing test would have caught had it been attempted.
- **Impact.** A creature's card becomes clickable by anyone (read-only unless the
  viewer's group owns it, or they are the referee) — symmetric with a character's card,
  which is the least surprising outcome given the two already look alike on the board.
  If the literal reading was actually wanted, it would additionally restrict every
  existing character card, which is a much larger, untested change than this work item's
  gate covers (RULE-016) and would need its own intake item.
- **Alternatives.** (a) Implement the literal predicate for creatures only —
  inconsistent with characters (two selectability rules on the same board) and answers
  a question nobody asked. (b) Implement it for both characters and creatures —
  out of scope for WI-056 and a real regression risk with no covering test today.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-056's completion
  summary. Reversible: the dropped conditions are one boolean each.

---

---

## Decisions taken during the mobile / Blaze / carve-artifacts batch (2026-08-03)

DEC-046 through DEC-048 record reversals and contract changes that only the user can
ratify, and are **Open** until they are answered. DEC-049 is **Open and blocking** — it is
a rule conflict, not a design choice. DEC-050 and DEC-051 are agent defaults under the
Default-and-notify tier, surfaced in the gates for WI-058 and WI-060.

### DEC-046 — Reversing "a snapped band covers whole cells, both ends inclusive"

- **Question.** IN-038 requires a snapped Corridor/Path leg to stop at its end anchor's
  cell **centre** rather than at the far edge of that anchor's cell. That directly
  reverses SPEC-028 §7 as shipped by WI-051, and the reasoning DEC-032 ratified.
- **Recommendation.** **Ratify, but narrowly:** withdraw the whole-cell rule for an
  _interior_ end — one that meets another leg — and keep it for a _terminal_ end. A
  straight run's caps still land on grid lines and its length still grows a cell at a
  time; only a bend changes.
- **Impact.** Visible on every snapped bend, and the narrower the band the larger the
  change: at width ⅛ under cell snap each leg currently overshoots the other by 0.4375
  cells, which is the reported four-way spray. It also collapses the corner's boolean
  seams, so the inside and outside corners each become a single vertex — the other half of
  the report, delivered by the same edit. Reversal cost is low: `bandRect` gains per-end
  extension parameters and the callers pass them; nothing is stored differently, and no
  committed floor is migrated or re-simplified, so **existing maps keep the geometry they
  already have** — the change applies to strokes drawn from here on, which means a map may
  visibly contain both shapes. That is the one genuinely awkward consequence and it is not
  worth a migration to avoid.
- **Alternatives.** (a) Keep whole-cell spans and subtract the overlap after the union —
  arrives at a similar picture through arithmetic nobody can later explain, and it has no
  honest answer for a bend sharper than 90°. (b) Keep whole-cell spans and accept the
  spray as the cost of sub-cell widths — i.e. withdraw ⅛ and ¼, which reverses DEC-032's
  extension 2 instead; the user asked for those widths specifically. (c) Ratify wholesale
  — extend nothing at all, including terminal ends — simplest rule of the three, but a
  snapped corridor would then stop half a cell short of where it was dragged, which
  contradicts §7's surviving expectations and the §6 indicator.
- **Answer.** _Awaiting the user's ratification._ **This entry names and supersedes**
  SPEC-028 §7's whole-cell clause and the part of DEC-032 that produced it; DEC-032 is
  annotated in place per RULE-019, never rewritten.

### DEC-047 — Simplification tolerance is bounded by the stroke's width

- **Question.** IN-039: `path: 0.15` is wider than the ⅛-cell (0.125) band Path can now
  emit, so Douglas-Peucker collapses a thin band into a sliver. Is the fix a new number,
  or a rule?
- **Recommendation.** **A rule, in two clauses.** (1) No tool's effective tolerance may
  exceed a small fraction of its own stroke width — the width is the smallest feature the
  stroke is required to preserve. (2) A _snapped_ Path or Corridor takes tolerance **0**,
  on the same grounds `room: 0` already stands: exact axis-aligned rectilinear geometry has
  no redundant vertices to prune.
- **Impact.** Committed strokes get more vertices — which the POC's own size finding makes
  free (§8.2: ~11 KiB worst-case region with simplify fully **off**, ~90× under the
  Firestore limit), so this spends headroom that was measured and is known to exist. Free-
  snap Path is unchanged in the common case, since 0.15 only binds below a width of about
  0.6 cells. The choice of the fraction `k` is a tuning constant and is the one part of
  this a future playtest may want to move.
- **Alternatives.** (a) Lower `path` to a flat value that is safe at ⅛ (say 0.03) — one
  number, no rule, but it silently over-preserves the free-form ribbon the value was tuned
  for, and it breaks again the day a narrower width is offered. (b) Set `path: 0` outright
  — correct for snapped, throws away the free-form pruning the §8.1 spike specifically
  identified as this stand-in's value. (c) Simplify before the boolean union rather than
  after — a real pipeline change, much larger, and it does not address the width relation
  at all.
- **Answer.** _Awaiting the user's call, though this is the least contentious of the three
  and is classified Simple._

### DEC-048 — The corridor's bend axis is latched from the gesture, not derived from the endpoints

- **Question.** IN-040: `corridorPoly` is unconditionally horizontal-leg-first. Latching
  the axis from the drag means the same two endpoints can produce either L, so the axis
  cannot be derived inside the primitive. Where does it live, and what happens before the
  drag has committed to a direction?
- **Recommendation.** An explicit argument on `corridorPoly`, fed by per-gesture state in
  `VectorMapView` that is set once the drag exceeds a latch threshold on one axis and
  cleared on pointer-up. Before the threshold there is **no bend to place** — the stroke is
  a single straight leg — so the latch is never guessed from insufficient input.
- **Impact.** This is what makes the item Deceptive: a shared geometry primitive's shape
  stops being a pure function of its two endpoints and starts depending on gesture history.
  Two consequences worth stating. First, the live preview must show the L that will
  actually commit, or the latch is invisible and reads as a bug of its own. Second, the
  threshold must be in lattice units, not pixels (RULE-006), or the tool behaves
  differently at different zoom levels.
- **Alternatives.** (a) Derive the first axis from whichever delta is larger at commit
  time — no new state, no threshold, and it is nearly right; but it flips the whole
  corridor as the pointer crosses the diagonal, which is a worse surprise than the one
  being fixed. (b) An explicit modifier key to swap the bend — precise, discoverable by
  nobody, and unavailable on touch. (c) Draw both legs and let the referee pick — a modal
  for something a drag already expresses.
- **Answer.** _Awaiting the user's call._

### DEC-049 — Blaze inverts RULE-010's stated premise _(Open, blocking)_

- **Question.** IN-037 asks for storage/usage limits implementable on our side ahead of a
  Blaze upgrade, against an outside attacker rather than the actual players. But RULE-010
  does not only forbid Cloud Functions — it states _why_ containment may be loose: "On
  Spark, quota exhaustion **denies requests rather than generating a bill** — the downside
  of abuse is an outage for the group, not a charge. Tune for availability and containment,
  not cryptographic guarantees." On Blaze that sentence is false.
- **Recommendation.** Amend RULE-010 in a standalone change before any implementation
  (RULE-017), and be explicit in the amendment about what the upgrade does and does not
  change. My reading: the **no-Cloud-Functions** clause can stand — every lever in
  SPEC-034 §2 is Security Rules or console configuration, exactly as the rule's second
  clause contemplates. The **economic premise** cannot: it must be replaced with a statement
  that on Blaze the backstop is a Cloud Billing budget plus enforced App Check, and that
  no aggregate quota is enforceable in-app.
- **Impact.** It is load-bearing beyond Storage. RULE-008 (all players trusted), RULE-012
  ("the roomId is the capability") and SPEC-025 §3's soft cap were all reasoned under
  "the worst case is an outage". Once one service bills per byte, an outsider holding a
  leaked room id has a cost lever they did not have before — which is exactly the threat
  the user named. The honest answer is that **App Check enforcement stops being optional**
  the day uploads go live; it is currently wired but inert for want of a site key
  (SPEC-025 §2), and turning it on is `[HUMAN]` console work.
- **Alternatives.** (a) Upgrade to Blaze but leave Storage disabled and uploads
  unimplemented — keeps every current premise true, and gets whatever else the upgrade was
  wanted for; the cheapest option if uploads are not the actual motivation. (b) Amend
  RULE-010 to permit Cloud Functions, which is the only way to get real quotas and rate
  limits — a much larger change to the project's stated architecture, and it reopens
  RULE-009. (c) Proceed without amending, treating the rule's premise as commentary —
  rejected outright; it is the reasoning the rest of the containment design rests on.
- **Answer.** _Awaiting the user. Work is blocked._ Scheduled after the Battle Map and Hex
  Crawl series (user, 2026-08-03), so there is time for this to be answered properly.

### DEC-050 — `dvh` is stated as an invariant, not applied as two fixes

- **Question.** IN-033's viewport bug is two `100vh` declarations (`App.svelte:46`,
  `RoomShell.svelte:914`). Fix those two lines, or state a rule?
- **Recommendation.** State it (SPEC-033 §1) and then fix the two lines. The failure mode
  is silent and non-local: a single `100vh` anywhere in the ancestor chain reintroduces the
  whole bug, and the element that _breaks_ is not the element that is wrong — `.mshell` is
  already correct and still gets clipped.
- **Impact.** Costs nothing now and gives the next person a reason rather than a diff.
  `100dvh` has no fallback concern for the browsers this app targets, and `dvh` resizing
  as the URL bar collapses is the intended behaviour, not a flaw.
- **Alternatives.** (a) Fix the two declarations with a comment — smaller, and the rule is
  then discoverable only by whoever reads those two lines. (b) A lint rule banning `100vh`
  — enforceable, but it is a new tooling dependency for one CSS unit.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-058's gate.

### DEC-051 — Credits live in the lobby only, and mirror `ATTRIBUTION.md`

- **Question.** IN-041 asks for credits on the lobby screen. Should the same content also
  appear in-room (Session config, an About panel), and what is the relationship to
  `apps/web/public/assets/ATTRIBUTION.md`?
- **Recommendation.** Lobby only, and the attribution file is corrected in the same change
  rather than replaced by the UI. Two audiences: the lobby credit is what a player sees,
  the attribution file is what a distribution build is audited against, and its
  symbol-pack section carries a standing TODO that this batch is exactly the occasion to
  close.
- **Impact.** The two can drift, which is the real cost, and is why the spec says
  explicitly that they must not disagree. Adding an in-room surface later is additive and
  needs no rework. CC0 1.0 imposes no attribution _requirement_ — the user supplied it as
  the licence and asked for the credit regardless, which is a courtesy, and the credit
  should not imply the author endorses this project.
- **Alternatives.** (a) Credits in both the lobby and Session config — two places to keep
  in step, for one static list. (b) A dedicated `/credits` route — more room to grow,
  more than one static list needs. (c) Link to `ATTRIBUTION.md` instead of restating it —
  no drift at all, but it sends a player to a raw markdown file in a build directory.
- **Answer.** Agent default (Default-and-notify), surfaced in WI-060's gate.

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
