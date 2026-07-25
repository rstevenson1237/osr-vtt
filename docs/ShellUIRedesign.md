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

## 2. Registries

`apps/web/src/lib/shell/activities.ts`.

**Main views** (`MAIN_VIEWS`) — exactly one on stage at a time:

| id          | availability |
| ----------- | ------------ |
| `map`       | all          |
| `encounter` | all          |
| `assets`    | **gm**       |

**Quick sheets** (`QUICK_SHEETS`) — independent open/closed toggles, none
GM-gated:

| id          | group     | body                                                       |
| ----------- | --------- | ---------------------------------------------------------- |
| `maptools`  | `world`   | `MapToolPalette` (the former Tools rail content)           |
| `character` | `records` | `CharacterDock` + identity header + quick d20              |
| `roll`      | `play`    | quick die buttons + recent rolls; `DiceTray` when expanded |
| `room`      | `referee` | `RoomsPanel` — selected room docked, full list expanded    |

**Map tools are no longer referee-only.** Map drawing is open to every seat,
consistent with `VectorMapSystem_Spec` §1's "all room members can write" trust
model. The referee-only _controls_ that remain (the hidden-layer PNG export
toggle) carry their own `isGM` gate inside `MapToolbar`.

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
- `4`–`7` — toggle quick sheet, in rail order.
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
layouts. New: `quick-sheet-{id}` (with `data-mode`), `quick-sheet-toggle-{id}`,
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
did not have to be rewritten; it dismisses any open backdrop first.
