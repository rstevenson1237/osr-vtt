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

**DEC-046, DEC-047 and DEC-048 were ratified as recommended** (user, 2026-08-03) and are
no longer Open; WI-059, WI-061 and WI-062 are unblocked. They stay written in place, per
RULE-019.

**DEC-049 was answered separately** (user, 2026-08-03, alternative (c)) and is likewise no
longer Open. SPEC-034 is unblocked as to its _content_; WI-066 remains blocked on WI-065,
the standalone `RULE-AMENDMENT:` change, which RULE-017 requires to land on its own first.

Nothing from the 2026-08-03 batch remains Open.

---

# Closed

Full text for each entry lives in `docs/decisions/DEC-nnn.md`. Read the one you
need; do not read them all.

- **DEC-001** — Map-edit permissions: should players be able to carve the shared map? → `docs/decisions/DEC-001.md`

## Decisions taken during this refactor (WI-028)

All of the following are **agent defaults** under the Default-and-notify tier, except
DEC-015 through DEC-018, which the user decided in advance, and DEC-007 through DEC-010,
which the user answered directly. Every one is reversible.

- **DEC-007** — Milestone boundaries → `docs/decisions/DEC-007.md`
- **DEC-008** — Repo map and dev commands live in README, not RULES → `docs/decisions/DEC-008.md`
- **DEC-009** — Part 0 splits between CLAUDE.md and README → `docs/decisions/DEC-009.md`
- **DEC-010** — Historical work items are zero-padded, not renumbered → `docs/decisions/DEC-010.md`
- **DEC-011** — Specs renumbered SPEC-001+ with a permanent crosswalk → `docs/decisions/DEC-011.md`
- **DEC-012** — Spec status vocabulary, and what "Active" means → `docs/decisions/DEC-012.md`
- **DEC-013** — Superseded specs may name a README section as successor → `docs/decisions/DEC-013.md`
- **DEC-014** — Legacy tables preserved verbatim rather than reshaped → `docs/decisions/DEC-014.md`
- **DEC-015** — Archiving policy → `docs/decisions/DEC-015.md`
- **DEC-016** — PreToolUse hooks: exactly two → `docs/decisions/DEC-016.md`
- **DEC-017** — `/work-item` slash command → `docs/decisions/DEC-017.md`
- **DEC-018** — `settings.json` pre-approvals → `docs/decisions/DEC-018.md`
- **DEC-019** — `DEC-nnn` ID scheme added → `docs/decisions/DEC-019.md`

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

## Vector Map System — decision log (condensed)

Moved verbatim to `docs/decisions/vector-map-log.md`.

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

- **DEC-020** — Firestore TTL on `rolls` → `docs/decisions/DEC-020.md`

## Decisions taken during the map-tools playtest batch (WI-030)

DEC-021 through DEC-027 were answered directly by the user during planning. DEC-028 is an
agent default under the Default-and-notify tier, surfaced in WI-030's completion summary.
All are reversible.

- **DEC-021** — N-gon orientation: the drag points at a flat face → `docs/decisions/DEC-021.md`
- **DEC-022** — N-gon size snaps across the flats → `docs/decisions/DEC-022.md`
- **DEC-023** — Fixed option sets for the n-gon and corridor only → `docs/decisions/DEC-023.md`
- **DEC-024** — Snapped floor tools anchor to cell centres, not lattice vertices → `docs/decisions/DEC-024.md`
- **DEC-025** — Battle map stores a rect, not an image → `docs/decisions/DEC-025.md`
- **DEC-026** — The battle map is a temporary map in the same room → `docs/decisions/DEC-026.md`
- **DEC-027** — Carve-tool audit findings become intake items, not edits → `docs/decisions/DEC-027.md`
- **DEC-028** — Changing snap mode resets the corridor width → `docs/decisions/DEC-028.md`

## Decisions taken while executing WI-045

- **DEC-029** — A third `PreToolUse` hook: PLAN.md status write-back reminder → `docs/decisions/DEC-029.md`

## Decisions taken during the quick-sheet / encounter / path-tool batch (2026-08-02)

DEC-030 and DEC-031 are **agent defaults** under the Default-and-notify tier, surfaced in
the gate for WI-046 and WI-047. DEC-032 is **Open** — it records a reversal that IN-028
requires and that only the user can ratify.

- **DEC-030** — The quick sheet's name is the seat's `displayName`, and only its own seat may edit it → `docs/decisions/DEC-030.md`
- **DEC-031** — A creature added from the encounter board spawns at the map's starter drop → `docs/decisions/DEC-031.md`
- **DEC-032** — Reversing "the Path tool keeps its free-form ribbon" → `docs/decisions/DEC-032.md`
- **DEC-033** — Every character always has a colour; there is no unset state → `docs/decisions/DEC-033.md`

## Decisions taken during the creature-selection batch (2026-08-02)

DEC-034 and DEC-035 are **user-answered**. DEC-036 is an **agent default** under the
Default-and-notify tier, surfaced in the gate for WI-057.

