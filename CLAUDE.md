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
- `docs/` — `VTT_Master_Plan.md` (the single source of truth) + `mockups/`.
- pnpm workspace (`pnpm-workspace.yaml`): `packages/*` + `apps/*`.

There is no `poc/` directory — a prior Vector Map System POC lived there
during design; it fully graduated into `packages/shared/src/map/vector/` and
`apps/web/src/lib/{components/VectorMapView.svelte,map/vector-*.ts}`, and the
scaffold was deleted once its governing docs moved into `docs/`. If you see a
comment or old branch referencing `poc/vector-floor/...`, treat it as a
historical pointer to `docs/VTT_Master_Plan.md` (Part II §2 / Part V §2), not
a live path.

## Documentation

**[`docs/VTT_Master_Plan.md`](./docs/VTT_Master_Plan.md) is the single source of
truth.** It is self-contained. If a requirement is not in it, it is not a
requirement.

Its structure:

- **Part 0** — how the document works; `[HUMAN]`/`[AGENT]` conventions, model
  targets, the one-WI-per-prompt rule.
- **Part I** — invariants, golden rules, trust/backend model, repo map, dev
  commands.
- **Part II** — **the system as it stands**, subsystem by subsystem (shell, map,
  encounter, group ownership, map ⇄ sheet, dice, assets/theming, log/session/
  accounts, test culture). This is the descriptive half; **when Part II and Part
  III disagree about present-day behaviour, Part II wins.**
- **Part III** — reference specs `R1`–`R26`, cited by work items. Superseded
  specs keep their annotation in place rather than being rewritten.
- **Part IV** — work items: the shipped ledger (WI-0–WI-24, WI-A–WI-D) and the
  upcoming items in full (**WI-25–WI-27**: access control, presence, room
  lifecycle).
- **Part V** — locked defaults and the vector-map decision log.
- **Part VI** — open items, deferred work, known limits, the quarantined e2e.

Supporting assets, all under `docs/mockups/`: `vtt-ui-mockups.html` (Activity
Shell — pre-redesign, historical), `vtt-ui-mockups-addendum-c.html` (Addendum C
boards), `dice-preview.html` / `dice-reference.png` (dice renderer reference).

Five documents were consolidated into the Master Plan and retired from the tree
(their full text remains in git history): the v2 Master Plan, its Addendum C,
the Vector Map System spec and decision log, and the Shell UI Redesign.

Don't silently reconcile a real conflict you find — flag it and add a
superseded-note annotation the way the existing ones are done, rather than
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
`MapToolbar.svelte`) — the right Tools rail was retired by the shell
redesign — driven by the shared `MapToolController`
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

**Fog of war** (rebuilt 2026-07-27; `docs/VTT_Master_Plan.md Part II §2` §4's annotation
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
pressing Roll. See `docs/VTT_Master_Plan.md` Part II §3.

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

## Access control (current state)

**Creating a room requires a non-anonymous sign-in provider** (R24.1, WI-25). The
Firestore rule gates `rooms/{roomId}` **create** on
`request.auth.token.firebase.sign_in_provider != 'anonymous'`. `read`/`update`/`delete`
are untouched, so a room whose `gmUid` is an unlinked anonymous uid keeps working.
**Joining is untouched and still promptless** — that invariant (Gate 10) is not
negotiable, and the gate is deliberately scoped to `create` alone.

Two consequences to remember when writing tests:

- Anything that creates a room needs a real identity. The `FirebaseStore` contract suite
  signs its clients in with an emulator-minted Google credential (it tests data plumbing,
  not access control); `account-recovery.emulator.test.ts` links Google **before**
  creating, the only order the real flow permits.
- Playwright specs call **`signInAsReferee(page)` instead of `page.goto('/')`**
  (`tests/e2e/helpers.ts`). It mints a genuine non-anonymous session over the Auth
  emulator's REST API and seeds the SDK's IndexedDB record. Two traps if you touch it:
  the record's `value` is a plain **object**, not a JSON string (stringifying fails
  silently — the SDK re-signs-in anonymously), and the seed must come **after** the app's
  anonymous bootstrap has settled or it is overwritten.

The Lobby shows a sign-in invitation (`create-room-signin-gate`) rather than a Create
form that would fail, and a **soft cap** of 12 GM-role My Rooms entries disables Create
(`create-room-cap`). That cap is client-side friction, **not a security boundary** — it
counts a document the user owns and could forge; a real cap needs a trusted writer.

**App Check** is wired but **off unless `VITE_FIREBASE_APPCHECK_SITE_KEY` is set** —
which is what keeps zero-setup dev, the emulator suite and e2e working. Don't "fix" its
absence; see `apps/web/.env.production` for the rollout order (monitoring first).

**Room ids are Firestore auto-ids** (~119 bits). Since room reads are `signedIn()` rather
than membership-gated, the roomId _is_ the capability — never replace the generator with
anything sequential, timestamp-derived or readable.

## Presence (current state)

Live presence rides **RTDB** at `rooms/{roomId}/presence/{uid} = { uid, name, ts }`
(R26, WI-26). Own-uid-only write, plus an **explicit `.read` at the parent `presence`
node** — RTDB rules cascade down, not up, so a `$uid`-only read leaves
`subscribePresence` silently never firing. 45 s heartbeat managed inside the store;
`onDisconnect().remove()` armed once per room+uid, the guarded pattern `publishCursor`
uses. `RoomShell` publishes once the client holds a seat (not on mount — a visitor on the
join gate has no seat) and clears on unmount.

**Disconnection is a display state with no data consequence.** A disconnected player's
row dims and their token dims, but every control stays enabled, the token stays where it
is and stays draggable, and the seat doc is never touched. Do not "tidy up" a
disconnected seat anywhere in the codebase — that is the one thing this model forbids.

The rules are pure and shared: `isPresent`, `presentUids`, `abandonedSeatUids` in
`packages/shared/src/store/campaign-store.ts`. Use them; don't re-derive staleness.

`PlayerSeat.lastPresentAt` (v18) is the durable half, written on first publish then at
most hourly. **Absent means "never observed", NOT "abandoned"** — `abandonedSeatUids`
requires a stamp older than the 30-day cutoff, so seats predating the field are never
offered for pruning. There is no backfill and the v17→v18 migration is a deliberate
no-op: `migrateRoom` only sees the room doc, and this field is on `players/{uid}`.

Map dimming is `Math.min(baseAlpha, 0.42)`, not a product — `alpha` already means
"GM-only view" at 0.4 and compounding would hide the token. A hollow **away badge**
carries the presence signal, since alpha alone can't distinguish the two cases.

The Session → Maintenance prune reuses `removePlayer` (character-sheet option included),
is always referee-confirmed, and the block is absent entirely when no seat qualifies.
