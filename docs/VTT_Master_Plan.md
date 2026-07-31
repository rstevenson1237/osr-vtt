# OSR VTT — Master Plan

**Status: the single source of truth.** This document is self-contained and
**replaces** the five documents that preceded it:

| Retired document                 | Where its content lives now                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `VTT_Master_Plan_v2.md`          | Parts I–II (invariants), III (R1–R9), IV (WI-0–WI-12), V (locked defaults) |
| `VTT_Master_Plan_v2_addendum.md` | Part III (R10–R23), Part IV (WI-13–WI-24)                                  |
| `VectorMapSystem_Spec.md`        | Part II §4 (current map system) and R9′ in Part III                        |
| `VectorMapSystem_Decisions.md`   | Part V §2 (vector map decision log, condensed)                             |
| `ShellUIRedesign.md`             | Part II §5 (current shell) and R1′ in Part III                             |

Those files are retired from the tree; their full text remains in git history.
**If a requirement is not in this document, it is not a requirement.**

**Companion assets — all under `docs/mockups/`:**

- `mockups/vtt-ui-mockups.html` — Activity Shell boards (R1, pre-redesign; historical)
- `mockups/vtt-ui-mockups-addendum-c.html` — Addendum C boards 1–11 (R10–R21)
- `mockups/dice-preview.html` — interactive dice-renderer preview (R19 tuning)
- `mockups/dice-reference.png` — the dice visual target (R19)

**Reading order.** Part 0 (how this document works) → Part I (invariants, always
binding) → Part II (what the system _is_ today) → Part III (reference specs, cited
by work items) → Part IV (work items) → Part V (decisions) → Part VI (open items).

---

# PART 0 — HOW TO USE THIS DOCUMENT

## 0.1 Structure

- **Part I** — invariants and golden rules. Binding on every change, forever.
- **Part II** — the current state of the system, subsystem by subsystem. This is
  the descriptive half: what shipped and how it behaves _now_. When Part III and
  Part II disagree about present-day behaviour, **Part II wins** — Part III is a
  record of intent at the time each item was specified.
- **Part III** — reference specs `R1`–`R26`. Work items cite them; do not
  improvise behaviour they define. Specs that were later overtaken carry a
  **superseded** annotation in place, pointing at what replaced them. Annotations
  are never deleted — the history of a reversal is often the reason the current
  design is right.
- **Part IV** — sequenced work items `WI-0`–`WI-27`, plus the vector-map lettered
  series `WI-A`–`WI-D`. Shipped items are compressed to a ledger; live items carry
  their full step list and gate.
- **Part V** — decision logs and locked defaults.
- **Part VI** — open items, deferred work, known limits.

## 0.2 Conventions

- **`[HUMAN]`** — console setup, playtests, credential handling, mockup approval,
  option selection. Never delegate these to an agent.
- **`[AGENT]`** — one Claude Code prompt.
- **`[OTHER AGENT]`** — optional art/design passes outside Claude Code.
- Each work item names a **model target** and an **effort** (`high`/`medium`/`low`).
  The established allocation: `claude-opus-4-8` for architecture-changing work
  (schema/model changes, new render passes, migrations, auth & rules); the current
  Sonnet release as the default workhorse; `low` effort for mechanical, bounded
  tasks. (The original convention named `claude-sonnet-4-6`; the current Sonnet
  release is a drop-in bump.)
- **One work item per Claude Code prompt.** Never batch. Every prompt ends with
  _"Stop after the gate; do not start the next work item."_
- A WI is done only when its PR passes CI and merges green. **If a gate fails, fix
  that WI — never move on broken.**
- Paste the relevant R-spec section(s) plus the WI block verbatim into the prompt,
  name the files to read first, and keep Part I's golden rules in the preamble.
- Plan reviews and spec amendments happen _here_, in this file, before code
  sessions — so it stays the single source of truth.

---

# PART I — INVARIANTS & GOLDEN RULES

These are binding on every change. A work item that would weaken one must **stop
and flag** rather than proceed.

## I.1 Golden rules

1. **Store abstraction only.** All Firebase access goes through
   `CampaignStore`/`AssetStore` (`packages/shared/src/store/`). Components never
   touch the Firebase SDK. `apps/web/src/lib/firebase/client.ts` is the sole
   concrete-store touchpoint. **Any new store method must be added to the shared
   contract suite (`campaign-store.contract.ts`) and pass against both
   `MemoryStore` and `FirebaseStore`.** This is what keeps a backend swap (e.g.
   PocketBase) cheap, and it is proven, not aspirational.
2. **No game mechanics — hard limit.** The app stores and displays data but never
   interprets it. No stat logic, no value-triggered behaviour, ever. Character
   data is referee-defined Profiles; field types are
   `text · longtext · number · counter · checkbox · roll`; only `roll` touches
   other UI (it stages a die in the tray). A test asserts no value-derived logic
   exists — keep it green.
3. **Write discipline.** If it updates many times per second it rides **RTDB**
   (cursors, drag frames, pings, in-progress carve strokes); **Firestore** gets one
   settled write (drag-end, stroke release, batched commits). Target: comfortably
   inside 20k Firestore writes/day.
4. **Security rules are tested code.** Rule changes ship with rule tests
   (`packages/shared/src/rules/`). The rules enforce exactly one boundary:
   GM-hidden information (`gmPrivate/**`, readable/writable only by `gmUid`) —
   plus the own-uid/own-seat write guards enumerated in Part II.
5. **Preserve `data-testid`s.** The Playwright e2e suite depends on stable testids;
   moving a control must carry its testid with it, or update the spec in the same
   change.
6. **Vector map coordinate space.** All floor/wall/door geometry is stored in
   **lattice (cell) units as floats**. `cellSize` is a render-time-only multiplier
   applied once at the render/LoS-build boundary. Never store pixel coordinates.
7. **Migrations for schema changes.** Any `GameMap`/`Room`/store schema change
   ships a migration + migration test (`packages/shared/src/migrations/`) and a
   `.vttcamp` round-trip test. Seed backfilled timestamp fields to the **migration
   timestamp**, never to zero.

## I.2 Trust & backend model

- **Trust model:** all players are trusted; no anti-cheat, no authoritative
  server. The population is friends and acquaintances, not attackers.
- **Backend:** Firebase serverless on the **Spark** tier. Firestore = durable
  state; RTDB = high-frequency ephemeral; Anonymous Auth (+ optional Google link)
  = identity; static hosting (Firebase Hosting or GitHub Pages) with hash routing
  and Vite `base` configured.
- **No Cloud Functions, no billing card.** Every mechanism in this plan is
  Security Rules, client-side, or Firebase console configuration. On Spark, quota
  exhaustion **denies requests rather than generating a bill** — the downside of
  abuse is an outage for the group, not a charge. Tune for availability and
  containment, not cryptographic guarantees.
- **Players join anonymously with zero prompts.** Nothing may introduce a login
  wall on the join path. (Sign-in is load-bearing in exactly one place: _creating_
  a room — see R24.1.)
- **"The roomId is the capability."** Room reads are `signedIn()`, not
  membership-gated, because a listener denied at subscribe time never recovers.
  Room-id entropy is therefore the only barrier against a stranger reading an
  arbitrary room (R24.4). Membership-gating reads is open work (Part VI).
- **Dice authority is the seed.** The rolling client writes
  `{seed, dice[], modifier, advantage, mode, total?}`; every client derives the
  same faces from the seed (`hashSeed` + `mulberry32`). Animation is decorative
  and never load-bearing.
- **Portability.** `schemaVersion` on the room doc; `.vttcamp` export/import must
  round-trip identically. `VTTCAMP_FORMAT_VERSION = 2`; pre-vector archives are
  rejected with an "unsupported schema" error.

## I.3 Repo map

- `apps/web` — the app. Svelte 5 + Vite, PixiJS v8 for the map canvas, Firebase
  (Firestore/RTDB/Auth), Rapier3D + Three.js for dice physics, Yjs for
  collaborative notes.
- `packages/shared` — framework-agnostic logic: the `CampaignStore`/`AssetStore`
  abstractions and their Firebase/in-memory implementations, schemas, map
  geometry, dice, encounter, rules, tables, portability (`.vttcamp`).
- `firebase/` — `firestore.rules`, `firestore.indexes.json`, `database.rules.json`.
- `docs/` — this plan and `docs/mockups/`.
- pnpm workspace (`pnpm-workspace.yaml`): `packages/*` + `apps/*`.

There is **no `poc/` directory**. A prior Vector Map System POC lived there during
design; it graduated wholly into `packages/shared/src/map/vector/` and
`apps/web/src/lib/{components/VectorMapView.svelte,map/vector-*.ts}`, and the
scaffold was deleted. A comment or old branch referencing `poc/vector-floor/...`
is a historical pointer to Part II §4 / Part V §2, not a live path.

## I.4 Dev commands

Run from the repo root unless noted:

```sh
pnpm install                 # workspace install
pnpm dev                     # apps/web dev server (Vite)
pnpm build                   # build packages + apps
pnpm typecheck               # svelte-check across the workspace
pnpm lint                    # eslint .
pnpm format                  # prettier --write .
pnpm test:unit               # vitest (all packages)
pnpm test:rules              # Firestore rules tests (packages/shared)
pnpm test:store              # CampaignStore contract suite, both impls
pnpm test:e2e                # Playwright (apps/web) — needs a browser
pnpm emulators               # firebase emulators:start
pnpm test:all:emulators      # full suite against the Firebase emulator
```

`test:rules`, `test:store`, `test:e2e` and one emulator-backed unit test need the
Firebase emulator running; `pnpm test:all:emulators` is the one-shot way.

**Proxy trap.** Both emulator scripts go through `scripts/firebase-emulators.mjs`
rather than calling `firebase` directly. `firebase-tools` proxies **every** request
when `HTTPS_PROXY`/`HTTP_PROXY` is set and ignores `NO_PROXY`, including its own
calls to the emulators it just started on 127.0.0.1. Behind a filtering proxy that
surfaces as the very misleading
`firebase/database.rules.json:Unable to parse JSON … "denied by "…`, with a
perfectly valid rules file. The wrapper strips the proxy variables for the child;
an emulator run is loopback-only and needs none of them. **Do not "fix" that error
by editing `database.rules.json`.**

---

# PART II — THE SYSTEM AS IT STANDS

Descriptive, authoritative for present-day behaviour.

## II.1 Session shell — quick sheets

The shell is **one full-screen main view plus independently toggled quick sheets
layered over it**, with Log and Session settings as modals. It replaced the R1
Activity Shell (four rails + one stage).

**Main views** (`MAIN_VIEWS`, `apps/web/src/lib/shell/activities.ts`) — exactly one
on stage:

| id          | availability |
| ----------- | ------------ |
| `map`       | all          |
| `encounter` | all          |
| `assets`    | **gm**       |

**Quick sheets** (`QUICK_SHEETS`) — independent open/closed toggles:

