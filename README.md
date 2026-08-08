# OSR VTT

A browser-based virtual tabletop (VTT) for OSR/tabletop RPGs. Serverless on Firebase
(Spark tier) — no custom backend.

This file is the **project overview**: what it is, where things live, how the pieces
work together, and how to develop on it. It is written so you can orient without
reading anything else first.

---

## Where the documentation lives

A set of documents replaced the single `docs/VTT_Master_Plan.md`. The four largest are
**indexes over per-entry files**, so a session reads one entry rather than one corpus:

| File                | Holds                                                        | When to read it                        |
| ------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `RULES.md`          | Hard rules (`RULE-001`+). Binding on every change, forever   | Always — loaded into every session     |
| `CLAUDE.md`         | Agent workflow, reading budget, model routing                | Always — loaded into every session     |
| `README.md`         | This file. Project overview and the system as it stands      | Orienting; before touching a subsystem |
| `SPEC.md`           | Spec index → `docs/spec/SPEC-nnn.md`                         | When a work item cites a spec          |
| `PLAN.md`           | Upcoming and in-flight work items                            | Before starting any change             |
| `INTAKE.md`         | Intake triage (§1.1 open, §1.2 closed)                       | Triaging or classifying a request      |
| `DECISIONS.md`      | Open and Postponed in full; Closed index → `docs/decisions/` | A design decision is touched           |
| `PLAN-COMPLETED.md` | Completed-item index → `docs/completed/WI-nnn.md`            | Reviewing a closed work item           |

**Read by section, never whole.** No file over ~300 lines should be read entire — grep
for the id, then read that range. This is a token-budget rule as much as a style one.

**When `README.md` and `SPEC.md` disagree about present-day behaviour, `README.md`
wins.** `SPEC.md` is a record of intent at the time each item was specified; this file
is the descriptive half — what shipped and how it behaves _now_.

**If a requirement is not in these documents, it is not a requirement.** (The Master
Plan said "not in this document"; the document set inherits the claim jointly.)

### Provenance

`docs/VTT_Master_Plan.md` was itself a consolidation. It replaced five documents,
which remain in git history:

| Retired document                 | Where its content lives now                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `VTT_Master_Plan_v2.md`          | Parts I–II (invariants), III (R1–R9), IV (WI-0–WI-12), V (locked defaults) |
| `VTT_Master_Plan_v2_addendum.md` | Part III (R10–R23), Part IV (WI-13–WI-24)                                  |
| `VectorMapSystem_Spec.md`        | Part II §4 (current map system) and R9′ in Part III                        |
| `VectorMapSystem_Decisions.md`   | Part V §2 (vector map decision log, condensed)                             |
| `ShellUIRedesign.md`             | Part II §5 (current shell) and R1′ in Part III                             |

The Master Plan's own text is archived verbatim at
`docs/archive/VTT_Master_Plan.ORIGINAL.md`, which is immutable (RULE-020). The `R`-spec
numbers it used map onto the current `SPEC-` numbers via the crosswalk at the top of
`SPEC.md`.

**Companion assets — all under `docs/mockups/`:**

- `mockups/vtt-ui-mockups.html` — Activity Shell boards (SPEC-001, pre-redesign; historical)
- `mockups/vtt-ui-mockups-addendum-c.html` — Addendum C boards 1–11 (SPEC-011–SPEC-022)
- `mockups/dice-preview.html` — interactive dice-renderer preview (SPEC-020 tuning)
- `mockups/dice-reference.png` — the dice visual target (SPEC-020)
- `mockups/wi26-presence.html` — presence boards (WI-026)
- `mockups/wi27-dormant-rooms.html` — dormant-room boards (WI-027)

---

## Repo map

- `apps/web` — the app. Svelte 5 + Vite, PixiJS v8 for the map canvas, Firebase
  (Firestore/RTDB/Auth), Rapier3D + Three.js for dice physics, Yjs for
  collaborative notes.
- `packages/shared` — framework-agnostic logic: the `CampaignStore`/`AssetStore`
  abstractions and their Firebase/in-memory implementations, schemas, map
  geometry, dice, encounter, rules, tables, portability (`.vttcamp`).