- **DEC-034** — Creatures get profiles; profiles are keyed by an actor, not a seat → `docs/decisions/DEC-034.md`
- **DEC-035** — Ownership for a seatless token is group membership alone → `docs/decisions/DEC-035.md`
- **DEC-036** — Map drag is gated, and an ungrouped seatless token is referee-only → `docs/decisions/DEC-036.md`

## Decisions taken while executing WI-053

- **DEC-037** — The Edit/View soft lock gates tool selection only, not Undo/Redo or the occasional whole-map actions → `docs/decisions/DEC-037.md`

## Decisions taken while executing WI-051

- **DEC-038** — What a _diagonal_ snapped Path leg does, which DEC-032 does not say → `docs/decisions/DEC-038.md`
- **DEC-039** — The shared control is `bandWidth` / `band-width`, not `corridorWidth` → `docs/decisions/DEC-039.md`

## Decisions taken while executing WI-050

- **DEC-040** — The colour backfill is a resolution rule, not a document rewrite → `docs/decisions/DEC-040.md`
- **DEC-041** — `setProfileColor` narrows to `string`; `setTokenColor` keeps its clearing overload → `docs/decisions/DEC-041.md`

## Decisions taken while executing WI-054

- **DEC-042** — SPEC-031's colour guarantee stays a _character_ guarantee; it does not follow the actor key → `docs/decisions/DEC-042.md`

## Decisions taken while executing WI-055

Both are **agent defaults** under the Default-and-notify tier, surfaced in WI-055's
completion summary. Both are reversible.

- **DEC-043** — The §3 predicate has two faces, and an unknown id is not a creature → `docs/decisions/DEC-043.md`
- **DEC-044** — `selected-seat` becomes `selected-actor` → `docs/decisions/DEC-044.md`

## Decisions taken while executing WI-056

- **DEC-045** — A creature's card selectability drops the ownership gate rather than gaining one → `docs/decisions/DEC-045.md`

## Decisions taken during the mobile / Blaze / carve-artifacts batch (2026-08-03)

DEC-046 through DEC-048 record reversals and contract changes that only the user could
ratify; all three were **ratified as recommended** (user, 2026-08-03). DEC-049 was a rule
conflict rather than a design choice and was **answered separately** the same day (c).
DEC-052 followed from the same conversation. DEC-050 and DEC-051 are agent defaults under the
Default-and-notify tier, surfaced in the gates for WI-058 and WI-060.

- **DEC-046** — Reversing "a snapped band covers whole cells, both ends inclusive" → `docs/decisions/DEC-046.md`
- **DEC-047** — Simplification tolerance is bounded by the stroke's width → `docs/decisions/DEC-047.md`
- **DEC-048** — The corridor's bend axis is latched from the gesture, not derived from the endpoints → `docs/decisions/DEC-048.md`
- **DEC-049** — Blaze inverts RULE-010's stated premise _(Open, blocking)_ → `docs/decisions/DEC-049.md`
- **DEC-050** — `dvh` is stated as an invariant, not applied as two fixes → `docs/decisions/DEC-050.md`
- **DEC-051** — Credits live in the lobby only, and mirror `ATTRIBUTION.md` → `docs/decisions/DEC-051.md`
- **DEC-052** — `isMobile` is two signals, not one → `docs/decisions/DEC-052.md`

## Decisions taken while executing WI-062

- **DEC-053** — What "the drag has declared an axis" means, which DEC-048 leaves open → `docs/decisions/DEC-053.md`

## Decisions taken while executing WI-067

Both are **agent defaults** under the Default-and-notify tier, surfaced in WI-067's
completion summary. Both are reversible.

- **DEC-054** — Hit-target sizing is three CSS tokens over the shell frame, not a component prop over the app → `docs/decisions/DEC-054.md`
- **DEC-055** — `createLayoutMode`/`isMobile` is renamed rather than kept as one of the two signals → `docs/decisions/DEC-055.md`

## Decisions taken while executing WI-069

DEC-058's automerge half was answered by the user (2026-08-07); the rest are agent
defaults under the Default-and-notify tier, surfaced in WI-069's completion summary.

- **DEC-056** — The big documents become indexes over per-entry files, rather than being trimmed → `docs/decisions/DEC-056.md`
- **DEC-057** — The `PLAN.md` model target binds the execution session → `docs/decisions/DEC-057.md`
- **DEC-058** — CI is checked once, not polled; automerge is declined → `docs/decisions/DEC-058.md`

## Decisions taken while planning WI-063

An **agent default** under the Default-and-notify tier, surfaced in WI-063's approval gate.
It fills in the answer SPEC-033 §4 deliberately left open — the room-label tooltip's touch
trigger — and is reversible in three independent pieces. **Shipped as WI-063, 2026-08-08**,
all three pieces intact: the note dot, `PICK_PX`, and the `@media (hover: hover)` wrapping.

- **DEC-059** — A coarse pointer gets a target, not a gesture → `docs/decisions/DEC-059.md`

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
