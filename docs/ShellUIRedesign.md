# Shell UI Redesign — Quick Sheets

**Status:** shipped. **Authoritative for the session shell**, superseding Master
Plan v2 §R1 (the Activity Shell) wherever the two conflict. R1 remains the
reference for everything it describes that this doc does not touch — dialog
primitives (R1.6), the z-order model (R1.5), and the colour-group palette
(R1.4).

Source of the design: `design_handoff_ui_redesign` (README + `VTT Shell.dc.html`
prototype). The prototype is a behavioural reference only — nothing was copied
from it; all values come from `apps/web/src/lib/theme/tokens.css`.

---

## 1. What changed

R1's model was _one activity at a time_ on a stage framed by four rails: a left
Activities rail (seven activities, two of which opened docked mini-cards), a
right Tools rail, a bottom Log drawer, and a top Session tab.

The shell is now **one full-screen main view plus independently toggled quick
sheets layered over it**, with Log and Session settings as modals:

| R1 (retired)                           | Now                                                        |
| -------------------------------------- | ---------------------------------------------------------- |
| 7 activities in one rail               | 3 **main views** + 4 **quick sheets**, separate registries |
| Right Tools rail (`ToolsRail.svelte`)  | Map tools quick sheet                                      |
| Bottom Log drawer (`LogRail.svelte`)   | Log modal, opened from a bottom-bar button                 |
| Session activity (full stage)          | Session settings modal, opened from the top-bar gear       |
| Dice / Characters docked mini-cards    | Roll / Character quick sheets                              |
| Mobile tool bottom-sheet (`ToolSheet`) | Any quick sheet, as a bottom sheet                         |
| Rooms manager inside Session settings  | Room quick sheet (player-accessible) + Assets activity     |

Deleted components: `ActivitiesRail`, `ToolsRail`, `LogRail`,
`MobileActivityBar`, `ToolSheet`, `DiceMiniCard`, `CharactersMiniCard`,
`Popover`.

### 1.1 Top status bar

`SessionTab.svelte`. Beyond the room name / id / role pills, invite copy, the
GM's settings gear, account controls and presence chips, the top bar carries
the two pieces of shared session state that belong on every stage:

- the **turn tracker** (`TurnStrip`, `variant="rail"`) — "Round N · X is up";
- the **encounter status strip** (`TensionBar`, `variant="rail"`) — the
  **pinned encounter profile fields**, which by default are Difficulty, Danger
  and Clock. It moved here from the top of the Encounter Board. The referee
  **edits the values in place** (tension changes constantly mid-play);
  players see the same strip **read-only**. The fields' _shape_ — labels,
  types, order, pinning — stays behind Session settings.

### 1.2 Encounter profile

Session settings gains an **Encounter profile** section: the room's
`encounterTemplate` (schema v14), a second `ProfileTemplateField[]` alongside
`profileTemplate`. Both are edited with the same `ProfileTemplateEditor` and
draw from the same field-type list (`text`/`longtext`/`number`/`counter`/
`checkbox`/`roll`) — one vocabulary for characters and encounters alike. Values
live on the single `encounter` doc (`Encounter.values`), the encounter's
counterpart to a seat's profile instance, and `pinned` means "show in the top
status bar". The section also hosts the `TensionBar` (`variant="panel"`), which
edits _every_ field's value, pinned or not.

**Nothing about the strip is hardcoded.** `DEFAULT_ENCOUNTER_TEMPLATE` seeds
Difficulty (`roll`), Danger (`roll`) and Clock (`counter`, `max: 6`) — the old
fixed widgets, now ordinary fields the referee can relabel, retype, reorder,
unpin or delete. `ProfileTemplateField` gained an optional `max` for `counter`
fields, generalizing the danger clock's segment count; it renders as pips and
bounds the ▲/▼ steps. Pre-template rooms keep their live values: an unset field
falls back to the legacy `difficultyDie`/`dangerDie` slots for those three ids
until first written.

## 2. Registries

`apps/web/src/lib/shell/activities.ts`.

**Main views** (`MAIN_VIEWS`) — exactly one on stage at a time:

| id          | availability |
| ----------- | ------------ |
| `map`       | all          |
| `encounter` | all          |
| `assets`    | **gm**       |

