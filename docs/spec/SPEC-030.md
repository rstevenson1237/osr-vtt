## SPEC-030 — Hex Crawl map type

**Status: Completed** — work items WI-037 – WI-041, all landed. §1 is the
coordinate space, the `GameMap.hex` schema (v24) and its migration, the infinite
grid renderer and the coordinate pills; §§2–3 are the `hexTiles` collection
(v25), the terrain/contents catalogs and `renderHexTiles`; §4 is `HexTile.note`
(v26) and the hover tooltip; §5 is the hex-tile sheet that authors all three,
and the palette a hex crawl offers — **narrower than this spec's own wording**,
see §5.

An overworld exploration map the referee can pull players into, replacing the square
lattice with an infinite hex grid.

> **⚠️ This spec creates a second coordinate space.** A hex map does not merely re-skin
> the grid; axial hex coordinates are a different space with different neighbours,
> different distance, and no meaningful `pointInFloorUnion`, and every consumer from LoS
> to token snapping reads the square lattice.
>
> **Cleared: RULE-006 was amended by WI-037 (2026-08-13)**, in its own standalone change
> (RULE-017), scoping the square-lattice guarantee to square-grid map types. A map still
> has exactly one coordinate space; which space it is now follows the map's grid kind.
> WI-038 – WI-041 are unblocked.

### §1 — Coordinates

Axial hex coordinates, integer. **`0,0` is the map's centre**; both axes run positive and
negative from there. Every hex shows its own `x,y` in a small translucent pill at its
bottom edge.

These coordinates **supersede map labels as the addressing scheme** — a hex is identified
by its coordinate, not by a name a referee has to invent and place.

> **Built by WI-038** (2026-08-13), less the pill.
> `packages/shared/src/map/hex/` holds the space — `Axial { q, r }`, neighbours,
> hex-step distance, cube rounding, and the render-boundary conversions for the fixed
> flat-top orientation. `axialKey(hex)` is the `"q,r"` string that serves as both the
> per-hex document id and the pill's label. The map declares itself a hex crawl with
> `GameMap.hex: { size }` (schema v24, `createMap({ gridKind: 'hex' })`); see
> `README.md` → "Hex-grid maps".
>
> **Completed by WI-039** (2026-08-13): the infinite grid renders
> (`VectorMapEngine.renderHexGrid`, culled by the pure `hexMap.hexesInRect`), every
> hex carries its `axialKey` pill on its bottom edge, a hex map opens centred on
> `0,0`, and "+ New hex crawl" in the Assets activity is the UI producer §1 needs to
> be reachable at all. See `README.md` → "Rendering a hex map".

> **Annotated by WI-102** (2026-09-04), the way WI-041 annotated §5. "Axial hex
> coordinates, **integer**" remains true of the **addressing scheme** this section is
> about: a hex is still named by an integer pair, and `axialKey` is still the one string
> that is both its document id and its pill. Since SPEC-047 §1 the same space also
> carries geometry that is not a hex — a corner, a free-placed symbol — as a `HexPoint`
> in **thirds** of a step, which is this space scaled by three so that every hex corner
> is an exact integer (DEC-081). One coordinate space, one origin, one render-time
> multiplier: RULE-006 is untouched, and this is an annotation rather than an amendment.

### §2 — Terrain

Each hex carries a terrain kind: plains, forest, hills, mountain, swamp, jungle, … Each
kind is a **background colour plus an SVG overlay** drawn in a contrasting light/dark
tone, following the existing symbol-catalog pattern
(`packages/shared/src/map/vector/symbol-catalog.ts`) rather than inventing a second art
pipeline.

There is no per-region fill concept in the renderer today — the whole floor is painted
one themed colour — so this is genuinely new rendering, not a parameter.

> **Built by WI-040** (2026-08-14). One document per painted hex at
> `maps/{mapId}/hexTiles/{axialKey}` (schema v25) carrying a terrain *kind* — never a
> colour or a ref — resolved through `HEX_TERRAIN_CATALOG`
> (`packages/shared/src/map/hex/catalog.ts`, the symbol-catalog pattern §2 asks for).
> `VectorMapEngine.renderHexTiles` is the per-region fill: each hex filled with its
> own colour at the bottom of the `floor` layer, its white-authored overlay tinted
> by `hexOverlayTone` — a luminance threshold against that terrain's own colour, so
> the "contrasting light/dark tone" cannot go stale when a terrain is re-coloured.
> Sparse and pruned on clear: an unpainted hex has no document. See `README.md` →
> "Terrain and contents".
>
> **Authored by WI-041** (2026-08-14): the hex-tile sheet's terrain palette,
> which reads `HEX_TERRAIN_CATALOG` in order and clears the kind a hex already
> carries when it is picked a second time.

### §3 — Contents