- `firebase/` — `firestore.rules`, `firestore.indexes.json`, `database.rules.json`.
- `docs/` — `docs/mockups/` and `docs/archive/`.
- pnpm workspace (`pnpm-workspace.yaml`): `packages/*` + `apps/*`.

There is **no `poc/` directory**. A prior Vector Map System POC lived there during
design; it graduated wholly into `packages/shared/src/map/vector/` and
`apps/web/src/lib/{components/VectorMapView.svelte,map/vector-*.ts}`, and the
scaffold was deleted. A comment or old branch referencing `poc/vector-floor/...`
is a historical pointer to "Map system — vector" below and the vector-map decision log
in `DECISIONS.md`, not a live path.

## Dev commands

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

# The system as it stands

Descriptive, authoritative for present-day behaviour. Section numbers in parentheses
are the Master Plan Part II numbers, retained so existing citations resolve.

## Session shell — quick sheets (II.1)

The shell is **one full-screen main view plus independently toggled quick sheets
layered over it**, with Log and Session settings as modals. It replaced the SPEC-001
Activity Shell (four rails + one stage).

**Main views** (`MAIN_VIEWS`, `apps/web/src/lib/shell/activities.ts`) — exactly one
on stage:

| id          | availability |
| ----------- | ------------ |
| `map`       | all          |
| `encounter` | all          |
| `assets`    | **gm**       |

**Quick sheets** (`QUICK_SHEETS`) — independent open/closed toggles:

| id          | group     | availability | body                                                                                                                                                                         |
| ----------- | --------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maptools`  | `world`   | all          | `MapToolPalette`                                                                                                                                                             |
| `character` | `records` | all          | `CharacterDock` + editable name header (the seat's `displayName`, own-seat-or-GM only) + colour picker (six swatches + a custom picker; **no Clear** — SPEC-031) + quick d20 |
| `roll`      | `play`    | all          | die buttons that **stage** a die, the staged pool + Roll button, tray controls, saved macros; `DiceTray` (custom dice, shared rolls, macro creator) when expanded            |
| `room`      | `referee` | all          | `RoomsPanel` — selected room docked, full list expanded                                                                                                                      |
| `tables`    | `referee` | **gm**       | `TableRunner` — import/roll random tables                                                                                                                                    |

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

`ShellState.railSide` (`'left' | 'right'`, persisted) moves the whole rail (56px on a
precise pointer, 66px on a coarse one — see "Layout and input" below) —
and with it the docked sheet column and the stage's `--sheet-gutter-*` — to either
edge. The control is a handle: click to flip, or drag to a half of the viewport.

The rail shows the **current** activity's icon, not all three tabs. Hovering it (or
clicking, which pins it) slides out `shell/ActivityDrawer.svelte`: a translucent,
blurred panel (`color-mix` + `backdrop-filter`, so the stage stays readable)
carrying the full `MainViewTabs` list in a `drawer` variant — icon _and_ label,
since being readable is the point — plus the rail-move handle. Selecting a view,
Escape, or the pointer leaving closes it. The panel flips with `railSide`;
`.rail-left`'s `overflow` is `visible` so it can escape the rail column.

Motion follows the house pattern: plain CSS keyframes with a
`prefers-reduced-motion: reduce` escape (as in `DiceOverlay`), not Svelte
transitions — the shell uses none.

Mobile has no rail; the bottom tab bar shows every main view at once.

### Viewport, touch and safe areas (SPEC-033 §§1–3)

The app frame (`.shell` desktop, `.mshell` mobile, and `App.svelte`'s wrapping `main`)
sizes against `100dvh`, the **small** viewport — the one with a mobile browser's URL bar
collapsed — with a `100vh` fallback for browsers that don't support `dvh`. A bare `100vh`
anywhere in that ancestor chain makes the document taller than what's on screen, so it
scrolls and the bottom-pinned mobile chrome (chip rail, tab bar) rides out from under the
bar; `overscroll-behavior: none` on `html`/`body` additionally stops a drag that misses a
scrollable pane from rubber-banding the whole document. The frame itself never scrolls —
scrolling belongs to the panes inside it.

The Pixi map host (`.vf-canvas-wrap`) declares `touch-action: none`, so the map's own
pan/pinch/drag (`map/pan-zoom.ts`, on the stage's federated pointer events) never races
the browser's native touch gestures.

`index.html` declares `viewport-fit=cover`; the mobile activity bar
(`mobile-activity-bar`) pads its bottom edge by `env(safe-area-inset-bottom)` (its grid
row grows by the same amount, so the inset doesn't shrink its tap targets), and `.mshell`
pads its left/right edges by `env(safe-area-inset-left/-right)` for landscape notches.

### Layout and input are two signals (SPEC-033 §7)

**Screen width picks the layout. Pointer coarseness picks the hit-target size. They are
independent and are never read as one boolean.** So a touchscreen laptop runs the desktop
shell with touch-sized controls, an iPad runs the desktop shell in landscape and the
mobile shell in portrait, and a phone is unchanged. (Before WI-067 a single
`'(max-width: 899px), (pointer: coarse)'` query switched the whole shell on either
condition, so the first two both ran the phone layout with most of the screen unused.)

`shell/layout.svelte.ts`'s `createShellMedia()` watches the two queries separately:

| Signal            | Query              | Decides                                                          |
| ----------------- | ------------------ | ---------------------------------------------------------------- |
| `isNarrow`        | `max-width: 899px` | which shell renders — `.mshell` or `.shell`                      |
| `isCoarsePointer` | `pointer: coarse`  | touch _behaviour_ (SPEC-033 §4, not yet built) — no consumer yet |

`RoomShell` reads `isNarrow` and only `isNarrow`, and passes it to `ShellState`'s
`isSheetOpen` / `toggleSheet` / `expandSheet` — the one-sheet-at-a-time bottom-sheet state
machine belongs to the mobile _layout_, not to touch input.

Hit-target **sizing** needs no JS at all: `theme/sizing.css` declares three tokens and
bumps them under the same `(pointer: coarse)` query, and the shell frame reads them.

| Token          | Precise | Coarse | Used by                                                                                                                                                                                                                                 |
| -------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--hit`        | 34px    | 44px   | rail toggles, rail view tabs, and the desktop grid's rail column (`--hit + 22px`) and top/bottom bar rows (`--hit + 10px` / `+ 6px`)                                                                                                    |
| `--hit-inline` | 18px    | 34px   | quick-sheet header buttons, the bottom bar's Log button, the drawer's rail-move handle — applied as a **floor** (`min-*`), never a size, and the precise value sits below every guarded row's natural height, so it binds only on touch |
| `--hit-gap`    | 8px     | 10px   | spacing between adjacent hit targets                                                                                                                                                                                                    |