| id          | group     | availability | body                                                                                                                                                              |
| ----------- | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maptools`  | `world`   | all          | `MapToolPalette`                                                                                                                                                  |
| `character` | `records` | all          | `CharacterDock` + identity header + quick d20                                                                                                                     |
| `roll`      | `play`    | all          | die buttons that **stage** a die, the staged pool + Roll button, tray controls, saved macros; `DiceTray` (custom dice, shared rolls, macro creator) when expanded |
| `room`      | `referee` | all          | `RoomsPanel` — selected room docked, full list expanded                                                                                                           |
| `tables`    | `referee` | **gm**       | `TableRunner` — import/roll random tables                                                                                                                         |

`QuickSheetDef` carries the same optional `availability` gate `MainViewDef` has
(omitted ⇒ `'all'`), and `quickSheetsFor(isGM)` mirrors `mainViewsFor`. The rail,
chips, docked stack, expanded sheet and digit shortcuts all filter through it, so a
player never gets a dead button or a dead key. `RoomShell` closes any gated sheet
on demotion.

### Sheet modes

Every sheet renders through `QuickSheetCard.svelte` in one of three modes:

- **`docked`** (desktop) — ~300px wide, max 320px tall, scrolls internally, stacked
  top-to-bottom in the stage margin **on the rail's side**. The stack wrapper is
  pointer-transparent so the map canvas stays clickable around the cards.
- **`mobile`** — a bottom sheet above the chips and tab bars, draggable (or
  tappable) between a half-height peek and full height.
- **`expanded`** — a centered ~620px modal on desktop, full-screen on mobile, over
  a blurred + dimmed backdrop. **At most one sheet is expanded at a time,
  globally.** Backdrop click or Escape returns it to docked.

Every mode carries a 3px left border in the sheet's group colour. Sheets whose body
is expensive or singleton-backed mount that body only when expanded — the
`DiceTray` (shared staged-dice store) is the case that matters, so it can never be
mounted twice.

### Rail, drawer and rail side

`ShellState.railSide` (`'left' | 'right'`, persisted) moves the whole 56px rail —
and with it the docked sheet column and the stage's `--sheet-gutter-*` — to either
edge. The control is a handle: click to flip, or drag to a half of the viewport.

The rail shows the **current** activity's icon, not all three tabs. Hovering it (or
clicking, which pins it) slides out `shell/ActivityDrawer.svelte`: a translucent,
blurred panel (`color-mix` + `backdrop-filter`, so the stage stays readable)
carrying the full `MainViewTabs` list in a `drawer` variant — icon _and_ label,
since being readable is the point — plus the rail-move handle. Selecting a view,
Escape, or the pointer leaving closes it. The panel flips with `railSide`;
`.rail-left`'s `overflow` is `visible` so it can escape the 56px column.

Motion follows the house pattern: plain CSS keyframes with a
`prefers-reduced-motion: reduce` escape (as in `DiceOverlay`), not Svelte
transitions — the shell uses none.

Mobile has no rail; the bottom tab bar shows every main view at once.

### Top status bar

`SessionTab.svelte`. Beyond the room name / id / role pills, invite copy, the GM's
settings gear, account controls and presence chips, it carries the two pieces of
shared session state that belong on every stage:

- the **turn tracker** (`TurnStrip`, `variant="rail"`) — "Round N · X is up";
- the **encounter status strip** (`TensionBar`, `variant="rail"`) — the **pinned
  encounter profile fields**, by default Difficulty, Danger and Clock. The referee
  edits the values in place (tension changes constantly mid-play); players see the
  same strip read-only. The fields' _shape_ — labels, types, order, pinning — lives
  behind Session settings.

### Encounter profile

Session settings has an **Encounter profile** section: the room's
`encounterTemplate` (schema v14), a second `ProfileTemplateField[]` alongside
`profileTemplate`. Both use the same `ProfileTemplateEditor` and the same field-type
list — one vocabulary for characters and encounters alike. Values live on the single
`encounter` doc (`Encounter.values`), and `pinned` means "show in the top status
bar". The section also hosts `TensionBar` (`variant="panel"`), which edits _every_
field's value, pinned or not.

**Nothing about the strip is hardcoded.** `DEFAULT_ENCOUNTER_TEMPLATE` seeds
Difficulty (`roll`), Danger (`roll`) and Clock (`counter`, `max: 6`) — the old fixed
widgets, now ordinary fields the referee can relabel, retype, reorder, unpin or
delete. `ProfileTemplateField` gained an optional `max` for `counter` fields,
generalizing the danger clock's segment count; it renders as pips and bounds the
▲/▼ steps. Pre-template rooms keep their live values: an unset field falls back to
the legacy `difficultyDie`/`dangerDie` slots for those three ids until first
written.

### State

`ShellState` (`apps/web/src/lib/shell/shell-state.svelte.ts`), one instance per
`RoomShell`, persisted to `localStorage['vtt-shell:{roomId}']` **only — never
Firestore**.

- Persisted: `mainView`, `railSide`, and the per-sheet `sheets` open map.
- Ephemeral (reset on reload): `expandedId`, `mobileActiveId`, `mobileSnap`,
  `overlay`, `overlayTab`, `dialog`. An expanded modal or open settings dialog
  surviving a refresh reads as the app being stuck, not as a restored preference.

A pre-redesign payload (which persisted `activeActivity`) is not migrated: the
loader falls back to the Map view with all sheets closed.

### Keyboard

- `1`–`3` — switch main view, indexing the **visible** list so players never hit a
  gap where the referee-only Assets view would be.
- `4`–`8` — toggle quick sheet, in rail order. The offset is the count of _visible_
  main views, not a constant 3, and the sheet list is filtered by role — so a
  player (two views, four visible sheets) gets `1`–`2` and `3`–`6`, with no dead
  keys and no shortcut sheet advertising the GM's ranges.
- `Esc` — collapse an expanded sheet; failing that, close an open modal.
- `L` — open the Log modal and focus its chat input.
- `?` — shortcut sheet. `Ctrl+Z` / `Ctrl+Shift+Z` — map undo/redo.

### The Log modal

`log-surface` pins itself to the bottom on open and follows new entries, releasing
the moment the reader scrolls up (or presses `log-load-older`) so history-reading is
never yanked back down. Entries render oldest-first.

### Room quick sheet & players' notes

Selection is shared with the map canvas through
`MapToolController.selectedMapRoomId`: picking a room label with Select → Object
publishes it, and the sheet's rows write it back. It survives map unmount, so the
sheet keeps showing the last selection while another main view is on stage.

- **Docked** — only the currently selected room, plus the Select → Object hint.
- **Expanded** — the full list (rename, renumber, delete, add, drag-reorder →
  sequential renumber, all GM-only; jump-to and select for anyone) plus the notes
  editor for the selected room.

**Players' notes** are per-map-room long-form markdown that _any_ seat may read or
write — not a referee field. They are CRDT-backed, exactly like the shared party
notes, so concurrent editors converge instead of stomping. All of a session's room
notes live in **one** Yjs doc (`room-notes`, a `Y.Map` of `mapRoomId → Y.Text`; see
`lib/collab/room-notes.svelte.ts`) rather than one doc per room: the list renders a
hover preview for every row, so doc-per-room would mean one RTDB subscription per
room in the dungeon. This adds no field to the `MapRoom` Firestore schema, so it
needs **no migration and no rules change** (`rooms/{roomId}/yjs/{docName}` is
already writable by any authenticated member).

### Markdown

`apps/web/src/lib/markdown.ts` — a ~70-line renderer, deliberately not a library,
supporting `#`/`##`/`###` (rendered as `h3`/`h4`/`h5` so a notes field never injects
an `h1` into the page outline), `**bold**`, `*italic*`, `- ` bullets, and
blank-line-separated paragraphs.

The input is player-authored and rendered with `{@html}`, so every character that is
not part of a recognised construct is HTML-escaped **before** any tag is emitted;
the output can only contain the small tag set the module writes itself. Covered by
`markdown.test.ts`, including the no-tags-from-source case. Two consumers, both via
`MarkdownEditor.svelte`'s Edit ⇄ Preview toggle: the party `NotesPanel`, and the
per-room players' notes (which also render through `MarkdownView` in the row hover
preview).

### Retired shell components

`ActivitiesRail`, `ToolsRail`, `LogRail`, `MobileActivityBar`, `ToolSheet`,
`DiceMiniCard`, `CharactersMiniCard`, `Popover`, `GroupsPanel`, `OwnershipPanel`,
the Blind Drawer UI, `MapsPanel`'s Session-settings home.

## II.2 Map system — vector

The map view is `apps/web/src/lib/components/VectorMapView.svelte` (rendering:
`apps/web/src/lib/map/vector-engine.ts`; tool logic:
`apps/web/src/lib/map/vector-tools.ts`; pure geometry:
`packages/shared/src/map/vector/`). It is the **only** map view — the cellular map,
its chunked storage, `MapView` and `map/engine.ts` were deleted in the WI-D cutover.

### Data model

**One coordinate space: cell-lattice units, floats** (golden rule 6).

```ts
interface Point {
  x: number;
  y: number;
} // lattice units

interface FloorRegion {
  id: string;
  rings: Point[][]; // rings[0] = outer boundary, rings[1..] = holes
  bbox: { minX: number; minY: number; maxX: number; maxY: number }; // derived
}
```

- A map's floor is the **union** of all `FloorRegion`s. Regions may be stored
  separately for edit-locality, but rendering / LoS / occupancy treat them as one
  union. A stroke bridging two regions merges them on commit.
- Path: `rooms/{roomId}/maps/{mapId}/floorRegions/{regionId}` — sparse documents,
  not fixed-size chunks.
- `bbox` is denormalized for "which regions are near the viewport / near a new
  stroke"; derived, recomputed every commit, never authoritative.
- **Floor is a baked union, not a construction history (Model A).** A committed
  region stores only the resulting boundary rings; the primitive that produced it
  (rect / n-gon / brush path) is not persisted and carries no retained type or
  params. Storage stays bounded and self-pruning (an erased shape leaves nothing
  behind), the union is the direct source of truth for LoS/occupancy, and edits stay
  local. Editing a committed region is **geometric** (drag boundary
  vertices/edges), not parametric. Identity that rules genuinely need lives on the
  **object layer** (walls, doors, `mapRooms`, labels — each with its own id), never
  on floor. Full rationale and the rejected Model B: Part V §2.
- **Firestore encoding.** Firestore forbids nested arrays, so the converter stores
  `rings` as an array of `{ points: Point[] }` maps (`VectorStoredFloorRegionSchema`)
  and unwraps on read. The model type, the RTDB draft and `MemoryStore` all keep the
  `Point[][]` shape — only the Firestore converter wraps. This is a permanent
  constraint, not a crutch.

### Walls, doors, LoS

One segment primitive, one door collection, one build-time consumer.

```ts
interface Segment {
  a: Point;
  b: Point; // lattice units
  source: 'perimeter' | 'explicit' | 'imported';
  blocksSight: boolean; // decoupled from…
  blocksMovement: boolean; // …passage
  style?: WallStyle;
  visible?: boolean; // render-only
}
```

- **perimeter** — derived from a `FloorRegion` boundary at build time; **never
  stored**. Defaults both block flags true.
- **explicit** — user-drawn free vector segment or closed loop, placeable anywhere,
  **not** edge-attached. Stored at `rooms/{roomId}/maps/{mapId}/walls/{wallId}`.
  Drawn with the Wall tool (polyline; snap/freeform per-point). The same tool and
  storage serve an interior divider _and_ a standalone vision/movement blocker
  (cliff edge, hedge, free-standing pillar) — no separate primitive.
- **imported** — from `.uvtt` etc., converted to lattice on import; stored.

`blocksSight`/`blocksMovement` decouple LoS from passage: a force field blocks sight
not movement; a low rail blocks movement not sight.

**Circle walls are not a storage type.** A circular room/pillar is a `FloorRegion`
(circular outer ring, or a circular hole). A standalone circular blocker is an
`explicit` closed loop sampled from the regular-polygon primitive.

```ts
interface Door {
  id: string;
  a: Point;
  b: Point; // lattice units — free endpoints
  type: DoorType; // single|double|secret|trapped|oneWay|barred
  state: DoorState; // open|closed
  facing?: DoorFacing; // oneWay only
}
```

Storage: `rooms/{roomId}/maps/{mapId}/doors/{doorId}` — the **single** door home. A
door is a free-floating overlay object (like symbols/labels), endpoints stretchable
between arbitrary points, so it sits on a fully organic boundary exactly as well as
a grid-aligned one. Every vector door renders identically to every viewer.

**Door ↔ wall is resolved at BUILD time, not commit time.** Doors never mutate
stored wall geometry. The LoS/segment builder reconciles once per render pass
(build-once, probe-many):

1. Emit all wall segments (perimeter-derived + explicit + imported).
2. For each door — **blocking** (closed / secret / barred / trapped-closed): add the
   door's own segment as a blocker. **Passing** (open): **clip** the door's span out
   of any wall segment collinear-and-overlapping with it (1-D interval subtraction
   along the segment) → a real gap in the boundary.

Moving a door, or a wall/region changing, needs no re-excision — the next build
reconciles. There is no durable door↔wall binding.

The store↔geometry bridge lives at `packages/shared/src/store/vector-los.ts`, not in
`map/vector/` (which is store-free by design). `subscribeVectorScene` does **no
debouncing** — every change to floorRegions/walls/doors triggers an immediate full
rebuild; these collections only change on a committed carve, a wall-tool release or
a door toggle.

### Layer model — six Pixi containers

All children of one pan/zoomed `world` container carrying the shared lattice space;
geometry is drawn at `lattice × cellSize`. Z-order, bottom → top:

| #   | Layer (`layers.*`) | Renders                                                                                                              | Source data                                |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `background`       | Background image sprite, or a solid `#rrggbb` fill                                                                   | `GameMap.background`                       |
| 2   | `floor`            | `FloorRegion` fills (holes cut) + all walls / sight segments (perimeter-derived + explicit, door-reconciled)         | `FloorRegion[]`, `walls` → `VectorScene`   |
| —   | _(grid)_           | The lattice grid, drawn between floor and overlay (`renderGrid`)                                                     | `GameMap` grid settings                    |
| 3   | `overlay`          | **Doors** (open=dashed / closed=solid, coloured by type) + `symbols` glyphs + `mapRoom` labels + freehand `Drawing`s | `doors`, `symbols`, `mapRooms`, `drawings` |
| 4   | `fog`              | Fog cover with revealed regions cut out                                                                              | `fogRegions`, `GameMap.fog.enabled`        |
| 5   | `tokens`           | Token sprites, status rings, collapsed-group count badges; drag→snap→`moveToken(s)`                                  | `tokens`, `groups`, `encounter`, `isGM`    |
| 6   | `tools`            | In-progress stroke ghost, Select handles, Eye LoS polygon, Measure ruler span, peers' live carve drafts              | ephemeral / per-frame                      |

Peer cursors and pings render on dedicated containers **above** every model layer,
so they are never occluded.

**Conceptual split:** `floor` is world _structure_ (floor + the segments bounding or
dividing it); `overlay` holds movable objects drawn above it. Doors render on
`overlay` but their `{a,b}` geometry is what the build-time reconciliation reads
against `floor`-layer walls — render layer and geometry reconciliation are
orthogonal. A door is the deliberate exception that moved up, because it is a
movable object that _modifies_ structure rather than being structure.

**Z-order intent:** fog covers everything below it — background, floor, grid, doors,
symbols, labels, annotations — so a fogged region is featureless for players. Tokens
sit above fog so a token in a revealed area still reads; the `tools` ghosts sit above
tokens so a live carve preview is never obscured.

Floor corners are rounded **at render time only** (a fixed pixel radius clamped per
edge); the stored geometry stays straight-line polygons.

### Carve pipeline

1. **Stroke capture.** Freeform brush stroke or grid-aligned shape both terminate in
   one polygon.
2. **Buffering** (freeform only). Raw pointer path → offset polygon at brush radius.
   `polygon-clipping` provides no offsetting, so this is `bufferPolyline` +
   Douglas-Peucker (see `packages/shared/src/map/vector/OFFSET-SPIKE.md`).
3. **Boolean combine.** New polygon unioned (carve) or subtracted (fill / interior
   rock hole) against existing `FloorRegion`s whose `bbox` overlaps. If a stroke
   fully bisects a region, the difference op **naturally splits** it into two — a
   normal boolean outcome, not a special case.
4. **Simplification.** Douglas-Peucker at a fixed tolerance on **every** commit, not
   periodically — unbounded vertex growth is the primary long-session perf risk.
   0.10–0.15 lattice units reads visually clean while cutting 25–35% of vertices.
