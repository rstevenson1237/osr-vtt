## SPEC-054 — First-run cues and palette affordances

**Status: Active**

_(New with the 2026-09-18 introspective's user-experience lens — IN-152 – IN-155, IN-159 –
IN-161, IN-163, IN-164, IN-168, IN-171, IN-190, IN-191, IN-193, all classified Simple (user,
2026-09-23). No `R`-number predecessor.)_

The shell works well for someone who already knows it and says nothing to someone who does
not (`docs/INTROSPECTIVE-2026-09-18.md` §1.1). Every section below adds a cue, a label or a
shortcut to a control that already exists. **None of them moves, renames or removes a
`data-testid`** (RULE-005), writes a new stored field, or changes what an existing control
does. A plan that finds it must do any of those is re-triaged, not widened.

### §1 — Empty states (IN-152)

- **Empty map.** While the active map has no floor and no background, the Map view shows a
  hint card: _Draw with Map tools · Add a background in Assets · Invite players_. Each phrase
  is a link that opens the named surface. The card is dismissable; dismissal is per viewer,
  kept in `ShellState`, and survives a reload. Players see a player version (no Assets, no
  drawing) or nothing — never a referee instruction they cannot follow.
- **Empty board.** An Encounter board with no creatures and no seats shows a one-line hint
  naming the `+` card.
- **"Show me around"** is an entry in the `?` shortcut sheet that re-shows every dismissed
  hint.
- **Not in scope:** a sample room. It needs the `.dd2vtt` importer, which does not exist
  (IN-186).

### §2 — The creator is seated (IN-153)

On the hosted build, a successful `createRoom` calls the existing `joinRoom(roomId,
'Referee')` before navigating — **the name is always `Referee`** (user, 2026-09-23), exactly
as the local build already seats. The referee never sees the join gate for a room they just
created. The **player** join path is unchanged and gains no prompt (RULE-011); a referee who
opens the invite link in another browser still meets the ordinary gate.

### §3 — The rail shows every view, and labels on first visit (IN-154)

(User, 2026-09-23.) **All three main-view icons sit in the rail** for a seat that can see
them (`mainViewsFor`); the hover `ActivityDrawer` keeps only the rail-move handle. **Labels
render beside rail icons — views and quick sheets — until the viewer's first rail
interaction**, then hide; the "seen" flag is per viewer in `ShellState`. Touch devices get
the same labels, which is the point: `title` tooltips do not exist there.

### §4 — A disabled tool says why (IN-155)

Under the View lock, a click on a disabled drawing tool shows a one-line hint beside
`map-mode-toggle` — _Switch to Edit to draw_ — for a few seconds. The lock, its `'view'`
default and `isViewTool` are unchanged. (Remembering the mode per room is IN-156, a separate
Shape A item.)

### §5 — Occasional map actions reach the docked palette (IN-159)

**Add creature** and **Download PNG** render in the docked Map tools palette as well as the
expanded sheet, each with its existing testid. **At most one instance of each testid is in
the DOM at a time** — the docked and expanded renders are exclusive, never simultaneous.

### §6 — One word for each thing (IN-160)

(User, 2026-09-23.)

- The **Room** quick sheet (map rooms: labels and per-label notes) is titled **Keys**, after
  the dungeon key it is. "Room" in user-facing copy then means only the campaign room.
- User-facing copy says **Referee**, never "GM". Code identifiers (`isGM`, `gmUid`,
  `gmPrivate`), the activity id `'room'`, and every testid are unchanged.

### §7 — Tool hotkeys (IN-161)

Single, unmodified keys switch the map tool while the Map view is the main view:

| Key | Tool    | Key | Tool       |
| --- | ------- | --- | ---------- |
| V   | select  | R   | room       |
| H   | pan     | C   | corridor   |
| E   | eye     | W   | wall       |
| M   | measure | D   | door       |
| P   | ping    | T   | text (§13) |

The key is a field on the tool's entry in `TOOL_GROUPS`, and the palette tooltip, the `?`
sheet and the handler all read it from there. Unbound tools stay unbound until a later item
names a key. **Reserved and never bound:** digits (views/sheets), `?`, `L` (chat), and any
key with Ctrl/Meta/Alt. Keys are inert while a text field has focus (`isTypingTarget`) and
while a dialog owns the keyboard. A drawing tool's key under the View lock does what a click
does — shows §4's hint.

### §8 — Token snap says what it is (IN-163)

The Character sheet's `token-snap-mode` control is labelled **Token snap** with a one-line
hint: _Hold Alt while dragging to place freely._ Its values and meaning are unchanged.

### §9 — Hex palette: Paint and Inspect (IN-164)

The hex tools render as two visual rows: **Paint** (the click tools that write terrain and
notes) and **Inspect** (Select, which opens `HexTilePanel` for the same fields). The rows'
headings say that both write the same field. No tool, id or testid changes.

### §10 — Room not found; reconnecting (IN-168)

- A room id whose room document does not exist shows **Room not found** with a link back to
  the lobby, instead of "Loading room…" forever. The state is decided from what the room
  subscription already reports; if that cannot distinguish "missing" from "not yet loaded"
  without a new store method, this section stops and is re-triaged.
- While the client reports itself disconnected (RTDB `.info/connected` or equivalent the
  store already exposes), a thin **Reconnecting…** banner shows over the stage.

### §11 — Version and a way to report a problem (IN-171)

The hosted build renders `VITE_APP_VERSION` in the account menu (or the Session settings
footer where there is no menu), beside a **Report a problem** link to
`https://github.com/rstevenson1237/osr-vtt/issues/new` with the version prefilled in the issue
body (user, 2026-09-23). The local build's `local-app-version` is unchanged.

### §12 — Path measurement and drag distance (IN-190)

- The Measure tool accepts further clicks: each extends the path, the readout shows the
  running total, and Escape or double-click ends it.
- While a token is dragged, a small chip beside it shows the distance from where the drag
  began.
- Both go through `measureSpanText` (`map/vector-tools.ts`), which already answers per grid
  kind. Nothing is written.

### §13 — A text tool (IN-191)

A **Text** tool in the Overlay group places a `Drawing` of kind `'text'` — a value
`DrawingKindSchema` already admits and the engine already draws — through the existing
drawing write path. Click to place, a prompt for the string, one settled write (RULE-003).

### §14 — "Now on" (IN-193)

When the active map changes, every client shows a transient notice, _Now on: <map name>_,
for a few seconds. The client that made the change does not.