**Quick sheets** (`QUICK_SHEETS`) — independent open/closed toggles:

| id          | group     | availability | body                                                                                                                                                                 |
| ----------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maptools`  | `world`   | all          | `MapToolPalette` (the former Tools rail content)                                                                                                                     |
| `character` | `records` | all          | `CharacterDock` + identity header + quick d20 — see the group-ownership amendment below                                                                              |
| `roll`      | `play`    | all          | die buttons that **stage** a die, the staged pool + Roll button, tray controls and saved macros; `DiceTray` (custom dice, shared rolls, macro creator) when expanded |
| `room`      | `referee` | all          | `RoomsPanel` — selected room docked, full list expanded                                                                                                              |
| `tables`    | `referee` | **gm**       | `TableRunner` — import/roll random tables                                                                                                                            |

> **Amended (2026-07-29).** `QuickSheetDef` gained the same optional
> `availability` gate `MainViewDef` already had (omitted ⇒ `'all'`), and
> `quickSheetsFor(isGM)` mirrors `mainViewsFor`. Everything downstream — the
> rail, the chips, the docked stack, the expanded sheet, and the digit
> shortcuts — filters through it, so a player never gets a dead button or a
> dead key. `RoomShell` also closes any gated sheet on demotion, matching the
> existing Assets-view guard.
>
> `tables` is the only gated sheet, and it moved here from the Encounter
> view's referee panel column: a wandering-monster check comes up while
> looking at the map at least as often as at the board. It is referee prep
> rather than shared play, hence the gate. Its sibling in that column, the
> Blind Drawer, was retired entirely — see §2.1.

> **Amended (2026-07-30) — the Character sheet under group ownership.** The
> sheet used to show "the seat whose card was last selected on the Encounter
> board, defaulting to my own", with editability decided by seat identity. Two
> things changed (Addendum C, R22/R23):
>
> - **What raises it.** The board is no longer the only writer of
>   `selectedSeatId`: selecting a token on the map raises that character's sheet
>   the same way, and `VectorMapView` now takes the same
>   `selectedSeatId`/`onSelectActor` pair `EncounterBoard` does. Dragging the
>   sheet's portrait back onto the map places that character's token there.
> - **What it defaults to, and who may edit it.** The default is
>   `PlayerSeat.currentCharacterSeatId` — the last character you selected from a
>   group you own — falling back to your own seat. Editability is
>   `canSeatActAs`, so a groupmate's character is fully writable and a character
>   outside your groups is a read-only view. `dock-back-to-mine` keeps its
>   testid but now means "back to my own profile": it clears the pointer as well
>   as the selection, because picking up a groupmate's character makes it your
>   current one.

### 2.1 Retired: the Blind Drawer

> **Superseded in part, 2026-07-30 — the checkbox is now a second button.**
> The referee's Roll sheet has two side-by-side buttons, `roll-button` ("Roll")
> and `roll-hidden-button` ("Hidden"), instead of a `hidden-roll` checkbox you
> tick before pressing Roll. Same two write paths, same absence of a reveal;
> what changed is that "hidden" is a per-press choice rather than sticky state
> you could leave switched on and silently swallow the next roll with. The
> `hidden-roll-list` / `hidden-roll-{id}` results list is unchanged. Everything
> below describes the routing, which still holds — read "checkbox" as "Hidden
> button".

The Encounter view's Blind Drawer (a secret roll/note stashed in `gmPrivate`
with a **Reveal** button that copied it into the shared log) is gone. Its
replacement is a **Hidden roll** checkbox on the Roll quick sheet, referee-only,
which routes the staged pool through `publishHiddenRoll`
(`packages/shared/src/dice/publish.ts`) instead of `publishRoll`: same seed →
expand → roll construction, but the result is written only to `gmPrivate` —
no `Roll` doc, no log entry — and listed back to the referee in the sheet.

Two deliberate differences from what it replaced. It lives on the die roller
the referee is already using rather than on one main view, and **there is no
reveal path**: a hidden roll stays hidden, and a roll the table should see is
just a normal roll. The `gmPrivate` store surface (`BlindDraw`,
`subscribeBlindDraws`, `writeBlindDraw`) is unchanged and still contract-tested
— only the UI went.

**Map tools are no longer referee-only.** Map drawing is open to every seat,
consistent with `VectorMapSystem_Spec` §1's "all room members can write" trust
model. The referee-only _controls_ that remain (the fog carve modes and the
bulk fog actions) carry their own `isGM` gate inside `MapToolbar`. The PNG
export's old GM-only "include hidden layer" checkbox — which drove nothing —
was replaced by an "up to layer" selector available to every seat, cutting the
export off above the chosen render layer (`map/export-layers.ts`).

### 2.2 Retired: the Groups roster (2026-07-30)

The Encounter view's last referee side-panel, the GM-only **Groups** roster
(`GroupsPanel`), is gone the same way the other two went: its controls moved
onto the thing they act on. Every named group's box on the board now leads with
a **group card** carrying that group's `[Map]`/`[Board]`/`[Active]` flags,
Collapse/Expand and Delete group — same store writes, same
`group-toggle-*-{id}` / `group-delete-{id}` testids. Delete group takes the
group's member tokens with it, behind a confirm.

Two knock-on changes. Real groups now render as a box even when empty (referee
only — a player would otherwise see a box announcing a group whose cast is all
off-board), because an empty group with no box has no reachable controls; and
`+ New group` (`cast-add-group`) creates one, since naming the Unassigned bin
can only promote _all_ the loose cards at once. The roster's membership checkbox
grid is not replaced: the board's drag-and-drop and per-card
`board-assign-{tokenId}` dropdown already cover assignment, at the cost of
multi-group membership, which the board has no way to draw. Its Actor Ownership
section survives verbatim as `shell/OwnershipPanel.svelte`.

> **Superseded (2026-07-30) by group ownership — Addendum C, R22.** Three things
> in the paragraph above no longer hold. The group card moved to the **left** of
> its member cards rather than leading the box, and gained the group's owning
> player seats (`group-seat-{groupId}-{seatId}`). `+ New group` and the per-card
> `board-assign-{tokenId}` dropdown are both **gone**: promoting the Unassigned
> bin is the only creation path, and membership is drag-and-drop only. And the
> Actor Ownership section did not survive after all — it went with the
> token-ownership model it configured, so authority is a property of the Group
> and `Token.ownerSeatId` means only which character profile a token shows.
> Everything else here — empty real-group boxes, the toggle/delete testids,
> delete-takes-the-cast — is unchanged.

**Map management moved to the Assets view.** `MapsPanel` (create / rename /
switch / delete a map) left Session settings — along with its `session-maps`
section and nav entry — for the Assets activity, beside the room list. Both
views are GM-only, so no permission changed; Session settings keeps only
session-wide configuration and the maintenance danger zone.

**The Log modal opens at the newest entry.** `log-surface` pins itself to the
bottom on open and follows new entries, releasing the moment the reader scrolls
up (or presses `log-load-older`) so history-reading is never yanked back down.
Entries have always rendered oldest-first; the scroller just never moved.

## 3. Quick-sheet behaviour

Every sheet renders through one component, `QuickSheetCard.svelte`, in one of
three modes:

- **`docked`** (desktop) — ~300px wide, max 320px tall, scrolls internally,
  stacked top-to-bottom in the stage's left margin. The stack wrapper is
  pointer-transparent so the map canvas stays clickable around the cards.
- **`mobile`** — a bottom sheet above the chips and tab bars, draggable (or
  tappable) between a half-height peek and full height.
- **`expanded`** — the focused view: a centered ~620px modal on desktop,
  full-screen on mobile, over a blurred + dimmed backdrop. **At most one sheet
  is expanded at a time**, globally; expanding another collapses the first.
  Clicking the backdrop or pressing Escape returns it to docked.

Every mode carries a 3px left border in the sheet's group colour.

Sheets whose body is expensive or singleton-backed only mount that body when
expanded — the `DiceTray` (shared staged-dice store) is the case that matters,
so it can never be mounted twice.

### 3.1 The rail: activity drawer and rail side

Two things arrived after this doc was first written and are recorded here.

**Rail side.** `ShellState.railSide` (`'left' | 'right'`, persisted alongside
`mainView` and `sheets`) moves the whole 56px rail — and with it the docked
sheet column and the stage's `--sheet-gutter-*` — to either edge. The §3 text
above says sheets dock in the stage's _left_ margin; read that as "the margin
on the rail's side". The control is a handle that can be clicked to flip or
dragged to a half of the viewport.

**Activity drawer** (2026-07-29, `shell/ActivityDrawer.svelte`). The rail no
longer shows all three main-view tabs permanently. It shows the **current**
activity's icon; hovering it (or clicking, which pins it open) slides out a
translucent, blurred panel — `color-mix` + `backdrop-filter`, so the stage
stays readable underneath — carrying the full `MainViewTabs` list in a new
`drawer` variant (icon _and_ label, since being readable is the point) plus the
rail-move handle, which lives there now rather than standing alone above the
tabs. Selecting a view, pressing Escape, or the pointer leaving all close it.
The panel flips to the rail's other edge with `railSide`, and `.rail-left`'s
`overflow` had to become `visible` for it to escape the 56px column.

Motion follows the house pattern (plain CSS keyframes with a
`prefers-reduced-motion: reduce` escape, as in `DiceOverlay`), not Svelte
transitions — the shell uses none.

Mobile is unchanged: it has no rail, and the bottom tab bar still shows every
main view at once.

## 4. State

`ShellState` (`apps/web/src/lib/shell/shell-state.svelte.ts`), one instance per
`RoomShell`, persisted to `localStorage['vtt-shell:{roomId}']` only — never
Firestore.

Persisted: `mainView`, and the per-sheet `sheets` open map.

Ephemeral (reset on reload): `expandedId`, `mobileActiveId`, `mobileSnap`,
`overlay`, `overlayTab`, `dialog`. An expanded modal or an open settings dialog
surviving a refresh reads as the app being stuck rather than as a restored
preference.

A pre-redesign payload (which persisted `activeActivity`) is not migrated: the
loader falls back to the Map view and all sheets closed.

## 5. Keyboard (revises R1.7)

- `1`–`3` — switch main view, indexing the _visible_ list so players never hit
  a gap where the referee-only Assets view would be.
- `4`–`8` — toggle quick sheet, in rail order (a player, with two views and
  four visible sheets, gets `3`–`6`).

  > **Corrected (2026-07-28).** The quick-sheet digits are offset by the count
  > of _visible_ main views, not the constant 3 — so a player, who sees two
  > views, gets `1`–`2` for views and `3`–`6` for sheets. Previously `3` was a
  > dead key for players, and the shortcut sheet advertised the GM's ranges to
  > everyone.
  >
  > **Amended (2026-07-29).** The sheet list is now filtered by role as well
  > (`quickSheetsFor`), for the same reason: the referee-only `tables` sheet
  > would otherwise be a dead key at the end of a player's run.

- `Esc` — collapse an expanded sheet; failing that, close an open modal.
- `L` — open the Log modal and focus its chat input.
- `?` — shortcut sheet. `Ctrl+Z` / `Ctrl+Shift+Z` — map undo/redo.

## 6. Room quick sheet & players' notes

Selection is shared with the map canvas through
`MapToolController.selectedMapRoomId`: picking a room label with Select →
Object publishes it, and the sheet's rows write it back. It survives map
unmount, so the sheet keeps showing the last selection while another main view
is on stage.

- **Docked** — only the currently selected room, plus the Select → Object hint.
- **Expanded** — the full list (rename, renumber, delete, add, drag-reorder →
  sequential renumber, all GM-only; jump-to and select for anyone) plus the
  notes editor for the selected room.

**Players' notes** are per-map-room long-form markdown that _any_ seat may read
or write — not a referee field. They are CRDT-backed, exactly like the shared
party notes, so concurrent editors converge instead of stomping. All of a
session's room notes live in **one** Yjs doc (`room-notes`, a `Y.Map` of
`mapRoomId → Y.Text`; see `lib/collab/room-notes.svelte.ts`) rather than one doc
per room: the list renders a hover preview for every row, so a doc-per-room
would mean one RTDB subscription per room in the dungeon.

Consequence worth noting: this adds no field to the `MapRoom` Firestore schema,
so it needs **no migration and no rules change** (`rooms/{roomId}/yjs/{docName}`
is already writable by any authenticated member).

Room management was removed from Session settings entirely; that stage keeps
only session-wide config and the maintenance danger zone.

## 7. Markdown

`apps/web/src/lib/markdown.ts` — a ~70-line renderer, deliberately not a
library, supporting `#`/`##`/`###` (rendered as `h3`/`h4`/`h5` so a notes field
never injects an `h1` into the page outline), `**bold**`, `*italic*`, `- `
bullets, and blank-line-separated paragraphs.