The precise-pointer values are the sizes as shipped, so a mouse-driven desktop is
pixel-identical: the frame's former `56px` / `44px` / `40px` / `38px` literals are now
`--hit` offsets that evaluate to exactly those numbers. Panel bodies, the map toolbar and
dialog internals keep their own sizing — a bounded scope, additive to widen (DEC-054).

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

## Map system — vector (II.2)

The map view is `apps/web/src/lib/components/VectorMapView.svelte` (rendering:
`apps/web/src/lib/map/vector-engine.ts`; tool logic:
`apps/web/src/lib/map/vector-tools.ts`; pure geometry:
`packages/shared/src/map/vector/`). It is the **only** map view — the cellular map,
its chunked storage, `MapView` and `map/engine.ts` were deleted in the WI-D cutover.

### Data model

**One coordinate space: cell-lattice units, floats** (RULE-006).

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
  on floor. Full rationale and the rejected Model B: `docs/decisions/vector-map-log.md`.
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
   one polygon. The four **cell-anchored** tools (Room, Corridor, N-gon, Carve) capture
   raw lattice points and snap inside `buildFloorStroke`; every other tool captures
   points already snapped to lattice vertices. See § "Tools" for why.
2. **Buffering** (freeform only). Raw pointer path → offset polygon at brush radius.
   `polygon-clipping` provides no offsetting, so this is `bufferPolyline` +
   Douglas-Peucker (see `packages/shared/src/map/vector/OFFSET-SPIKE.md`).
3. **Boolean combine.** New polygon unioned (carve) or subtracted (fill / interior
   rock hole) against existing `FloorRegion`s whose `bbox` overlaps. If a stroke
   fully bisects a region, the difference op **naturally splits** it into two — a
   normal boolean outcome, not a special case.
