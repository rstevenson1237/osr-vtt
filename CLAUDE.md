# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

A browser-based virtual tabletop (VTT) for OSR/tabletop RPGs. Serverless on
Firebase (Spark tier) — no custom backend.

## Repo map

- `apps/web` — the app. Svelte 5 + Vite, PixiJS v8 for the map canvas,
  Firebase (Firestore/RTDB/Auth), Rapier3D + Three.js for dice physics, Yjs
  for collaborative notes.
- `packages/shared` — framework-agnostic logic shared by the app (and any
  future client): the `CampaignStore`/`AssetStore` abstractions and their
  Firebase/in-memory implementations, schemas, map geometry, dice, encounter,
  rules, tables, portability (`.vttcamp` import/export).
- `firebase/` — `firestore.rules`, `firestore.indexes.json`,
  `database.rules.json`. Security rules are tested code, not an afterthought.
- `docs/` — the documentation set (read order below).
- pnpm workspace (`pnpm-workspace.yaml`): `packages/*` + `apps/*`.

There is no `poc/` directory — a prior Vector Map System POC lived there
during design; it fully graduated into `packages/shared/src/map/vector/` and
`apps/web/src/lib/{components/VectorMapView.svelte,map/vector-*.ts}`, and the
scaffold was deleted once its governing docs moved into `docs/`. If you see a
comment or old branch referencing `poc/vector-floor/...`, treat it as a
historical pointer to `docs/VectorMapSystem_Spec.md` /
`docs/VectorMapSystem_Decisions.md`, not a live path.

## Documentation — read order & precedence