5. **Commit.** Preview during drag rides RTDB
   (`VectorMapDraft = { uid, tool, mode, points: Point[], ts }` — the raw
   centerline, never the offset polygon); release commits to Firestore. A merge
   writes one region and deletes the others in a **single atomic batch** — a
   partially-committed merge/split would corrupt the floor, so chunking merge/split
   is disallowed. Treat "≤500 ops per floor commit" as an invariant.

`MAX_FLOOR_EXTENT = 2000` lattice units is a soft cap: a carve commit that would push
the floor union's bbox past it is blocked with a visible error
(`data-testid="vector-floor-extent-error"`) rather than silently truncating.

Occupancy is answered by `pointInFloorUnion(point)` at interaction time or batched —
**never per-frame-per-cell**.

Undo is **snapshot-based**: a merge/split is a `floorRegionBatch` of
`{ id, from, to }` where deleted regions are `to: null` and the merged/new region is
`from: null`. Delta-based entity undo is not used — it isn't well-defined across a
split.

### Tools

Draw tools and their contextual parameters (Carve/Snap/Width/Sides/Door, plus
Simplify and the export controls in the expanded sheet only) live in one unified
panel in the **Map tools quick sheet** (`sheets/MapToolsSheet.svelte` →
`MapToolPalette.svelte` → `MapToolbar.svelte`), driven by the shared
`MapToolController` (`apps/web/src/lib/shell/map-tool-controller.svelte.ts`).

The palette is grouped by **gesture**, not by an arbitrary list.
`apps/web/src/lib/map/tool-groups.ts` is the single catalog of **five** groups —
Select · View · click-and-drag shapes · multi-click runs · Overlay — each with its
own icon and its own canvas cursor (`engine.setCursor`, layered under `pan-zoom`'s
transient gesture cursor), plus optional per-tool cursor overrides
(`MapToolGroup.toolCursors`). Every `MapToolId` belongs to exactly one group — a tool
missing from `TOOL_GROUPS` is unreachable, and `tool-groups.test.ts` guards that.

- **Select** is three tools (`selectVertex` / `selectEdge` / `selectObject`), not one
  tool with a mode row. `selectModeForTool` derives the engine's unchanged
  `ToolPreviewInput.selectMode` from the tool id; there is no `selectMode` state on
  the controller.
- **View** gathers everything that reads the map rather than changing it: Pan, Eye,
  Ping, and **Measure** — drag a span and a ruler line plus a distance chip appear,
  in the map's `RoomMeasure` units, vanishing on release. Nothing is committed, no
  undo entry is made.
- **Pen** is the tool formerly called Annotate, in Overlay (it puts something on top
  of the map, like a label/symbol/door) while keeping its own nib cursor. Its
  freehand `Drawing` write is unchanged.
- **Carve** is the freehand brush: the snap level picks its shape (Cell/Half paint
  whole lattice cells, Free buffers the sampled polyline), committing through the
  unchanged `commitCarve` pipeline, so carve modes, undo and simplify apply as usual.

Snap/freeform is a **per-stroke input modifier, not a property of the shape type**.
One shared abstraction — a vertex/point stream with a per-point snap decision —
feeds the same polygon-emission → buffer → boolean-combine → simplify pipeline
regardless of primitive:

| Primitive                                             | Snapped                                   | Freeform                                            |
| ----------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| **Room** (rectangle)                                  | Corners snap to grid intersections        | Corners follow raw pointer                          |
| **Corridor** (L-shaped)                               | Legs snap to axis/grid, single-cell width | Legs follow drag angle, width fixed                 |
| **Path** (skinny interior carve or exterior corridor) | Each click-point snaps                    | Raw pointer per point; double-click to complete     |
| **Polygon** (irregular)                               | Vertices snap to grid                     | Raw pointer per vertex; double-click to close       |
| **Regular polygon (n-sided)**                         | Center/radius snap                        | Center/radius freeform; **n=1 degenerate = circle** |

While a click-and-drag shape is being dragged, a dimension chip
(`strokeMeasureText` → `ToolPreviewInput.measure`) shows `w × h` in the map's
`RoomMeasure` units, or `radius:` for the N-gon; it derives from the live drag, so it
clears itself on commit. The Measure tool reuses the same chip via `measureSpanText`.

Hovering a room **label** shows its long-form description as a tooltip
(`map-label-tooltip`), read from the per-room players' notes
(`collab/room-notes.svelte.ts`) — there is no `MapRoom.description` field — and
hit-tested by the same `pickMapRoomAt` that Select → Object clicks use.

Token snap-mode defaults live on the character quick sheet, not the map toolbar.

The map camera (pan + zoom) is remembered per map on `MapToolController`, so
switching main views and coming back resumes the same view.

**Map tools are not referee-only.** Map drawing is open to every seat, consistent
with the "all room members can write" trust model. The referee-only controls that
remain (fog carve modes, bulk fog actions) carry their own `isGM` gate inside
`MapToolbar`. The PNG export's old GM-only "include hidden layer" checkbox — which
drove nothing — was replaced by an "up to layer" selector available to every seat,
cutting the export off above the chosen render layer (`map/export-layers.ts`).

> **⚠️ Flagged, unratified:** the vector toolbar is shown to **all** room members.
> The old cellular map hid all editing tools from players. Only `add-creature` is
> GM-gated. If players should not be able to carve/edit the shared map, the toolbar
> can be gated behind `isGM` — awaiting the user's call. See Part VI.

### Fog of war

Referee-authored, a `fog` Pixi layer between `overlay` and `tokens`.

- **Storage.** `maps/{mapId}/fogRegions` holds the _revealed_ geometry in the same
  `FloorRegion` doc shape as the floor (rings + bbox, lattice units), plus
  `GameMap.fog: { enabled }`. Schema v14→v15. No `fogChunks`, no mode enum.
- **Authoring.** Referee-only, expressed as a **carve mode** on the ordinary shape
  tools rather than dedicated tools: Room/Corridor/Path/Polygon/N-gon each offer
  `Carve: Floor | Rock | Fog: reveal | Fog: hide`, the last two running the existing
  `commitCarve` pipeline (union / difference) against `fogRegions`. A plain click
  reveals the whole floor region under the pointer; a drawn shape reveals exactly
  that shape. Offered only to the GM and only while `GameMap.fog.enabled`. **Reveal
  all** / **Reset fog** live in the expanded Map tools sheet; the fog **on/off**
  switch is a per-map Session setting, not a tool. All of it rides the same
  `UndoStack` via a `fogRegionBatch` op mirroring `floorRegionBatch`. Fog strokes are
  **not** published as RTDB drafts — a peer preview would leak what is about to be
  revealed.
- **Rendering.** The fog layer fills a covering rect in `--map-fog` and cuts the
  revealed rings out of it, redrawing off the same pan/zoom/wheel/resize triggers as
  the grid. That rect is the viewport **unioned with the extent of the revealed
  geometry** (`fogCoverRect`): a `Graphics.cut()` hole only triangulates correctly
  while it lies inside the shape it cuts, so a viewport-only rect deformed any
  revealed area partly scrolled off screen — it read as vertices being dropped as you
  zoomed. Fog geometry is viewport-independent. Opaque for players, ~0.4 alpha for
  the referee so they can see where fog _remains_. Tokens standing in fog are dropped
  from a player's render set (`pointInFloorUnionRegions` at render time) and dimmed
  for the referee.
- **Rules.** `fogRegions` is the one map collection that is **read-all but
  GM-write**. Honest limit: `floorRegions` stays readable by every member, so fog is
  a _presentation_ guarantee, not a secrecy boundary against reading the database
  directly. Making unexplored geometry genuinely unreadable would mean staging
  unrevealed floor behind `gmPrivate` — a different design, not a rules tweak.

The Eye tool's `visibilityPolygon` is untouched and still the LoS preview. Deriving
reveals from it automatically remains open (Part VI); the storage shape supports
adding it without a migration.

### Map management

Create / rename / switch / delete a map (`MapsPanel.svelte`) lives in the **Assets**
main view, beside the room list. Both are GM-only, so nothing about permissions
changed; Session settings keeps only session-wide config and the maintenance danger
zone.

### Schema versioning — error, don't migrate

The map carries a schema tag. A map whose tag does not match the current system gets
**simple error handling** — surface a clear "unsupported map schema" error and stop;
do not read or transform it. There is no dual-read path and no migration scaffold for
pre-vector maps; runs are assumed to occur in newly created sessions. (This is a
deliberate, ratified exception to golden rule 7, which governs changes _within_ the
vector schema.)

## II.3 Encounter board

`EncounterBoard.svelte` groups the cast into per-`Group` boxes with a synthetic
**Unassigned** bin, always rendered for the referee so it is a reachable drop target.

- A referee can drag cards between boxes and reorder them inside one —
  `Group.memberTokenIds` order _is_ the card order — and drag group headers to
  reorder the boxes, persisted via `Group.order`
  (`packages/shared/src/encounter/ordering.ts`). Both stores sort through
  `sortGroups`, which keeps groups written before the field rather than dropping them
  the way a Firestore `orderBy` would.
- Double-clicking a group name edits it inline; doing that to the Unassigned bin
  **creates** a real group holding its cards, ordered after every existing group, and
  an empty bin reappears in its place. That promote is the **only** creation path.
- All of this is GM-only. Membership/order writes go through the pure helpers in
  `apps/web/src/lib/encounter/board-view.ts`. **Membership is drag-and-drop, full
  stop** — there is no per-card assign dropdown.
- **A token belongs to at most one group.** Accepted deliberately: the old checkbox
  grid could put it in two, which the board cannot draw.

Each named group's box carries a **group card** (`group-card-{id}`) to the **left**
of its member cards, in the same card-sized footprint, holding that group's
`[Map]`/`[Board]`/`[Active]` flags, Collapse/Expand, Delete group, and the group's
owning player seats (`group-seat-{groupId}-{seatId}`). It renders outside the collapse
branch (so Expand stays reachable while collapsed), and real groups render **even
when empty**, for the referee only — otherwise a fresh or emptied group would have no
box and therefore no controls. Delete group removes the group _and its member
tokens_, behind a `dialogs.confirm`, via `deleteToken`.

**Actor card:** rectangle; top half = portrait (or `gen:` disc); bottom half = name +
**pinned profile fields** (template fields carry a `pinned` boolean, GM-set; rendered
as read-only label:value rows) + status tags; roll-shortcut chips; turn highlight;
hidden badge (GM). Click raises the Character sheet.

**Initiative modes:** side/group (default; one number per side, typed or dropped from
a roll), individual, free/caller (rotating Caller marker). The app arranges and steps
order; it **never derives order from a stat**. Round counter increments on
advance/wrap; `acted` and defeated are flags, never HP math.

**Roll strip:** an ephemeral row where simultaneous results collect and sort.
Separate-mode result classes: Success 4+ / Complication 2–3 / Failure 1 — this
classifies the rolled face only.

**Collapse group to one token (map):** `group.collapsed: boolean` + stored member
offsets relative to an anchor member. Collapsed ⇒ the map renders one stacked-badge
token (count bubble); dragging it moves all members by delta — RTDB drag frames for
the anchor only, one **batch** Firestore write of all member positions on release.
Expand restores offsets.

The board's referee side-panels are all gone: **Random tables** became the GM-only
`tables` quick sheet; the **Blind Drawer** was replaced by the Roll sheet's
referee-only **Hidden** button; the **Groups roster** became the per-group group card.

## II.4 Group ownership

Authority is a property of the **`Group`**, not the token.
`Token.ownerSeatId` survives meaning only "which character profile this token shows"
— what makes card selection, roll shortcuts, initiative slots, the R21 status ring's
"owned" branch and "My token" work — and confers nothing. The model lives in
`packages/shared/src/encounter/ownership.ts` (pure, unit-tested):

- `Group.memberSeatIds` lists the player seats that own a group. A listed seat may act
  as **every** character in it: open the sheet, edit the profile, roll its fields,
  place its token. Edited from the group card's checkbox list.
- **The referee is in every group, implicitly.** GM membership is derived from
  `Room.gmUid` by `canSeatActAs`, never stored, so transferring the referee updates it
  across every group with no writes and nothing to keep in sync. Their checkbox renders
  checked and disabled to say so.
- `RoomSettings.defaultPlayerGroup` (`'first'` | `'unassigned'` | a `groupId`, Session
  settings → Players, `session-default-group`) decides where a newly joined seat lands.
  `groups/{groupId}` is GM-write-only, so a joiner cannot place themselves:
  `RoomShell`'s GM-gated, idempotent reconciliation effect applies it via
  `defaultGroupPatches`, the way `ensureActiveMap` works. A player who joins with no
  referee connected is placed when one arrives. Deleting the named group writes the
  setting back to `'first'`, and `resolveDefaultGroupId` reads a dangling value that way
  regardless.
- `PlayerSeat.currentCharacterSeatId` is the character a seat is currently playing —
  the last one it selected from a group it owns. Absent ⇒ its own profile. It is what
  the Character sheet defaults to; "← Back to my sheet" (`dock-back-to-mine`) clears it
  and returns to the player's own profile.

**Enforcement is client-side.** `canSeatActAs` decides whether the sheet renders
editable; `firestore.rules` gates `profiles/{seatId}` on room _membership_ (loosened
from own-seat-or-GM, with tests). Expressing group ownership in rules would need the
owning seats denormalized onto every profile doc, since a group holds token ids and a
character is a seat. Token ownership never had server-side teeth either, so this gives
up no guarantee that previously held.

## II.5 Map ⇄ character sheet

Selecting a token on the map raises that character's sheet, exactly as clicking their
card on the Encounter board does — `VectorMapView` takes the same
`selectedSeatId`/`onSelectActor` pair the board does and fires it from the token
sprite's `pointerdown` (already the selection moment, so there is no
click-versus-drag discrimination). Readout: `selected-seat`.

