## SPEC-047 — Hex crawl authoring: the thirds lattice and the tools it carries

**Status: Active**

SPEC-030 §5 closed the hex palette at Select plus the View tools, and it named the price of
re-opening it:

> Re-opening any overlay tool for hex maps means giving it an axial-space form first, and is
> a new intake item.

This spec is that form, and the tools it makes possible. It comes from IN-088 – IN-094 and
from DEC-080, DEC-081 and DEC-083, all three answered by the user on 2026-09-02.

Six sections, each with its own work item. §1 is the foundation and everything else reads
it; §6 is independent of the other five and may ship at any time.

**Terrain is deliberately absent.** IN-091 (the terrain paint tool, its union and its
free-form brush) has no section here: DEC-082 is unanswered, postponed by the user pending
WI-100's investigation, and the two alternatives still live differ by roughly a collection,
a migration and a rules block. Writing a section for it now would be improvising the answer.
It joins this spec as §7 once DEC-082 closes.

**What does not move, in any section.** RULE-006 is untouched and needs no amendment: a hex
map keeps exactly one coordinate space, that space is axial, `0,0` stays the map's centre,
and `hex.size` stays a render-time-only multiplier crossed once. Nothing here stores a pixel.
Nothing here reaches a square-lattice consumer — `pointInFloorUnion`, LoS, `snapCell`,
`snapCellCenter`, token snapping — from a hex map, which RULE-006 says must not happen.

---

### §1 The thirds lattice: `HexPoint`

**The finding this rests on.** Every hex centre and every hex corner is an exact integer
multiple of ⅓ of an axial coordinate. A hex's six corners sit at these offsets from its
centre, in axial units — constant at every hex, and independent of `hex.size` because
`axialToPixel` is linear in it:

    (⅔, −⅓)   (⅓, ⅓)   (−⅓, ⅔)   (−⅔, ⅓)   (−⅓, −⅓)   (⅓, −⅔)

Scale the space by 3 and all of them become integers. DEC-081 has the derivation and the
numeric check over an 81-hex patch at two sizes.

**The type.**

> **`HexPoint { q, r }`, in thirds of a hex step.** A **snapped** point is integer-valued; a
> **free** point is not. The render boundary is crossed exactly as it is today:
> `axialToPixel({ q: q / 3, r: r / 3 }, size)`.

**Classification is a mod-3 test, not a float comparison.** For an integer-valued `HexPoint`:

| `(q + r) mod 3` | What it is |
| --------------- | ---------- |
| `0` | a **hex centre** — and `(q/3, r/3)` is exactly the integer `Axial` that `hexTiles` is keyed by |
| `1` or `2` | a **hex corner** |

**Integers, not floats, and this is load-bearing.** Three hexes computing their shared corner
`(⅔, −⅓)` in floating point produce three *different* doubles —
`0.66666666666666662966`, `0.66666666666666674068`, `0.66666666666666640761`. Stored as
floats, two roads meeting at a corner would not literally meet, and "does this road join that
one" would become a tolerance question against `tolerance.ts`. Stored as integer thirds they
are the same value, exactly.

**What §1 ships.** In `packages/shared/src/map/hex/`, beside `axial.ts`, pure and store-free
and tested the way `axial.ts` is:

- `HexPoint`, distinct from `Axial` at the type level for the same reason `Axial` is distinct
  from a lattice `Point` — the mistake RULE-006 warns about should be a type error.
- `hexPointKey` / `parseHexPointKey`, the canonical `"q,r"` string form, with the same care
  `axialKey` takes over `-0`.
- `isHexCentre` / `isHexCorner`, and `hexPointToAxial` / `axialToHexPoint` for the centre case.
- `hexPointToPixel` / `pixelToHexPoint`, and `snapHexPoint` — the nearest thirds-lattice
  point, which is what Hex snap resolves to for a tool that anchors on corners (§3).

**Two annotations, in this work item, not ahead of it.** SPEC-030 §1 says "Axial hex
coordinates, integer"; that remains true of the *addressing scheme* and is annotated in place
to say so explicitly, the way WI-041 annotated §5. `axial.ts`'s header comment asserts the
fractional case "is never stored" and stops being true; it is corrected in the same change.
Neither is a rule amendment — see DEC-081.

**No UI.** §1 is geometry and tests. Nothing in the palette changes here.

