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

- **DEC-135** — IN-199: how does the token controller take pointer input? Recommendation (a), keep the sprite handlers in the controller. Blocks WI-230's gate. → `docs/decisions/DEC-135.md`

The next free id is **DEC-136**.

# Closed

Full text for each entry lives in `docs/decisions/DEC-nnn.md`. Read the one you
need; do not read them all.

- **DEC-134** — IN-205: who owns the selection once three seams write it? → `docs/decisions/DEC-134.md`
- **DEC-133** — IN-201: how does the hex controller keep the axial boundary? → `docs/decisions/DEC-133.md`
- **DEC-132** — IN-210: what should the Yjs RTDB node hold, so a listener gets the edit and not the whole document? → `docs/decisions/DEC-132.md`
- **DEC-131** — IN-206: what happens to the grid testids when grid and fog move to Assets? (agent default) → `docs/decisions/DEC-131.md`
- **DEC-130** — IN-113: where do token rings draw once each token is one container? → `docs/decisions/DEC-130.md`
- **DEC-129** — IN-106: is per-hex terrain scatter still wanted? → `docs/decisions/DEC-129.md`
- **DEC-128** — IN-072: what does the app do with a `.vttcamp` written by a newer build? → `docs/decisions/DEC-128.md`
- **DEC-127** — IN-226: what does a store update method do when its document is gone? → `docs/decisions/DEC-127.md`
- **DEC-126** — IN-197: does the seam protocol need its own execution item? → `docs/decisions/DEC-126.md`
- **DEC-125** — Backgrounds on hex maps: a hex-native position, or switched off? → `docs/decisions/DEC-125.md`
- **DEC-124** — What does the background layer do when one image will not load? → `docs/decisions/DEC-124.md`
- **DEC-123** — What does a write to a background that has just been removed do? → `docs/decisions/DEC-123.md`
- **DEC-122** — Which name does an unnamed creature show? → `docs/decisions/DEC-122.md`
- **DEC-002** — Theme engine: reachability, or authoring? → `docs/decisions/DEC-002.md`
- **DEC-003** — Plan mode as a supplement to the step-5 approval gate → `docs/decisions/DEC-003.md`
- **DEC-004** — Subagents for isolated or parallel work items → `docs/decisions/DEC-004.md`
- **DEC-005** — Nested per-directory `CLAUDE.md` files → `docs/decisions/DEC-005.md`
- **DEC-006** — Git worktrees for concurrent work items → `docs/decisions/DEC-006.md`
- **DEC-077** — Do imported die meshes enter the dice renderer, and on what terms? → `docs/decisions/DEC-077.md`
- **DEC-078** — What replaces SPEC-020 §5's edge rule for numeral orientation? → `docs/decisions/DEC-078.md`
- **DEC-079** — How does bevel geometry coexist with value faces? → `docs/decisions/DEC-079.md`
- **DEC-082** — Free-form hex terrain beside per-hex terrain: one representation or two? → `docs/decisions/DEC-082.md`
- **DEC-084** — What is a ping attached to, and how does it read on a token? → `docs/decisions/DEC-084.md`
- **DEC-086** — What is a "referee-created" token, and where is that recorded? → `docs/decisions/DEC-086.md`
- **DEC-087** — How far does retiring the `gen:disc:` mechanic reach? → `docs/decisions/DEC-087.md`
- **DEC-090** — What bounds a 1.8× terrain glyph? → `docs/decisions/DEC-090.md`
- **DEC-091** — Does `danger` leave the contents palette with nothing to redirect to? → `docs/decisions/DEC-091.md`
- **DEC-092** — What clips a terrain glyph, now that the stencil is priced? → `docs/decisions/DEC-092.md`
- **DEC-093** — Does `GameMap.measure` mean something different on a hex map? → `docs/decisions/DEC-093.md`
- **DEC-094** — What is a hex-snapped token position? → `docs/decisions/DEC-094.md`
- **DEC-095** — Where does a river's smoothing happen? → `docs/decisions/DEC-095.md`
- **DEC-102** — Does the `PLAN.md` freshness hook stay, move, or go? → `docs/decisions/DEC-102.md`
- **DEC-103** — What may a planning turn run on? → `docs/decisions/DEC-103.md`
- **DEC-120** — What goes in `PLAN.md`'s Effort column, and how is it assigned? → `docs/decisions/DEC-120.md`
- **DEC-001** — Map-edit permissions: should players be able to carve the shared map? → `docs/decisions/DEC-001.md`
- **DEC-085** — What does a zero-length gesture commit, per tool and per snap mode? → `docs/decisions/DEC-085.md`
- **DEC-088** — On what terms does the Worldographer terrain pack replace the current one? → `docs/decisions/DEC-088.md`
- **DEC-089** — Where does a terrain overlay's ink colour come from? → `docs/decisions/DEC-089.md`
- **DEC-096** — How is a side-mode initiative slot keyed? → `docs/decisions/DEC-096.md`
- **DEC-097** — Does an open Call for Initiative stop other rolls? → `docs/decisions/DEC-097.md`
- **DEC-098** — Icon render size is three stops chosen by pointer coarseness, not a number each caller picks → `docs/decisions/DEC-098.md`
- **DEC-099** — The mobile quick-sheet chips carry a word, rather than teaching their glyphs some other way → `docs/decisions/DEC-099.md`
- **DEC-100** — One session, one approved unit: the batch lane for Simple items → `docs/decisions/DEC-100.md`
- **DEC-101** — The bounded Deviations budget: same file, ≤ 20 lines, tested, recorded → `docs/decisions/DEC-101.md`
- **DEC-104** — The git tag is the version; `package.json` stops pretending to be one → `docs/decisions/DEC-104.md`
- **DEC-105** — CI parallelism is a shard per job, not workers inside one job → `docs/decisions/DEC-105.md`
- **DEC-106** — A `SessionStart` bootstrap joins the harness, and the hook count is read per event → `docs/decisions/DEC-106.md`
- **DEC-107** — What the one-home-per-fact pass may delete, and what it may not → `docs/decisions/DEC-107.md`
- **DEC-108** — Undo is one stack per client, cleared when the viewed map changes → `docs/decisions/DEC-108.md`
- **DEC-109** — Select joins the View tools: tokens are selectable and movable, geometry read-only → `docs/decisions/DEC-109.md`
- **DEC-110** — The hosted build uses Firestore's persistent, multi-tab offline cache → `docs/decisions/DEC-110.md` — **superseded by DEC-121**
- **DEC-111** — Collection backfills share one ledger: a version stamp on the room doc → `docs/decisions/DEC-111.md`
- **DEC-112** — A `.dd2vtt`/`.uvtt` import makes a new map of walls and doors, and nothing else → `docs/decisions/DEC-112.md`
- **DEC-113** — Hex fog is a `revealed` flag on `HexTile`, painted by a Reveal tool → `docs/decisions/DEC-113.md`
- **DEC-114** — The Edit/View choice lasts for the tab session (supersedes DEC-064 in part) → `docs/decisions/DEC-114.md`
- **DEC-115** — The referee may roll during a call, and may resolve it with who has staged (supersedes DEC-097 in part) → `docs/decisions/DEC-115.md`
- **DEC-116** — The room password is removed, and a join secret is out of scope → `docs/decisions/DEC-116.md`
- **DEC-117** — `CampaignStore` splits by domain; the contract file still runs every suite → `docs/decisions/DEC-117.md`
- **DEC-118** — Render dirty-tracking is built only if a measurement says so → `docs/decisions/DEC-118.md`
- **DEC-119** — Token portraits may be stored as small images in Firestore → `docs/decisions/DEC-119.md`
- **DEC-121** — A disconnected room is read-only; no offline cache (supersedes DEC-110) → `docs/decisions/DEC-121.md`

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

