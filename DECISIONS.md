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
longer Open. SPEC-034 is unblocked as to its _content_; WI-066 was blocked on WI-065, the
standalone `RULE-AMENDMENT:` change, which RULE-017 required to land on its own first.
**Both have landed** — WI-065 and then WI-066, on 2026-08-14 — and SPEC-034 is Completed
as to code. Its `[HUMAN]` console half is `docs/runbooks/blaze-billing.md`.

Nothing from the 2026-08-03 batch remains Open.

## DEC-078 — What replaces SPEC-020 §5's edge rule for numeral orientation?

> **Answered as recommended — user, 2026-09-02 — and so no longer Open.** It stays
> written here, in place, per RULE-019.

- **Question.** IN-079: a numeral's in-plane rotation is currently set by the face's *first
  edge*, `pts[0]→pts[1]`, and which edge that is comes from the order a vertex index list
  happens to carry in `geometry.ts`'s hand-written tables. Those orders are incoherent
  across a shape's faces, so each numeral's "up" is effectively arbitrary. The edge rule's
  *form* is right — a numeral should sit square to an edge — but its *selection* is
  accidental. What selects it instead?

- **Recommendation.** **Project a die-local reference axis onto the face, then snap to the
  face's own symmetry.** For each face with normal `n`:

  1. `up₀ = A − n(A·n)` where `A` is the die-local `+Y` axis — the same axis `topFaceIndex`
     scans, so the die has one reference direction rather than two. If `|up₀|` falls below
     an epsilon (the face normal is parallel to `A`), retry with `B = +X`. Deterministic,
     no randomness, no table dependence.
  2. Build the face's candidate directions: **centroid → each vertex** for triangles and
     pentagons (a numeral's apex points at a corner, so its baseline is parallel to the
     opposite edge — which is what a machined die does), **centroid → each edge midpoint**
     for the square faces of a d6.
  3. glyph-up = the candidate with the highest dot product against `up₀`, normalised
     in-plane.

  The snap in step 3 is what makes this robust: the projection only has to be roughly
  right, because the answer is then quantised to one of three or five discrete
  orientations the face actually admits. Every face of a shape resolves against one shared
  axis, so the set reads as one family — a pole-to-pole swirl, which is what a real die's
  indexed cutting produces.

  **`Polyhedron.faceUp` is promoted rather than retired.** It stops being an escape hatch
  bolted on for the d10 and becomes the declared **override**: a shape may name the
  direction its numerals' tops point, applied without snapping, and the rule above is what
  runs when no override is given. The d10 keeps its override, because its kite's correct
  answer is a geometric fact about that shape (the symmetry axis, apex-ward) rather than a
  family convention.

  **The invariant test this buys, and it is the point.** *Rotating a face's index list
  (`[a,b,c]` → `[b,c,a]`) must not change its glyph-up.* That is precisely the property the
  edge rule fails, it is checkable in isolation from Three's renderer, and it makes the
  class of bug IN-079 describes unable to return.

- **Impact.** Amends SPEC-020 §5, which names the edge rule in as many words, and restates
  the 2026-07-30 d10 amendment as an instance of a general override rather than a one-shape
  exemption. Confined to `buildDieGeometry`'s UV-basis block — roughly one function.
  **Nothing outside UVs moves:** face count, groups, `locators`, `hullPoints`, the
  face→value remap and `topFaceIndex` are untouched, so **RULE-013 carries no risk here** —
  the value a die shows cannot change, only the rotation of the glyph inside its face. This
  item is Deceptive because it rewrites a spec's stated behaviour, **not** because it is
  risky or large.

- **Alternatives.**
  **(a) Hand-authored `faceUp` tables per shape.** Exact, and able to match a specific
  reference die face for face. But it is 4–20 hand-written vectors per shape, 70 in total,
  unverifiable by any test that does not simply restate the table, and it re-creates the
  present bug's root cause — orientation living in hand-maintained data — one level up.
  **(b) Project a global axis without snapping.** Simpler, but every face gets a continuous
  rotation rather than one of its natural few, so numerals sit at odd angles to their own
  edges — trading arbitrary-but-square for consistent-but-skew, which reads worse.
  **(c) Leave it.** Defensible only if the incoherence is invisible in play. The user has
  reported it twice, so it is not.