4. **Simplification.** Douglas-Peucker at a per-tool tolerance on **every** commit, not
   periodically — unbounded vertex growth is the primary long-session perf risk.
   0.10–0.15 lattice units reads visually clean while cutting 25–35% of vertices. Since
   WI-059 (SPEC-028 §10), that per-tool policy is a ceiling, not the number actually used:
   `boundedTolerance` caps it at a quarter of the stroke's own governed width — a
   tolerance wider than a ⅛-cell band would prune it to a sliver — and forces exactly 0
   for a Path/Corridor band under Cell or Half snap, whose axis-aligned rectilinear
   geometry has nothing to prune.
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
- **Symbol** and **Label** both floor to the cell (or half-cell) the pointer is
  actually inside — `anchorCellFor`/`snapCell` — rather than rounding to the nearest
  grid vertex, and both honour the active snap mode (IN-014: Symbol used to hardcode
  a whole-cell floor regardless of Half/Free).
- **Carve** is the freehand brush: the snap level picks its shape (Cell/Half paint
  whole lattice cells, Free buffers the sampled polyline), committing through the
  unchanged `commitCarve` pipeline, so carve modes, undo and simplify apply as usual.
  Cell-anchored like Room/Corridor/N-gon/Path (WI-042, SPEC-028 §2): each raw sample
  anchors to the centre of the cell it's inside before the brush radius test, so the cell
  under the pointer always paints. Since WI-051 took the Path grid-true, Carve is the
  **only organic floor tool** — knowingly (DEC-032).

Three tools carry a fixed option set rather than a number input (SPEC-028). **N-gon**
offers Circle · 3 · 4 · 5 · 6 · 7 · 8, defaulting to **Circle**; above 8 a polygon
reads as a circle anyway. **Corridor and Path** share one width set — ⅛ · ¼ · ½ · 1 · 2
(`BAND_WIDTH_OPTIONS`, the `band-width` select) — and its default follows the snap mode,
½ under Half and 2 under Cell and Free, resetting whenever the mode changes
(`MapToolController.setSnapMode`). Only **Carve** keeps the free-form `Width`
(`map-width`), where an arbitrary ribbon is the point.

**Sub-tile widths are centred in the tile** (SPEC-028 §7, DEC-032). A snapped band's low
edge is `snapCellCenter - width / 2` with no further quantization, so `width = ½` under
**Cell** snap is a half-wide passage with a quarter-cell of rock either side, while
`width = ½` under **Half** snap fills the pointed-at half-tile edge to edge. Those two
used to collapse onto each other.

Snap/freeform is a **per-stroke input modifier, not a property of the shape type**.
One shared abstraction — a vertex/point stream with a per-point snap decision —
feeds the same polygon-emission → buffer → boolean-combine → simplify pipeline
regardless of primitive:

| Primitive                                             | Snapped                                                                                                                                           | Freeform                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Room** (rectangle)                                  | **Whole cells**, both end cells inclusive; a click with no drag is 1×1                                                                            | Corners follow raw pointer                                          |
| **Corridor** (L-shaped)                               | **Centred on the pointed-at cell**; legs run anchor to anchor, whole cells only at the two terminal ends; first leg follows the latched drag axis | Legs follow drag angle, width fixed; first leg latched the same way |
| **Path** (skinny interior carve or exterior corridor) | **The Corridor's band, one leg per click-pair**: centred in the pointed-at cell, capped at the gesture's two ends only                            | Raw pointer per point, round caps; double-click to complete         |
| **Polygon** (irregular)                               | Vertices snap to grid intersections                                                                                                               | Raw pointer per vertex; double-click to close                       |
| **Regular polygon (n-sided)**                         | **Centred in the pointed-at cell**; across-flats diameter and face orientation snap                                                               | Centre/diameter/angle freeform; **n=1 degenerate = circle**         |

**Cells, not intersections** (SPEC-028). Room, Corridor, N-gon, Carve and Path are
_cell-anchored_: they receive raw lattice points and do their own snapping through
`snapCellCenter` / `snapAngle` / `snapSpan`, because which cell the pointer is in is not
recoverable from a point already rounded to the nearest vertex — that rounding crosses a
cell boundary for three quadrants out of four. `snapPoint` remains correct, and
unchanged, for Wall and Door (whose geometry runs _between_ intersections) and for
Polygon (whose gesture is placing corners).