> **Work item: WI-102.**
>
> **Built by WI-102** (2026-09-04), as specified and no wider.
> `packages/shared/src/map/hex/point.ts` holds the space: `HexPoint`, the six
> `HEX_CORNER_OFFSETS` in thirds, `hexPointKey`/`parseHexPointKey`,
> `isHexCentre`/`isHexCorner`, `hexPointToAxial`/`axialToHexPoint`,
> `hexPointToPixel`/`pixelToHexPoint` and `snapHexPoint`, with
> `hexPointAdd`/`hexPointEquals`/`hexPointCorners` as the small helpers the corner
> offsets are unusable without. `HexPoint` and `Axial` each carry a phantom `__space`
> brand, so passing thirds where whole steps are expected is a type error rather than a
> map drawn three times too large. SPEC-030 §1 and `axial.ts`'s header are annotated in
> the same change; no rule was amended (DEC-081), no storage and no UI moved. See
> `README.md` → "The thirds lattice".

---

### §2 Hex overlay storage

**What it stores.** One new map-scoped collection per overlay kind, under
`maps/{mapId}/…`, each document positioned by a `HexPoint`:

- **Hex symbols** (IN-092) — a `kind` from the contents catalog and a `HexPoint`. Integer-valued
  under Hex snap, free-valued under Free snap (§3).
- **Hex lines** (IN-094) — roads and rivers: an ordered run of `HexPoint`s, a kind
  (`road` | `river`), one of three shades, one of three widths, and its join style.

**The join style rides the document.** Roads mitre and rivers round, but that is a property of
the drawn line, not something to infer from which tool made it — the same distinction the
square map already draws between a snapped Corridor's flat caps and a free Path's round ones
(SPEC-028 §9). A line that was drawn as a river and re-coloured is still round.

**Shades and widths come from a catalog, never from the document.** Three browns and three
blues live beside `HEX_TERRAIN_CATALOG` in `packages/shared/src/map/hex/catalog.ts`, and a
document carries the *kind* and an index, never a colour — the same rule SPEC-030 §2 set for
terrain, and for the same reason: re-drawing the palette must stay a change to the catalog
rather than a migration.

**What §2 owes each rule.**

- **RULE-007** — `CURRENT_SCHEMA_VERSION` goes 28 → 29, with a migration and a migration test.
  The migration is a no-op on existing data (the collections are sparse and absent), and it is
  still written and tested, as `HexTile.note`'s was at v26.
- **RULE-014** — each collection name joins `EXPORTED_MAP_COLLECTIONS`. `vttcamp.ts` already
  handles map-scoped collections generically, so what is owed here is a **round-trip test**,
  not a mechanism. This is not optional politeness: under RULE-009's amendment the `.vttcamp`
  *is* the database in a local build, so a dropped field drops the user's campaign.
- **RULE-004** — one `match /<collection>/{id}` block each in `firebase/firestore.rules`,
  member-or-GM write and `signedIn()` read, copying `hexTiles`' existing block, with rule tests.
- **RULE-001** — the new store methods go in `campaign-store.contract.ts` and must pass against
  `MemoryStore`, `FirebaseStore` **and** `LocalStore`.
- **RULE-003** — placing a symbol and completing a line are settled writes, one per gesture.
  Neither is a drag frame, so neither goes near RTDB. (Terrain painting is the case that does,
  and it is not in this spec — see the note above.)

**Sparse, and pruned on clear**, exactly like `hexTiles`: an unplaced symbol has no document,
and deleting the last thing a document carries deletes the document rather than leaving an
empty one. An infinite plane can only be stored sparsely, and "erased" and "never drawn" must
be the same state.