- **Answer.** **Accepted as recommended — user, 2026-09-02.** Specified as SPEC-045 §1,
  scheduled as WI-093. `Polyhedron.faceUp` is promoted to the declared override and the d10
  keeps it; SPEC-020 §5's edge rule is superseded and annotated in place (RULE-019).

## DEC-079 — How does bevel geometry coexist with value faces?

> **Answered as recommended — user, 2026-09-02 — and so no longer Open.** It stays
> written here, in place, per RULE-019.

- **Question.** IN-082: real dice have no sharp edges, and the generated set does. But
  `buildDieGeometry` emits exactly one material group per face with `faceIndex` as the group
  id, and the renderer indexes dice by that id everywhere — `locators[faceIndex]`,
  `scene.ts`'s per-face materials array, the face→value remap that satisfies RULE-013, the
  d100 tens tint, the d4's composed corners, the advantage dim pass. Today
  `groups.length === locators.length === faceCount === the number of values`. Bevel strips
  and corner patches are geometry that carries no value, so where do they go?

- **Recommendation.** **One extra "body" group past the value range, named explicitly in
  the type — and sequenced after IN-081.**

  Value faces keep group ids `0 … faceCount-1`, unchanged and still 1:1 with values. All
  bevel geometry — every edge strip and corner patch — goes into a single additional group
  `faceCount`, carrying one untextured body material in the roller's face colour.
  `DieGeometry` gains `bodyGroupIndex: number` so the convention is stated in the type
  rather than implied by arithmetic. Every existing consumer that iterates `0 …
  faceCount-1` is correct as written; the single place that changes is `scene.ts`'s
  materials array, which grows by one entry.

  Three details that fall out of it, all favourable:

  - **`flatShading` splits cleanly.** It is a per-material flag, so the face materials keep
    `flatShading: true` (crisp facets, as SPEC-020 §2 requires) while the body material sets
    it `false` for smooth bevel strips. Under any scheme that mixed bevel and face geometry
    in one group, that split would be impossible.
  - **`hullPoints` stays as it is** — the un-bevelled vertex cloud, documented as
    deliberately a hair larger than the visible mesh. Bevelling insets the corners by a few
    percent, and a collider marginally larger than its mesh is the safe direction. **But
    check it against IN-083:** once dice actually strike one another, an oversized hull
    shows as a small visible gap at the moment of contact. These two items want verifying
    together.
  - **The seam is the real risk.** The body material is a flat colour and the face material
    is a canvas texture whose background is that same colour. They match only if colour
    management agrees end to end — an sRGB/linear mismatch between a `THREE.Color` and a
    `CanvasTexture` shows up as a visible ring where bevel meets face. This is what the
    work item must verify first, before any bevel tuning.

  **Sequence it behind IN-081.** Most of what a bevel contributes visually is the specular
  highlight along the edge, and IN-081's normal-mapping work can produce that highlight
  with no geometry change and no contract impact at all. What a normal map cannot fix is
  the **silhouette** — a d6's corner against a light background stays geometrically sharp.
  So: ship IN-081, look at the dice, and let what remains decide how much bevel is actually
  wanted. It may turn out to be less than it looks now, and that judgement costs nothing to
  defer.

- **Impact.** `DieGeometry` gains a field (additive; no existing consumer breaks). The
  materials array in `scene.ts` grows by one entry in one place. `geometry.test.ts` gains
  the assertion that value groups stay `0 … faceCount-1` and that `locators.length` still
  equals the value count — which is the guard that keeps RULE-013's remap addressing the
  right groups. Generation cost rises (bevelled solids carry several times the triangles),
  but geometry is built once per die kind and cached, not per roll.