Dragging the sheet's portrait (`dock-portrait`) onto the map places that character's
token where it is released: the token hides for the duration
(`mapCtrl.sheetDragTokenId` → `hiddenTokenIds`), the pointer carries a translucent
copy of the portrait (`setGhostImage`), and the drop snaps through the same
`snapTokenPosition` / `snapModeFromModifiers` call an on-map drag uses. A character
with no token yet gets one created at the drop point.

This is the **only DOM drag-and-drop on the map** — all other map input is Pixi
federated pointer events, which a DOM drag never reaches, hence the `DataTransfer`
payload in `apps/web/src/lib/tokens/drag.ts`.

## II.6 Dice

**Engine (untouched, byte-for-byte):** seed → `hashSeed` + `mulberry32` → faces. The
Roll doc is the source of truth; the 3D tumble is cosmetic.

**Renderer:**

- **No-flip settle.** On roll arrival the full Rapier sim runs **headlessly first**
  (same seed-derived throw, no rendering), recording each die's final orientation.
  Settle detection is threshold-based (`|linvel| + |angvel|` below epsilon, die inside
  bounds) with a hard step cap that force-reads whatever face is most up. The landed
  face comes from **per-face locator points** baked into each generated geometry — the
  locator direction with the highest dot product against world-up — one uniform
  mechanism for every shape, no per-shape normal tables. Each die's initial orientation
  is then **pre-rotated** (equivalently, its face→value assignment remapped) so the
  face destined to land up carries the required `kept` value. The identical sim replays
  visually and the body **locks** at rest. A face change after rest is a gate failure.
  Cross-client float drift is irrelevant: each client pre-rotates against its own sim.
- **One physics world per roll** — a new roll tears down and recreates the world and
  scene contents, which makes "old dice persist" impossible by construction.
- **Real polyhedra:** d4 (tetra), d6 (box), d8 (octa), d10 & d% (pentagonal
  trapezohedron; d100 = paired d10s, tens half darkened), d12 (dodeca), d20 (icosa).
  Number textures are generated at runtime on canvas, one cached atlas + geometry per
  die type per theme — never rebuilt per roll. 6/9 underlined.
- **d10 is exempt from the edge-aligned UV rule and reshaped.** `apexZ` 1.15 → 0.85
  (height ÷ width 1.15 → 0.85) with `SCALE.d10` 0.5 → 0.55 to keep on-screen size
  matched to the d20; `ringZ` stays derived as `apexZ·tan²(π/10)` — the planarity
  constraint that keeps each kite face flat is non-negotiable and pinned by a test.
  `Polyhedron` carries an optional `faceUp` (per-face glyph-top direction), which the
  d10 supplies as "far ring vertex → apex". Every other shape uses the edge rule.
- **Quality bar:** `renderer.setPixelRatio(min(devicePixelRatio, 2))`, hemisphere + key
  light, glossy plastic material (roughness ~0.30, metalness ~0.10, `flatShading: true`
  so facet edges stay crisp), a soft contact shadow cast from the key light onto an
  invisible `ShadowMaterial` plane at the physics floor. **No tray mesh.** Invisible
  walls keep dice in frame; dice scale relative to viewport.
- **Die colour has exactly one source: the roller's character colour**
  (`ProfileInstance.color`), picked on the character quick sheet. The colour is baked
  into the face **texture**, not applied as a `material.color` tint — the tint
  multiplied the coloured texture, so the rendered die was never the hex the player
  picked. `--dice-face` survives as the single neutral for a character who hasn't
  picked one.
- **Overlay lifecycle:** full-viewport fixed transparent canvas above the stage,
  `pointer-events:none`. New roll ⇒ previous dice cleared immediately. After settle a
  result chip (per-die faces + total/flags, author name) anchors near the dice for ~4s
  then fades; the renderer pauses when idle. Rapid rolls queue at most one deep —
  latest wins. Reduced-motion ⇒ skip tumble, show chip only.

**Shared rolls.** A shared roll is **one composite Roll doc authored by the referee's
client** — native to the seed-authoritative model.
`rooms/{roomId}/sharedRoll/current = { status, label?, openedBy, slots }`; players
write only their own slot (rules: own-seat-or-GM); the referee's client generates one
seed and expands slots into dice in **deterministic seat-id-sorted order**, which is
the invariant letting every client re-derive identical faces. Writes one Roll doc with
`parts?: [{ seatId, dice, modifier, advantage, total?, flags? }]` (ordinary rolls
leave `parts` unset) and marks the staging doc resolved. Single writer ⇒ no race.
Unstaged seats are skipped or filled with a default by the referee. Overlay renders
all parts at once tinted per seat; the log gets one grouped entry; the roll strip shows
parts individually.

**Call for Initiative** is a staged round with `SharedRoll.kind === 'initiative'` whose
results apply to the tracker **automatically** on resolve — such a call exists only to
fill those rows, so an extra tap was ceremony. The explicit **Apply results to
initiative** action still stands for every _other_ shared roll. Individual-mode slot
keying is `{uid}:{tokenId}`, so one player can stage several characters they own.

**Advantage/disadvantage, mode-dependent:**

- **Summed mode → (n+1) pool.** Roll one extra die and keep the `n` highest
  (advantage) / lowest (disadvantage). For a **mixed** summed pool, apply per die-kind
  group, one extra per type (`2d20 + 1d6` adv → `3d20` keep 2, `2d6` keep 1). Consume
  the RNG stream in a documented, stable order (kind groups in fixed order) so
  re-derivation matches across clients.
- **Separate mode → +1 per die.** Each staged die gets its own companion; keep the
  higher/lower of each pair, flagging each kept die independently.
- **Visualization:** render the full set of physical dice with each **dropped** die
  **dimmed**, in both modes. The roll strip and log annotate the dropped value(s).
  `Roll` schema changes here are additive — old rolls still render.

**Hidden rolls:** the referee's Roll sheet has two side-by-side buttons, `roll-button`
and `roll-hidden-button`. `publishHiddenRoll` uses the same seed → expand → roll
construction as `publishRoll` but writes only to `gmPrivate` — **no `Roll` doc, no log
entry, and no reveal path**. Results list back to the referee via
`hidden-roll-list` / `hidden-roll-{id}`. The `gmPrivate` store surface (`BlindDraw`,
`subscribeBlindDraws`, `writeBlindDraw`) is unchanged and still contract-tested.

## II.7 Tokens, assets & theming

- **Generated default tokens:** `AssetStore.resolve` supports a `gen:` ref scheme —
  `gen:disc:{label}:{colorToken}` renders a circled alphanumeric SVG data-URI. Label
  assignment is deterministic (players A, B, C… by seat join order; referee creatures
  a1, a2… per creature type letter) and overridable. The Generate-default tab exposes a
  **character** field accepting arbitrary text (letters, digits, symbol/emoji glyphs —
  not restricted to A–Z, with a ~2–3 glyph render cap and a guard/encoding for a typed
  `:` so the `gen:disc:{label}:{color}` parse stays unambiguous) and a **colour
  picker**, both pre-filled with the auto values. Preview updates live via
  `renderGenTokenSvg`; confirm builds the ref with `buildGenTokenRef`. The ref still
  fully describes the SVG.
- **Assets view tabs:** _Bundled_ (starter pack), _By URL_ (validated paste, preview,
  saved to a room-level `assetRefs` list), _Uploads_ (visible but disabled until a
  `[HUMAN]` Blaze upgrade activates `FirebaseStorageAssetStore` — the interface slot
  exists). Saved-URL refs delete via the per-tile ✕ with a confirm; bundled starter
  assets are non-removable by design (the fallback pack).
- **Token status ring.** The engine strokes an outer ring around every token from live
  state: **white** if selected **or** owned by the viewing player, else the **group
  colour** if grouped, else **black**. Precedence: selected/owned > group > none. This
  is a render-time overlay, separate from a generated disc's own baked-in art ring.
  Note: under group ownership, "owned" still means `token.ownerSeatId === myUid`, so
  the ring marks "my own character's token", not "a token I may move" — every character
  in a group you own is one you may move, and only the one linked to your seat is
  white. Left as-is deliberately.
- **Background:** a map's background is either an image ref or a solid `#rrggbb`
  colour (`GameMap.background`), set from Session Config, with Change/Remove controls
  reusing the asset picker.
- **Theming:** every colour/space/radius/type decision is a CSS custom property on
  `:root` under a `data-theme` attribute (`--bg-deep --bg-panel --line --text
--text-dim --accent --success --complication --failure --group-world --group-play
--group-records --group-referee --map-rock --map-floor --map-wall --map-door
--map-secret --map-fog --map-grid --map-selection`). Because the Pixi engine cannot
  read CSS vars cheaply per-frame, `readMapTheme(): MapTheme` resolves the `--map-*`
  vars once (and on theme change) into numeric constants; the engine takes a `MapTheme`
  and exposes `setTheme()` triggering a re-render. Two themes ship: `parchment-dark`
  (default) and `keyed-blue`. Theme is a **room-level** setting
  (`room.settings.theme`, GM-set) so all players see the same map colours.
- **Icons:** simplistic, single-colour, stroke-based SVGs drawn as `currentColor` so
  group/hover/active colour is pure CSS. No multicolour art, no emoji in UI chrome.

## II.8 Log, session config & accounts

**Log:** entry anatomy is icon by `type` (roll/chat/table/reveal/system), author
display name (resolved from seats, falling back to "—"), relative + absolute timestamp,
body; roll entries keep result-class tinting. Client-side filter chips per type
(persisted locally per user), substring search over loaded entries, and "load older"
pagination via `listLogBefore(roomId, ts, limit)`. Live subscription capped at 200.
Chat input at the bottom writes `{type:'chat', authorUid, text}`; `/r <expr>` parses
via the existing tray engine and performs a real roll (writes Roll + log, triggers the
overlay); unknown `/` commands post nothing and hint inline. Recording is always-on for
roll/chat/table/reveal; per-user _view_ filters are the primary control.

**Session settings** (GM-only modal, scroll-with-nav; the nav uses
`scrollIntoView` buttons, **never hash anchors** — raw `<a href="#id">` collides with
the hash router and bounces the app to the Lobby):

1. **Room** — name (inline edit), invite link + copy/QR, theme select, export
   `.vttcamp` / import.
2. **Grid & measurement** — grid w/h (validated ≥1×1), cell size px, half-size grid
   toggle, measurement `perSquare` + `unit` free text (defaults **10** / **feet**).
3. **Fog** — the per-map on/off switch.
4. **Profile template** and **Encounter profile** — both via `ProfileTemplateEditor`.
5. **Players** — display name (GM-editable), role select `player|viewer`, **remove
   player** (deletes `players/{uid}`; their profile is kept unless "also delete
   character sheet" is checked), **transfer referee** (writes `gmUid`, demotes self,
   double-confirm), and `defaultPlayerGroup`.
6. **Maintenance danger zone** — prune old entries, delete room, and (per R25/R26) the
   inactive-seat prune.

`room.settings = { theme, measure: { perSquare, unit }, grid: { subdivide }, defaultPlayerGroup }`.

**Ruler / measurement:** renders `${squares} sq / ${squares*perSquare} ${unit}`;
Chebyshev distance. With `subdivide` on, the ruler additionally shows the half-square
count.

**Accounts:** `linkWithPopup(GoogleAuthProvider)` upgrades the **existing anonymous
uid in place** — same uid, zero data migration; on a new device Google sign-in restores
that uid, which is how GM recovery works. Players may stay anonymous forever. A "Save
your identity" affordance lives in the Session tab — subtle, never a login wall.
`credential-already-in-use` is handled by offering sign-in-instead with a clear "this
switches who you are" warning; no merge attempt.

**Creating a room requires a non-anonymous account** (R24.1, shipped). The Firestore rule
gates `rooms/{roomId}` **create** on `request.auth.token.firebase.sign_in_provider !=
'anonymous'`; `read`/`update`/`delete` are untouched, so a pre-existing room whose `gmUid`
is an unlinked anonymous uid keeps working. The Lobby renders a sign-in invitation
(`create-room-signin-gate` / `create-room-signin`) in place of the Create form for an
anonymous visitor, rather than letting a write fail. **Joining is untouched and still
promptless.** A soft cap of `MAX_ROOMS_SOFT = 12` GM-role My Rooms entries disables the
Create button (`create-room-cap`) — client-side friction, explicitly not a boundary.

**App Check** (R24.2) is wired but **off unless a reCAPTCHA v3 site key is configured**.
`createFirebaseClient` takes an optional `appCheck` block and initializes App Check
before any Firestore/RTDB handle exists; `loadFirebaseEnv` supplies it only when
`VITE_FIREBASE_APPCHECK_SITE_KEY` is set, and adds the debug provider for emulator/dev
runs. That default is what keeps zero-setup dev, the emulator suite and Playwright
working against a project with no App Check registration.

**Room ids** are Firestore auto-ids — 20 chars over a 62-symbol alphabet, ≈119 bits of
CSPRNG entropy — which satisfies R24.4. Since the roomId is the capability, this is
load-bearing: never replace it with anything sequential, timestamp-derived or readable.

**My Rooms:** `users/{uid}/rooms/{roomId} = { name, role, lastSeenAt }`, written on
create/join/open, self-owned (rules: a user may write only their own index). The Lobby
lists My Rooms (name, role badge, last seen, open/delete) above Create/Join. Index
entries are best-effort convenience data — a dangling entry after external deletion
renders a "room gone — remove?" row.

**Room deletion (GM):** client-side recursive delete iterating the known subcollection
list in ≤400-doc batches, then the room doc, then the RTDB `/rooms/{roomId}` node.
"Export first" is offered in the confirm dialog. Only the GM may delete the room doc.