**Terminal ends are capped; interior ends are not** (SPEC-028 §9, WI-061). A snapped
Corridor or Path leg spans **cell centre to cell centre**, and is pushed out to the far
edge of its end cell only where that end is one of the gesture's two _terminal_ ends. An
_interior_ end — one that meets another leg — stops dead on the shared anchor, and
`cornerBlock` carries the turn from there. Extending every end (the rule WI-051 shipped
and DEC-046 withdrew) made each leg of a bend overshoot the other by `(step − width) / 2`,
which at width ⅛ under Cell snap sprayed floor 0.4375 cells into all four cardinals from
one corner, and left the inside and outside corners as staircases of boolean seams rather
than one vertex each. A straight run has no interior end, so it is unchanged: its flat
caps still land on grid lines and its length still grows a cell at a time. **Floor already
committed is not migrated**, so a long-lived map can visibly hold both shapes.

**The Corridor's bend follows the drag** (SPEC-028 §11, WI-062). Its first leg — the one
that starts where the gesture started — runs along the axis the drag first commits to,
rather than always being the horizontal one. The axis is **latched**: the first time the
drag travels `BEND_LATCH_LATTICE` (half a cell, in lattice units — never pixels, so zoom
cannot change it) further along one axis than it has along the other, that axis is fixed
for the rest of the gesture, however the pointer moves afterwards. Drag east then north
and the corridor runs east then north; drag north then east and it runs north then east.
Before the latch there is nothing to place — both endpoints are still in the same cell —
and a gesture that never latches (a click with no drag, or a perfectly diagonal one) gets
the historical horizontal-first shape. It has to be latched rather than derived, because
the same two endpoints must be able to produce either L, and a corner derived from the
current endpoints flips across the diagonal as the pointer moves. `corridorPoly` takes the
axis as an argument (`firstAxis`); `latchBendAxis` is the rule; `VectorMapView` holds the
state per gesture and drops it on pointer-up. The live ghost is built from the same call
as the commit, so it always shows the L that will land.

The N-gon's drag vector carries three things at once: the cell it starts in is the
centre, its length is the radius **across the flats** (so a snapped polygon sits flush
inside whole cells), and its direction is where one flat face points — snapped to the
cardinals under Cell, the eight compass points under Half, raw when Free.

**The targeted-cell indicator.** Room highlights the cell (half-cell) under the
pointer — a faint fill plus outline in the same `snapCursorColors` palette as the snap
dot, so it reads as floor or rock depending on the carve mode. It follows the pointer
_before_ any button is pressed. Absent under Free snap, and absent for the N-gon and
Carve, both of which anchor to a cell but extend well past it. The snap dot itself sits
on whichever anchor its tool actually uses. Readout: `snap-cell-readout`.

**The Corridor/Path band indicator** (SPEC-028 §6, WI-052) replaces the whole-tile
highlight for those two tools: with `BAND_WIDTH_OPTIONS` reaching below the snap step
(⅛, ¼), "the tile you're pointing at" and "the area that will actually be carved" stop
being the same rectangle, so the indicator draws the band instead —
`targetedBandFor`/`targetedBandRect`, on exactly the lines `bandLo`/`cornerBlock` give
the committed shape. Under Cell/Half snap it's the width×width square centred in the
tile (coinciding with the tile exactly at width 1); under Free snap — where Room's
indicator has nothing to show — it's a circle of the chosen width, matching the round
cap a free-snap Path produces, so Corridor/Path always have an indicator once the
pointer has been anywhere. Drawn instead of, not alongside, the whole-tile highlight;
the snap dot is suppressed under it the same way it is under `cursorCell`. Readout:
`snap-band-readout` (`x,y @size` for the rect, `⌀ size` for the circle).

While a click-and-drag shape is being dragged, a dimension chip
(`strokeMeasureText` → `ToolPreviewInput.measure`) shows `w × h` in the map's
`RoomMeasure` units, or `⌀` for the N-gon; it reports the shape that will **commit**,
not the distance dragged, so under snap a drag inside one cell still reads `1 × 1`. It
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

> **✅ Ratified (user, 2026-08-02):** the vector toolbar is shown to **all** room
> members, and is not GM-gated. **Collaborative player mapping is an intended goal**,
> not a side effect of the trust model — a change that would restrict a player's access
> to the carve tools contradicts a stated aim. Only `add-creature` and the fog controls
> stay GM-gated. See `docs/decisions/DEC-001.md`.