- **Alternatives.**
  **(a) `DieGeometry` grows an explicit `valueFaceCount` and every consumer is updated to
  respect it.** More honest typing, more churn — and it carries exactly the same information
  as the recommendation, since "groups `0 … faceCount-1` are value faces" is the convention
  either way. The recommendation is this option with the churn removed.
  **(b) Normal-mapped edges only, no bevel geometry at all.** Zero contract impact, folds
  entirely into IN-081, and IN-082 disappears. Gets the lighting but not the silhouette.
  This is the alternative the recommendation's sequencing is designed to keep open.
  **(c) One body group per die *kind* rather than per die.** No benefit — materials are
  already cached per kind, and it would break the per-roller colour, which is baked per
  roll.

- **Answer.** **Accepted as recommended — user, 2026-09-02**, including the sequencing,
  which is not advisory: SPEC-045 §4 makes "not started until §3 has shipped and been looked
  at" a standing constraint on WI-097, and WI-096 lands before it so the `hullPoints` gap can
  be judged by looking. Specified as SPEC-045 §4, scheduled as WI-097.

## DEC-077 — Do imported die meshes enter the dice renderer, and on what terms?

> **Answered (c) — user, 2026-09-02 — and so no longer Open.** It stays written here,
> in place, per RULE-019. See the Answer field at the end of the entry.

- **Question.** IN-077 asks for selectable 3D die models, with a model already chosen and
  available as GLB. Today every die is **generated** (`geometry.ts`), which is what makes
  the seed-authoritative face→value remap, the per-roller colour bake, the d100 tens tint,
  the d4 corner glyphs and the advantage dimming all possible. Admitting an imported mesh
  reverses SPEC-003 §2 / R3.2's premise and needs four things settled together:
  **(i)** which of IN-077's two paths — model-supplies-shape-only, numerals still
  procedural; or model-supplies-shape-and-material, numerals baked and a hand-authored
  face→value manifest driving pre-rotation; **(ii)** whether the selection is per-viewer
  (`localStorage`, no schema, private to the viewer) or per-seat (stored field, RULE-007
  migration, `.vttcamp` round-trip, my dice look like mine on your screen); **(iii)**
  whether the per-roller character colour may be given up for a model that carries its own
  albedo; **(iv)** the model's licence for redistribution in the hosted **and** local
  builds, plus the `ATTRIBUTION.md` entry SPEC-003 §5 already calls for (IN-078).

- **Recommendation.** Admit imported meshes, on **path (b) + per-viewer + procedural set
  stays the default**. Concretely: the generated set remains what an unset preference
  renders and keeps every guarantee it has today; an imported model is an opt-in choice
  stored in `localStorage`, shipped as a bundled GLB with a hand-authored manifest
  (face→value table, locators, decimated hull, scale), and the die is **pre-rotated** so
  the baked numeral matching the seed's value lands up — `README.md` already names
  pre-rotation as equivalent to the remap, so RULE-013 holds without amendment. Accept, and
  state in the spec, that an imported set trades away the per-roller colour cue, the d100
  tens tint and the d4 corner composition unless the specific model admits them.

- **Impact.** Adds `GLTFLoader` (from the existing `three` dependency, so no new package)
  and a binary asset to a local bundle already at 3.62 MB — the local build is a file the
  user carries, so weight is a real cost there. Amends SPEC-003 §2 and SPEC-020 in place
  and needs a new SPEC for the model/manifest contract. Creates a second render path
  through `scene.ts` that every future dice change must keep working, which is the durable
  cost. **Reversible**: deleting the asset, the manifest and the preference returns the
  renderer to today's single path, because the generated set is never removed. The
  per-seat variant is what is *not* cheaply reversible — a stored field needs a migration
  to add and another to retire (RULE-007).

- **Alternatives.**
  **(a) Path (a) instead** — import the mesh for its shape only and keep numerals
  procedural. Preserves every guarantee including the colour cue, but needs a coplanar-face
  analyser over triangle soup that has to be right about bevels, and discards the model's
  material, which is most of why the user picked it.
  **(b) Per-seat rather than per-viewer.** The version that pairs a chosen model with a
  player's identity at the table. Costs a schema field + migration + `.vttcamp` round-trip,
  and requires every client to have the model, i.e. bundled for all — an uploaded model
  would be an `AssetStore` contract change (RULE-001) and a Blaze cost surface (RULE-010).
  **(c) Decline, and spend the effort on the generated set instead** — material, bevel and
  numeral work on `geometry.ts`/`textures.ts`, which reaches every die for every player at
  a fraction of the cost and keeps one render path. The honest comparison: much of what an
  imported model buys is *material quality*, and material quality is available without
  importing anything.
  **(d) Defer** until the local build's packaging (SPEC-042) settles, since bundle weight
  is one of the costs being weighed.

