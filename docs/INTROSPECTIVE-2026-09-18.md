# Project introspective — 2026-09-18

A whole-project review of OSR VTT at commit `d176331` (WI-137 closed, nothing queued).
Four lenses, as requested: user experience, architecture, next steps against comparable
products, and the development process itself.

**Who this is for.** A planning session (`/work-item`, `opus`) that will turn findings into
intake items and work items. Every finding carries a stable id (`INT-xx-nn`) so an `IN-nnn`
row can cite it, a proposed intake classification in the project's own vocabulary
(Simple / Deceptive / Investigation, per `CLAUDE.md` → "Deceptive triggers"), a suggested
model target, and the evidence it rests on. Findings are observations, not decisions:
nothing here clears a gate.

**What was read.** `RULES.md`, `CLAUDE.md`, `SPEC.md`, `PLAN.md`, `INTAKE.md` §1.1, the
workflow commands and hooks, both CI workflows, `README.md` in full by section, the store
contract, the shell and map components, the engine, the rules files, the test configs, and
the last 50 merged PRs with their CI runs. No emulator or browser was run: `node_modules`
is not installed in this sandbox, so bundle sizes are quoted from `README.md`'s own
measurements (WI-089) rather than re-measured.

**Line references** are to `d176331` and will drift.

---

## 0. Executive summary

The project is unusually well-engineered for its size: a clean store abstraction proven by
a contract suite across three backends, one coordinate space per map enforced by types, a
vector floor model with sound geometry, migrations for every schema step, 1,278 unit tests
and 100 Playwright flows, and a documentation corpus that records *why* every decision was
made. The risks are the flip side of those strengths.

The ten findings most worth scheduling, in rough order of leverage:

| #   | Finding                                                                                                                         | Lens         | Id                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------ |
| 1   | A first-time referee lands on a blank grid with an icon-only rail and no cue about what to do next; there is no onboarding path | UX           | INT-UX-01, INT-UX-02     |
| 2   | Map-related configuration is split across three surfaces (Assets view, Session settings modal, Map tools sheet)                 | UX           | INT-UX-05                |
| 3   | `VectorMapView.svelte` is 4,095 lines with 42 call sites of a full-scene `renderAll()`; every change redraws every layer        | Architecture | INT-AR-01, INT-AR-03     |
| 4   | `CampaignStore` is ~150 methods × 3 implementations × a 3,318-line contract; every feature pays that three times                | Architecture | INT-AR-02                |
| 5   | The dice renderer (three.js + Rapier WASM) ships in the main chunk; no code splitting anywhere                                  | Architecture | INT-AR-06                |
| 6   | CI takes 28–35 min per PR because 100 e2e tests run serially on one worker with 2 retries                                       | Process      | INT-PR-04                |
| 7   | Every completion summary exists in four places; `PLAN.md` is 1,128 lines with nothing queued                                    | Process      | INT-PR-01, INT-PR-02     |
| 8   | The chain costs two sessions and ~30 min of CI for a 22-line CSS fix; Simple items need a batch lane                            | Process      | INT-PR-03                |
| 9   | No token vision / automatic reveal, no UVTT import, no image upload on Spark, no multi-token select                             | Next steps   | INT-NX-01 – INT-NX-04    |
| 10  | The create-room form stores a plaintext `password` that is readable by any signed-in user and never enforced                    | UX / trust   | INT-UX-13                |

---

## 1. User experience

### 1.1 The first-run walkthrough

What a new person actually meets, traced through the code rather than the docs.

**A new referee.**