| Decision                 | Default (locked unless overridden at WI start)                                                                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell model              | Quick Sheets (Part II §1). The R1 Option A rail shell is retired                                                                                                                                                                                                                                                                                         |
| Measurement defaults     | `perSquare: 10`, `unit: "feet"` — applied to existing rooms by migration                                                                                                                                                                                                                                                                                 |
| Token snapping           | Cell-center default; Alt = half-grid; Alt+Shift = free                                                                                                                                                                                                                                                                                                   |
| Google auth              | Optional link for players; **required to create a room** (R24.1). Anonymous join stays zero-friction                                                                                                                                                                                                                                                     |
| Theming scope            | System + two themes (R2); more themes are content, not code                                                                                                                                                                                                                                                                                              |
| Hex grid                 | **Stale entry, annotated in place (IN-045, WI-071).** Was "Deferred"; SPEC-030 is now Active, IN-011 Scheduled, WI-037–WI-041 all gate-cleared. Left in the table per RULE-019 rather than deleted.                                                                                                                                                      |
| Log recording config     | View-side filters primary; room-level recording toggles only for future noisy types                                                                                                                                                                                                                                                                      |
| Uploads (Blaze)          | `[HUMAN]` card decision unlocks `FirebaseStorageAssetStore`; the Assets view ships the disabled slot. **Containment landed with WI-066** (SPEC-034 §§2–4): `storage.rules` is the boundary, the usage readout is friction, `deleteRoom` sweeps the bucket, runbook in `docs/runbooks/blaze-billing.md`. The `[HUMAN]` console work is still outstanding. |
| Floor storage            | Model A — baked union, no construction history                                                                                                                                                                                                                                                                                                           |
| Map schema mismatch      | Error, don't migrate ("unsupported map schema")                                                                                                                                                                                                                                                                                                          |
| Advantage semantics      | Summed = (n+1) pool, 1 extra per kind for mixed; separate = +1 per die; dropped dice dimmed in both                                                                                                                                                                                                                                                      |
| Circular walls           | Not a storage type — a `FloorRegion` ring or an `explicit` segment loop                                                                                                                                                                                                                                                                                  |
| Group membership         | A token belongs to **at most one** group                                                                                                                                                                                                                                                                                                                 |
| Group creation path      | Renaming the Unassigned bin — the only path                                                                                                                                                                                                                                                                                                              |
| Room soft cap            | `MAX_ROOMS_SOFT = 12`, client-side friction, explicitly not a security boundary                                                                                                                                                                                                                                                                          |
| Stale room threshold     | `STALE_ROOM_DAYS = 90`; surfaced, never auto-deleted                                                                                                                                                                                                                                                                                                     |
| Abandoned seat threshold | `ABANDONED_SEAT_DAYS = 30`; GM-confirmed prune only                                                                                                                                                                                                                                                                                                      |
| Presence heartbeat       | `PRESENCE_HEARTBEAT_MS = 45_000`; disconnected at 2× heartbeat                                                                                                                                                                                                                                                                                           |
| Room activity throttle   | `ROOM_ACTIVITY_THROTTLE_MS` = 5 minutes, in-memory                                                                                                                                                                                                                                                                                                       |

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