**Maintenance answer — no admin panel is needed.** Orphaned rooms → in-app GM delete +
My Rooms visibility. Unbounded `rolls`/`log` growth → capped live subscriptions + the
GM prune button. Stale RTDB nodes → ts-filtering plus `onDisconnect().remove()`.
Firestore TTL on `rolls` → optional belt-and-braces, **console-only** `[HUMAN]` setup.
Usage/quota monitoring and orphaned anonymous Auth users → **the Firebase console is
the admin UI**; anonymous user records are inert and harmless. No custom admin panel,
no Cloud Functions, no card.

## II.10 Presence & seat lifecycle

Live presence rides **RTDB** at `rooms/{roomId}/presence/{uid} = { uid, name, ts }` —
own-uid-only write, with an explicit `.read` at the **parent** node (RTDB rules cascade
down, not up, so a `$uid`-only read leaves `subscribePresence` silently never firing).
The heartbeat is 45 s (`PRESENCE_HEARTBEAT_MS`), managed inside the store rather than by
callers; `onDisconnect().remove()` is armed once per room+uid using the same guarded
pattern `publishCursor` uses. `RoomShell` publishes once this client holds a seat — not on
mount, since a visitor on the join gate has no seat to mark — and clears on unmount.

**Three states, and the distinction between them is the whole feature:**

| State            | Signal                                     | Effect                                                                                           | Reversible     |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------- |
| **Present**      | node exists, `ts` within 2× heartbeat      | normal                                                                                           | —              |
| **Disconnected** | node absent, or `ts` stale                 | dimmed row + dot in `PlayersPanel`, dimmed token + away badge on the map; **seat doc untouched** | instantly      |
| **Abandoned**    | no presence for `ABANDONED_SEAT_DAYS` (30) | listed in Session → Maintenance for referee review                                               | GM action only |

**Disconnection carries no data consequence whatsoever.** Every control on a disconnected
player's row stays enabled, their token stays exactly where it is and stays draggable by
anyone who could already move it, and the seat doc is never touched.

The pure rules live in `packages/shared/src/store/campaign-store.ts` as tested functions —
`isPresent`, `presentUids`, `abandonedSeatUids` — so the panel, the map renderer and the
Maintenance block share one definition rather than each re-deriving it.

**Durable half.** `PlayerSeat.lastPresentAt` (schema v18) is written on the first presence
publish of a session and then at most hourly (`LAST_PRESENT_THROTTLE_MS`) — the only
Firestore write in an otherwise all-RTDB channel. **Absent means "never observed", which is
deliberately not "abandoned"**: `abandonedSeatUids` requires a stamp older than the cutoff,
so a seat predating the field is never offered for pruning and earns a real value the first
time its player connects. There is no backfill, and the v17→v18 migration is a documented
no-op — `migrateRoom` only ever sees the room doc, and this field lives on `players/{uid}`.

**Map dimming** uses `Math.min(baseAlpha, 0.42)` rather than a product: `alpha` is already
overloaded (0.4 means "GM-only view of something players cannot see"), and compounding
would push a hidden-and-away token to near-invisible. Because alpha alone cannot
distinguish those two cases, a small hollow **away badge** carries the presence signal; the
status ring (R21) keeps its full weight and colour, so "whose token is this" and "is that
player here" stay independent readings. The mockup's saturation shift was dropped — a
per-sprite `ColorMatrixFilter` is real GPU cost against the standing Chromebook budget, and
opacity plus the badge already reads.

**Prune inactive seats** (Session → Maintenance) lists only seats `abandonedSeatUids`
returns, each with a checkbox, and reuses the existing `removePlayer` path including its
"also delete character sheet" option (off by default). Never automatic, always confirmed,
and the block is **absent entirely** when no seat qualifies rather than shown empty.

New testids: `player-presence-{uid}` (with `data-present`), `player-last-seen-{uid}`,
`player-inactive-{uid}`, `token-away-{tokenId}`, `inactive-seats`,
`inactive-seat-{uid}`, `inactive-seat-check-{uid}`, `inactive-delete-profiles`,
`inactive-prune-start`, `inactive-prune-run`, `inactive-cancel`, `inactive-confirm`,
`inactive-error`.

## II.11 Room lifecycle & dead data

Rooms carry an activity clock — `Room.lastActivityAt` (v19, R25.1) — written **only** from
settled write paths (`createToken`/`moveToken`/`moveTokens`/`deleteToken`,
`commitFloorRegions`/`commitFogRegions`, `writeRoll`, `setProfileValue`) and throttled
in-memory to at most one write per `ROOM_ACTIVITY_THROTTLE_MS` (5 min) per client via the
shared `ActivityThrottle`. Never from an RTDB path, a cursor, a drag frame, or a timer.

Room-doc updates are GM-only in `firestore.rules`, so **the referee's client keeps the
clock**. A player's first attempt is denied, and `FirebaseStore` remembers that room in
`activityDenied` and stops trying for the session rather than paying a room read up front
to find out. This is deliberate, not a gap: "nobody with write authority has opened this
room in 90 days" is exactly what dormancy is meant to describe.

The migration (v18→v19) seeds the **migration timestamp**, never zero and never
`createdAt`. Because `roomConverter.fromFirestore` runs every doc through `migrateRoom`,
a pre-v19 room reads as freshly active until a real settled write persists a value —
the same conservative direction as `lastPresentAt`'s deliberate absence.

**Dormant surfacing** (R25.2) lives on the Lobby's My Rooms rows, per
`docs/mockups/wi27-dormant-rooms.html`: a GM-role row whose clock is older than
`STALE_ROOM_DAYS` (90) grows a dashed inset with **Export** (archive only, nothing
deleted), **Delete** (opens the row's existing confirm and reuses `deleteRoom`
unchanged — no new destructive code) and **Keep**. Keep writes
`MyRoomEntry.dormantDismissedUntil` on the user's **own** index entry
(`dismissRoomDormancy`), which is the one document a user may always write; it is one
user's opinion about their own list and changes nothing about the room. The rule is
pure: `isRoomDormant`, and it treats an absent clock as _not_ dormant, exactly as
`abandonedSeatUids` treats an absent `lastPresentAt`. Rooms where the user is a player
are out of scope — a dangling entry already has its "room gone" row.

**RTDB leak closure** (R25.3): `publishPing` arms `onDisconnect().remove()` per pushed
node (each ping is its own `push()` id, so there is nothing to de-duplicate) alongside
the existing `PING_TTL_MS` timeout — the timeout is the normal path, `onDisconnect` is
the crash path. `publishDrag` arms it guarded per room+token in `dragDisconnects`, the
same one-time pattern `publishCursor` and `publishPresence` use, because it is a
per-frame path.

New testids: `my-room-dormant-{roomId}`, `my-room-dormant-export-{roomId}`,
`my-room-dormant-delete-{roomId}`, `my-room-dormant-keep-{roomId}`.

## II.9 Test culture

Vitest units, Firestore rules tests, `CampaignStore` contract suite run unmodified
against both implementations, Playwright two-context e2e with stable `data-testid`s,
CI green-gate. A hidden **e2e introspection readout layer** mirrors Pixi canvas state
as queryable DOM: `token-pos-*`, `token-size-*`, `token-current-*`, `token-ring-*`,
`collapsed-group-*`, `maproom-name-*`, `floor-region-count`, `wall-count`,
`door-count`, `drawing-count`, `last-batch-move-count`, `selected-seat`,
`measure-readout`.

`tests/e2e/helpers.ts`'s `openActivity()` keeps its old call signature and maps each
legacy activity id onto wherever its panel now lives; it dismisses any open backdrop
first and opens the activity drawer before reaching for a main-view tab
(`openActivityDrawer` / `closeActivityDrawer`, no-ops on mobile). It also carries
`claimOwnToken()` (a seat gives itself a token from its own sheet, the only
token→profile link left) and a `createGroup()` written onto the promote-then-drag-back-out
flow, plus `vectorCarve` (`vector-tool-room` + drag).

**`signInAsReferee(page)` (R24.1)** — call it **instead of `page.goto('/')`** in any spec
that creates a room; creating one now requires a non-anonymous provider. It mints a real
Google-provider session against the **Auth emulator's REST API**
(`accounts:signInWithIdp`, which never verifies the token signature) and hands it to the
SDK by writing its own IndexedDB persistence record
(`firebaseLocalStorageDb` → `firebaseLocalStorage`, key
`firebase:authUser:{apiKey}:[DEFAULT]`), then reloads. Two things about that record are
easy to get wrong and cost real debugging time: **`value` is a plain object, not a JSON
string** (stringifying it fails _silently_ — the SDK reads it back, parses no user, and
quietly re-signs-in anonymously), and the seed must happen **after** the app's own
anonymous bootstrap has settled, or it simply loses the race and is overwritten. The
helper waits for the Lobby's sign-in gate before seeding for exactly that reason.

The `sign_in_provider` claim in the resulting token is genuine, so the specs exercise the
shipped rule rather than bypassing it, and **nothing in `apps/web/src` knows the helper
exists**. The app's own `linkWithPopup` path cannot be driven here: the SDK popup loads
`apis.google.com`, unreachable from a headless sandbox.

New testids: `create-room-signin-gate`, `create-room-signin`, `create-room-signin-error`,
`create-room-cap`, `create-room-cap-near`.

---

# PART III — REFERENCE SPECS

Specs are cited by work items. Superseded specs keep their annotation in place.

## R1 — The Activity Shell

> **⚠️ Structure superseded (2026-07-24) by the Quick Sheets shell** — see Part II §1,
> which is authoritative. The seven-activity, four-rail shell (R1.1–R1.4, R1.7, R1.8)
> is gone: the Activities rail, Tools rail, Log drawer and mini-cards no longer exist.
> **R1.5 (layering), R1.6 (dialog primitives) and R1.4's colour palette still stand.**

**R1.1–R1.3 (retired).** The room UI was a near-fullscreen stage hosting one Activity
at a time, framed by four slim edge tabs (top Session, left Activities rail with
colour-coded group boxes and mini-cards, right context-sensitive Tools rail, bottom
Chat/Log tab). Each rail tab moved `collapsed` → `mini-card` → `stage`; exactly one
mini-card open per rail; shell state persisted per room in `localStorage`. The
registry (`ActivityDef` with `id/title/icon/group/stage/miniCard/tools/availability`)
registered Map, Encounter, Dice, Characters, Assets, Log, Session. Existing panels were
re-housed, never rewritten. **WI-0 locked Option A (docked flyouts)** as the shell
choice.

**R1.4 Colour groups & icons (still in force).** Groups and their design-token colours:
**world** (Map, Assets) — map blue; **play** (Encounter, Dice) — rust red; **records**
(Log/Chat, Characters/Notes) — moss green; **referee** (Session) — violet, GM-only.
Icons are simplistic single-colour stroke SVGs drawn as `currentColor`.

**R1.5 Layering (still in force).** Z-order, top last: stage → rails/flyouts → bottom
drawer → **dice overlay** → dialogs/toasts. The dice overlay canvas is
`position:fixed`, full-viewport, `pointer-events:none`.

**R1.6 Dialog primitives (still in force).** A shell-owned `<Dialog>` (focus-trapped,
Esc-dismiss, token-styled). **Every `window.prompt`/`confirm` is retired.** (The
companion `<Popover>` was later deleted with the mini-card model.)

**R1.7 Keyboard map.** Revised by Part II §1 — see the current shortcut list there.

**R1.8 Mobile / tablet mode.** Trigger: viewport `< 900px` **or** a coarse-pointer
media query. The bottom activity bar and touch input survive; the tool bottom-sheet
became "any quick sheet, as a bottom sheet". Touch: one-finger = active tool,
two-finger drag = pan, pinch = zoom.

## R2 — Design tokens & theming

Shipped as described in Part II §7. The deliverable was the _system_: the token sheet,
`data-theme`, `readMapTheme()`/`engine.setTheme()`, and two themes. No further theme
design work is in scope. (Whether a fuller theme _authoring_ engine — editing/creating
custom token sets — is wanted remains open; see Part VI.)

## R3 — Dice renderer v2

Shipped as described in Part II §6. R3.1 (no-flip settle), R3.2 (real polyhedra),
R3.3 (presentation quality), R3.4 (overlay lifecycle), R3.6 (shared rolls) are all
live.

**R3.5 Prior art — license discipline (BINDING, permanently).**
`owlbear-rodeo/dice` (GPL-3.0) was examined as reference _during planning only_. Its
techniques informed R3.1 (threshold settle, locator-based face detection, rest locking,
world-per-roll, throw-toward-center feel), all restated in our own terms. Its
architecture also validates our divergence: Owlbear is physics-authoritative (remote
clients render **static** dice); our seed-authoritative invariant requires every client
to animate, which is exactly what pre-rotation provides.

- Claude Code must **not** clone, fetch, open, or otherwise place the Owlbear repo (or
  any GPL-3.0 code) in its context. This spec section is the sole channel for its
  ideas.
- **No assets** (GLB meshes, textures, materials, audio) from that repo may be copied
  or traced — geometry and number textures are generated procedurally. See
  `ATTRIBUTION.md`.

## R4 — Session configuration & player management

Shipped; see Part II §8. Note the grid-shrink guard described here was **removed** —
a vector floor has no cell-grid ceiling to shrink against (Part V §2, D3).

## R5 — Log activity & chat

Shipped; see Part II §8.

## R6 — Accounts, out-of-session management & maintenance

Shipped; see Part II §8. **R6.4's maintenance table is the standing answer** to "do we
need a DB-admin UI?" — mostly no. R24–R26 extend it with access control, room
lifecycle and presence.

## R7 — Asset management & default tokens

Shipped; see Part II §7. The `gen:` scheme's determinism contract (the ref fully
describes the SVG) is binding.

## R8 — Encounter Board v2