**Edit/View soft lock** (IN-031), beside Undo/Redo. `MapToolController.mapMode`
(`'edit' | 'view'`) is per-viewer client state, not a store write — flipping it does
**not** resolve DEC-001. `View` disables every tool button outside the `view` group
(`isViewTool`, `map/tool-groups.ts`) and, if a carve/edit tool was active, forces the
active tool back to Pan so a stray click can't finish a stroke that was already armed.
Undo/Redo and the View-group tools (Pan/Eye/Measure/Ping) stay live under View —
reversing a change you already made isn't the accidental edit this guards against.

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
reveals from it automatically remains open (`DECISIONS.md` → Postponed); the storage
shape supports adding it without a migration.

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
deliberate, ratified exception to RULE-007, which governs changes _within_ the
vector schema.)

## Encounter board (II.3)

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

A named group's (expanded) card row also ends in its own "+" card
(`board-add-creature-{groupId}`, GM-only): it opens the same creature picker as the
map toolbar's Add creature, but adds the picked creature(s) straight into _that_
group instead of leaving them unassigned. No map camera exists on the board, so the
spawn position reuses the map toolbar's starter-drop staircase. The synthetic
Unassigned bin does not get this card.

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

## Group ownership (II.4)

Authority is a property of the **`Group`**, not the token.
`Token.ownerSeatId` survives meaning only "which character profile this token shows"
— what makes card selection, roll shortcuts, initiative slots, the SPEC-022 status
ring's "owned" branch and "My token" work — and confers nothing. The model lives in
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

**Enforcement is client-side.** `canActOnActor` — `canSeatActAs` plus the seatless case
below — decides whether the sheet renders
editable; `firestore.rules` gates `profiles/{seatId}` on room _membership_ (loosened
from own-seat-or-GM, with tests). Expressing group ownership in rules would need the
owning seats denormalized onto every profile doc, since a group holds token ids and a
character is a seat. Token ownership never had server-side teeth either, so this gives
up no guarantee that previously held.

### Profiles are keyed by an actor, not a seat (SPEC-032 §2, schema v21)

`rooms/{roomId}/profiles/{actorId}` takes an **actor id**, which is either a **seat
id** (a character) or a **token id** (a creature). Creatures reuse the room's existing
`profileTemplate`; `encounterTemplate` cannot serve, being one instance per _room_
(`Encounter.values`) rather than per actor. `ProfileInstance.seatId` is accordingly
named `actorId` — a field that only ever exists in memory, since it is the document id
that `profileInstanceConverter` strips on write and restores on read.

Three consequences worth knowing:

- **Nothing on disk changed at v21.** The key space widened: every pre-v21 document is
  seat-keyed, and a seat id is still a valid actor id. The v20→v21 migration is a no-op
  that exists to stamp `.vttcamp` archives.
- **`deleteToken` deletes `profiles/{tokenId}`** in the same batch as the token. A
  creature's profile is _owned_ by its token rather than merely referenced by it, so
  without this it leaks on every deletion with no key left to reach it by — the
  collection-enumeration duty the vector cutover's M2 imposed on `deleteRoom`. A
  character's profile is never at risk: no token id is a seat id.
- **`firestore.rules` is unchanged**, deliberately. `profiles/{seatId}` is already
  member-writable rather than own-seat-only, so a token-keyed document in the same
  collection is governed correctly already — the decisive argument for widening this
  collection rather than adding a second one. The rule's `{seatId}` wildcard now names
  an actor id; the wildcard is a local label and binds nothing.

### Ownership for a seatless actor (SPEC-032 §3)

`canSeatActAs` resolves a character by finding a group that lists me **and** holds a
token linked to the target seat. A creature has no seat for that inner test to find, so
`ownership.ts` gains two token-keyed siblings — not a replacement, since a character is
still reached through its seat:

- `actorIdForToken(token)` — the key rule in one place: `ownerSeatId` when there is one,
  the token's own id when there is not.
- `canActOnToken(groups, tokens, mySeatId, tokenId, isGM)` — the §3 predicate. A token
  with an owning seat defers to `canSeatActAs` on that seat; a **seatless** one asks the
  shorter question, **is this token in a group I own**. The motivating case is an NPC
  travelling with the party, in the group and owned by no one player.
