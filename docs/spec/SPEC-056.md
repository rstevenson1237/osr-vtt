## SPEC-056 — Contract changes from the 2026-09-18 introspective

**Status: Active**

_(New with the Deceptive items of the 2026-09-18 introspective — IN-158, IN-166, IN-167,
IN-169, IN-173, IN-176, IN-183, IN-184, IN-186, IN-192 — each designed with the user on
2026-09-23; decisions DEC-108 – DEC-113. No `R`-number predecessor.)_

Unlike SPEC-054 and SPEC-055, every section here **changes a contract** — a testid's home,
what undo or selection means, what a snapshot may be, a stored field, a new store method, or a
new input path. Each section is its own work item (never batched, RULE-016) and names the rule
it answers to.

### §1 — Handouts get their own quick sheet (IN-158)

A referee-only **Handouts** quick sheet (`availability: 'gm'`), added **last** in the
referee group of `QUICK_SHEETS` so every existing digit shortcut keeps its key. The handout
controls leave the Session settings modal and move there **with their testids**
(`handout-title`, `handout-image`, `handout-save`, `handout-reveal-*`, …; RULE-005);
`tests/e2e/portability.spec.ts`, the one spec that reaches them, opens the sheet instead of the
modal in the same change. The player-side `handout-viewer` is unchanged.

### §2 — Undo (IN-166, IN-184; DEC-108)

1. **One stack per client.** The `UndoStack` moves out of `VectorMapView` into a room-level
   service owned by `RoomShell`, and `RoomsPanel`'s local stack is folded into it. The stack is
   **cleared whenever the viewed map changes**. Undo reverses only this client's own actions;
   it restores each entry's `from` state, last-writer-wins.
2. **Deletes are undoable**: symbol, label, door and drawing deletes — Backspace on the canvas
   and delete in the Keys sheet alike — push an entry whose undo re-creates the object with
   its id.
3. **Token moves and group changes are undoable**: a single drag, a multi-token drag (§3) as
   one entry, and moving a creature between encounter groups.

README → "The selection model" and SPEC-037's "deletes are not on the undo stack" are
updated with §2.2.

### §3 — Selecting several tokens (IN-167; DEC-109)

- **Select joins the View group** (`isViewTool('select')` is true). Under **View** it selects
  tokens, and geometry **read-only** — a selected vertex, symbol, label, door or drawing shows
  its tooltip/note but cannot be moved, resized or deleted. Under **Edit** it grabs everything,
  as today.
- **Shift-click** toggles a token in the selection in either mode.
- **A lasso that catches any token selects tokens only.** Backspace never deletes a token.
- **Dragging any selected token moves the set**: RTDB drag frames while dragging, one
  `moveTokens` batch on release (RULE-003), one undo entry (§2.3).
- A readout `selected-token-count` is added for the e2e suite.

### §4 — Offline cache on the hosted build (IN-169; DEC-110)

`persistentLocalCache({ tabManager: persistentMultipleTabManager() })` where the hosted Firestore
instance is created, falling back to the memory cache if IndexedDB is unavailable. SPEC-054
§10's banner reads **Offline — changes will sync** while the client is disconnected and has
pending writes. The local build is untouched and must still contain no Firebase (RULE-009).

### §5 — Listener guarantees, then one collection primitive (IN-173)

1. **Pin.** The contract suite gains, for every `subscribeX`, tests that pin: the first
   callback fires once with the current contents (empty included); ordering is as documented
   per method; after unsubscribe no callback fires; a permission error reaches the error path
   rather than an empty snapshot. Where the three stores disagree today, the disagreement is
   logged as an intake item and the test pins today's documented behaviour.
2. **Migrate.** `FirebaseStore` gains a private `collectionOf<T>(path, converter)` returning
   `{ subscribe, set, remove, batch }`, and the per-collection methods become calls to it, in
   slices, each slice green against the pinned suite. The `CampaignStore` interface does not
   change.

### §6 — One migration ledger (IN-176; DEC-111)

`Room.collectionsMigratedTo?: number`, next schema version; absent = never walked. New store
method `migrateRoomCollections(roomId)` runs the collection steps — adopt legacy flat layout
(`ensureActiveMap`'s adoption), background split (`migrateMapBackgrounds`), token letters
(`migrateTokenLetters`) — above the stamp, then sets it. `RoomShell`'s three GM effects become
one call. Ships with contract tests (RULE-001), a migration test and a `.vttcamp` round-trip
test (RULE-007); an imported archive is stamped current.

### §7 — One modal stack (IN-183)

A single modal stack holds prompts, confirms, the token picker, the shortcut sheet and dialogs,
and the Log/Session overlays. **Escape closes the top entry**; an expanded quick sheet is not
on the stack and, as today, closes before any overlay. Focus is trapped in the top entry and
restored to the opener on close. Global shortcuts are inert while the stack is non-empty.
Every testid stays on its control.

### §8 — Import a `.dd2vtt` / `.uvtt` (IN-186; DEC-112)

An **Import UVTT** action in Assets creates a **new square-grid map**: grid size from
`resolution.map_size`; walls from `line_of_sight` and `objects_line_of_sight` with
`source: 'imported'`; doors from `portals` (`bounds[0]`/`bounds[1]` → `a`/`b`, `closed` →
state). Coordinates are `point − resolution.map_origin` in lattice units, floats; nothing is
scaled by `pixels_per_grid` (RULE-006). The image and `lights` are ignored. Parsing is a pure
function in `packages/shared` with unit tests against the bundled
`sample-dungeon.dd2vtt`; the writes go through existing store methods in one batch. A file that
fails to parse is rejected with a message and writes nothing.

### §9 — Fog on hex maps (IN-192; DEC-113)

- `HexTile.revealed?: true`, next schema version; absent = hidden. A tile doc may exist for
  the flag alone; a tile left with no fields is deleted.
- When the map's `fog.enabled` is true, players see unrevealed hexes as fog (terrain, contents
  and notes not drawn); the referee sees them dimmed.
- A **Reveal / Hide hex** tool (hex palette, Edit only) paints by click or drag and commits
  one batched write on release (RULE-003); **Reveal all** and **Reset** mirror square fog.
- Axial keys only; no square-lattice consumer is reached (RULE-006). Migration, migration
  test and `.vttcamp` round-trip (RULE-007).