- **Prior art evaluated — `3d-dice/dice-box` (2026-09-02).** Raised by the user during the
  gate. Licence checked **before** anything was read, per SPEC-003 §5's discipline: the
  library is **MIT** (`Copyright (c) 2021 3Ddice`) and its companion `3d-dice/dice-themes`
  advertises **CC0 models and themes**. Neither is GPL, so §5 — which is scoped to
  `owlbear-rodeo/dice` — does not bar them. The repository was deliberately **not** cloned
  or read beyond its README and licence; the recommendation is to keep §5's posture uniform
  regardless of licence, taking ideas and restating them in our own terms.

  **Not adoptable as a dependency, on three counts.** (1) It is **BabylonJS + AmmoJS**,
  a second renderer and a second physics engine beside `three` + Rapier — unshareable
  canvas lifecycle, and a bundle cost a 3.62 MB local build cannot absorb. (2) It is
  **physics-authoritative**: it rolls, then reports what physics produced. RULE-013 is the
  inverse — the seed decides and the renderer must make the die *land* on the decided value.
  SPEC-003 §5 already recorded this exact divergence against Owlbear; dice-box shares that
  architecture. (3) It replaces the whole overlay rather than any part of it, so there is no
  incremental adoption path.

  **What it does change.** Its CC0 theme models remove the licence leg — item (iv) — from
  path (b): off-the-shelf, redistributable die meshes exist, so a model choice no longer
  waits on `[HUMAN]` licence clearance. And it is evidence *for* alternative (c): what reads
  as "expensive" in its dice is bevelled geometry plus PBR material and normal-mapped
  incised numerals — all of which are reachable in `geometry.ts` / `textures.ts` on the
  stack already here, with no import and no second render path.

- **Answer.** **Alternative (c) — user, 2026-09-02.** Decline the imported model; spend the
  effort on the generated set instead. The user's reasoning, recorded because it is the
  reusable part: the gain from `3d-dice/dice-box` "isn't necessarily a new engine or fancy
  models, but we do have an open licensed reference point for fixing up what we already
  have." IN-077 is **Denied** and closed; no `WI-` id was ever reserved for it. The effort
  it would have taken is redirected to IN-079 – IN-083 (numeral orientation, sizing and
  aspect, material pass, bevelled edges, die-to-die collision).

  **This entry is not a wall.** Per this file's own preamble a Closed decision is a default,
  and the recorded finding that CC0 die meshes exist off the shelf stands: reopening the
  imported-model question later is an ordinary intake item, and item (iv)'s licence leg is
  already answered if it is.

---

## DEC-082 — Free-form hex terrain beside per-hex terrain: one representation or two?

> **⏸ Answering this is postponed (user, 2026-09-02), pending an investigation.** It stays
> **Open** rather than moving to `# Postponed`, because it is still blocking: IN-091 cannot
> be scheduled until it is answered. What the user asked for is more evidence before
> choosing — specifically between (a) two layers and (b) free mode writing hex tiles at
> sub-hex resolution, which differ by roughly a whole collection, a migration and a rules
> block. **WI-100** is that investigation; its findings come back here.

_Raised by IN-091 (2026-09-02). This is the user's own question, restated._

**Question.** The terrain tool is asked to work two ways on the same map: under Hex snap it
paints whole hexes and unions like neighbours; under Free snap it is a hex-sized circular
brush painting an organic region. Can both live in one map, and how are they reconciled?

**Recommendation. Two layers with a declared precedence, not one merged geometry.**

- `hexTiles` stays exactly what it is: the per-hex authoritative record, addressable by
  coordinate, carrying `terrain`, `contents` and `note`, exporting with the map.