## Decisions taken during the map-tools/backgrounds playtest batch (2026-08-11)

Raised after the Battle Map series landed (SPEC-029 Completed). All eight answered by the
user in the same planning session that produced WI-071 – WI-082; DEC-063 is an agent
default under Default-and-notify, surfaced at that gate, the rest were put to the user
directly.

- **DEC-060** — One Select tool, lasso included; `selectEdge` is retired → `docs/decisions/DEC-060.md`
- **DEC-061** — Free snap attracts to an existing vertex, within the existing pick radius → `docs/decisions/DEC-061.md`
- **DEC-062** — Multiple backgrounds are a subcollection; `GameMap.background` narrows to colour-only → `docs/decisions/DEC-062.md`
- **DEC-063** — Background transform is GM-only; the alignment grid shows while a background is selected → `docs/decisions/DEC-063.md`
- **DEC-064** — Edit/View becomes one binary button, and reverses WI-053's default to View → `docs/decisions/DEC-064.md`
- **DEC-065** — The v13→v14 migration is pinned to a frozen literal, decoupled from the live default → `docs/decisions/DEC-065.md`
- **DEC-066** — The battle-map quick sheet's button arms the existing canvas gesture; `capture` leaves `TOOL_GROUPS` → `docs/decisions/DEC-066.md`
- **DEC-067** — IN-027 becomes an explicit "Tidy" action, not a change to expand → `docs/decisions/DEC-067.md`

## Decisions taken during the backgrounds / creature-naming / local-runtime batch (2026-08-17)

Eight entries. **DEC-069, DEC-072, DEC-073 and DEC-075 were put to the user directly** —
they are the blocking four (an existing-data migration default, a persistence-format
scoping rule, the backend architecture, and a distribution shape that could have added a
new runtime dependency) — and all four were answered in the same planning session.
**DEC-068, DEC-070 and DEC-074's feature list are agent defaults** under Default-and-notify,
surfaced at that gate. **DEC-071 is a reversal**: it names and supersedes SPEC-038 §3, which
is annotated in place rather than rewritten (RULE-019).