Icons overlaid in black — castle, town, fort, cave, danger, temple, … — reusing the
symbol catalog's authoring and rendering path. Any seat may select a hex and change its
contents, consistent with the existing member write scope (`DECISIONS.md` → Postponed,
"Member write scope inside a room").

> **Built by WI-040** (2026-08-14), on the same document as §2's terrain and through
> the same catalog pattern (`HEX_CONTENTS_CATALOG`): the icon rides the `overlay`
> layer — an object standing on the ground, where terrain *is* the ground — tinted
> black on every terrain. `hexTiles` is member-or-GM write in `firestore.rules`, with
> rule tests, which is §3's "any seat" read literally: the existing member write
> scope, not a new boundary.
>
> **Selecting a hex to change is WI-041** (2026-08-14): Select's click on a hex
> map picks the hex under the pointer, and the same sheet carries the contents
> palette beside §2's terrain one.

### §4 — Notes

The label-notes feature carries over as **per-hex notes**, visible on mouseover through
the existing `map-label-tooltip` path. **Only hexes with a note attached are tracked** —
there is no "add a label" step, because §1's coordinates already name every hex.

> **Built by WI-041** (2026-08-14) as `HexTile.note` — a third optional field on the
> same document §§2–3 use, schema **v26** with a no-op migration. "Only hexes with a
> note are tracked" needed no index: it is the collection's existing sparseness, and a
> hex carrying only a note is as ordinary as one carrying only terrain (clearing the
> note then unpaints it). It is a plain Firestore field rather than a `room-notes` Yjs
> entry like a *map-room*'s players' notes — that doc is keyed by map-room id and is
> per-room, not per-map, so it has nowhere to file a coordinate that repeats on every
> hex map in the session; and this way the note rides the `.vttcamp` export, the map
> delete and the rules the rest of the tile already has.
>
> The hover half is literal: the same `map-label-tooltip` node, the same markdown
> rendering, anchored on the hex's centre. A hex map has no room labels, so the two
> sources can never both be live. There is **no coarse-pointer note dot** (contrast
> SPEC-033 §4 for labels) because the hex-tile sheet already is the equivalent — a tap
> selects the hex, and the sheet shows the note in full.

### §5 — Tools

View and overlay tools only, plus a new hex-tile quick sheet for editing the selected
hex's terrain, contents and note. Every carve tool is meaningless here: a hex map has no
carved floor.

> **Partly built by WI-039** (2026-08-13), in its blunt form: a hex map takes the same
> `toolSubset` path a battle map does and offers the **View tools only**, which is what
> keeps a square-lattice carve gesture from writing cell-space geometry onto an axial
> map (RULE-006). The overlay tools a hex map should keep, and the quick sheet, are
> WI-041.
>
> **Completed by WI-041** (2026-08-14), and **narrower than the paragraph above**. The
> palette is `HEX_TOOL_IDS` — **Select plus the View tools**, no overlay tools at all.
> The reason §5's own wording does not survive is that its stated test (carved floor)
> is not the one that decides: RULE-006 forbids two coordinate spaces inside one map,
> and every overlay tool stores square-lattice units multiplied by `grid.cellSize` —
> `MapSymbol.cell`, `MapRoom.labelAnchor`, `Drawing.points`, a door's endpoints. A hex
> map's multiplier is `hex.size`, so placing one would put a second space on the map.
> Label is doubly out: §1 makes the coordinate the addressing scheme, replacing the
> labels a referee used to invent. RULES.md outranks the specs, so the rule wins and
> this paragraph is annotated rather than the rule bent. Re-opening any overlay tool
> for hex maps means giving it an axial-space form first, and is a new intake item.
>
> **Select is what fills the sheet**: its click picks the hex under the pointer
> (`hexMap.pixelToAxial`) and publishes `MapToolController.selectedHex`. The sheet
> itself is the Map tools quick sheet's hex body (`HexTilePanel`), not a seventh entry
> in `QUICK_SHEETS` — it is contextual to the map on stage, and a rail button dead on
> every square-grid map is the dead button `quickSheetsFor` exists to prevent. See
> `README.md` → "Per-hex notes and the hex-tile sheet".
>
> **Qualified by WI-106 (2026-09-04), SPEC-047 §5.** A `hexLabel` tool now joins
> `HEX_TOOL_IDS`, and "Label is doubly out" above still holds in the sense that
> mattered: this tool invents no name and places no anchor. It writes `HexTile.note`
> — the field Select's own click already opens for editing — by resolving the
> pointer to a hex the same way (`hexAt`, this component's `pixelToAxial` wrapper)
> and setting `MapToolController.selectedHex`; both snap modes agree, since a note
> belongs to a hex by definition. No new schema, no new collection, no migration.
> See `README.md` → "Per-hex notes and the hex-tile sheet".