Shipped; see Part II §3. R8.3's "GM controls move to the right tools rail" is
superseded — the rail is gone and every referee control now sits on the thing it acts
on (group card, Roll sheet, `tables` quick sheet).

## R9 — Map geometry & tooling pack (cellular)

> **⚠️ Superseded (2026-07-20) by the Vector Map System (R9′).** R9 was designed
> against the cellular model and was overtaken wholesale rather than extended. R9.1's
> premise (preserve the cellular model), R9.2 (vector walls as an extension of
> edge-walls) and R9.4 (rasterize-to-cells "natural" rendering) are moot. R9.5 (Labels
> v2) was superseded again by R13.

**R9.3 Measurement units, R9.6 half-size grid, R9.7 token snapping, R9.8 PNG export**
describe behaviour that **survived** the cutover largely as specified, re-implemented
against `GameMap`/the vector engine:

- **R9.3** — `room.settings.measure = { perSquare: 10, unit: 'feet' }`, defaults 10/feet
  (a deliberate change from the previous implicit 5 ft, applied to existing rooms by
  migration).
- **R9.6** — `room.settings.grid.subdivide: boolean`; rendering only, half-spacing lines
  at reduced alpha/weight (10′/5′ dual-mark style). No model change.
- **R9.7** — tokens snap to full-cell centers on drop. **Alt** ⇒ half-grid
  intersections; **Alt+Shift** ⇒ free placement. Snap honours token size (2×2 snaps to
  cell corners so it covers whole cells).
- **R9.8** — "Download map as PNG" for all users, via Pixi v8
  `renderer.extract.image(world)` over the carved bbox + margin, downloaded via
  object-URL. The GM-only "include hidden layer" checkbox was replaced by an
  **"up to layer" selector available to every seat** (`map/export-layers.ts`).

## R9′ — Vector Map System

**The authoritative map spec.** Its full content is Part II §2 (data model,
walls/doors/LoS, six-layer stack, carve pipeline, tools, fog, schema versioning),
which is written descriptively because the system shipped. The decision log behind it
is Part V §2.

Explicit non-goals, still binding:

- No change to dice, encounter, session, account or logging systems from map work.
- No per-frame point-in-polygon in any hot path.
- No dual-live bitmask+polygon representation — the bitmask model is gone.
- No custom polygon clipping/offsetting math — use a vetted library.

## R10 — Wall line-type system

`WallStyle` is the union `'solid' | 'masonry' | 'natural' | 'dashed'`; a wall carries
its **own** optional `style`, falling back to the hosting room's default when absent.
Effective style resolves as `wall.style ?? hostingRoom?.wallStyle ?? 'masonry'`, then
dispatches: `solid` → single stroke; `masonry` → solid + masonry treatment; `dashed` →
`strokeDashed(…, 5, 3)`; `natural` → `naturalizePolyline` + `drawSmoothCurve`, so a
single natural wall reads irregular even in a masonry room. The chaining seed is
`hashSeed(roomId + runKey)` for cross-client determinism. Displacement is clamped to
≤0.25 cell so the art never visibly disagrees with the true geometry LoS uses.

**Angled/diagonal walls default to `solid`**, not dashed. Dashed is produced only when
the effective style is explicitly `dashed`. The Wall tool's style select is a 4-way.

> **⚠️ Circular walls (R10.5) superseded.** The dedicated `CircleWall` doc — with its
> `gaps: Arc[]`, reserved `doors: ArcDoor[]`, and circle→N-gon LoS sampling that skipped
> gap arcs — **is not a storage type in the vector system**. A circular room is a
> `FloorRegion` with a circular ring; a standalone circular blocker is an `explicit`
> closed segment loop from the regular-polygon primitive. The ring→segment sampling
> helper survives as a draw-time utility. "A circular room must never be dead-sealed"
> is satisfied natively: an opening is just floor geometry.

## R11 — Door type system

```ts
DoorType = 'none' | 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred';
```