The input is player-authored and rendered with `{@html}`, so every character
that is not part of a recognised construct is HTML-escaped _before_ any tag is
emitted; the output can only contain the small tag set the module writes itself.
Covered by `markdown.test.ts`, including the no-tags-from-source case.

Two consumers, both via `MarkdownEditor.svelte`'s Edit ⇄ Preview toggle: the
party `NotesPanel`, and the per-room players' notes (which also render through
`MarkdownView` in the row hover preview).

## 8. Testids

`activity-tab-{map,encounter,assets}` survive on the main-view tabs, in both
layouts — on desktop they are inside the activity drawer (§3.1) and only exist
while it is open. New: `activity-switcher`, `activity-current` (with
`aria-expanded`), `activity-drawer`, `hidden-roll-list`,
`hidden-roll-{id}`, `group-name-input-{sectionKey}`,
`quick-sheet-{id}` (with `data-mode`), `quick-sheet-toggle-{id}`,
`quick-sheet-{expand,collapse,close}-{id}`, `quick-sheet-grip-{id}`,
`quick-sheet-rail`, `quick-sheet-chips`, `log-open`, `log-overlay`,
`session-overlay`, `overlay-close`, `room-notes-{id}-{input,preview,toggle}`,
`room-notes-preview-{id}`, `room-add`, `quick-roll-d{n}`.