1. **[`docs/VTT_Master_Plan_v2.md`](./docs/VTT_Master_Plan_v2.md)** — the
   primary product spec. Part I is a codebase assessment (what to protect,
   what's missing, tech decisions); Part II carries forward invariants; Part
   III is reference specs **R1–R9**; Part IV is the sequenced work-item
   history (WI-0…WI-12, all shipped); Part V is locked decisions. Its map
   sections (§1.1.2, §1.3, R9) describe the **retired cellular map model** and
   are annotated in place as superseded — see next item.
2. **[`docs/VTT_Master_Plan_v2_addendum.md`](./docs/VTT_Master_Plan_v2_addendum.md)**
   ("Addendum C") — continues the same series: specs **R10–R21**, work items
   **WI-13–WI-24** (all shipped).
3. **[`docs/VectorMapSystem_Spec.md`](./docs/VectorMapSystem_Spec.md)** — the
   **authoritative spec for the current map system** (floor/wall/door
   geometry, the five-layer Pixi renderer model, snap/freeform drawing,
   carve pipeline). Supersedes the Master Plan's cellular-model sections
   wherever they conflict.
4. **[`docs/VectorMapSystem_Decisions.md`](./docs/VectorMapSystem_Decisions.md)**
   — the decision log behind the vector map system, plus a condensed
   historical record of the POC review/findings that produced it. Includes
   two flagged, unratified items worth knowing about: map-edit permissions
   (the vector toolbar is currently shown to all room members, not GM-only)
   and a quarantined flaky e2e spec (`portability.spec.ts`).
5. **[`docs/ShellUIRedesign.md`](./docs/ShellUIRedesign.md)** — the
   **authoritative spec for the current session shell** (main views vs. quick
   sheets, the expanded/docked/bottom-sheet model, Log & Session modals, the
   Room quick sheet and its per-room players' notes, the markdown renderer).
   Supersedes the Master Plan's R1 shell structure wherever they conflict;
   R1.5 (layering), R1.6 (dialog primitives) and R1.4's colour palette still
   stand.
6. Supporting assets: `docs/mockups/vtt-ui-mockups.html` (Activity Shell —
   pre-redesign, historical), `docs/vtt-ui-mockups-addendum-c.html` (Addendum C
   boards), `docs/dice-preview.html` / `docs/dice-reference.png` (dice renderer
   reference).

**When docs conflict:** the Vector Map System docs (3–4) win for anything
map-related; the Shell UI Redesign (5) wins for the session shell; the Master
Plan + Addendum (1–2) are authoritative for everything else (dice, encounter,
accounts, assets, session config).
Don't silently reconcile a real conflict you find elsewhere — flag it and add
a superseded-note annotation the way the existing ones are done, rather than
deleting/rewriting history.

## Golden rules (carried forward from the Master Plan, still binding)

1. **Store abstraction only.** All Firebase access goes through
   `CampaignStore`/`AssetStore` (`packages/shared/src/store/`). Components
   never touch the Firebase SDK directly. Any new store method must be added
   to the shared contract suite (`campaign-store.contract.ts`) and pass
   against both `MemoryStore` and `FirebaseStore`.
2. **No game mechanics.** The app stores and displays data but never
   interprets it — no stat logic, no value-triggered behavior, ever.
3. **Write discipline.** RTDB for high-frequency ephemeral state (cursors,
   drags, in-progress carve strokes); Firestore for settled commits. New
   high-frequency features follow the same split.
4. **Security rules are tested code.** Rule changes ship with rule tests
   (`packages/shared/src/rules/`).
5. **Preserve `data-testid`s.** The Playwright e2e suite depends on stable
   testids; moving a control (e.g. between panels) must carry its testid with
   it or update the spec in the same change.
6. **Vector map coordinate space.** All floor/wall/door geometry is stored in
   lattice (cell) units as floats; `cellSize` is a render-time-only
   multiplier applied at the render/LoS-build boundary. Never store pixel
   coordinates.
7. **Migrations for schema changes.** Any `GameMap`/store schema change ships
   a migration + migration test (`packages/shared/src/migrations/`).

## Dev commands

Run from the repo root unless noted:

```sh
pnpm install                 # workspace install
pnpm dev                     # apps/web dev server (Vite)
pnpm build                   # build packages + apps
pnpm typecheck               # svelte-check across the workspace
pnpm lint                    # eslint .
pnpm format                  # prettier --write .
pnpm test:unit                # vitest (all packages)
pnpm test:rules               # Firestore rules tests (packages/shared)
pnpm test:store               # CampaignStore contract suite, both impls
pnpm test:e2e                 # Playwright (apps/web) — needs a browser
pnpm emulators                 # firebase emulators:start
pnpm test:all:emulators        # full suite against the Firebase emulator
```

`test:rules`, `test:store` and `test:e2e` (and one emulator-backed unit test)
need the Firebase emulator running — `pnpm test:all:emulators` is the one-shot
way to run everything.

Both emulator scripts go through `scripts/firebase-emulators.mjs` rather than
calling `firebase` directly. `firebase-tools` proxies **every** request when
`HTTPS_PROXY`/`HTTP_PROXY` is set and ignores `NO_PROXY`, including its own
calls to the emulators it just started on 127.0.0.1 — behind a filtering proxy
that surfaces as the very misleading
`firebase/database.rules.json:Unable to parse JSON … "denied by "…`, with a
perfectly valid rules file. The wrapper strips the proxy variables for the
child; an emulator run is loopback-only, so it needs none of them. Don't
"fix" that error by editing `database.rules.json`.

## Map tools (current state)

The map view is `apps/web/src/lib/components/VectorMapView.svelte`
(rendering: `apps/web/src/lib/map/vector-engine.ts`, tool logic:
`apps/web/src/lib/map/vector-tools.ts`, pure geometry:
`packages/shared/src/map/vector/`). Draw tools (Select vertex/edge/object, Pan,
Eye, Measure, Ping, Room, Corridor, N-gon, Carve, Wall, Path, Polygon, Label,
Symbol, Door, Pen) and their contextual parameters
(Carve/Snap/Width/Sides/Door, plus Simplify and the export controls in the
expanded sheet only) live in one unified panel in the **Map tools quick sheet**
(`sheets/MapToolsSheet.svelte` → `MapToolPalette.svelte` →
`MapToolbar.svelte`) — the right Tools rail was retired by the Shell UI
Redesign — driven by the shared `MapToolController`
(`apps/web/src/lib/shell/map-tool-controller.svelte.ts`).

The palette is grouped by **gesture**, not by an arbitrary list:
`apps/web/src/lib/map/tool-groups.ts` is the single catalog of **five** groups —
Select · View · click-and-drag shapes · multi-click runs · Overlay — each with
its own icon and its own canvas cursor (`engine.setCursor`, layered under
`pan-zoom`'s transient gesture cursor), plus optional per-tool cursor overrides
(`MapToolGroup.toolCursors`) for tools whose pointer still has something of its
own to say. Every `MapToolId` belongs to exactly one group — a tool missing
from `TOOL_GROUPS` is unreachable, and `tool-groups.test.ts` guards that.

Regrouped 2026-07-30, retiring the last one-tool groups:

- **Select** is a group of three tools (`selectVertex`/`selectEdge`/
  `selectObject`), not one tool with a Vertex/Edge/Object mode row beside it.
  `selectModeForTool` derives the engine's unchanged
  `ToolPreviewInput.selectMode` from the tool id; there is no `selectMode`
  state left on the controller.
- **View** gathers everything that reads the map rather than changing it: Pan,
  Eye, Ping, and the new **Measure** tool — drag a span and a ruler line plus a
  distance chip appear, in the map's `RoomMeasure` units, and vanish on release.
  Nothing is committed and no undo entry is made.
- **Pen** is the tool formerly called Annotate, moved into Overlay (it puts
  something on top of the map, like a label/symbol/door) while keeping its own
  nib cursor. Its freehand `Drawing` write is unchanged.

**Carve** is the freehand brush: the snap level picks its shape (Cell/Half paint
whole lattice cells, Free buffers the sampled polyline), and it commits through
the unchanged `commitCarve` pipeline, so carve modes, undo and simplify apply as
usual. While a click-and-drag shape is being dragged, a dimension chip
(`strokeMeasureText` → `ToolPreviewInput.measure`) shows `w × h` in the map's
`RoomMeasure` units, or `radius:` for the N-gon; it is derived from the live
drag, so it clears itself on commit — the Measure tool reuses the same chip via
`measureSpanText`. Hovering a room **label** shows its long-form description as
a tooltip (`map-label-tooltip`), read from the per-room players' notes
(`collab/room-notes.svelte.ts`) — there is no `MapRoom.description` field — and
hit-tested by the same `pickMapRoomAt` that Select→Object clicks. Token snap-mode
defaults live on the character quick sheet, not the map toolbar. The lattice
grid renders between the **floor and overlay** layers (`vector-engine.ts`'s
`renderGrid`); a map's background is either an image ref or a solid
`#rrggbb` color (`GameMap.background`), set from Session Config; floor
corners are rounded at render time only (a fixed pixel radius clamped per
edge) — the stored geometry stays straight-line polygons (Model A).

**Fog of war** (rebuilt 2026-07-27; `VectorMapSystem_Spec.md` §4's annotation
is authoritative) is a referee-authored `fog` Pixi layer between `overlay` and
`tokens`. Revealed geometry lives in `maps/{mapId}/fogRegions` — the same
`FloorRegion` doc shape as the floor, committed through the same `commitCarve`
pipeline by the GM-only **fog carve modes** (`Carve: Fog: reveal / Fog: hide`
on the ordinary shape tools; the dedicated Reveal/Hide tools were retired
2026-07-29) — gated by `GameMap.fog.enabled`, whose on/off switch lives in
Session settings. Reveal all / Reset fog are in the expanded Map tools sheet.
It is the one map collection that is read-all but GM-write.

**Map management** (create/rename/switch/delete a map — `MapsPanel.svelte`)
moved out of Session settings into the **Assets** activity (2026-07-30), beside
the room list. Both activities are GM-only, so nothing about permissions
changed; Session settings keeps only session-wide config.

The map camera (pan + zoom) is remembered per map on the `MapToolController`,
so switching main views and coming back resumes the same view.

## Encounter board (current state)

`EncounterBoard.svelte` groups the cast into per-`Group` boxes with a synthetic
**Unassigned** bin (always rendered for the referee, so it is a reachable drop
target). A referee can drag cards between boxes and reorder them inside one —
`Group.memberTokenIds` order _is_ the card order — and drag group headers to
reorder the boxes themselves, persisted via `Group.order`
(`packages/shared/src/encounter/ordering.ts`; both stores sort through
`sortGroups`, which keeps groups written before the field rather than dropping
them the way a Firestore `orderBy` would). Double-clicking a group name edits
it inline; doing that to the Unassigned bin _creates_ a real group holding its
cards, ordered after every existing group, and an empty bin reappears in its
place. That promote is now the **only** creation path — `+ New group`
(`cast-add-group`) was retired 2026-07-30 because it made an _empty_ group,
which is the one thing renaming the bin does better. All of this is GM-only. The
membership/order writes go through the pure helpers in
`apps/web/src/lib/encounter/board-view.ts`; the per-card `board-assign-{tokenId}`
dropdown went with `+ New group`, so **membership is drag-and-drop, full stop**.

Each named group's box carries a **group card** (`group-card-{id}`) to the
**left** of its member cards, in the same card-sized footprint, holding that
group's `[Map]`/`[Board]`/`[Active]` flags, Collapse/Expand, Delete group, and
the group's owning player seats (`group-seat-{groupId}-{seatId}` — see Group
ownership below). It renders outside the collapse branch (so Expand stays
reachable while collapsed) and real groups render **even when empty**, for the
referee only — otherwise a fresh or emptied group would have no box and
therefore no controls. Delete group removes the group _and its member tokens_,
behind a `dialogs.confirm`, via the `deleteToken` store method.

That card replaced the separate GM-only **Groups roster** (`GroupsPanel`), whose
toggles sat in one place while their effect showed in another. All of its testids
carry over (`group-toggle-{map,board,active,collapsed}-{id}`,
`group-delete-{id}`). Its one non-group section, `shell/OwnershipPanel.svelte`
(Actor Ownership, `ownership-*`), went with the token-ownership model it
configured — see below. One consequence, accepted deliberately: **a token belongs
to at most one group** — the old grid could put it in two, which the board cannot
draw.

The board's two other referee side-panels left earlier: **Random tables** are
now the GM-only `tables` quick sheet, and the **Blind Drawer** was replaced by
the Roll sheet's referee-only **Hidden** button (`publishHiddenRoll` — same roll
construction as `publishRoll`, written only to `gmPrivate`, with no reveal
path). The Roll sheet gives the referee two side-by-side buttons, `roll-button`
and `roll-hidden-button`, rather than a sticky checkbox you must set before
pressing Roll. See `docs/ShellUIRedesign.md` §2.1.

## Group ownership (current state)

Authority is a property of the **`Group`**, not the token (changed 2026-07-30).
`Token.ownerSeatId` survives meaning only "which character profile this token
shows" — what makes card selection, roll shortcuts, initiative slots and "My
token" work — and confers nothing. The model lives in
`packages/shared/src/encounter/ownership.ts` (pure, unit-tested):

- `Group.memberSeatIds` lists the player seats that own a group. A listed seat
  may act as **every** character in it: open the sheet, edit the profile, roll
  its fields, place its token. Edited from the group card's checkbox list.
- **The referee is in every group, implicitly.** GM membership is derived from
  `Room.gmUid` by `canSeatActAs`, never stored, so transferring the referee
  updates it across every group with no writes and nothing to keep in sync.
  Their checkbox renders checked and disabled to say so.
- `RoomSettings.defaultPlayerGroup` (`'first'` | `'unassigned'` | a `groupId`,
  Session settings → Players, `session-default-group`) decides where a newly
  joined seat lands. `groups/{groupId}` is GM-write-only, so a joiner cannot
  place themselves: `RoomShell`'s GM-gated, idempotent reconciliation effect
  applies it via `defaultGroupPatches`, the way `ensureActiveMap` works. A
  player who joins with no referee connected is placed when one arrives.
  Deleting the named group writes the setting back to `'first'`, and
  `resolveDefaultGroupId` reads a dangling value that way regardless.
- `PlayerSeat.currentCharacterSeatId` is the character a seat is currently
  playing — the last one it selected from a group it owns. Absent ⇒ its own
  profile. It is what the Character sheet defaults to; "← Back to my sheet"
  (`dock-back-to-mine`) clears it and returns to the player's own profile.

**Enforcement is client-side.** `canSeatActAs` decides whether the sheet renders
editable; `firestore.rules` gates `profiles/{seatId}` on room _membership_
(loosened from own-seat-or-GM, with tests). Expressing group ownership in rules
would need the owning seats denormalized onto every profile doc, since a group
holds token ids and a character is a seat. Token ownership never had server-side
teeth either, so this gives up no guarantee that previously held.

## Map ⇄ character sheet

Selecting a token on the map raises that character's sheet, exactly as clicking
their card on the Encounter board does — `VectorMapView` takes the same
`selectedSeatId`/`onSelectActor` pair the board does, and fires it from the
token sprite's `pointerdown` (which is already the selection moment, so there is
no click-versus-drag discrimination). Readout: `selected-seat`.

Dragging the sheet's portrait (`dock-portrait`) onto the map places that
character's token where it is released: the token hides for the duration
(`mapCtrl.sheetDragTokenId` → `hiddenTokenIds`), the pointer carries a
translucent copy of the portrait (`setGhostImage`), and the drop snaps through
the same `snapTokenPosition`/`snapModeFromModifiers` call an on-map drag uses. A
character with no token yet gets one created at the drop point. This is the only
DOM drag-and-drop on the map — all other map input is Pixi federated pointer
events, which a DOM drag never reaches, hence the `DataTransfer` payload in
`apps/web/src/lib/tokens/drag.ts`.