**DEC-074 is not self-executing.** It records that RULE-009 stands in the way of a
backend-less build, and that the amendment is its own standalone `RULE-AMENDMENT:` change
with its own approval (RULE-017) — WI-088, which gates WI-089.

- **DEC-068** — `MapBackground.locked` is a stored field, not a client-side mode → `docs/decisions/DEC-068.md`
- **DEC-069** — Every existing background migrates to **locked** → `docs/decisions/DEC-069.md`
- **DEC-070** — The Assets panel keeps add/lock/Fit/remove and loses "Adjust on map" → `docs/decisions/DEC-070.md`
- **DEC-071** — Corners preserve the ratio, edges change it; supersedes SPEC-038 §3 → `docs/decisions/DEC-071.md`
- **DEC-072** — Creature symbols restart at A within each group → `docs/decisions/DEC-072.md`
- **DEC-073** — Local mode is a `LocalStore` over a `.vttcamp` file handle → `docs/decisions/DEC-073.md`
- **DEC-074** — What a local build gives up, and the RULE-009 amendment it needs first → `docs/decisions/DEC-074.md`
- **DEC-075** — A local build ships as a static bundle plus a launcher, no new runtime dependency → `docs/decisions/DEC-075.md`
- **DEC-076** — Icons depict the implement, not the mark and not the map-legend glyph → `docs/decisions/DEC-076.md`

## Decisions taken during the hex-tools / snap batch (2026-09-02)

Five entries were raised (DEC-080 – DEC-084), and **all five are now answered.** Three were
put to the user directly and **answered as recommended** on 2026-09-02; they are indexed
below. The remaining two were answered on **2026-09-07**, and neither took its
recommendation — both are written in full further up this file, per RULE-019:

- **DEC-082** (free-form terrain beside per-hex terrain) → **(b), narrowed.** The user
  postponed it on 2026-09-02 pending WI-100's investigation, which ran (2026-09-03) and
  recommended (b) against the entry's own recommendation of (a). The answer takes (b) and
  removes its brush as well: **terrain is locked to single hexes**, the free-draw
  conversation is postponed as a body of work alongside IN-084, and the union outline and
  border colour are dropped (**IN-105 Denied**). IN-091 is unblocked as SPEC-047 §7.
- **DEC-084** (what a ping is attached to) → **(b), with a drop-on-move rider.** Click-time
  resolution, no target field, and the mark is dropped locally by each client once the token
  moves. `PingPos` and `publishPing` are unchanged, so **IN-087 reclassifies Deceptive →
  Simple** and is unblocked as SPEC-046 §2.

DEC-081 is the load-bearing one: working the geometry out found that every hex corner is an
exact integer multiple of ⅓ of an axial coordinate, which collapsed three proposed address
kinds into one type and removed a RULE-006 amendment from the critical path.

- **DEC-080** — What `hex` means as a snap mode → `docs/decisions/DEC-080.md`
- **DEC-081** — The axial overlay space: hex corners are exact thirds → `docs/decisions/DEC-081.md`
- **DEC-083** — The supplied pack extends the hex catalogs, and is re-authored white → `docs/decisions/DEC-083.md`

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
- **In-app image uploads** (`FirebaseStorageAssetStore`). **Narrowed by DEC-119 (user, 2026-09-23):** portraits gain a Firestore route (WI-195); Storage uploads stay postponed as below. Still requires a `[HUMAN]` Blaze
  upgrade + budget alert + App Check enforcement, and the Assets tab still ships disabled
  with an explanatory note until `VITE_ENABLE_STORAGE_UPLOADS=true`. **What changed with
  WI-066** (2026-08-14, SPEC-034 §§2–4): the code side is no longer a bare interface slot
  — `firebase/storage.rules` and its rule tests, the client-side usage readout and soft
  cap, the room-delete object sweep, and `docs/runbooks/blaze-billing.md` all exist. The
  console steps, in order, are in that runbook.
- **Hex grid.** ~~Deferred.~~ **Stale, annotated in place (IN-045, WI-071).** SPEC-030
  (Hex Crawl map type) is Active, IN-011 is Scheduled, and WI-037 – WI-041 all carry cleared
  gates — this bullet was left behind when IN-011 was scheduled. Kept per RULE-019 rather
  than deleted; the hex crawl series is not deferred.
