## SPEC-030 — Hex Crawl map type

**Status: Active** — partly built. Work items WI-037 – WI-041; **WI-037,
WI-038 and WI-039 have landed**, so §1 is complete — the coordinate space,
the `GameMap.hex` schema (v24) and its migration, the infinite grid renderer
and the coordinate pills. §§2–4 are unbuilt; §5's tool restriction exists in
its blunt form (View tools only) and is extended by WI-041.

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

### §2 — Terrain

Each hex carries a terrain kind: plains, forest, hills, mountain, swamp, jungle, … Each
kind is a **background colour plus an SVG overlay** drawn in a contrasting light/dark
tone, following the existing symbol-catalog pattern
(`packages/shared/src/map/vector/symbol-catalog.ts`) rather than inventing a second art
pipeline.

There is no per-region fill concept in the renderer today — the whole floor is painted
one themed colour — so this is genuinely new rendering, not a parameter.

### §3 — Contents

Icons overlaid in black — castle, town, fort, cave, danger, temple, … — reusing the
symbol catalog's authoring and rendering path. Any seat may select a hex and change its
contents, consistent with the existing member write scope (`DECISIONS.md` → Postponed,
"Member write scope inside a room").

### §4 — Notes

The label-notes feature carries over as **per-hex notes**, visible on mouseover through
the existing `map-label-tooltip` path. **Only hexes with a note attached are tracked** —
there is no "add a label" step, because §1's coordinates already name every hex.

### §5 — Tools

View and overlay tools only, plus a new hex-tile quick sheet for editing the selected
hex's terrain, contents and note. Every carve tool is meaningless here: a hex map has no
carved floor.

> **Partly built by WI-039** (2026-08-13), in its blunt form: a hex map takes the same
> `toolSubset` path a battle map does and offers the **View tools only**, which is what
> keeps a square-lattice carve gesture from writing cell-space geometry onto an axial
> map (RULE-006). The overlay tools a hex map should keep, and the quick sheet, are
> WI-041.