- `canActOnActor(groups, tokens, mySeatId, actorId, isGM)` — the same rule keyed by what
  the selection spine actually carries. An actor id counts as a creature's only when a
  seatless token answers to it; everything else, an unknown id included, goes to
  `canSeatActAs`, which keeps "a seat may always act as itself" true for a seat holding
  no token yet.

A token that is **both seatless and ungrouped** — scenery, and the lone creature
`addCreature` leaves ungrouped — matches no ownership rule and is therefore
**referee-only** (DEC-036). That falls out of the rule rather than being special-cased.

**Selection is actor-keyed (SPEC-032 §4).** `onSelectActor(actorId)`,
`RoomShell`'s `selectedActorId`/`dockActorId` and the board's `selectedActorId` all take
an actor id, and `dockReadOnly` asks `canActOnActor`. Two things follow the key rather
than the seat: `PlayerSeat.currentCharacterSeatId` is **never written for a creature** —
it means "the seat whose character this player is currently playing" and has no reading
for a seatless actor, so selecting one is view state (SPEC-032 §4) — and a card's
`selected` highlight compares `actorIdForToken(token)`.

**Every card is selectable (SPEC-032 §4, WI-056)** — a creature's included, and on the
same terms a character's already was: selectability was never ownership-gated (any
member could open a foe's sheet read-only), so a creature drops the `ownerSeatId` gate
rather than gaining a narrower one. `CharacterDock` (its `seatId` prop renamed to
`actorId`) branches on whether a seatless token answers to that id: a creature has no
`resolveCharacterColor` guarantee (DEC-042, its swatches start unselected), no "My
token" action, and its header falls back to `creatureLabel` — the same id-derived name
`EncounterBoard`'s own card uses — since it has no seat `displayName`.

**Map drag is gated on `canActOnToken` (SPEC-032 §5, WI-057).** The check sits inside
`attachDragHandlers`'s `pointerdown`, which closes over live `tokens`/`groups` state and
so re-evaluates on every press — no sprite-cache invalidation needed when group
membership changes. Selection stays unconditional: a token this seat may not act on is
still picked (its ring/sheet still raise), it simply does not move — `tokenDragging`
never starts, so the subsequent move/up handlers no-op. `syncSprites` mirrors the rule
in the cursor (`grab` when the drag would work, `pointer` when it would not; `eventMode`
stays `static` either way, since selection needs the pointer events too). An ungrouped,
seatless token — scenery, and the lone creature `addCreature` leaves ungrouped — matches
no ownership rule and is **referee-only** (DEC-036), a capability removal from the
previously-ungated behaviour.

## Map ⇄ character sheet (II.5)

Selecting a token on the map raises that character's sheet, exactly as clicking their
card on the Encounter board does — `VectorMapView` takes the same
`selectedActorId`/`onSelectActor` pair the board does and fires it from the token
sprite's `pointerdown` (already the selection moment, so there is no
click-versus-drag discrimination). Readout: `selected-actor`, which holds a seat id
for a character and a token id for a creature.

Dragging the sheet's portrait (`dock-portrait`) onto the map places that character's
token where it is released: the token hides for the duration
(`mapCtrl.sheetDragTokenId` → `hiddenTokenIds`), the pointer carries a translucent
copy of the portrait (`setGhostImage`), and the drop snaps through the same
`snapTokenPosition` / `snapModeFromModifiers` call an on-map drag uses. A character
with no token yet gets one created at the drop point.

This is the **only DOM drag-and-drop on the map** — all other map input is Pixi
federated pointer events, which a DOM drag never reaches, hence the `DataTransfer`
payload in `apps/web/src/lib/tokens/drag.ts`.

## Dice (II.6)

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
  picked. **Every character always has a colour** (SPEC-031, schema v20): one is assigned
  at random from `CHARACTER_COLOR_PALETTE` when the seat is created, and a seat that
  predates the rule — or has no profile document at all — resolves through
  `assignedCharacterColor(seatId)`, a deterministic pick from the same palette, so every
  client agrees without anything being written. `--dice-face` survives as the neutral for
  a die with **no seat behind it**; no _character_ can reach it any more, and the quick
  sheet's **Clear** button went with the unset state it returned to. The guarantee is
  scoped to **characters** and stays there (SPEC-032 §2, DEC-042): a token-keyed creature
  profile carries a colour only if one was stored, exactly as `Token.color` does.
  `resolveCharacterColor` therefore takes a seat id, not any actor id.
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