- **PocketBase second backend.** Kept alive by the contract suite; not scheduled. **Still
  not scheduled — but the bet it represents is being cashed** (2026-08-17, DEC-073): IN-065's
  local mode adds `LocalStore` as a third implementation of the same contract, which is the
  first real proof that a backend swap is as cheap as RULE-001 claims. If it is, PocketBase
  gets easier; if it isn't, this bullet is the entry that should be reopened first.
- **Typed doors on an arc, elevation/multi-floor, animated effects, terrain cost, typed
  lighting/vision ranges.** Out of scope. (`.uvtt` import populates lights; they are
  stored, not used for vision.)
- **Map texture polish** (water/rubble/vegetation fills). Aspirational, non-gating.
- **Room `password` field.** ~~Stored, unenforced, dormant.~~ **Retired by DEC-116 (user, 2026-09-23)** — removed with a migration, WI-191.
- **SPEC-022 §3 owned-vs-selected ring split.** Both map to white today; the cheapest
  split is a glow/thicker stroke for selected. Not built unless asked.
- **Full-viewport-diff rendering optimizations.** **Reopened by DEC-118 (user, 2026-09-23)** — measured in WI-192, built in WI-193 only if over budget. `renderMap` redraws everything per
  change. **Watch item:** re-evaluate if maps grow large enough, or Chromebook playtests
  dip below budget.
  **Measured by WI-192 (2026-09-30):** a large dungeon's vertex drag costs 42 – 44 ms of
  `renderAll` JS per move (≈ 25 ms of it `buildVectorScene`) against a 33 ms budget; rest
  19 – 27 ms. Over budget on the drag — see `README.md` § Render budget.
  **Built by WI-193 (2026-09-30):** per-layer `invalidate` with one rAF-coalesced flush,
  and an incremental drag preview in place of the per-move LoS rebuild — the same drag
  measures 9 – 11 ms per move (a one-off 10 – 16 ms setup on its first). Within budget.
- **Dice physics in a Web Worker + OffscreenCanvas.** Pre-approved fallback if the dice
  overlay drops below 30 fps on the Chromebook.

## Quarantined test — **resolved 2026-08-09 (WI-070, SPEC-036)**

The original entry, verbatim from Master Plan Part VI §4, is kept below for the record.
**It no longer describes the suite:** `apps/web/tests/e2e/portability.spec.ts` is
un-quarantined and the e2e battery carries no `test.fixme`.

The TODO it set — pool or force-release the Pixi/WebGL context so the map survives rapid
mount/unmount — was **not** what fixed it, and was not attempted. The flake was never in
the map's lifecycle as such; it was in asking the _imported_ room's UI what had
round-tripped, which forced activity-tab clicks against a stage the post-import navigation
had just remounted. WI-070 stopped asking the UI: the assertions now read Firestore and
RTDB over the emulators' admin REST surface. See SPEC-036 §2 for the rule that follows
(after a navigation that remounts the map stage, assert stored state, not UI) and §5 for
the standing invariant that the battery carries no quarantined tests.

The WebGL-context-lifecycle question is therefore **open but no longer blocking**, and is
not scheduled. Revive it as an intake item if a _different_ spec starts flaking on map
teardown.

> _Original entry (Master Plan Part VI §4), superseded:_
>
> `tests/e2e/portability.spec.ts` is `test.fixme`-quarantined (known-flaky). This heavy
> two-context flow mounts/tears down the vector map's Pixi/WebGL stage across many
> activity switches; under headless-CI resource pressure the tab intermittently goes
> unresponsive and a later activity-tab click hangs to the 180s timeout (seen hanging at
> different tab clicks across runs, always after the `.vttcamp` import + map churn). It is
> **not a product-functionality failure** — every map feature passes in the other e2e
> specs, and the `.vttcamp` round-trip is independently covered by the `CampaignStore`
> contract suite + `portability/vttcamp.test.ts`. A force-release of the WebGL context on
> teardown and CI `retries` did not clear it. **TODO:** investigate the map's
> WebGL-context lifecycle under rapid mount/unmount (a shared/pooled Pixi app, or a
> reliable context release with a real-browser repro) and un-quarantine.
