## SPEC-047 — Hex crawl authoring: the thirds lattice and the tools it carries

**Status: Active**

SPEC-030 §5 closed the hex palette at Select plus the View tools, and it named the price of
re-opening it:

> Re-opening any overlay tool for hex maps means giving it an axial-space form first, and is
> a new intake item.

This spec is that form, and the tools it makes possible. It comes from IN-088 – IN-094 and
from DEC-080, DEC-081 and DEC-083, all three answered by the user on 2026-09-02.

Seven sections, each with its own work item. §1 is the foundation and everything else reads
it; §6 and §8 are independent of the rest and may ship at any time.

**§7 is the terrain tool, and it arrived last.** IN-091 had no section here while DEC-082 was
open — the user postponed it on 2026-09-02 pending WI-100's investigation, and the two
alternatives still live differed by roughly a collection, a migration and a rules block, so
writing the section would have been improvising the answer. **DEC-082 closed 2026-09-07** —
(b), narrowed: terrain is locked to single hexes — and §7 is that answer. It is much smaller
than the first draft of this spec assumed: no collection, no migration, no rules block, no new
coordinate space.

**§8 replaces §6's terrain art**, and is numbered 8 because §7 was still reserved for the
terrain tool when it was written. It is independent of §7: §7 is the *tool* that paints a
terrain kind, §8 is the *art* a kind resolves to, and neither needs the other.

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

---

### §7 The terrain tool

**Terrain is painted one hex at a time.** The tool places the selected `HEX_TERRAIN_CATALOG`
kind on the hex the pointer is inside, one click per hex. There is no brush, no drag, no
free-form region and no sub-hex resolution.

This is DEC-082 answered **(b), narrowed** (user, 2026-09-07): the investigation's
recommendation, with the drag affordance it kept removed as well. **What that costs is
stated here rather than left to be discovered** — a referee laying down a forest clicks each
hex of it, and the free-form brush that would have made that one gesture is postponed as a
body of work alongside IN-084, not denied.

**The gesture, and why it is the one the palette already uses.**

| | |
| --- | --- |
| Place | One click paints the hex under the pointer with the selected kind. |
| Erase | The same click on a hex that already carries that kind clears it — `setHexTerrain(…, null)`. |
| Kind | A fixed option set on the toolbar, driven by `HEX_TERRAIN_CATALOG`, exactly as §4's Symbol is driven by `HEX_CONTENTS_CATALOG`. |
| Snap | **Not offered.** Both modes would resolve to the same hex, so the Snap selector is hidden for this tool, the way it is for Select and for §5's Label. |

`hexTerrain` joins `HEX_TOOL_IDS` and is rendered in `MapToolbar`'s hex-only row beside
Symbol, Road and River — not `TOOL_GROUPS`, which is the square palette's own list (§3). It
is a new control and takes a new `data-testid`, not a moved one (RULE-005).

**Nothing about storage changes, and that is the point of the narrowing.** The tool is a
second caller of `setHexTerrain`, which the hex-tile sheet already calls. Its contract already
says what this tool needs and needs no restatement: *"One settled write per painted hex
(RULE-003): this is a click, not a drag frame"*, the document id is derived from the axial
coordinate so a caller never spells it, and clearing the last thing a hex carries deletes the
document rather than leaving an empty one. **A drag-brush would have changed that guarantee** —
40 hexes in a stroke is 40 Firestore writes, which is what RULE-003 exists to prevent, and
buying it back needs the RTDB-draft-plus-batched-commit pattern. Locking the tool to a click is
what keeps `setHexTerrain` exactly as it is.

**Terrain and contents stay independent**, as `setHexContents`' contract already states:
painting terrain leaves a hex's contents icon and its note alone, and a hex may carry any of
the three without the others.

**Three things this section does not do.**

- **No union, and no border colour.** DEC-082's own "so yes" to the user's parenthetical
  *(add a border colour?)* is **withdrawn** (user, 2026-09-07). Adjacent like-terrain hexes
  are not merged into one outlined shape at render time, and `HexTerrainEntry` gains no border
  field. **40 painted hexes keep their 40 visible seams**, and that is accepted rather than
  overlooked. **IN-105 is Denied.**