## Tokens, assets & theming (II.7)

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

## Log, session config & accounts (II.8)

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
6. **Maintenance danger zone** — prune old entries, delete room, and (per SPEC-026 /
   SPEC-027) the inactive-seat prune.

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

**Creating a room requires a non-anonymous account** (SPEC-025 §1, shipped). The Firestore rule
gates `rooms/{roomId}` **create** on `request.auth.token.firebase.sign_in_provider !=
'anonymous'`; `read`/`update`/`delete` are untouched, so a pre-existing room whose `gmUid`
is an unlinked anonymous uid keeps working. The Lobby renders a sign-in invitation
(`create-room-signin-gate` / `create-room-signin`) in place of the Create form for an
anonymous visitor, rather than letting a write fail. **Joining is untouched and still
promptless.** A soft cap of `MAX_ROOMS_SOFT = 12` GM-role My Rooms entries disables the
Create button (`create-room-cap`) — client-side friction, explicitly not a boundary.

**App Check** (SPEC-025 §2) is wired but **off unless a reCAPTCHA v3 site key is configured**.
`createFirebaseClient` takes an optional `appCheck` block and initializes App Check
before any Firestore/RTDB handle exists; `loadFirebaseEnv` supplies it only when
`VITE_FIREBASE_APPCHECK_SITE_KEY` is set, and adds the debug provider for emulator/dev
runs. That default is what keeps zero-setup dev, the emulator suite and Playwright
working against a project with no App Check registration.

**Room ids** are Firestore auto-ids — 20 chars over a 62-symbol alphabet, ≈119 bits of
CSPRNG entropy — which satisfies SPEC-025 §4. Since the roomId is the capability, this is
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

## Presence & seat lifecycle (II.10)

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
status ring (SPEC-022) keeps its full weight and colour, so "whose token is this" and "is that
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

## Room lifecycle & dead data (II.11)

Rooms carry an activity clock — `Room.lastActivityAt` (v19, SPEC-026 §1) — written **only** from
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

**Dormant surfacing** (SPEC-026 §2) lives on the Lobby's My Rooms rows, per
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

**RTDB leak closure** (SPEC-026 §3): `publishPing` arms `onDisconnect().remove()` per pushed
node (each ping is its own `push()` id, so there is nothing to de-duplicate) alongside
the existing `PING_TTL_MS` timeout — the timeout is the normal path, `onDisconnect` is
the crash path. `publishDrag` arms it guarded per room+token in `dragDisconnects`, the
same one-time pattern `publishCursor` and `publishPresence` use, because it is a
per-frame path.

New testids: `my-room-dormant-{roomId}`, `my-room-dormant-export-{roomId}`,
`my-room-dormant-delete-{roomId}`, `my-room-dormant-keep-{roomId}`.

## Test culture (II.9)

Vitest units, Firestore rules tests, `CampaignStore` contract suite run unmodified
against both implementations, Playwright two-context e2e with stable `data-testid`s,
CI green-gate. A hidden **e2e introspection readout layer** mirrors Pixi canvas state
as queryable DOM: `token-pos-*`, `token-size-*`, `token-current-*`, `token-ring-*`,
`collapsed-group-*`, `maproom-name-*`, `floor-region-count`, `wall-count`,
`door-count`, `drawing-count`, `last-batch-move-count`, `selected-actor`,
`measure-readout`.

`tests/e2e/helpers.ts`'s `openActivity()` keeps its old call signature and maps each
legacy activity id onto wherever its panel now lives; it dismisses any open backdrop
first and opens the activity drawer before reaching for a main-view tab
(`openActivityDrawer` / `closeActivityDrawer`, no-ops on mobile). It also carries
`claimOwnToken()` (a seat gives itself a token from its own sheet, the only
token→profile link left) and a `createGroup()` written onto the promote-then-drag-back-out
flow, plus `vectorCarve` (`vector-tool-room` + drag).

**`signInAsReferee(page)` (SPEC-025 §1)** — call it **instead of `page.goto('/')`** in any spec
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