- Free-form paint becomes a **separate region layer** — polygons whose vertices are
  `HexPoint`s (free-valued, per DEC-081) — rendered **beneath** the per-hex fills.
- Precedence, in one sentence a referee can predict: **a hex that carries a `terrain` kind
  wins over any free paint under it**; a hex with no `terrain` shows whatever region is
  beneath.

Why not merge them: they are not the same kind of object. A hex tile is *an address with
properties* — SPEC-030 §1 made the coordinate the addressing scheme, and §4's notes and the
tooltip hang off that. A painted region is *a shape*. Merging means either regions get
decomposed into hexes on write (losing the organic edge, which is the entire point of Free
mode) or hex tiles get promoted to shapes (losing addressability, and migrating every existing
hex map).

**Four things fall out, and the spec must state them rather than let them emerge.**

**The union is render-time, not stored.** IN-091's "union on similar cells" is a merge of
adjacent like-terrain hexes into one outlined shape at draw time — `renderHexTiles` stops
drawing 40 separate hexes with 40 visible seams. No document changes. That also answers the
user's parenthetical *(add a border colour?)*: a union is only visible if the merged shape is
outlined, **so yes** — and the border colour belongs on the terrain kind, in
`HEX_TERRAIN_CATALOG` beside its fill, for the same reason the fill is there and not on the
document.

**The scattered icons must be seeded.** "Randomly but at a consistent density" needs a seed
derived from the region's own id, or every render re-scatters and every client draws a
different field. RULE-013 already makes seed-derived determinism this project's answer to
exactly this problem.

**Painting is a drag, and RULE-003 applies.** `setHexTerrain` is documented as "one settled
write per painted hex … this is a click, not a drag frame". A paint stroke across 40 hexes is
40 Firestore writes under that method, which is what RULE-003 exists to prevent. The stroke
rides RTDB while in progress — the existing `publishVectorMapDraft`/`subscribeVectorMapDraft`/
`clearVectorMapDraft` pattern, which also gets peers the live preview for free — and settles
as **one batched Firestore write on release**, the way a floor commit does. That changes
`setHexTerrain`'s stated guarantee, which is its own RULE-001 trigger and part of why IN-091
is Deceptive.

**Erase has to mean two things.** With two layers, "erase" either clears the hex's `terrain`
or cuts the region beneath it. The spec picks one per mode (Hex snap erases tiles, Free snap
cuts regions) rather than leaving it to whichever layer the click lands on.

**Impact.** New collection, schema bump, migration + test, generic `.vttcamp` coverage plus a
round-trip test, new tested rules, new store methods through the contract suite against all
three implementations. Existing hex maps are untouched — the layer is sparse and absent — so
there is no data migration, only a version bump. Reversible in that the layer can be dropped
without touching `hexTiles`; not reversible once referees have painted.

**Alternatives.**

(a) *Recommended, above.* Two layers, per-hex wins.

(b) **Free mode writes hex tiles at sub-hex resolution** — the brush is a UI affordance and
everything stays per-hex. By far the cheapest: no new collection, no migration, no rules, no
export change, and the terrain tool becomes nearly Simple. Loses the organic edge entirely — a
"free" stroke is still a staircase of whole hexes, just placed more comfortably. **Worth
taking if the real want is "painting hexes one at a time is fiddly" rather than "hex edges are
too regular".** This is the alternative most likely to be underrated.

(c) **Everything becomes region geometry; `hexTiles.terrain` is derived.** One representation,
no precedence rule, most coherent end state. Costs a migration of every existing hex map's
terrain into regions and breaks §1's addressability for terrain specifically — a hex would no
longer *have* a terrain, it would be *inside* a region. Most expensive, and it trades away a
property SPEC-030 deliberately bought.

(d) **Free mode only, per-hex painting retired.** Stated for completeness; it would make the
question disappear along with the feature.

**Answer.** _Open._

---

## DEC-084 — What is a ping attached to, and how does it read on a token?

_Raised by IN-087 (2026-09-02). The visual half is the user's own question._