- **No scatter.** Each hex keeps the single centred overlay SPEC-030 §2 already draws. The
  per-hex seeded scatter is **IN-106**, still Open — it survives DEC-082's answer untouched,
  since it stores nothing and never needed a region, but it is not this section's to assume.
- **No free-form geometry of any kind**, so nothing here touches §1's `HexPoint` lattice.
  The tool addresses whole hexes by `Axial`, which is SPEC-030 §1's addressing, unchanged.

**What would reopen this section.** A referee who paints **coastlines** — the one terrain
boundary whose shape is the content rather than the decoration, which neither a click-per-hex
tool nor an outline recovers. DEC-082 records that as the thing that would reverse its answer;
it would reopen DEC-082, not just this section.

> **Work item: WI-111.** Independent of §§1–6, all of which have shipped.
>
> **Built by WI-111 (2026-09-08), as specified and no wider.** `hexTerrain`
> joins `MapToolId` and `HEX_TOOL_IDS`, not `TOOL_GROUPS` (`tool-groups.ts`'s
> `PaletteToolId` excludes it for the same reason it excludes `hexSymbol`/
> `road`/`river`/`hexLabel`): it is rendered in `MapToolbar`'s hex-only row
> beside them (testid `hex-tool-terrain`), gated on `isHexMap`. A click
> short-circuits `VectorMapView`'s stage `pointerdown` the way `hexLabel`'s
> does — a hex map has no lattice to hand the square-map dispatch — resolving
> through `hexAt` (the same `pixelToAxial` Select's own click uses) into a new
> `placeHexTerrainAt`, which reads the hex's current `HexTile.terrain` out of
> the already-subscribed `hexTiles` and calls `store.setHexTerrain` with the
> toolbar's selected kind, or `null` when that kind is already painted there —
> the click-to-erase gesture this section specifies, with no new store
> method. The kind picker (`hex-terrain-kind`, `HEX_TERRAIN_CATALOG`) is its
> own `MapToolController` field, `selectedHexTerrainKind`, independent of
> `selectedHexSymbolKind` exactly as `setHexTerrain`/`setHexContents` are
> independent writes. Not joined to `SNAP_TOOLS`: both snap modes resolve to
> the same hex, so the Snap selector stays hidden, as specified. No union, no
> border colour, no scatter, no free-form geometry — the tool addresses whole
> hexes by `Axial` and nothing else.

---

### §8 The Worldographer terrain art pack

§6 landed a terrain and contents pack. This section replaces the **terrain** half of it with
the public-domain Worldographer/Inkwell Ideas icon sets, on the terms DEC-083 already settled
and DEC-088 completes. **Contents are out of scope** — `HEX_CONTENTS_CATALOG` and its 26 files
are untouched, and §6's account of them stands.

**§6's three rules are reaffirmed, not re-litigated.** *Extend and alias, never rename in
place*: every current terrain `kind` string keeps resolving, to the new art where that is the
intent. *The pack is re-authored white*, because both overlays are tinted at the render
boundary and a tint multiplies. *Single-tone only*, because one multiply tint cannot express
two. **This section ships no migration**, and if one turns out to be needed, that is the signal
that a kind was renamed rather than aliased — §6's own test, applied again.

**The supplied art satisfies all three more comfortably than §6's pack did.** All 37 B&W files
are a single flat `#484848` ink with the antialiasing carried entirely in the alpha channel, so
white re-authoring is a substitution and no file is two-tone. Of the 60 multicoloured files
only six are single-tone — `cultivatedfarmland`, `deadforest`, `grassyhills`, `reefs`,
`sandydesert`, `snowfields` — and **only those six may be drawn on**. The other 55 are a redraw
under a multiply tint, which is what §6 declined to do for one file and declines again for 55.

**The art is traced to SVG, not landed as PNG.** The sources are 300×300 (B&W) and 250×250
(multicoloured) raster. SPEC-030 §2's normative text says *"a background colour plus an SVG
overlay"*, and this section holds it to that — not because the pipeline requires it
(`AssetStore.resolve` is extension-agnostic and `PIXI.Assets.load` loads either, so PNG would
work with no code change) but because changing it would be a stated-behaviour amendment to a
Completed spec bought for nothing, and because raster art blurs on zoom-in where
`hexTerrainArtPx` scales it up. Each traced file is a single
`<path class="ink" fill="#ffffff" fill-rule="evenodd">` over the alpha mask — the `class="ink"`
shape §6's pack already carries, so `catalog.ts` needs no new notion of what a hex glyph is.
**The trace threshold is a judgement call and belongs in the completion summary**, together
with a look at the densest glyphs (`forest-heavy`, `forest-mixed-mountains`), which are where
fidelity will fail first if it fails.

**Coverage, and what happens to a kind the pack cannot draw.** The B&W set defines the
roster: **all 37 shapes become kinds**, the 12 the author's own `black_white.properties` does
not expose included, because the compound terrain among them (`forest-mixed-*`,
`jungle-mountains`, `mountains-snow`) is what a hex crawl actually wants. **Four
single-tone files from the multicoloured set join them** — `cultivatedfarmland`,
`snowfields`, `deadforest`, `reefs` — those being the ones that are single-tone *and* not a
duplicate of a B&W shape. `sandydesert` and `grassyhills` are held back for §8's reference
sheet to judge against B&W's own `desert` and `grassland`.

**Names are the filenames, minus the `bw-` prefix**, rather than
`black_white.properties`' labels. One wrinkle the reference sheet resolves: the properties
file labels `bw-brokenlands.png` "Badlands" while `bw-badlands.png` is one of the twelve
unreferenced extras, so filename-canon yields `badlands` *and* `brokenlands` as distinct
kinds.

**A kind the pack cannot draw leaves the palette; it does not leave the catalog.** The alias
rule is read here as *unpaintable*, not *gone* — the row stays and keeps resolving, so no
stored value falls through to `UNKNOWN_HEX_KIND` and no migration is owed:

- **`water` is not a gap.** It becomes **three shades of blue, background only, with no
  glyph** — which is how Worldographer draws Ocean and Sea, whose own B&W config gives them
  a background and `isuseicon` with no icon file. `HexTerrainEntry.color` is already that
  background. The blues are this project's own choice; the B&W set's are greys because the
  set is monochrome. Whether the entry keeps a `ref` or the renderer learns to skip an empty
  one is the execution session's call, recorded under Deviations if it is the latter.
- `tundra` and `ice-floe` resolve to `snowfields`.
- `grass` resolves to `grassland` and `scrub` to `cactus`, which is what both already meant.
- `palm` and `plateau` have no honest equivalent in either set. They leave the palette and
  keep resolving to the nearest shape, named as an approximation in the completion summary,
  not silently.

**`volcano` stays in both catalogs, deliberately.** The B&W set has a `volcano` terrain glyph
and `HEX_CONTENTS_CATALOG` already has a `volcano` contents kind. Two catalogs, two lookups —
a hex may carry both and both resolve — so this costs nothing to allow, and the two readings
are genuinely different: the terrain kind says *volcanic country*, the contents kind says
*that volcano, and it is interesting*. Neither is renamed.

**Provenance is a deliverable of this section, as it was of §6.** The two sets are attributed
to **Inkwell Ideas, Inc.**, released to the public domain, credit appreciated but not required.
That rests on **the project owner's confirmation in session, plus a web-search summary** —
`worldographer.com` and `hexographer.com` were both blocked by the planning session's egress
proxy, so the licence statement **was not fetched verbatim** and `ATTRIBUTION.md` must record
it in those terms rather than as a quotation. The sets are parked at
`docs/intake/worldographer/` first, on the IN-089 precedent, and **no file lands in
`apps/web/public/` before the attribution entry exists** — §6's rule, unchanged. The existing
hex-terrain paragraph of `ATTRIBUTION.md` is *corrected* rather than deleted: it stays true of
the 26 contents files, which do not move.

**The colour model: three separable things.** This section replaces "white ink on a
background" with a model that separates the ground, the terrain drawing and the feature:

- **Contents icons stay black**, on every terrain. SPEC-030 §3, unchanged.
- **Terrain background is a colour** — `HexTerrainEntry.color`, unchanged in kind.
- **Terrain ink is a colour contrasting with that background**, taking its cue from the
  multicoloured set and from classic hex sets — **not** merely one of two greys. This is the
  change.

**No pipeline change is needed, and the art is still authored white.** `sprite.tint` is a
multiply, so white art renders as *whatever colour it is tinted*; the two-tone limitation is
`hexOverlayTone`, which picks between `HEX_OVERLAY_DARK` and `HEX_OVERLAY_LIGHT` on a
luminance threshold, not the renderer. **White authoring is load-bearing for exactly this
feature** — white is the multiply identity, which is what makes ink a render-time decision at
all, and `#484848` art tinted green renders muddy green rather than green. DEC-083 (ii)
therefore survives untouched; it stops implying the *ink* is white, but the authoring
requirement it protects is the reason coloured ink is cheap.

**Where the ink colour comes from is DEC-089, answered (a)** (user, 2026-09-08): an authored
`color`/`ink` pair on each row, guarded by a unit test asserting a minimum contrast ratio
between them. The pair is what buys the classic look — those inks are picked, not computed —
and the test is what keeps SPEC-030 §2's guarantee mechanically, so a re-coloured terrain whose
ink went stale fails the suite rather than shipping. SPEC-030 §2's "drawn in a contrasting
light/dark tone" is the wording that changes, and §2 is **Completed**, so that is a
stated-behaviour amendment rather than a catalog edit.

**`HexTerrainEntry` gains `ink`, and nothing else.** IN-105's border colour would have landed
on the same interface, and DEC-089 was first written arguing to settle both at once. **DEC-082
Denied it** (user, 2026-09-07): the union outline and the border colour are dropped together,
like-terrain hexes keep their seams, and no border field is added. The user separately excluded
it here on 2026-09-08. Both rulings agree, so the contrast test guards one pair.

**The mid-tone constraint tightens rather than relaxes.** `catalog.ts` requires terrain
backgrounds to be mid-tone because a hex is a background *and* an overlay *and* often a black
contents icon. With coloured ink the stack holds three colours instead of two greys, and the
black contents icon must stay readable over both. §8's reference sheet judges this by eye
rather than asserting it.

**A greyed "dead" variant comes free under this model** — desaturate the background and the
ink at render time, no new art — which is how most tile sets ship theirs. It is **not** built
here; it is an intake item.

**What this section does not do.** It does not touch `HEX_CONTENTS_CATALOG`, the `hexTiles`
schema, the store contract, `firestore.rules`, or any coordinate space. It does not resolve
**IN-106** (per-hex seeded scatter), which wants to change what this overlay means; it neither
blocks this section nor is blocked by it, and it gets easier against single-motif glyphs.
IN-105 is Denied (DEC-082) and is not a consideration.

**The reference sheet comes first.** §8 lands in two work items, and the order matters
because the palette colours are the irreversible half of this work — the tracing is a script
re-run, roughly 42 hand-picked `color`/`ink` pairs are not.

> **Work items: WI-119, then WI-120.** Both independent of §§1–7 — §§1–6 have shipped, and
> §7 is the tool rather than the art.
>
> **WI-119 — the reference sheet.** Findings and figures, no production code (the WI-100
> precedent). Traces all 41 candidates, proposes a `color`/`ink` pair for each, groups them
> for a ~42-kind palette, and renders the sheet at true render size over a black contents
> icon. It settles what this section leaves to it: `sandydesert`/`grassyhills` against B&W's
> `desert`/`grassland`, and contents legibility over coloured ink. **`badlands` against
> `brokenlands` is not a blocker** — the user's call (2026-09-08) is that the two shapes are
> close enough that the wrong decision is invisible to anyone but us, so WI-119 proposes one
> and moves on rather than stopping for an answer.
>
> **WI-120 — landing it.** Takes WI-119's approved sheet as input: the traced files, the
> catalog rewrite, the `ATTRIBUTION.md` entry, and the SPEC-030 §2 annotation.

---

### §9 The terrain overlay's render box

§8 settled what a terrain glyph *is* — a white-authored SVG tinted to an authored `ink` over
an authored `color`. This section settles **how much of the hex it fills**, which §8 left at
WI-101's `hexTerrainArtPx` of `size * 1.1` by omission rather than by decision.

**The box is `size * 1.8`, and each glyph is clipped to its own hex.** WI-119 studied 1.1×
(today), 1.8× and 2.2× against six representative kinds with a real contents icon over them
(`docs/completed/WI-119.md` §9) and recommended 1.8×: at 1.1× the glyph reads as a speck
beside the contents icon rather than as the hex's texture, and 2.2× crowds the icon without
adding legibility. The two numbers are not independent — `hexContentsArtPx` stays at
`size * 0.9`, and the overlay's 55% alpha is unchanged, so the icon keeps reading as an
object standing *on* the ground.

**What the clip replaces.** `apps/web/src/lib/map/vector-engine-hex.test.ts` asserts today
that the art box's half-diagonal stays inside the hex's inradius. That assertion is the
current answer to "why does a glyph not bleed into its neighbour", and 1.8× contradicts it by
design. It is replaced, not deleted: the glyph is masked to its own hex polygon, and the test
asserts **that** — art outside the hex is not drawn — rather than asserting a box small enough
never to reach the boundary. A hex map has no free-form terrain regions (§7), so a glyph
belonging to exactly one hex is a property worth keeping under either mechanism.

**Cost is part of the deliverable, per DEC-090's conditional answer.** The mask is one
`PIXI.Graphics` hexagon per painted tile on a layer that redraws per pan/zoom, and there is no
`Sprite.mask` precedent anywhere in `vector-engine.ts` to inherit a cost expectation from. The
work item measures frame cost on a representative painted map — at rest and under a
pan/zoom, against today's unmasked path — and **falls back to the largest box that still
satisfies the existing fit assertion** (≈1.4× across the flats) if the mask does not pay for
itself, recording the measurement either way.

> **Work item: WI-122.** Independent of §10 and of WI-121; touches the render pass only.

---

### §10 Retiring the pre-pack contents glyphs

§6 landed a contents pack and §8 explicitly left contents alone. This section closes the gap
that left: three contents kinds still carry WI-040-era art — `danger`, `ruins`, `tower`, the
only three files under `apps/web/public/assets/hex/contents/` with no `aria-label` and a
filled `<path>` idiom rather than the pack's stroked one — and the pack shipped near-neighbours
beside two of them.

**§8's palette rule is read across to contents, with one named exception.** *A kind whose art
the pack supersedes leaves the palette; it does not leave the catalog.* `ruins` retires to
`ruin`'s art and `tower` to `tower-keep`'s: rows kept, `kind` strings kept, art redirected, so
nothing stored changes and no migration is owed (RULE-007), exactly as §8's six terrain
aliases were handled.

**`danger` is the exception, and it is deliberate** (DEC-091 (c)). The pack has no
"something dangerous here" glyph to redirect it to, and SPEC-030 §3 names `danger` in its own
prose. Retiring a kind because its art is older than its neighbours' would cost the referee a
marker to buy visual consistency. It keeps its palette slot and its WI-040 art until
replacement art exists (IN-117), at which point that is a `ref` swap and nothing else.

**The exclusion mechanism is WI-121's**, not a second one — whatever expresses
"not authorable" for terrain expresses it for contents, on the same field or the same exported
list. If WI-121 has not landed when this item runs, this item waits rather than inventing a
parallel mechanism.

> **Work item: WI-123.** Blocked on WI-121 for the mechanism, on nothing else.