1. Lobby (`Lobby.svelte`): a heading, an account control, a sign-in gate ("Sign in with
   Google to create a room"), a Join field. Clean. The gate copy is good.
2. Create room → `navigateToRoom` → `RoomShell`. The GM's own seat is *not* auto-created:
   the referee sees the same "Display name / Join room" gate a player sees
   (`RoomShell.svelte:556–571`). A referee who just typed a room name is asked to join it.
3. After joining: the Map view with `map-loading` then a blank square grid.
   `MapToolController.mapMode` defaults to `'view'` (`map-tool-controller.svelte.ts:140`),
   every quick sheet is closed (`shell-state.svelte.ts:22`), the rail shows **only the
   current view's icon** (README → "Rail, drawer and rail side") and the other two views are
   behind a hover-drawer. The six quick-sheet toggles are icon-only with a `title`
   tooltip (`QuickSheetRail.svelte:33`) — on touch there is no tooltip at all.
4. Nothing on screen says "open Map tools and switch to Edit to draw", "add a map
   background in Assets", or "invite players from the top bar". The `?` shortcut sheet is
   the only in-app help and it is not advertised.

**A new player.** The invite link works and the join gate is one field — RULE-011 is
honoured well. After joining, the player has no token and no character. Their character
sheet is the second rail icon; nothing says so. The Encounter view is empty. Their first
meaningful action (claim a token from the sheet, `my-token`) is two undiscoverable steps
deep.

**Assessment.** The shell is well-built for someone who already knows it — persistent
layout, keyboard digits, mobile parity, presentation mode — and unfriendly to someone who
does not. The redesign optimised for a clear stage and paid for it in discoverability.

### 1.2 Findings — discoverability

**INT-UX-01 — No onboarding or empty states.** *Investigation → Simple items.* `sonnet`.
There is no first-run tour, no empty-state copy on a blank map or an empty Encounter board,
and no sample room. A bundled `maps/sample-dungeon.dd2vtt` fixture exists
(`apps/web/src/lib/assets.ts:23`) but nothing imports it. Suggested shape: (a) an
empty-map hint card that appears until the map has floor or a background ("Draw with Map
tools · Add a background in Assets · Invite players ↗"), dismissable, persisted in
`ShellState`; (b) an empty-board hint; (c) a "Show me around" entry in the `?` sheet.
Adds `data-testid`s only — not a Deceptive trigger.

**INT-UX-02 — The referee's own seat is not created on room creation.** *Simple* (calls
existing `joinRoom`). `haiku`/`sonnet`. `createRoom` in `Lobby.svelte:222` navigates and
the referee is then asked to join their own room. The local build already auto-seats
(`RoomShell.svelte:~330`, `joinRoom(roomId, 'Referee')`); the hosted build should seat
the creator with the display name from their account (or prompt for one *on the create
form*, not after).

**INT-UX-03 — Icon-only rail with hover-only navigation.** *Simple.* `sonnet`. The rail
hides two of three main views behind hover (`ActivityDrawer`) and the six sheet toggles
carry no visible label. Options, cheapest first: show all three view icons in the rail
(the drawer then only holds the rail-move handle); add a first-visit label reveal
(labels shown beside icons for the first N seconds or until first interaction); a
persistent "labels on" toggle in `ShellState`. RULE-005: existing testids stay.

**INT-UX-04 — The Edit/View lock defaults to View on every session.** *Simple*, but
opinionated — needs the user's call. The default was deliberately flipped to `'view'`
(README → "Edit/View soft lock", reversing WI-053). Every referee now flips it every
session, and a first-time referee does not know the lock exists (the palette renders with
every drawing tool disabled and one small `map-mode-toggle`). Two cheap improvements that
keep the safe default: persist the choice per room in `ShellState`, and when a disabled
tool is clicked under View, show a one-line "Switch to Edit to draw" hint instead of
nothing.

**INT-UX-05 — Map configuration lives in three places.** *Investigation → Simple
consolidation.* `sonnet`. A referee configuring one map visits: the **Assets** main view
(create/rename/switch/delete maps, backgrounds, background colour), the **Session
settings** modal (grid w/h, cell size, half-grid, measurement unit, fog on/off), and the
**Map tools** sheet (snap, simplify, export). Fog is on/off in Settings but revealed via a
carve-mode dropdown value on five shape tools in the sheet. Grid and fog are per-map
properties displayed under a session-wide modal. Suggested end state: a **Map** panel
(in Assets or as the expanded Room sheet) holding every per-map property; Session settings
keeps only room-wide config. Testid moves are a RULE-005 trigger, so the consolidation
itself is Deceptive; the investigation is not.

**INT-UX-06 — Play-time surfaces hidden inside configuration.** *Simple.* `sonnet`.
Handouts — a play-time action (reveal an image to the table) — are a section of the
GM-only Session settings modal (`SessionActivity.svelte:643`). Party notes are the second
tab of the Log modal. Random tables are a quick sheet. Three "referee prep/play" features,
three different homes. Handouts belong beside Tables in the referee quick-sheet group, or
in the Room sheet's expanded view.

**INT-UX-07 — Occasional actions only exist in the expanded sheet.** *Simple.* PNG
export and **Add creature** render only when the Map tools sheet is expanded
(`MapToolsSheet.svelte`, `expanded` prop). "Add creature" is the referee's most common
play-time action on the map and is unreachable from the docked palette. The board's `+`
card partly compensates, on a different view.

**INT-UX-08 — Two words for two different "rooms", and two words for the referee.**
*Simple*, copy only. The **Room** quick sheet (`activities.ts:23`) is about *map rooms*
(labels and per-room notes); "Room" in the Lobby, Session settings and the top bar is the
campaign room. UI copy uses both "Referee" and "GM" (`join-gate`, `roleLabel`,
`isGM`-driven strings). Rename the quick sheet ("Areas"/"Locations"/"Labels") and pick one
word for the referee in user-facing text.

**INT-UX-09 — No tool hotkeys.** *Simple.* `sonnet`. The canvas keyboard handler
(`VectorMapView.svelte:3557`) knows Ctrl+Z, Enter, Escape, Backspace and Alt. Every
comparable product has single-key tool switching (V select, H pan, R room, W wall, D door,
M measure, E eye, P ping…). Add the keys to `TOOL_GROUPS` so the palette, the shortcut
sheet and the handler read one catalog.

### 1.3 Findings — competing functionality

The question was whether there is more than one way to do a task and whether choosing one
blocks the others. Multiple entry points are mostly fine here; the blocking cases are the
concern.

**INT-UX-10 — Five ways to roll, one of which blocks the other four.** *Investigation.*
Roll sheet, the character sheet's quick d20, card roll chips on the board, `/r` in chat,
and the table runner. During a Call for Initiative every die control outside the call
disables (WI-136, SPEC-050 §3) — including the referee's, so a wandering-monster check or
a reaction roll cannot be made until the call resolves or is cancelled. That was a
deliberate decision (DEC-097 (b)); it should be revisited once played: a call that stays
open while a player is away from keyboard locks the table's dice. A softer rule —
disable only staging-eligible controls, or auto-resolve after a timeout with unstaged
seats defaulted — is worth a decision entry.

**INT-UX-11 — Two snap settings on two sheets.** *Simple* (copy/placement). The map
tools' snap selector (`map-snap-mode`, Map tools sheet) governs drawing; the token snap
selector (`token-snap-mode`, Character sheet, `CharacterDock.svelte`) governs token drops.
They are different settings by design (README: "Token snap-mode defaults live on the
character quick sheet, not the map toolbar") but nothing tells the user that, and the
Alt-modifier override is undiscoverable. At minimum, label the token control "Token
snap" with a hint; better, show it in the Map tools sheet too as read-only context.

**INT-UX-12 — Hex authoring has two paths per field.** Terrain is painted by Select +
`HexTilePanel` swatch *or* the `hexTerrain` click tool; the note is edited by Select +
panel *or* the `hexLabel` tool. Not blocking, and each path is justified in the docs,
but the palette shows both without saying they write the same thing. Group them visually
("Paint" row vs "Inspect" row) — *Simple*.

**Expanded-sheet exclusivity** (one expanded sheet globally) and the **battle map's
tool subset** are intentional and read well. The Edit/View lock is covered by INT-UX-04.

### 1.4 Findings — missing or weak

**INT-UX-13 — The room password is stored in plaintext, readable by anyone, and never
checked.** *Deceptive* (touches the join path and rules; RULE-011/012). `opus`. The create
form says "stored for later, not enforced yet" (`Lobby.svelte:409`); the value is written
onto the room doc (`firebase-store.ts:299`), which every signed-in user may read
(`firestore.rules:60`). Either remove the field until a design exists, or design the
feature under RULE-012 (a join secret cannot be enforced by rules without a Cloud
Function; the honest version is "the roomId is the capability", which the project already
states). Recommendation: remove the field and the `Room.password` schema field with a
migration, and add a DEC entry closing the door.

**INT-UX-14 — Undo is asymmetric.** *Deceptive* (changes what undo means). Floor, fog,
wall and door edits are on the undo stack; symbol/label/door/drawing *deletes* are not
(README → "The selection model"); token moves and group changes are not; the stack lives in
`VectorMapView` and is discarded on map switch (`VectorMapView.svelte:625`, `{#key}`
remount). Users expect Ctrl+Z to undo the last thing they did. A room-scoped undo service
with entity ops (move token, delete object) is the professional baseline.

**INT-UX-15 — No multi-token selection or group move outside a collapsed group.**
*Deceptive* (selection model, SPEC-037). The lasso collects vertices and objects, never
tokens. Moving a party means dragging each token or collapsing the group. Shift-click and
lasso for tokens, with `moveTokens` (already batched) on release.

**INT-UX-16 — Loading, error and offline states are minimal.** *Simple.* "Loading room…"
and "Loading map…" are the only states; a wrong room id renders "Loading room…" forever
(`RoomShell.svelte:~552`, `room === null`). No Firestore offline persistence is enabled
(no `persistentLocalCache` anywhere), so a dropped connection blanks live data. Add a
not-found state, a reconnecting banner, and consider `persistentLocalCache` for the hosted
build (a RULE-009 reading question — it is a cache, which the local-build amendment
explicitly does not admit for *that* build; the hosted build is unconstrained).

**INT-UX-17 — Mobile: the Map tools palette is the most control-dense sheet and is a
half-height bottom sheet.** *Investigation.* 50 interactive controls in `MapToolbar` on a
phone. Worth a playtest before design.

**INT-UX-18 — Versioning and feedback.** *Simple.* `package.json` is `0.0.0` (IN-073
already open); there is no in-app version, changelog or "report a problem" affordance.

---

## 2. Architecture review

### 2.1 What is working and should be protected

- **The store abstraction is real.** `CampaignStore` + contract suite across
  `MemoryStore`, `FirebaseStore`, `LocalStore` (RULE-001). The local build proves it: a
  whole second product with zero Firebase in the bundle.
- **Coordinate discipline.** RULE-006, phantom-branded `Axial`/`HexPoint`/`Point`
  types, and the thirds lattice are excellent decisions with tests behind them.
- **Model A floors.** Baked union, boolean ops, per-commit simplification, atomic batch
  commits, build-time door reconciliation. Correct and bounded.
- **Write discipline.** RTDB for per-frame, Firestore for settled (RULE-003), presence
  and drag cleanup via `onDisconnect`.
- **Test culture.** Contract suite, rules tests, e2e introspection readouts. Zero
  TODO/FIXME markers in the source tree.
- **Mechanics-agnostic guard** (RULE-002) enforced by a test.

### 2.2 Subsystem integration and structure

**INT-AR-01 — `VectorMapView.svelte` is the whole map application in one component.**
*Investigation → Deceptive refactor series.* `opus` for the plan. 4,095 lines, ~25
subscriptions, ~30 `$effect`s, 42 `renderAll()` call sites, and every concern of the map:
tokens (sprites, rings, letters, badges, drag), selection, backgrounds, collab
(cursors/pings/drafts), hex tools, labels and tooltips, fog, export, keyboard. The
comments repeatedly warn about the reactive/imperative boundary ("`renderAll` must NOT
write reactive state", "plain local: see `strokeMeasure`'s declaration for why this must
not be reactive"). That is the symptom of many `$effect`s driving one imperative engine.

The file already has the seams — its section comments are the module boundaries. A
low-risk path: extract plain-TS controllers that take the engine and store as arguments
and expose `invalidate()`:

| Extract              | From (approx. lines)        | Owns                                                        |
| -------------------- | --------------------------- | ----------------------------------------------------------- |
| `TokenLayer`         | 1081–1860                   | sprites, rings, letters, badges, drag, texture cache        |
| `SelectionGesture`   | 2064–2320                   | handles, lasso, object drag, delete                         |
| `BackgroundGesture`  | 3100–3190                   | pick/move/resize, alignment grid                            |
| `CollabPresenter`    | 2989–3060, 3190–3265        | cursors, pings, drafts (multiplayer only)                   |
| `HexAuthoring`       | 2587–2935                   | hex pick, symbol/line/terrain/label tools                   |
| `LabelTooltip`       | 2656–2990                   | label editor, hover/pinned tooltip, note dot                |

Each extraction is Deceptive only if it moves a `data-testid`; most would not. Do it
one controller per work item, starting with `TokenLayer` (the one IN-113 already
names).

**INT-AR-02 — The store interface is fat and every feature pays for it three times.**
*Investigation → Deceptive.* `opus`. ~150 methods on `CampaignStore`; `FirebaseStore`
2,208 lines, `MemoryStore` 2,027, the contract 3,318. Twenty-odd `subscribeX` methods are
the same three lines with a different collection name and converter
(`firebase-store.ts:1048`, `:1435`). `MemoryStore` already has the generic primitive
(`ReactiveCollection`, `memory-store.ts:141`); `FirebaseStore` does not.

Two options, not exclusive:

1. **Generic collection primitive in `FirebaseStore`** — `collectionOf<T>(path,
   converter)` returning `{ subscribe, set, remove, batch }`; the per-collection methods
   become one-liners. Cuts ~800 lines with no interface change (Simple in contract terms:
   the shape and guarantees stay).
2. **Split the interface by domain** — `RoomStore`, `MapStore`, `EncounterStore`,
   `DiceStore`, `PresenceStore`, `CollabStore`, composed into `CampaignStore`. The
   contract suite splits the same way, so a hex feature runs the map contract, not the
   whole battery. RULE-001 says "the shared contract" and would read naturally as "the
   shared contract suites"; check whether it needs an amendment before committing.

**INT-AR-03 — Full-scene redraw on every change, including per frame during a drag.**
*Deceptive* (render pass). `opus`. `renderAll()` (`VectorMapView.svelte:3604`) redraws
grid, hex layers, scene, doors, overlay, annotations, fog, alignment and the tool
preview every call. During a vertex drag it also rebuilds the LoS scene
(`activeDrag ? buildVectorScene(...)`), i.e. `perimeterSegments` + door clipping per
pointer-move. The engine's per-layer methods are already separate; what is missing is
dirty tracking. Suggested shape: a `MapRenderer` with `invalidate(layer)` and one
`requestAnimationFrame`-coalesced flush; the `$effect`s call `invalidate('floor')` rather
than `renderAll()`. The bench harness from WI-122 (`apps/web/bench/`) is the place to
measure before/after. Expected win: large on big dungeons and on Chromebook-class GPUs
(the stated budget); the fog `Graphics.cut()` and the rounded-corner floor path are the
expensive pieces.

**INT-AR-04 — Once-per-room-open backfills are a second migration system.**
*Deceptive* (migrations, RULE-007). `opus`. Three GM-side effects in `RoomShell`
(`ensureActiveMap`, `migrateMapBackgrounds`, `migrateTokenLetters`) each read a whole
subcollection on every room open because "the signal is an absent field, invisible from a
room-doc update" (`RoomShell.svelte:~355–380`). That is N token reads + M map reads per
open, forever, and a fourth such effect is one schema bump away. Consolidate into a store
method `migrateRoomCollections(roomId)` driven by a `Room.collectionsMigratedTo` version
stamp on the room doc, so the walk runs once per room per version and the room-doc
version walk (`migrateRoom`) and the collection walk share one ledger.

**INT-AR-05 — Yjs state is one RTDB node holding the whole merged doc, rewritten per
update.** *Investigation.* `mergeYUpdate` (`firebase-store.ts:1970`) runs an RTDB
transaction that base64-decodes the entire stored state, merges, re-encodes and writes it
back — per local edit, per client. Cost is O(doc size) per keystroke and the transaction
serialises writers. For party notes it is fine today; with all room notes in one doc
(`room-notes`, by design) a long campaign's notes make every keystroke rewrite the whole
history. Options: append updates to a list node and compact periodically (the standard
y-provider shape), or snapshot + tail. Measure first: a 50 KB doc at 10 edits/s is the
threshold to test.

**INT-AR-06 — No code splitting; the dice renderer ships in the main chunk.** *Simple*
(build config). `sonnet`. `vite.config.ts` has no `manualChunks` and the source has no
dynamic `import()`. README's own numbers: main chunk 4.38 MB hosted, 3.62 MB local. Three.js,
Rapier (WASM), Pixi, Firebase and Yjs all load before a player sees the join gate. The
dice scene (`dice/scene.ts`, `geometry.ts`, `textures.ts`) is only needed on the first
roll; the hex catalog and terrain art only on a hex map; the tables/handout panels only
for the referee. Dynamic-import the `DiceOverlay` renderer and the hex art loader first;
add a bundle-size assertion to CI beside the Firebase-strip grep (IN-071).

**INT-AR-07 — Security-rule reads are billed per write.** *Investigation, low.*
`isGM()` and `isMember()` each cost a document read per evaluated write
(`firestore.rules:16–24`). On Spark (50k reads/day) that is a meaningful share of a
session's budget once four players are dragging tokens and drawing. Not wrong, but the
project should have a measured reads/writes-per-session number in `README.md` so RULE-003's
"comfortably inside 20k writes/day" is a fact rather than an intent. A one-off
instrumentation run against the emulator (`firebase emulators:exec` with the Firestore
emulator's request log) would produce it.

**INT-AR-08 — ~25 live listeners per client per room.** *Investigation, low.* Nine in
`RoomShell`, up to fourteen in `VectorMapView` (hex maps add three), plus per-panel
subscriptions. Correct, but every map switch tears down and re-establishes twelve of
them and pays each collection's initial snapshot again. Fold into INT-AR-07's
measurement.

**INT-AR-09 — The e2e introspection readout layer lives in the production component.**
*Simple.* Dozens of hidden DOM mirrors (`token-pos-*`, `token-letter-readout`,
`selection-count`, …) are rendered by `VectorMapView` for Playwright. Accepted design, but
it grows with every feature and is shipped to every user. Gate it behind
`import.meta.env.VITE_E2E_READOUTS` (on in dev/test, off in production) or move it to a
`window.__vtt` debug object the specs read via `page.evaluate`.

### 2.3 Technology decisions

- **Svelte 5 + Pixi 8 + Firebase + Yjs + three/Rapier** — all current, all justified.
  No blocker. The only heavy choice is the physics dice; keep it, lazy-load it
  (INT-AR-06).
- **Firebase Spark as the hard constraint** shapes the biggest product gaps (no uploads,
  no server, capability-by-roomId). It is a deliberate choice, documented in RULE-009/010.
  See INT-NX-03 for what can still be done inside it.
- **No offline cache** (INT-UX-16).
- **pnpm workspace, Vitest, Playwright, Prettier, ESLint** — fine. No pre-commit hook;
  the agent runs `pnpm verify` instead, which is the right trade for this workflow.
- **Hash routing** — right for static hosting on two targets.

### 2.4 Consolidation opportunities (scattered infrastructure)

**INT-AR-10 — Three "which snap/anchor" vocabularies.** `SnapMode` (tokens,
`tokens/drag.ts`), `VectorSnapMode` (tools, `map/vector/snap.ts`), and the hex snap
(`'hex'` added to both). SPEC-028 §2 lists three anchor families. A single `snap.ts` that
answers `snapFor(kind, mode, point)` for tokens and tools alike would remove the
per-caller switch statements and the two selectors' drift (INT-UX-11).

**INT-AR-11 — Label/name resolution is in five places.** `creatureLabel`,
`creatureDisplayName`, `tokenLabel`/`refLabel` (`encounter/labels.ts`, WI-137),
`resolveCharacterColor`/`assignedCharacterColor`, `letterStyleFor`. Each was added by a
work item that needed one answer. One `actorPresentation(actor, players, groups)` returning
`{ name, letter, color, portrait }` would give every surface the same answer.

**INT-AR-12 — Migration knowledge is split across `migrations/index.ts`, converters,
`vttcamp.ts`, and `RoomShell` effects.** Covered by INT-AR-04.

**INT-AR-13 — Dialogs: `PromptDialog`, `ConfirmDialog`, `TokenPickerDialog`, the
shortcut `dialog`, and `ShellOverlay` (log/session) are three different modal mechanisms**
(`DialogService`, `ShellState.dialog`, `ShellState.overlay`). One modal stack with focus
trapping and Escape ordering would replace the hand-rolled priority in `onGlobalKey`
(`RoomShell.svelte:~470`).

### 2.5 Accreted functionality with poor discoverability

Already itemised as INT-UX-05 (map config), INT-UX-06 (handouts/notes/tables),
INT-UX-07 (expanded-only actions), INT-UX-12 (hex dual paths). One more:

**INT-AR-14 — The Room quick sheet and the map label tool are the same feature from
two ends.** Map rooms (labels) are created on the canvas with the Label tool and
managed in the Room sheet (rename, renumber, reorder, delete, notes) with its *own*
undo stack (`RoomsPanel.svelte:83`), separate from the map's. A user who deletes a label
on the canvas (Backspace, not undoable) and one who deletes it in the sheet (undoable in
the sheet's stack) get different behaviour for the same operation.

---

## 3. Next steps — the product against its peers

Comparable products in the "lightweight, rules-agnostic, browser VTT" band: Owlbear Rodeo
2, Shmeppy, Tableplop, Alchemy, Let's Role, and Foundry/Roll20 as the heavyweight
reference. OSR VTT's distinctive strengths against them are: the vector carve tools (no
peer has "draw the dungeon live at the table" this well), the hex crawl with Worldographer
art, the seed-authoritative 3D dice, the mechanics-agnostic profiles, the `.vttcamp`
portability and the local build. Those are the things to keep leaning into.

What players of those products will notice is missing, ordered by how much it matters
for an OSR table:

**INT-NX-01 — Token vision / automatic fog reveal.** *Deceptive* (fog storage and the
render pass). `opus`. Every peer with fog now reveals it from token positions; here the
Eye tool is a manual referee preview and "derive reveals from it automatically" is in
`DECISIONS.md` Postponed. The storage shape already supports it (README → "Fog of war"):
each player-owned token becomes an eye; `visibilityPolygon` per token per move, unioned
into `fogRegions` on drag-end (one settled write, RULE-003-clean). Light radius as a
profile-independent token property (`Token.vision: { radius }`) keeps RULE-002 intact —
the app draws what a token can see, it interprets nothing.

**INT-NX-02 — UVTT / Dungeondraft import.** *Deceptive* (adds `imported` walls, a new
input path). `opus`. The data model already reserves `source: 'imported'`
(README → "Walls, doors, LoS") and a `.dd2vtt` fixture is bundled, but no importer exists
(`SAMPLE_UVTT_REF` is referenced only in `assets.ts`). Importing walls, doors and the
image from a `.dd2vtt`/`.uvtt` is the single most-requested feature in this product
category and would make the vector LoS immediately useful on pre-drawn maps. The image
half depends on INT-NX-03.

**INT-NX-03 — Small-image storage inside Spark.** *Deceptive* (schema, rules, store).
`opus`. Uploads are gated on Blaze (SPEC-034). But a token portrait compressed client-side
to a 96×96 WebP is ~6–15 KB, and a Firestore document holds 1 MB. A
`rooms/{roomId}/images/{id} = { bytes: <base64>, mime, w, h }` collection with a rules
size check (`request.resource.data.bytes.size() < 200000`) gives every table token art
and small handouts with no Storage, no billing and no Cloud Function — inside RULE-009
and RULE-010 as written. Backgrounds stay by-URL (too large). Per-write containment is
enforceable in rules; aggregate isn't (RULE-010 §1), which is the same position the
project already accepts.

**INT-NX-04 — Multi-token select and move; token undo.** INT-UX-14 and INT-UX-15.

**INT-NX-05 — Conditions / status markers on tokens.** *Deceptive* (`Token` schema).
`sonnet` after a schema decision. A referee-defined list of markers (`room.settings
.conditions: [{ id, label, icon, color }]`) and `Token.conditions: string[]`, drawn as
small badges. No interpretation, no duration ticking — RULE-002-safe. Every peer has this.

**INT-NX-06 — Whisper / GM-only chat and roll visibility.** *Deceptive* (rules,
`gmPrivate`). Hidden rolls exist; private messages do not. `/w` to the referee writing
into `gmPrivate` mirrors the hidden-roll path exactly.

**INT-NX-07 — Path measurement and drag distance.** *Simple.* The Measure tool is a
single span. A multi-click path (total distance) and a live distance chip while dragging
a token are small additions on existing `measureSpanText`.

**INT-NX-08 — Text on the map.** *Simple.* `Drawing.kind === 'text'` renders
(`vector-engine.ts:2043`) but no tool writes it. A text tool in the Overlay group is a
few dozen lines.

**INT-NX-09 — Fog on hex maps.** *Deceptive* (hex space). Fog is square-lattice only;
hex crawls — the genre's exploration mode — have no unexplored state. Per-hex
`revealed` on `HexTile` is the natural shape and needs no polygon math.

**INT-NX-10 — Player-facing scene handoff.** *Simple.* When the referee switches the
active map every client follows (correct), but there is no "you are now on: Map name"
toast. Cheap, and it closes a real confusion during play.

**INT-NX-11 — A demo room and a tutorial map.** INT-UX-01. Peers ship a sample scene;
this project already has the assets (starter map, sample dungeon fixture, two tokens, two
tables).

**INT-NX-12 — Accessibility and localisation baseline.** *Investigation.* Focus rings
and ARIA names are already there; contrast on `parchment-dark` and `keyed-blue` has not
been measured, and every string is inline. A `strings.ts` extraction is mechanical
(`haiku`) and unblocks translation later.

Out of scope for the stated intent, and correctly so: audio, video, rules automation,
character-sheet compendia, marketplaces, module systems.

---

## 4. Development process

### 4.1 What the process does well

The chain (intake → triage → spec → decision → gate → execute → summary → PR) produces a
record that a reviewer can audit months later, and it has clearly prevented the class of
"why is this like this" debt most solo projects accumulate. SPEC-035's cost model (weight ×
context × turns) is the right frame, and its mechanisms — `pnpm verify` quiet on success,
the `line` reporter, no CI polling, model routing, section reads — are all correct.
Velocity is real: 110 work items closed between 2026-08-01 and 2026-09-17, one PR per
item, CI green on 49 of the last 50 runs.

### 4.2 Where the cost goes

**INT-PR-01 — Every completion summary is written four times.** *Simple* (docs only,
one work item). `haiku`/`sonnet`. A closed item's summary exists in `docs/completed/WI-nnn.md`
(the record), as a "**WI-nnn has now run and closed**" paragraph in `PLAN.md` §2, as a
row in `PLAN-COMPLETED.md` §3, and as a prose cell in `INTAKE.md` §1.2 — plus the commit
message and the README delta. `PLAN.md` is 1,128 lines / 86 KB (~21k tokens) with
**nothing queued**; `/work-item` reads it whole. `INTAKE.md`'s two index tables alone
are 105 KB (~26k tokens) before the per-item prose begins, and `/work-item` reads both.
A planning session therefore starts ~50k tokens deep, on `opus`, before reading a spec.

Suggested rule, one line: *a fact has one home.* `docs/completed/WI-nnn.md` is the
record; `PLAN.md` §2 holds only open items (a closed item's paragraph is deleted when the
file is written); `PLAN-COMPLETED.md` and `INTAKE.md` §1.2 rows are one line each — id,
title, date, link. Apply it retroactively in one mechanical pass (RULE-019 is untouched:
no id disappears, only duplicated prose).

**INT-PR-02 — Prose density.** *Process decision.* The house style writes rationale
everywhere: README paragraphs restate the DEC, the DEC restates the spec, the WI restates
all three, and code comments restate the WI (e.g. `HEX_TOOL_IDS`'s 60-line doc comment in
`tool-groups.ts`). Rationale is valuable exactly once. Suggested split: **specs and DECs
hold the why**; **README holds the what, ≤ 5 lines per fact, with the id**; **code
comments hold the local invariant, with the id**; **WI summaries are ≤ 40 lines**. The
execution reading list would shrink by roughly half.

**INT-PR-03 — The ceremony-to-work ratio for Simple items.** *RULE amendment* (RULE-016).
`opus` for the planning. WI-127 (22-line CSS fix) and WI-128 (no code change: the
premise was already stale) each consumed a planning session, an execution session, a WI
file, a PLAN entry, an INTAKE row move, a README touch, a PR and ~30 min of CI. For a
Shape B playtest batch of ten Simple items that is twenty sessions. Two lanes would keep
every guarantee the rules exist for:

- **Batch lane** — one planning session classifies the batch (already the case); one
  execution session may execute *all Simple items in the same approved batch* as one PR
  with one combined summary. RULE-016 becomes "one session, one approved unit", where a
  unit is a work item or an approved Simple batch. Deceptive items keep one-per-session.
- **Trivial lane** — an item the triage marks `haiku`/Simple/≤ 30 lines skips the
  separate WI file: its summary is the PR body, and `PLAN-COMPLETED.md` links the PR.

**INT-PR-04 — CI is 28–35 minutes per PR.** *Simple* (workflow). `sonnet`. Measured from
the last eight runs (`actions/runs/35288888201` … `34925223336`: 33, 35, 28, 35, 33, 33,
27, 34 min). The cause is `playwright.config.ts`: `workers: 1`, `fullyParallel: false`,
`timeout: 180_000`, `retries: 2` on CI, 100 tests, all behind one emulator. Options in
order of payoff: (1) a CI matrix that shards Playwright 3–4 ways, each shard with its own
`firebase emulators:exec` (the emulator is per-job already); (2) `fullyParallel` with 2–3
workers — every spec creates its own room, so cross-test state is already isolated by
room id, and the emulator handles concurrent clients; (3) drop `retries` to 1 so a
genuinely flaky test surfaces instead of costing three attempts silently; (4) run the
`lint`/`typecheck`/`build` jobs as a single job (three `pnpm install`s today). Target: a
10-minute PR.

**INT-PR-05 — The emulator battery does not run in agent sessions.** *Simple* (a
SessionStart hook). Every recent completion record says "the emulator battery could not
run locally (no `firebase` CLI in the sandbox)". `firebase-tools` is in
`devDependencies` and Java is present here (`/usr/bin/java`); the missing piece is
`pnpm install` plus the emulator jar cache, i.e. a session-start script. Until then every
rules/store/e2e failure costs a second full session to discover. A `.claude/` session-start
hook that runs `pnpm install --frozen-lockfile` and pre-downloads the emulators (with
`HTTPS_PROXY` stripped, per README's proxy trap) would let `pnpm verify:all` run before
the push. This is the highest-leverage process change for a Pro-plan budget: a red CI
after the session ends is the most expensive failure mode the project has.

**INT-PR-06 — The `PLAN.md` freshness hook.** *Process decision.* `remind-plan-status.sh`
denies any build/e2e/subagent call unless `PLAN.md` was modified in the last 15 minutes.
Its purpose (survive compaction) is now largely served by the harness's own context
summarisation, and its effect is `PLAN.md` churn in every PR plus "WI-NNN step X of Y"
edits that have to be cleaned up. Replace with a status file outside the tree
(`.claude/status.local`, gitignored) or drop it.

**INT-PR-07 — Planning on `opus` reads the most tokens.** *Process decision.* Model
routing is honoured on execution (WI-134 on `opus` for rules, the rest on `sonnet`), but
every `/work-item` run is `opus` and it is the session with the largest reading list
(INT-PR-01). Shape B triage of a playtest batch is pattern-matching against a fixed
trigger list and could run on `sonnet`; reserve `opus` for Shape A and for gates that
touch a RULE. Combined with INT-PR-01 this is the biggest allocation saving available.

**INT-PR-08 — Are the docs over-protective?** Two answers. The *golden rules* (001–014)
are invariants and earn their weight; none should be loosened. The *process rules*
(015–020) plus the three hooks are where friction lives, and two of them bite in
practice: RULE-015's "no side fixes" made WI-128 a full work item to confirm nothing
needed doing, and the same rule forbids an executor from fixing a one-line bug in a file
already open. A bounded **Deviations budget** — an executor may fix a defect *in a file the
work item already touches* if the fix is ≤ 20 lines, covered by a test, and recorded under
Deviations — keeps the chain auditable while removing the worst of the friction. That is
a RULE-015 amendment and needs its own commit.

**INT-PR-09 — Index drift is a recurring intake item.** *Simple.* IN-044/045/046 are all
"an index disagrees with its entry". A `pnpm docs:check` script asserting every `SPEC-`,
`DEC-`, `WI-` id in an index has a file and a matching status, and every `IN-` appears in
exactly one of §1.1/§1.2, turns a class of work items into a lint failure.

**INT-PR-10 — No release mechanism.** IN-070 and IN-073 (open). A tag workflow that
publishes `dist-local` as a zip and stamps `VITE_APP_VERSION` from the tag closes both and
gives users a version to report against.

### 4.3 A cost sketch for a Pro plan

Per closed work item today: one `opus` planning session (~50k tokens of reading before
work), one `sonnet` execution session (~20–40k of reading), a PR, ~30 min CI, and a
second execution session in the cases where CI catches what the sandbox could not run.
The changes above attack each term: INT-PR-01/02 halve the reading, INT-PR-03 halves the
session count for Simple batches, INT-PR-05 removes most second sessions, INT-PR-04
halves the wall-clock wait, INT-PR-07 moves the heaviest reader off the heaviest model.
Applied together they are plausibly a 2–3× improvement in work items per month at the same
allocation, with no change to what the rules guarantee.

---

## 5. Seed table for work items

Every row is a suggestion for an `IN-` entry, in the project's vocabulary. Order within a
group is suggested priority.

| Seed         | Title                                                              | Class         | Model  | Depends on |
| ------------ | ------------------------------------------------------------------ | ------------- | ------ | ---------- |
| INT-PR-01    | One home per fact: dedupe completion summaries; trim `PLAN.md`     | Simple        | sonnet |            |
| INT-PR-05    | Session-start hook: install deps + emulators so `verify:all` runs  | Simple        | sonnet |            |
| INT-PR-04    | Shard Playwright in CI; single lint/typecheck/build job             | Simple        | sonnet |            |
| INT-PR-03    | RULE-016 amendment: batch lane for Simple items                    | RULE-AMENDMENT | opus  |            |
| INT-PR-08    | RULE-015 amendment: bounded Deviations budget                      | RULE-AMENDMENT | opus  |            |
| INT-PR-06    | Retire or relocate the `PLAN.md` freshness hook                    | Simple        | haiku  |            |
| INT-PR-09    | `pnpm docs:check` index/entry consistency lint                      | Simple        | sonnet |            |
| INT-PR-02    | House-style note: rationale has one home; README states behaviour  | Simple (docs) | sonnet | INT-PR-01  |
| INT-UX-13    | Remove the unenforced plaintext room password                      | Deceptive     | opus   |            |
| INT-UX-02    | Seat the creator on room creation                                  | Simple        | sonnet |            |
| INT-UX-01    | Empty-state hints on map and board; sample room                    | Simple        | sonnet |            |
| INT-UX-03    | Visible view tabs in the rail; sheet labels on first visit          | Simple        | sonnet |            |
| INT-UX-04    | Persist Edit/View per room; hint on disabled-tool click             | Simple        | sonnet |            |
| INT-UX-09    | Tool hotkeys from `TOOL_GROUPS`                                     | Simple        | sonnet |            |
| INT-UX-08    | Rename the Room sheet; one word for the referee                    | Simple        | haiku  |            |
| INT-UX-07    | Add creature and export reachable from the docked palette          | Simple        | sonnet |            |
| INT-UX-06    | Handouts out of Session settings                                   | Simple        | sonnet |            |
| INT-UX-05    | Investigation: one home for per-map configuration                  | Investigation | sonnet |            |
| INT-UX-16    | Room-not-found, reconnecting states; offline cache decision        | Simple + DEC  | sonnet |            |
| INT-UX-10    | DEC: what an open initiative call may block                        | Decision      | opus   |            |
| INT-AR-06    | Lazy-load dice renderer and hex art; bundle-size CI assertion      | Simple        | sonnet |            |
| INT-AR-09    | Gate the e2e readout layer behind a build flag                     | Simple        | sonnet |            |
| INT-AR-07/08 | Investigation: measured reads/writes/listeners per session         | Investigation | sonnet |            |
| INT-AR-04    | One migration ledger for room-doc and collection backfills         | Deceptive     | opus   |            |
| INT-AR-02    | Generic collection primitive in `FirebaseStore`                    | Simple*       | sonnet |            |
| INT-AR-02b   | DEC: split `CampaignStore` by domain                               | Decision      | opus   | INT-AR-02  |
| INT-AR-01    | Investigation: `VectorMapView` extraction plan (seams above)       | Investigation | opus   |            |
| INT-AR-01a   | Extract `TokenLayer` (closes IN-113)                               | Deceptive     | opus   | INT-AR-01  |
| INT-AR-03    | Layer dirty-tracking and rAF-coalesced render                      | Deceptive     | opus   | INT-AR-01  |
| INT-AR-05    | Investigation: Yjs transport cost at scale                          | Investigation | sonnet |            |
| INT-AR-10/11 | Consolidate snap vocabularies; one actor-presentation resolver     | Simple        | sonnet |            |
| INT-AR-13/14 | One modal stack; one undo service (with INT-UX-14)                 | Deceptive     | opus   |            |
| INT-NX-08    | Text tool on the Overlay group                                     | Simple        | sonnet |            |
| INT-NX-07    | Path measurement; live drag distance                               | Simple        | sonnet |            |
| INT-NX-10    | "Now on: map" toast on active-map change                           | Simple        | haiku  |            |
| INT-NX-05    | Conditions/status markers                                          | Deceptive     | opus   |            |
| INT-NX-01    | Token vision and automatic fog reveal                              | Deceptive     | opus   | INT-AR-03  |
| INT-NX-03    | Small-image storage in Firestore                                   | Deceptive     | opus   |            |
| INT-NX-02    | UVTT import (walls, doors, image)                                  | Deceptive     | opus   | INT-NX-03  |
| INT-NX-09    | Fog on hex maps                                                    | Deceptive     | opus   |            |
| INT-NX-06    | Whispers via `gmPrivate`                                            | Deceptive     | opus   |            |
| INT-NX-12    | Strings extraction; contrast audit                                  | Simple        | haiku  |            |

\* Simple in contract terms — the `CampaignStore` shape and guarantees do not change — but
it is a large mechanical diff in the concrete-store touchpoint; classify conservatively.

---

## 6. Things checked that are fine

Recorded so the next reviewer does not re-check them.

- RULE-002 is honoured: no value-derived logic found; the guard test exists
  (`profile/mechanics-agnostic.test.ts`).
- RULE-006 is honoured after WI-131: the Measure tool was the last square-lattice consumer
  reachable from a hex map.
- Rules tests cover the side-slot keying (WI-134) and the gmPrivate boundary; RTDB rules
  cascade reads correctly at the parent node.
- `LocalStore` autosave is atomic where the platform allows and says so where it does not.
- Room ids are Firestore auto-ids (~119 bits); nothing sequential leaks.
- `onDisconnect` is armed for presence, cursors, drags and pings.
- The Firebase strip for the local build is a resolver alias, not a runtime flag, and
  `sideEffects: false` is set where it must be.
- No `TODO`/`FIXME` markers anywhere in `apps/` or `packages/`.