**Question.** A ping is `publishPing(roomId, { x, y })` producing `PingPos { id, uid, x, y,
ts }` on RTDB, drawn by every client as a fixed 14px ring at that point. The request is
that a ping — and the Eye — may be aimed at a token or object instead of open floor, and
that the thing becomes the focus. What does a ping carry, and what does it look like?

**Recommendation.** **Target by id, resolve at render, fall back to the point.**

- `PingPos` gains an optional target — `{ kind: 'token', id }` — and `publishPing` takes it
  alongside the point. The point is still published and is still what an untargeted ping
  uses, and is what a client falls back to when it cannot resolve the id.
- Every client resolves the id against its own token state each frame, so the ping
  **follows** the token. A ping that snaps to where a token was at click time is not worth
  the schema.
- If the target vanishes mid-ping (deleted, or its group collapses), the ping reverts to
  its published point for its remaining life rather than disappearing. Three seconds is
  short enough that anything cleverer is invisible.
- **Scope the target to tokens.** "Or an object" is tempting, but map objects are picked
  through `pickMapRoomAt` / `vertexHandles` and identified by heterogeneous ids; tokens
  have one id space and one position. Widening later is additive.

**The visual, which is the actual question.** A map ping is a fixed 14px ring in the
pinging player's colour. A token ping should read as *the same gesture, aimed* — not as a
new kind of mark:

- Draw the ring **concentric with the token**, at the token's radius plus a small gap, so
  it sits just outside the status ring (SPEC-022) rather than competing with it.
- **Animate it inward** — two or three pulses collapsing toward the token over the ping's
  life — where a map ping's ring expands outward from its point. Converging says "this
  one"; diverging says "here".
- Keep the pinging player's colour and the existing stroke weight, so the two read as one
  feature.
- The status ring is untouched. A ping is transient and a status is not; overloading the
  status ring would make a three-second mark look like a state change.

The Eye's target needs no visual of its own — the eye dot simply sits at the token's
position and moves with it.

**Impact.** RULE-001 is the binding one: a changed `publishPing` signature and a changed
`PingPos` shape are a store-contract change, so `campaign-store.contract.ts` grows a case
and it must pass against `MemoryStore`, `FirebaseStore` and `LocalStore`. RTDB stays the
right home (RULE-003 — high-frequency ephemeral), and the existing `onDisconnect().remove()`
per-node cleanup and the 3s TTL are unaffected. An older client receiving a targeted ping
ignores the unknown field and draws it at the point, which is the correct degradation and
needs no version gate.

**Alternatives.**

(a) *Recommended, above.* Optional target id, resolved at render, point as fallback.

(b) **Resolve at click time — publish the token's current point, no target field.** No
contract change at all, so the whole item would be Simple. The ping does not follow a
moving token, which on a map where tokens are being dragged is most of the value.

(c) **A separate `publishTokenPing` method.** Keeps `PingPos` untouched. Two methods, two
subscriptions and two render paths for one gesture; the contract suite pays twice.

(d) **Target any pickable object, not just tokens.** What the request literally says.
Deferred rather than rejected — it needs a single id space across tokens, rooms, symbols
and doors, which does not exist and is a larger change than this item.

**Answer.** _Open._

---

## DEC-085 — What does a zero-length gesture commit, per tool and per snap mode?