> **Work item: WI-103.**
>
> **Built by WI-103** (2026-09-04), as specified and no wider. Two collections,
> `maps/{mapId}/hexSymbols` and `maps/{mapId}/hexLines`, typed as `HexSymbol` and
> `HexLine` in `types.ts` and validated by `HexSymbolSchema`/`HexLineSchema` over a
> shared `HexPointSchema` that is deliberately **not** `.int()` — a snapped point is
> integer-valued and a free one is not, and both are legitimate stored positions.
> `HEX_LINE_CATALOG` (three browns, three blues, and each kind's starting join) and
> `HEX_LINE_WIDTHS` (three multiples of `hex.size`) join `catalog.ts`; a document
> carries the kind and an *index*, and an out-of-range index clamps rather than
> dropping the line.
>
> **The one place the section's own wording had to be read rather than followed
> literally: the document id.** §2 says each document is "positioned by a `HexPoint`",
> and the obvious reading — key it by `hexPointKey`, as `hexTiles` is keyed by
> `axialKey` — cannot hold, because a Free-snap point is fractional and has no key
> (§1: `parseHexPointKey` rejects a fractional string rather than rounding it onto the
> lattice). It would also collapse two symbols in one hex to one document, which §4's
> "one catalog symbol per click" does not ask for. So the id is minted, as
> `placeSymbol`'s is, and the point is a stored field.
>
> Each rule's due was paid where §2 said: `CURRENT_SCHEMA_VERSION` 28 → **29** with a
> no-op migration and its tests (RULE-007); both names in `EXPORTED_MAP_COLLECTIONS`
> with a `.vttcamp` round-trip test that pins the vertices exactly (RULE-014); a
> `match` block each in `firestore.rules`, copying `hexTiles`', with rule tests
> (RULE-004); six methods on `campaign-store.contract.ts`, passing against
> `MemoryStore`, `FirebaseStore` and `LocalStore` (RULE-001); one settled write per
> gesture, nothing on RTDB (RULE-003). **No UI and no tool** — the palette that draws
> these is §§3–4. See `README.md` → "Hex overlays — symbols, roads and rivers".

---

### §3 The hex snap mode, and the hex palette

**`VectorSnapMode` grows a member** — `'free' | 'full' | 'half' | 'hex'` — and
`MapToolbar`'s unconditional `SNAP_MODES` array becomes a function of the map's grid kind. A
hex map offers **Hex** and **Free**, and nothing else (IN-090). Every exhaustive
`Record<VectorSnapMode, …>` answers for `'hex'`; that it fails to compile until it does is
the point of adding a member rather than reinterpreting one (DEC-080).

> **Corrected by WI-104 (2026-09-04).** DEC-080's text (written 2026-09-02) named two such
> `Record`s, `DEFAULT_BAND_WIDTH` and `snapCursorColors`. By the time WI-104 ran,
> `vector-engine.ts`'s `snapCursorColors` had been refactored to take a `'floor' | 'rock' |
> 'select'` kind rather than a `VectorSnapMode` — present-day code, not this spec, is what
> WI-104 read (`CLAUDE.md`'s precedence). `DEFAULT_BAND_WIDTH` is the one `Record` that
> exists and needed the new member; nothing else in the codebase switches exhaustively on
> `VectorSnapMode`.

**Hex means "each tool snaps to its own anchor", which is what Cell already means.** Under
`full` today, one mode means three different quantizations depending on which tool holds it:
grid intersections for Wall/Door/Polygon, the cell centre for Room/Corridor/Path/N-gon/Carve,
the cell's top-left corner for Symbol/Label. Hex is the same rule on the hex lattice:

| Hex tool | Hex snap anchors to | Free snap |
| -------- | ------------------- | --------- |
| Symbol | the hex the pointer is inside — an integer-valued centre `HexPoint` | the raw pointer, as a free-valued `HexPoint` |
| Label | the same | the hex the pointer is inside — a label always belongs to a hex (§5) |
| Road, River | `snapHexPoint` — the **nearest thirds-lattice point**, centre or corner | the raw pointer per vertex |

So roads get corners without a third snap mode existing to give them one.

**The palette stops being derived.** `HEX_TOOL_IDS` is
`TOOL_GROUPS.filter(g => g.id === 'select' || g.id === 'view').flatMap(g => g.tools)` — a
filter over the square map's groups, which cannot express a tool the square map does not have.
It becomes an authored list. `tool-groups.test.ts`'s guarantee — every `MapToolId` is in
exactly one group, so no tool is unreachable — holds unchanged and covers the new ids.

**`data-testid`s.** New controls get new testids; no existing one moves, is renamed, or is
removed (RULE-005).

> **Work item: WI-104.** Blocked on WI-102.

---

### §4 The symbol, road and river tools

**Symbol** places one catalog symbol per click. Under Hex snap it lands on the hex the pointer
is inside; under Free snap it lands where the pointer is and stays there — IN-092's "not
required to snap to the grid in free snap", read literally.

**Road and River** are one polyline gesture with two configurations:

| | Road | River |
| --- | --- | --- |
| Shades | three browns | three blues |
| Widths | three, increasing | three, increasing |
| Vertices | **hard angles** — mitred joins | **round** |

Both draw click-to-click with a double-click to finish, the way Polygon and Path already do,
so the gesture is one a referee has met. Under Hex snap each vertex resolves through
`snapHexPoint`, which is what makes a road run corner to corner and a river follow the lattice;
under Free snap the vertices are raw and the line is organic.

The three widths and three shades are a fixed option set on the toolbar, not a free-form
number — the same choice SPEC-028 made for the N-gon's sides and the band widths, and for the
same reason: the useful values are the ones that land on the grid, and a 7.5-wide river was
reachable and never wanted.

> **Work item: WI-105.** Blocked on WI-103 and WI-104.
>
> **Built by WI-105 (2026-09-04), as specified and no wider.** Three new
> `MapToolId`s — `hexSymbol`, `road`, `river` — added to `HEX_TOOL_IDS`
> (`apps/web/src/lib/map/tool-groups.ts`), not to `TOOL_GROUPS`: they are not
> square-map tools wearing a hex hat, so `PaletteToolId` now excludes them
> too, and `MapToolbar` renders them in their own hex-only row (testids
> `hex-tool-symbol`/`hex-tool-road`/`hex-tool-river`), gated on `isHexMap`
> exactly as the Hex/Free snap set is (DEC-080). `tool-groups.test.ts`'s
> completeness guarantee was extended rather than weakened: every `MapToolId`
> is still reachable from exactly one place, `TOOL_GROUPS` for the square
> tools and `HEX_TOOL_IDS` for these three.
>
> **Gesture and resolution.** `hexSymbol` is a single click, short-circuited in
> `VectorMapView`'s stage `pointerdown` handler the way the square map's own
> `symbol` tool is — a hex map has no lattice to convert the pointer into, so
> the handler needs the raw world pixel. `road`/`river` reuse the Wall/Path/
> Polygon click-to-click/double-click(or Enter) gesture, collecting into a new
> `hexCollecting: HexPoint[]`, kept apart from the lattice `collecting: Point[]`
> array so a `HexPoint` — thirds of a hex step — can never reach a
> square-lattice consumer at the wrong scale (RULE-006). §3's table is read
> literally: Hex snap resolves Symbol to `hexMap.axialToHexPoint(hexMap.
> pixelToAxial(...))` (an integer centre) and each line vertex through
> `hexMap.snapHexPoint(hexMap.pixelToHexPoint(...))` (nearest corner or
> centre); Free snap keeps the raw `pixelToHexPoint` result for both. A
> zero/one-point double-click (or Enter) on `road`/`river` discards rather than
> commits — `finishMultiClick`'s existing `>= 2` guard, extended one more
> `else if` rather than reinvented, satisfies DEC-085 here with nothing new to
> add.
>
> **Store and render.** Placement and line-completion call `store.
> placeHexSymbol`/`store.addHexLine` directly (this component owns
> `CampaignStore` calls; WI-103's methods were otherwise unused until now).
> `hexSymbols`/`hexLines` are subscribed alongside `hexTiles` and rendered by
> two new `VectorMapEngine` methods, `renderHexSymbols`/`renderHexLines`, both
> on `overlay` — a placed symbol the same layer a square map's `symbol` uses,
> a line above the grid lines so it reads against the terrain under it. A
> line's `width`/`shade` are resolved from `HEX_LINE_WIDTHS`/`HEX_LINE_CATALOG`
> at draw time only, never stored as values (§2); `join` is drawn as Pixi's
> `'miter'`/`'round'` directly from the document's own `HexLineJoin`.
>
> **Deviation: no live line preview.** §4 only specifies the gesture and the
> committed line, not a live ghost — Wall's `buildWallPreviewSegs` has no
> `HexPoint`-space counterpart, and building one would mean new preview
> plumbing in `vector-engine.ts` beyond a straightforward analogous addition.
> Shipped without one: a Road/River click still lands and accumulates
> normally, it just isn't previewed mid-draw. Recorded here rather than as a
> silent gap.
>
> **Not built, deliberately: hex-object selection/removal.** `removeHexSymbol`/
> `removeHexLine` exist (WI-103) and stay unused — §4 describes placement
> only, and hex Select still picks hexes, not objects (RULE-015: no scope
> creep). See `README.md` → "Hex overlays — symbols, roads and rivers".

---

### §5 The hex label gesture

**Most of this already exists, and the section says so rather than rebuilding it.**
`HexTile.note` is per-hex markdown, shown on hover through the same `map-label-tooltip` a room
label uses, authored today in the hex-tile sheet (SPEC-030 §4, schema v26). It exports with the
map, it survives a map delete, and it has rules.

**What is missing is a gesture.** IN-093 asks for a Label tool that "adds detail tied to that
map's address", and — under Free snap — "just find which hex we are within and add the label to
that hex". That is `hexMap.pixelToAxial`, which Select already calls, followed by the note
editor the sheet already opens.

**So the Label tool writes `HexTile.note`. It does not introduce a second thing.** Under both
snap modes it resolves the pointer to a hex and opens that hex's note — Hex and Free differ in
nothing here, because a note belongs to a hex by definition and there is no fractional position
for it to occupy. **No new schema, no new collection, no migration.**

**This qualifies SPEC-030, and the qualification is the point.** §1 makes the coordinate the
addressing scheme "superseding map labels as the addressing scheme", and §5 says "Label is
doubly out". Both stay true: this tool invents no name and places no anchor. It is a faster way
to reach a note on a hex the coordinate already addresses. SPEC-030 §5 is annotated in place to
record that.

> **Work item: WI-106.** Blocked on WI-104. The smallest item in the programme.
>
> **Built by WI-106 (2026-09-04), as specified.** `hexLabel` joins `MapToolId` and
> `HEX_TOOL_IDS` (`apps/web/src/lib/shell/map-tool-controller.svelte.ts`,
> `apps/web/src/lib/map/tool-groups.ts`), reachable through `MapToolbar`'s hex-only
> row (testid `hex-tool-label`), not `TOOL_GROUPS` — the same shape of reason
> `hexSymbol`/`road`/`river` are there. `VectorMapView`'s stage `pointerdown` handler
> short-circuits it exactly like `hexSymbol` (a hex map has no lattice to hand
> `onPointerDown`), calling a new `handleHexLabelClick`: resolve the pointer to a hex
> through `hexAt` (this component's own `pixelToAxial` wrapper, the one `Select`'s
> gesture already uses) and set `mapCtrl.selectedHex`, unconditionally — unlike
> Select, this gesture never toggles the selection off, since its point is to land
> on the hex whose note the sheet should show. `HexTilePanel` renders that hex's
> note unchanged; no new store method, no new prop threaded through `MapToolbar`.
> **No live snap-mode dependence**: both Hex and Free resolve through the same
> `hexAt`, so the Snap selector is not shown for this tool (`SNAP_TOOLS` excludes
> it) the way it is not shown for Select either.

---

### §6 The symbol and terrain art pack

The 37 supplied `.svg` files at `docs/intake/hex-symbols/` become the hex palette, on the terms
DEC-083 settled.

**Extend and alias; never rename in place.** New kinds are added alongside the existing 9
terrain and 10 contents kinds. Where a new kind supersedes an old one, **the old `kind` string
keeps resolving** — to the new art, if that is the intent — rather than being deleted or
renamed. A stored `terrain: 'mountains'` whose entry had become `mountain-major` would resolve
to `UNKNOWN_HEX_KIND` and render grey, and that is a stored field's meaning changing:
RULE-007, a migration, a round-trip test. Aliasing keeps the whole change inside the catalog's
own promise that "re-drawing the whole terrain set is a change to this file rather than a
migration". **This section ships no migration**, and if one turns out to be needed, that is the
signal that a kind was renamed rather than aliased.

**The pack is re-authored white.** Every glyph currently inks at `#111111`.
`catalog.ts` states the requirement and the reason: the art is authored white because both
overlays are tinted at the render boundary — terrain to whichever of
`HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT` contrasts with its own colour, contents to black — and a
tint multiplies, so black art cannot be tinted lighter. Changing the tint rule instead would
cost SPEC-030 §2's contrast guarantee, which is what stops a re-coloured terrain from orphaning
its overlay. Mechanically this is a `#111111` → `#ffffff` substitution across 37 files with a
uniform structure (every drawn element already carries `class="ink"`), not a redraw.

**`sym-water.svg` becomes single-tone.** It is the one two-tone file (`class="tint ink"`,
`fill="#a8c4d0"` with a `#111111` stroke), and one multiply tint cannot express two tones. Its
fill goes; a pipeline notion of untinted art is a larger change than one file justifies.

**Provenance — answered, and still a deliverable of this section.** The pack carries no licence
or authorship metadata in the files themselves. **Its origin is now on record** (user,
2026-09-02): there is **no third-party source**. The project owner states the files were
generated by Claude in a separate session for a separate project of their own, and supplied
here. Nothing was cloned, traced or copied from a licensed pack, which is the risk SPEC-003
§5's licence discipline exists to contain.

`ATTRIBUTION.md` — which SPEC-003 §5 cites and which does not yet exist (IN-078) — is created
by this work item, and the pack's entry attributes it as **the owner's own generated art, not
third-party work**, in those terms and no stronger: the entry records what the owner stated,
which is what an attribution file is for. The files do not land in `apps/web/public/` before
that entry exists.

This does **not** discharge IN-078 on its own. That item is the whole file SPEC-003 §5 cites,
which also owes an entry for the dice work's prior-art posture. IN-078 stays Open for the
remainder — cheaper now, since the file will exist.

**Which catalog each file joins** is decided in this work item from the art itself, not from the
filename split guessed in `docs/intake/hex-symbols/README.md`.

> **Work item: WI-101.** Independent of §§1–5 — it may ship first, last, or in parallel.