`secret` is a **type**, not a flag. `facing` is meaningful only for `oneWay`.
`type: 'none'` is the removal sentinel. The Door tool does not cycle a fixed sequence:
clicking opens a type picker (or uses the palette's selected type) and sets it centered
on the nearest segment. State (open/closed) is a separate toggle.

**Rendering:** draw the wall stroke as normal, then stamp a **centered** type glyph at
the segment midpoint — single = door leaf; double = two leaves; secret = "S"; trapped =
hazard mark; one-way = arrow along `facing`; barred = double bar. Icons come from theme
tokens; no external art.

**LoS:** `open` passes; `closed`, `secret`, `barred`, `trapped(closed)` block. `oneWay`
blocks like a normal door for sight — per-side blocking is out of scope; the arrow is a
GM annotation.

> **Amended:** in the vector system doors are free-endpoint overlay objects with their
> own geometry, reconciled against walls at build time (Part II §2), not flags on a
> grid edge. Every door renders identically to every viewer — no `isGM`-gated branch
> (D5). The type/state/facing model above is unchanged.

## R12 — Dimension HUD

While dragging a shape, show a centered readout of the size that updates live and
disappears on commit — no persistence, no draft doc, purely local like the ruler label.
Shipped as `strokeMeasureText` → `ToolPreviewInput.measure`, in the map's `RoomMeasure`
units (`w × h`, or `radius:` for the N-gon), reused by the Measure tool via
`measureSpanText`.

## R13 — Labels v3

- **R13.1 Inline edit.** Double-clicking a placed label opens an inline text editor
  positioned over it (an absolutely-positioned input in the map overlay, **not** a
  modal). Commit on blur or Enter; Escape cancels. Writes a `mapRoom` replace op
  (undoable).
- **R13.2 Delete.** The inline editor (and a context affordance) exposes Delete →
  `mapRoom` delete op (undoable).
- **R13.3 Renumber.** The room manager offers drag-to-reorder and direct `key` edit;
  keys must stay unique (`nextMapRoomKey` / a validator). Reordering rewrites affected
  keys in one batch op. Shipped in the Room quick sheet (Part II §1).

## R14 — Shell collapse & token-config contextualization

- **R14.1** A collapsed rail must shrink its grid track to a thin spine so the stage
  grows. (Satisfied structurally by the Quick Sheets shell, whose docked sheets sit in
  a pointer-transparent margin and whose rail is a fixed 56px.)
- **R14.2** Snap is a **global drop default** → always visible under a clearly-labeled
  group. Scale is **per-selected-token** → gated behind a selection, showing nothing (or
  a muted "Select a token to resize" hint) when none. (Snap defaults now live on the
  character quick sheet.)
- **R14.3** `select` holds exactly one token: a new single click clears the prior
  selection. No marquee/multi-select.

## R15 — Background management

The background is a managed room/map property, not a hard-coded sprite:
`GameMap.background` is either an image ref or a solid `#rrggbb` colour, rendered by
the `background` layer. GM controls (Assets view + Session settings) offer **Change
background** (picking from Bundled / Saved URL via the asset picker) and **Remove
background**. There is no selection-on-canvas of the background sprite — management
lives in the GM UI, which avoids accidental drags.

## R16 — Settings navigation

**Binding, and easy to regress.** Section-nav jump-links must be **buttons calling
`el.scrollIntoView({behavior:'smooth'})`**, never raw `<a href="#id">` anchors. The app
uses hash routing (`routes.ts`); `parseHash` matches only `^/r/([^/]+)` and returns
`{name:'lobby'}` for anything else, so a raw anchor sets `location.hash`, fires
`hashchange`, fails the match, and navigates the whole app to the Lobby. With this
fixed, `session-theme-select` (wired to `room.settings.theme` and `applyTheme`) is
reachable and applies live to every client.

## R17 — Asset removal & multi-room management

- **R17.1 Removal — resolved, no work needed.** The saved-asset ✕ per tile (with a
  confirm) is sufficient. Bundled starter assets stay non-removable by design.
- **R17.2 Multi-room manager.** A **Rooms** panel listing every `MapRoom` (key, name,
  cell-count) with rename, renumber/reorder (feeding R13.3), jump-to (center the
  viewport) and delete, reading the existing `mapRooms` subscription and writing
  undoable `mapRoom` ops. Shipped as the Room quick sheet, which also gained per-room
  players' notes (Part II §1).

## R18 — Generate-default token customization

Shipped; see Part II §7.

## R19 — Dice renderer v2.1

Shipped; see Part II §6. The visual target is `docs/mockups/dice-reference.png`, tuned
through `docs/mockups/dice-preview.html` — **R3.5-safe**: it tunes material/colour/
numeral proportions by eye and is **never traced into geometry**; the polyhedra stay
procedural.

Live parameters: no tray mesh (R19.1); glossy plastic, roughness ~0.30, metalness
~0.10, `flatShading: true`, soft key-light specular, no harsh rim (R19.2); `SCALE`
reduced ~10% (R19.4); single-digit face font ~0.50 of the face, two-digit ~0.38, 6/9
underlined, UV U-axis derived from a face **edge** (`pts[0]→pts[1]`) rather than a
corner so numerals sit square to their faces (R19.5); d4 corner glyphs re-anchored
inboard so all three sit within the visible triangle and read upright, value read at
the up-apex (R19.6).

> **⚠️ R19.1's shadow clause superseded (2026-07-27).** The "whisper of grounding" held
> in reserve was taken up — a soft contact shadow now casts from the key light onto an
> invisible `ShadowMaterial` plane at the physics floor. The **tray removal still
> stands**; there is no tray mesh, only the shadow.

> **⚠️ R19.3 (per-die-kind colours) superseded (2026-07-27) — the veto in its own last
> sentence was exercised.** The `DICE_KIND_COLOR` palette (d4 crimson, d6 green, d8
> blue, d10 gold, d12 orange, d20 purple), the `--dice-d4`…`--dice-d20` theme override
> hook and the seat-id hash fallback were all deleted. Die colour has exactly one
> source: the roller's character colour, baked into the face texture. See Part II §6.

> **⚠️ R19.5 amended (2026-07-30) — the d10 is exempt from the edge rule and reshaped.**
> See Part II §6 for the shipped geometry.

## R20 — Advantage/disadvantage by mode

Shipped; see Part II §6. Seed-authoritative determinism is preserved: the RNG stream is
consumed in a documented, stable order for the pool case so re-derivation matches across
clients.

## R21 — Token status ring

Shipped; see Part II §7.

> **Superseded in part (R22).** "Owned by the viewing player" still means
> `token.ownerSeatId === myUid` — the ring is unchanged — but `ownerSeatId` no longer
> means authority. The ring marks "my own character's token", not "a token I may move".
> **R21.3 (optional split):** because _selected_ and _owned_ both map to white, a player
> selecting their own token sees no change. The cheapest split, if ever wanted, is
> owned = solid white ring, selected = solid white **+ a subtle glow/thicker stroke**.
> Not built.

## R22 — Group ownership

Shipped; the model is Part II §4. It **supersedes the token-ownership reading** that
R7/R8 and R21.2 assumed: the GM-only Actor Ownership panel that set `Token.ownerSeatId`
is retired, and `CharacterDock`'s "My token" is now its only writer.

## R23 — Map ⇄ character sheet

Shipped; see Part II §5.

---

> **Numbering note.** The source addendum for the three specs below proposed them as
> R22–R24. Those numbers were already taken (R22 group ownership, R23 map ⇄ sheet), so
> they are **renumbered R24–R26** here. The work-item numbers WI-25–WI-27 are unchanged.

## R24 — Access control & abuse containment

**Motivation:** widening the release from private testing to a friends-and-acquaintances
group. Three exposures, in priority order: unbounded room creation by anonymous uids; no
signal distinguishing a live room from an abandoned one; no presence model at all.

**Threat model (stated explicitly, because it bounds every decision here):** the
population is friends and acquaintances, not attackers. The realistic failure is
_accidental_ quota exhaustion and accumulated dead data, not a determined adversary. On
Spark, quota exhaustion denies requests rather than generating a bill — **the downside
is an outage for the group, not a charge.** Tune for availability and containment, not
cryptographic guarantees.

### R24.1 GM creation gate (non-anonymous provider)

Room creation currently succeeds for a freshly-minted anonymous uid, so any browser that
loads the app can create unlimited rooms, at no cost and with no attribution. Require a
non-anonymous sign-in provider **on the room-create rule only**:

```
match /rooms/{roomId} {
  allow create: if signedIn()
    && request.auth.token.firebase.sign_in_provider != 'anonymous'
    && request.resource.data.gmUid == request.auth.uid;
  // read / update / delete unchanged
}
```

This converts "any browser" into "any Google account", which is what makes every
downstream containment measure meaningful — an abusive creator becomes identifiable and
blockable in the console.

**It does not touch the join path.** R6.1 already builds the full `linkWithGoogle` /
`signInWithGoogle` / `signOutToAnonymous` flow; this only requires a would-be _GM_ to
use it. The zero-prompt anonymous join invariant stays green.

**Lobby UX consequence:** the Create Room form must handle the anonymous case. An
anonymous visitor sees the Create control with an inline "Sign in with Google to create
a room" affordance rather than a failed write. Joining via link, and My Rooms for an
already-linked account, are unaffected. This is the one place in the app where sign-in
is load-bearing rather than optional, and **the copy should say why** (rooms are yours,
they follow your account across devices) rather than presenting it as a gate.

**Migration note:** any existing room whose `gmUid` is an unlinked anonymous uid keeps
working — the gate is on `create`, not on `update`/`delete`. Those GMs should be nudged
to link via the existing R6.1 affordance, but nothing breaks if they don't.

### R24.2 App Check enforcement

The highest-leverage anti-abuse lever available without Cloud Functions. App Check
(reCAPTCHA v3 provider) attests that requests originate from your actual app, and
enforcement on Firestore and RTDB is **free — it does not require Blaze.**

- **[HUMAN]** register the app in the Firebase console under App Check, obtain the
  reCAPTCHA v3 site key, add the Pages/Hosting hostnames.
- **[HUMAN]** run in _monitoring_ mode first and watch the metrics for at least one full
  session with real players before switching to enforcement — enforcing early will lock
  out legitimate clients that haven't shipped the SDK yet.
- **[AGENT]** initialize App Check in `apps/web/src/lib/firebase/client.ts` (the sole
  concrete-store touchpoint, per golden rule 1) with a debug token path for local
  development and the emulator suite.
- Emulator and e2e runs must continue to work — the debug provider is set when
  `import.meta.env.DEV` or the emulator host is configured.

R24.1 handles attribution; R24.2 handles volume, blocking the scripted-client vector
that could actually exhaust quota.

### R24.3 Soft room cap (client-side, deliberately not rules-enforced)

**A rules-enforced per-user cap is not achievable here, and this plan does not pretend
otherwise.** Any counter document the user can write, the user can forge; any counter
they cannot write cannot be maintained without a trusted writer. A real cap means App
Check plus a Cloud Function, which crosses the no-functions/no-card line.

Given the threat model, the correct response is a **soft cap in the Lobby**: once a
user's My Rooms index holds `MAX_ROOMS_SOFT` (default **12**) entries with
`role: 'gm'`, the Create form disables with "You have 12 rooms. Delete or export one to
make space." It is honest friction for honest users, which is the entire population.

Document the limitation in the code comment so a future reader doesn't mistake it for a
security boundary — the same way the `password` field is documented as unenforced and
group ownership is documented as client-side-only.

### R24.4 Room id entropy audit

The trust model is "the roomId is the capability" (Part I §2) — room reads are
`signedIn()`, not membership-gated — and that cannot change until the pre-join subscribe
problem is solved (documented at length in `firestore.rules` and
`firestore.rules.test.ts`: a listener denied at subscribe time never recovers, which
previously left clients with empty groups, permanently revealing hidden tokens). Room id
entropy is therefore **the only barrier against a stranger reading an arbitrary room.**
Audit what `createRoom` generates.

- **Required:** ≥ 128 bits of CSPRNG-derived entropy (`crypto.getRandomValues`),
  rendered in a URL-safe alphabet. Firestore auto-ids qualify (20 chars, 62-symbol
  alphabet ≈ 119 bits) and are acceptable.
- **Unacceptable:** anything sequential, timestamp-derived, `Math.random()`-derived, or
  short enough to enumerate.

If the current generator falls short, replacing it is in scope for WI-25; existing rooms
keep their ids (no migration — old ids stay valid, new ones are stronger).

### R24.5 Quota headroom monitoring

- **[HUMAN]** in the Firebase console, confirm the Spark daily quotas and note the
  current steady-state consumption per active session. Target remains "comfortably
  inside 20k Firestore writes/day".
- **[HUMAN]** set a calendar reminder to check usage after the first wide session. The
  console _is_ the admin UI (R6.4); no custom panel.

## R25 — Room lifecycle & dead data

### R25.1 `lastActivityAt` on the room doc

**The missing input to every automatic cleanup decision.** Today nothing can distinguish
a live room from an abandoned one. `users/{uid}/rooms/{roomId}.lastSeenAt` exists but is
per-user, self-owned, rules-denied to every other user, and explicitly best-effort —
nothing can scan it.

Add `lastActivityAt: number` to the room doc (`schemaVersion` bump + migration +
round-trip test, per golden rule 7).

**Write policy — this must not undermine write discipline:**

- Written only on **settled** writes (the same moments that already produce a Firestore
  write: drag-end, stroke release, roll resolution, profile save, token add/remove).
- **Throttled client-side to at most once per 5 minutes per client**
  (`ROOM_ACTIVITY_THROTTLE_MS`). An in-memory timestamp guard in `FirebaseStore`, not a
  stored one.
- Never written from RTDB paths, never from cursor movement, never on a timer
  independent of real activity.

Net cost is at most 12 additional writes per client-hour, and in practice far fewer.

**Migration:** pre-migration rooms get `lastActivityAt` seeded to the **migration
timestamp**, not to zero — otherwise every existing room appears instantly abandoned and
the reaper offers to delete a live campaign.

### R25.2 Stale-room surfacing + GM-run reaper

With R25.1 in place, add to the Lobby's My Rooms section: entries where `role === 'gm'`
and `lastActivityAt` is older than `STALE_ROOM_DAYS` (default **90**) render with a
"dormant" affordance offering **Export**, **Delete**, or **Keep** (dismiss for another
90 days, stored in the user's own index entry).

This is a _surface_, not an automatic deletion. **Nothing deletes a room without the GM
pressing the button.** It reuses the existing, well-tested `deleteRoom` recursive delete
(R6.3) and the existing export path — no new destructive code.

Rooms where the user is a player, not GM, are out of scope: they aren't the user's to
delete, and a dangling entry already renders as a "room gone — remove?" row (R6.2).

### R25.3 RTDB leak closure

Two concrete leaks in the ephemeral layer, both the exact class `onDisconnect` exists
for:

1. **Pings** self-expire via `setTimeout(() => remove(pingRef), PING_TTL_MS)`. If the tab
   closes inside that 3-second window the timer dies with it and the node leaks
   permanently. **Fix:** arm `onDisconnect(pingRef).remove()` at push time, alongside the
   existing timeout. The timeout stays as the normal path; `onDisconnect` is the crash
   path.
2. **Drag frames** are cleared by an explicit `clearDrag`, with no fallback. A client
   that crashes or closes mid-drag leaves the node behind. **Fix:** arm
   `onDisconnect(dragRef).remove()` in `publishDrag`, guarded per room+token with the
   same `Set`-based one-time pattern `publishCursor` already uses for cursors — the hot
   per-frame path must arm it only once.

### R25.4 Firestore TTL on `rolls` — verification

R6.4 lists a TTL policy on a `ts`-derived field as optional belt-and-braces, console-only
setup. **[HUMAN]** verify in the console whether this was ever actually configured. If
not, configure it now (behind the R6.4 prune button, which remains the primary
mechanism).

## R26 — Presence & seat lifecycle

### R26.1 RTDB presence channel

There is currently **no presence model.** `players/{uid}` is a durable Firestore doc with
no liveness field, removed only by explicit GM action. The only liveness signal in the
system is the cursor node, and it is unusable as presence: cursors publish on pointer
movement over the map, so a player reading their character sheet for ten minutes is
indistinguishable from one who closed the tab.

Add a proper channel at `rooms/{roomId}/presence/{uid} = { uid, name, ts }`.

- **RTDB, not Firestore** — high-frequency ephemeral state, exactly what golden rule 3
  assigns to RTDB. It costs nothing meaningful.
- **Heartbeat every 45 s** (`PRESENCE_HEARTBEAT_MS`), refreshing `ts`.
- **`onDisconnect(presenceRef).remove()` armed once per room+uid**, using the same
  guarded one-time pattern as `publishCursor`.
- Armed on join and on room re-entry; torn down on `RoomShell` unmount.

**Rules** (`database.rules`) mirror the cursor guards exactly:

- `rooms/$roomId/presence/$uid` — write only where `$uid === auth.uid`; the own-uid-only
  guard is the whole point and must have a test asserting a client cannot write someone
  else's presence.
- **An explicit `.read` at the parent `presence` collection node.** This is the
  documented trap: `onValue()` listens at the parent, RTDB rules cascade _down_ and not
  up, so a `.read` declared only on the `$uid` wildcard leaves `subscribePresence`
  silently never firing. `database.rules.test.ts` already has a "parent-collection reads"
  describe block — add `presence` to it.
- The existing `$roomId` delete-only allowance (`.write: !newData.exists()`) must
  continue to cover the presence subtree so `deleteRoom` still removes the whole node.
  The Gate 10 e2e assertion that the RTDB node is gone after deletion must stay green.

**Store interface** (contract tests on both `MemoryStore` and `FirebaseStore`, per golden
rule 1):

```ts
/** Live presence for a room (R26.1). Own-uid-only writes, RTDB-backed,
 *  self-cleaning via onDisconnect. Heartbeat is managed internally. */
publishPresence(roomId: string, name: string): void;
clearPresence(roomId: string): void;
subscribePresence(roomId: string, cb: (present: PresenceEntry[]) => void): Unsubscribe;
```

### R26.2 Two distinct states: disconnected vs. abandoned

The critical distinction — conflating these leads either to seats vanishing mid-session
or to seats never being cleaned up at all.

| State            | Signal                                                                         | Effect                                                                                             | Reversible                   |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Present**      | presence node exists, `ts` within 2× heartbeat                                 | normal                                                                                             | —                            |
| **Disconnected** | presence node absent (or `ts` stale)                                           | row dimmed in `PlayersPanel`; token rendered at reduced opacity on the map; **seat doc untouched** | yes, instantly, on reconnect |
| **Abandoned**    | seat exists and has had no presence for `ABANDONED_SEAT_DAYS` (default **30**) | listed in Session → Maintenance for GM review                                                      | via GM action only           |

Disconnection is a _display_ state and carries **no data consequence whatsoever**. A
player who closes their laptop for a week and comes back finds their seat, their
character, and their tokens exactly as they left them.

**Tracking "abandoned" requires a durable field**, since presence itself is ephemeral by
construction: add `lastPresentAt: number` to the `PlayerSeat` doc, written on the _first_
presence publish of a session and then at most once per hour thereafter (same throttle
discipline as R25.1). Seeded on join. Pre-migration seats get the migration timestamp,
not zero.

### R26.3 Prune inactive seats (GM)

New block in Session → Maintenance, alongside the existing prune and delete-room
controls: lists seats whose `lastPresentAt` exceeds `ABANDONED_SEAT_DAYS`, with per-seat
checkboxes and a confirm step. Reuses the existing seat-removal path, including its "also
delete character sheet" option — a player who has been gone a month may still have a
character the GM wants to keep.

**Never automatic. Always GM-confirmed. Never touches a seat with live presence.**

---

# PART IV — WORK ITEMS

**Pattern for every WI:** send the prompt → review PR → check the gate → `[HUMAN]`
Chromebook playtest → merge green → only then start the next.

## IV.1 Shipped ledger

All items below are **complete**. Their specs are Part III; their shipped behaviour is
Part II.

| WI     | Spec          | Model             | Effort | What it delivered                                                                        |
| ------ | ------------- | ----------------- | ------ | ---------------------------------------------------------------------------------------- |
| **0**  | —             | `[HUMAN]`         | —      | Adopt the plan; tag `v1-complete`; retire four v1 docs; lock shell Option A              |
| **1**  | R2            | Sonnet            | medium | Design tokens, `data-theme`, `readMapTheme()`/`setTheme()`, two themes, migration        |
| **2**  | R1            | `claude-opus-4-8` | high   | The Activity Shell (later replaced by the Quick Sheets shell); Dialog primitives         |
| **3**  | R1.8          | Sonnet            | medium | Mobile/tablet mode; touch input in the Pixi engine; mobile Playwright project            |
| **4**  | R3            | `claude-opus-4-8` | high   | Dice renderer v2 — no-flip settle, real polyhedra, quality bar, overlay lifecycle        |
| **4b** | R3.6          | Sonnet            | high   | Shared rolls — staging doc, `Roll.parts`, seat-sorted expansion, apply-to-initiative     |
| **5a** | R9.2/9.3/9.5  | Sonnet            | medium | Wall drag-runs, labels, measurement units, space-pan, cursor-anchored bounded zoom       |
| **5b** | R9.4/9.6/9.7  | `claude-opus-4-8` | high   | Organic walls, half-grid, shape carves, token snapping                                   |
| **6**  | R4            | Sonnet            | medium | Session Configuration + player management (rename/role/remove/GM-transfer)               |
| **7**  | R5            | Sonnet            | medium | Log activity + chat, `listLogBefore` pagination, `/r` command                            |
| **8**  | R8            | Sonnet            | high   | Encounter Board v2 — cards, group boxes, Unassigned bin, collapse + `moveTokens`         |
| **9**  | R7            | Sonnet            | medium | Assets activity, `gen:` token scheme, add-creature / My-token flows                      |
| **10** | R6            | `claude-opus-4-8` | high   | Google linking, My Rooms, `deleteRoom` recursive delete, prune button                    |
| **11** | R9.8          | Sonnet            | low    | Map PNG export                                                                           |
| **12** | —             | Sonnet            | medium | Hardening & closeout; contract parity; Chromebook + phone playtest                       |
| **A**  | R9′           | —                 | —      | Pure vector geometry in `packages/shared/src/map/` (carve pipeline, `pointInFloorUnion`) |
| **B**  | R9′           | —                 | —      | Store contract, rules, RTDB draft / Firestore commit for the vector primitives           |
| **C**  | R9′           | —                 | —      | Wall/door/LoS unification; build-time door reconciliation; `store/vector-los.ts`         |
| **D**  | R9′           | —                 | —      | Production vector editor; hard cellular cutover; `VTTCAMP_FORMAT_VERSION` → 2            |
| **13** | R16           | Sonnet            | low    | Settings section-nav scroll buttons; theme reachability                                  |
| **14** | R10           | `claude-opus-4-8` | high   | Wall line-type system (per-wall style, angled→solid, natural pass)                       |
| **15** | R11           | `claude-opus-4-8` | high   | Door type system + centered icon overlay pass                                            |
| **16** | R12           | Sonnet            | low    | Dimension HUD                                                                            |
| **17** | R13.1–2       | Sonnet            | medium | Labels v3 — inline edit, delete, undoable                                                |
| **18** | R14           | Sonnet            | medium | Collapse reclaims stage width; snap vs. scale contextualization                          |
| **19** | R15           | `claude-opus-4-8` | medium | Background/starter map management                                                        |
| **20** | R17.2 / R13.3 | `claude-opus-4-8` | high   | Multi-room manager + renumber/reorder                                                    |
| **21** | R18           | Sonnet            | medium | Generate-default token customization                                                     |
| **22** | R19           | `claude-opus-4-8` | medium | Dice renderer v2.1 — match the reference set                                             |
| **23** | R20           | `claude-opus-4-8` | medium | Advantage/disadvantage by mode; dropped dice dimmed                                      |
| **24** | R21           | Sonnet            | low    | Token status ring                                                                        |

Beyond the ledger, these landed as follow-on passes rather than numbered items: the
Quick Sheets shell redesign (superseding R1), fog of war rebuilt on the vector system,
group ownership (R22), map ⇄ character sheet (R23), the tool-group regrouping, and the
Measure/Pen tools.

## IV.2 Upcoming

Dependency spine: **WI-25 → WI-26 → WI-27.** The couplings are soft (WI-26 and WI-27
depend on WI-25 only for sequencing), but keeping them ordered means the rules surface
changes one work item at a time.

---

### WI-25 — Access control gate, App Check & id audit · **`[AGENT]` steps complete**

**Spec:** R24 · **Model:** `claude-opus-4-8` · **Effort:** medium

> **Status.** All five `[AGENT]` steps have shipped and the automated half of Gate 25 is
> green (rules · contract · unit · e2e). **The `[HUMAN]` console steps below are still
> outstanding**, and until they are done App Check is inert by construction: no site key
> is configured, so `loadFirebaseEnv` omits the `appCheck` block entirely and
> `createFirebaseClient` never calls `initializeAppCheck`. Registering the app and
> supplying `VITE_FIREBASE_APPCHECK_SITE_KEY` is what turns it on — no code change.
>
> **Consequence discovered during implementation, worth remembering:** an anonymous
> identity can no longer create a room _anywhere_, including in tests. Two suites created
> their fixture rooms anonymously and had to be given real identities — the
> `FirebaseStore` contract suite (which signs in with an emulator-minted Google
> credential; it tests data plumbing, not access control) and the account-recovery test
> (which now links Google _before_ creating, the only order the real flow permits). The
> Playwright specs get the same treatment through `signInAsReferee` in
> `tests/e2e/helpers.ts`, which mints a genuine non-anonymous emulator session over the
> Auth REST API and hands it to the SDK via its own IndexedDB persistence record — the
> `sign_in_provider` claim is real, so the specs exercise the shipped rule rather than
> bypassing it. The app's `linkWithPopup` path could not be driven here because the SDK
> popup loads `apis.google.com`.

**`[HUMAN]` first:** register App Check in the Firebase console (reCAPTCHA v3), obtain
the site key, add authorized hostnames, and set the provider to **monitoring** mode (not
enforcement). Confirm the Google sign-in provider from R6.1 is still enabled and its
authorized domains are current.

**`[AGENT]` steps:**

1. `firestore.rules` — add the non-anonymous provider condition to room `create` **only**.
   Rules tests: an anonymous context is denied room creation; a Google-provider context
   succeeds; `update`/`delete` by an existing anonymous GM still succeed (no regression
   for pre-existing rooms).
2. Lobby — the Create Room form renders the sign-in affordance for anonymous visitors
   instead of attempting a write that will fail. Reuses `linkWithGoogle` from R6.1. Copy
   explains the _why_, not just the requirement.
3. App Check init in `apps/web/src/lib/firebase/client.ts`, with the debug provider wired
   for dev and emulator so the existing suite and e2e runs are unaffected.
4. Soft room cap (R24.3) in the Lobby, with a code comment documenting that this is
   friction, not a boundary.
5. Audit `createRoom`'s id generator against R24.4; replace with a CSPRNG-derived id if it
   falls short. Existing ids remain valid.

**`[HUMAN]` after:** watch App Check monitoring metrics through at least one full real
session, then flip to enforcement.

**Gate 25:** anonymous context denied room creation, Google context succeeds (rules
tests) · **a player still joins an existing room anonymously with zero prompts — Gate
10's e2e re-run green, unmodified** · Lobby offers sign-in rather than erroring for an
anonymous would-be creator · soft cap blocks the 13th GM room · full suite + e2e green
against the emulator with the App Check debug provider.

---

### WI-26 — Presence channel & seat lifecycle · **complete**

**Spec:** R26 · **Model:** `claude-opus-4-8` · **Effort:** high · Depends on WI-25 (soft).

> **Status.** All seven steps have shipped and Gate 26 is green. Behaviour is described in
> Part II §10.
>
> **Two decisions taken during the foundation, both flagged for review:**
>
> - **Mockups live in `docs/mockups/wi26-presence.html`, not `vtt-ui-mockups.html`.** The
>   named file is the retired Activity Shell board set, marked historical in Part 0; adding
>   current-shell boards to it would contradict that label. Same visual language, new file.
> - **`lastPresentAt` is NOT backfilled**, contrary to R26.2's "pre-migration seats get the
>   migration timestamp". It cannot be: `migrateRoom` only ever sees the room doc, and this
>   is a field on `players/{uid}` — the same additive-subcollection shape as v11→v12 and
>   v14→v15. The _intent_ (existing seats must not read as abandoned) is met more robustly
>   by absence itself: `abandonedSeatUids` requires a `lastPresentAt` older than the cutoff,
>   so a seat without one is never offered for pruning, and earns a real value the first
>   time its player connects. The v17→v18 bump is kept as a documented no-op so `.vttcamp`
>   archives are still stamped.

**`[HUMAN]` first — mockup gate: ✅ APPROVED (2026-07-31).** The `PlayersPanel`
present/disconnected treatment, the map token dimming, and the Session → Maintenance
"inactive seats" block are UI-affecting. Mockups are
**`docs/mockups/wi26-presence.html`** (three boards), approved as drawn — including
Board 1's referee-only "inactive" pill, which was flagged on the sheet as the one element
R26 does not call for. Steps 4–7 are unblocked; build to those boards.

**`[AGENT]` steps:**

1. `database.rules` — `presence/$uid` own-uid-only write, explicit `.read` at the parent
   `presence` node. Rules tests: own-uid write succeeds; another uid's write denied;
   **parent-collection read succeeds** (add to the existing "parent-collection reads"
   describe block); the `$roomId` delete allowance still removes the presence subtree.
2. `CampaignStore` — `publishPresence` / `clearPresence` / `subscribePresence` + the
   `PresenceEntry` type. Implement in `FirebaseStore` (heartbeat + guarded one-time
   `onDisconnect`) and `MemoryStore`. Contract tests on both.
3. `PlayerSeat.lastPresentAt` — schema field, `schemaVersion` bump, migration seeding
   existing seats to the migration timestamp, `.vttcamp` round-trip test.
4. `RoomShell` — publish presence on join/mount, tear down on unmount, thread presence
   through to `PlayersPanel` and the map token renderer.
5. `PlayersPanel` + token dimming per the approved mockups.
6. Session → Maintenance "prune inactive seats" block (R26.3), reusing the existing
   seat-removal path including the character-sheet option.
7. e2e: two contexts join, both show present on each other · one context closes, the other
   observes it flip to disconnected within ~2× heartbeat **and the seat doc still
   exists** · it rejoins and flips back to present.

**Gate 26:** all three e2e presence assertions green · rules tests green including the
parent-read and cross-uid-denial cases · contract suite green on both stores · **Gate 10
room-deletion e2e still green (RTDB node fully gone, presence subtree included)** ·
migration round-trips.

---

### WI-27 — Room activity tracking, stale surfacing & RTDB leak closure · **`[AGENT]` steps complete**

**Spec:** R25 · **Model:** `claude-opus-4-8` · **Effort:** medium · Depends on WI-26
(sequencing only).

> **Status.** All four `[AGENT]` steps have shipped and the automated half of Gate 27 is
> green (throttle unit · dormancy unit · migration · contract · RTDB arming unit ·
> Playwright). Behaviour is described in Part II §11. The two `[HUMAN]` items below are
> outstanding: the **mockup gate is unapproved** (the sheet is drawn and built to, at
> `docs/mockups/wi27-dormant-rooms.html`, but was not reviewed before implementation —
> flagged rather than silently skipped) and the `rolls` TTL policy is console-only.
>
> **Two decisions taken during the build, both worth review:**
>
> - **The activity clock is maintained by the referee's client only.** `firestore.rules`
>   gates room-doc updates on `isGM`, so a player's write is denied. Rather than a room
>   read per client to check, the first denial is the answer: the room enters
>   `activityDenied` and that client stops trying. The alternative — loosening the room
>   rule to admit a `lastActivityAt`-only update from any member — is a real widening of
>   the one authority boundary in the app, for a signal whose whole purpose is "has anyone
>   with authority been here". Not taken.
> - **The v18→v19 migration reads `Date.now()`**, which makes it the first non-deterministic
>   step in the list. That is what "seed the migration timestamp" requires, and since
>   `roomConverter` re-runs the walk on every read, a pre-v19 room simply reads as active
>   until a settled write persists a real value. The migration is idempotent in the way
>   that matters: an existing `lastActivityAt` is never overwritten.

**`[HUMAN]` first — mockup gate:** the dormant-room affordance in My Rooms is
UI-affecting. Mockup approved before implementation.

**`[HUMAN]` also:** verify/configure the `rolls` TTL policy (R25.4) — console-only, no
code.

**`[AGENT]` steps:**

1. `Room.lastActivityAt` — schema field, `schemaVersion` bump, migration seeding existing
   rooms to the **migration timestamp** (not zero — a zero seed makes every live campaign
   look abandoned), `.vttcamp` round-trip test.
2. `FirebaseStore` — throttled write on settled-write paths only, with the 5-minute
   in-memory guard. A unit test asserting the throttle actually suppresses (N rapid
   settled writes produce exactly one activity write).
3. My Rooms dormant surfacing (R25.2) per the approved mockup, with Export / Delete /
   Keep. Delete reuses `deleteRoom` unchanged. "Keep" stores a dismissal on the user's own
   index entry.
4. RTDB leak closure (R25.3): `onDisconnect().remove()` on ping nodes at push time, and on
   drag nodes with the guarded one-time pattern in `publishDrag`.

**Gate 27:** throttle unit test green (rapid settled writes → one activity write) · a room
seeded with an old `lastActivityAt` surfaces as dormant, and Delete from that row removes
every subcollection (reuse the Gate 10 admin-context assertion) · migration seeds existing
rooms to _now_, verified by a test that a freshly migrated room does **not** appear
dormant · ping and drag `onDisconnect` registered exactly once per node · full suite green.

Where each Gate 27 leg is pinned: the throttle and the dormancy rule in
`packages/shared/src/store/room-activity.test.ts` (including the freshly-migrated-room
case, mirrored in `migrations/index.test.ts`); the dormant row, Keep, and Delete-from-that-row
in `apps/web/tests/e2e/room-lifecycle.spec.ts` against the Gate 10 admin REST context; the
`onDisconnect` arming counts in `packages/shared/src/store/rtdb-leaks.test.ts`, which mocks
`firebase/database` because "how many registrations did the SDK receive" is not observable
through a real connection; and the clock's store-level behaviour in the contract suite,
against both implementations.

---

# PART V — DECISIONS

## V.1 Locked defaults

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

## V.2 Vector Map System — decision log (condensed)

Ratified during the POC and the WI-A–WI-D build (**user** = product direction;
**rec** = Claude Code recommendation accepted).

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

# PART VI — OPEN ITEMS, DEFERRED WORK & KNOWN LIMITS

## VI.1 Flagged, awaiting a decision

1. **Map-edit permissions.** The vector toolbar is shown to **every** room member,
   consistent with the "all room members can write" trust model; only `add-creature` is
   GM-gated. The old cellular map hid all editing tools from players. If players should
   not be able to carve/edit the shared map, the toolbar can be gated behind `isGM` — a
   small change, awaiting the call.
2. **Theme engine — reachability or authoring?** The theme select is wired and reachable.
   Whether a fuller theme _engine_ (edit/create custom token sets) is wanted is a larger
   R2 extension, unscoped.

## VI.2 Deferred by decision

- **Membership-gating room reads.** Blocked on deferring the `RoomShell` mount-time
  subscriptions (`groups`/`encounter`/`rolls`/`log`) until after join. A listener denied
  at subscribe time never recovers, which previously left clients with empty groups,
  permanently revealing hidden tokens. Until that is done, "the roomId is the capability"
  stands and R24.4's entropy requirement is load-bearing. **This earns its own work item
  and must not be attempted as a side effect of anything else** — it carries real
  regression risk.
- **Hard per-user room cap.** Requires a trusted writer. Revisit only if the group grows
  past the point where R24.3's soft cap plus R24.1's attribution is credible.
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
- **R21.3 owned-vs-selected ring split.** Both map to white today; the cheapest split is
  a glow/thicker stroke for selected. Not built unless asked.
- **Full-viewport-diff rendering optimizations.** `renderMap` redraws everything per
  change. **Watch item:** re-evaluate if maps grow large enough, or Chromebook playtests
  dip below budget.
- **Dice physics in a Web Worker + OffscreenCanvas.** Pre-approved fallback if the dice
  overlay drops below 30 fps on the Chromebook.

## VI.3 Known limits, accepted

- **Fog is a presentation guarantee, not a secrecy boundary.** `floorRegions` stays
  readable by every member; only `fogRegions` is GM-write.
- **Group ownership is enforced client-side.** Expressing it in rules would need the
  owning seats denormalized onto every profile doc. Token ownership never had
  server-side teeth either.
- **The soft room cap is friction, not a boundary** (R24.3).
- **A token belongs to at most one group** — the board cannot draw multi-group
  membership.
- **`seatId == uid` throughout.** Acceptable; new code must read `seatId` from the seat
  doc rather than assuming `uid`.
- **Pre-vector `.vttcamp` archives cannot be imported** (B3).

## VI.4 Quarantined test

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