Retired: `activity-tab-{dice,characters,log,session}`, `mobile-activity-{id}`
(except `mobile-activity-session`, which now marks the mobile gear),
`activities-rail`, `tools-rail`, `tools-{collapse,expand}`,
`tool-sheet{,-handle}`, `log-{peek,peek-collapse,ticker}`, `chat-text-drawer`,
`dice-activity`, `characters-activity`.

`tests/e2e/helpers.ts`'s `openActivity()` keeps its old call signature and maps
each legacy activity id onto wherever its panel now lives, so the feature specs
did not have to be rewritten; it dismisses any open backdrop first, and opens
the activity drawer before reaching for a main-view tab
(`openActivityDrawer` / `closeActivityDrawer`, no-ops on mobile).

Added 2026-07-30: `roll-hidden-button` (the Hidden button, §2.1 — deliberately
not `hidden-roll`, whose prefix already collides with `hidden-roll-{id}`),
`group-card-{id}`, plus the map tools'
`vector-tool-select-{vertex,edge,object}`, `vector-tool-measure`,
`vector-tool-pen`, `measure-readout` and `map-label-tooltip`.

Added with group ownership (2026-07-30): `group-seat-{groupId}-{seatId}` (the
group card's owning-seat checkboxes), `session-default-group` (Session settings →
Players), and `selected-seat` (the map's readout of which character the last
token pick-up raised).

Retired with token ownership (2026-07-30): `ownership-panel`,
`ownership-row-{tokenId}`, `ownership-select-{tokenId}` — the Actor Ownership
panel went with the model it configured (Addendum C, R22). `cast-add-group` and
`board-assign-{tokenId}` went with it: creation is the Unassigned-bin rename and
membership is drag-and-drop. `helpers.ts` gained `claimOwnToken()` (a seat gives
itself a token from its own sheet, the only token→profile link left) and
rewrote `createGroup()` onto the promote-then-drag-back-out flow.

Retired 2026-07-30 with the Groups roster and the hidden-roll checkbox:
`hidden-roll` (the checkbox), `groups-panel`, `group-row-{id}`,
`new-group-name`, `new-group-member-{tokenId}`, `create-group-submit`,
`group-member-{groupId}-{tokenId}`, `select-mode-object`,
`vector-tool-select`, `vector-tool-annotate`.

Retired with the Blind Drawer: `blind-drawer`, `blind-draw-title`,
`blind-draw-die`, `blind-draw-roll`, `blind-draw-note`, `blind-draw-note-add`,
`blind-draw-row-{id}`, `blind-draw-text-{id}`, `blind-draw-reveal-{id}`,
`blind-draw-revealed-{id}`.