_Raised by IN-102 (WI-098's snap audit, 2026-09-03)._

**Question.** Under Cell/Half every floor tool commits **exactly one cell** for a click
with no drag — but that falls out of five separate mechanisms rather than one rule:
`snapSpan`'s floor, `cellRectPoly`'s inclusive rect, `corridorPoly`'s kept first leg,
`pathPoly`'s single-cell branch and `buildBrushStroke`'s radius floor. Under **Free** the
same gesture gives five different answers: Room, Corridor and N-gon commit **nothing**;
Path and Carve commit a **round dot** of their governed width. Only Room's half is cited
(SPEC-028 §1, §3). What should a zero-length gesture commit — and is that one rule or a
per-tool fact?

**Recommendation.** **One rule, stated once in SPEC-028 §2 beside the cell-anchoring
constraint, and written so a new tool inherits it rather than inventing an answer:**

> A zero-length gesture commits the tool's own **end primitive** at the anchor its snap
> mode gives. Under Cell or Half that is one cell, as today. Under Free it is the cap or
> corner block the tool's own geometry already uses — and **nothing at all** for a tool
> that carries no governed width.

Applied to what ships today, that endorses four tools unchanged and moves one:

| Tool | Free, today | Under the rule |
| --- | --- | --- |
| Room | nothing (`rectPoly` rejects zero area) | nothing — no governed width. Cited already (§1, §3) |
| N-gon | nothing (`snapSpan` is identity under Free) | nothing — no governed width |
| Path | round dot of `bandWidth` (`bufferPolyline`'s `roundCap`) | unchanged — its Free geometry is round-capped |
| Carve | round dot of `width` | unchanged — the organic brush (DEC-032) |
| **Corridor** | **nothing** (both legs degenerate, `bandRect` returns null) | **a `bandWidth` square** — `cornerBlock`, which is exactly that square, matching its flat caps and square joints |

**Why the Corridor's square rather than a dot.** `corridorPoly` has no Free branch: every
mode goes through `bandRect`, flat caps and square joints throughout (WI-098 §2, IN-095).
A round dot would be the only round thing the Corridor ever draws. `cornerBlock` is
already a `width × width` square on exactly the lines `bandLo` gives every leg, so the
zero-length case reuses a primitive rather than adding one.

**Why it should be answered before WI-104 and WI-105.** SPEC-047 §3 adds a `hex` snap mode
and §4 adds three more tools. If the zero-gesture answer is still five accidents rather
than one rule, those tools will each acquire a sixth, seventh and eighth answer, and the
audit that found this gets re-run. The rule above is written to be inherited: a hex tool's
"end primitive" is its hex or its road cap, and nothing about the rule is square-lattice
specific.

**Impact.** A **stated-behaviour change to SPEC-028**, so Deceptive by the trigger list:
§2 gains the rule and §1/§3's Room clause is restated as an instance of it rather than a
special case. One behaviour change in code (`corridorPoly`'s Free zero-length branch,
`packages/shared/src/map/vector/primitives.ts`); no schema, no store contract, no rules
file, no coordinate-space change (RULE-006 untouched — `cornerBlock` is already lattice
units). It interacts with **IN-095**: once the Corridor commits a square, its Free
indicator should be that square too, which is the same one-line fix IN-095 already asks
for, from the other direction.

**Alternatives.**

(a) *Recommended, above.* One rule in §2; four tools endorsed, the Corridor moved.

(b) **Document the five answers as they stand, change nothing.** Free, and honest. It
leaves the next five tools with nothing to inherit, which is the whole reason this was
worth raising — and it leaves the Corridor silently committing nothing from a gesture that
commits floor in every other mode.

(c) **Everything commits one cell, under Free too.** Uniform, and wrong: it destroys the
premise Free exists for, that a partial cell is the point (SPEC-028 §1, §3).

(d) **Nothing commits under Free, for any tool.** Also uniform. It removes the Carve dab,
which is a gesture referees actually use, to buy tidiness.

**Answer.** _Open._

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

Five entries were raised (DEC-080 – DEC-084). **Three were put to the user directly and
answered as recommended**; they are indexed below. **DEC-082** (free-form terrain beside
per-hex terrain) is still Open — the user postponed answering it pending WI-100's
investigation. **DEC-084** (what a ping is attached to) is still Open, blocking IN-087.

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
- **In-app image uploads** (`FirebaseStorageAssetStore`). Still requires a `[HUMAN]` Blaze
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
- **Room `password` field.** Stored, unenforced, dormant.
- **SPEC-022 §3 owned-vs-selected ring split.** Both map to white today; the cheapest
  split is a glow/thicker stroke for selected. Not built unless asked.
- **Full-viewport-diff rendering optimizations.** `renderMap` redraws everything per
  change. **Watch item:** re-evaluate if maps grow large enough, or Chromebook playtests
  dip below budget.
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
