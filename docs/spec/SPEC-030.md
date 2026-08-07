## SPEC-030 — Hex Crawl map type

**Status: Active** — specified, not built. Work items WI-037 – WI-041.

An overworld exploration map the referee can pull players into, replacing the square
lattice with an infinite hex grid.

> **⚠️ This spec creates a second coordinate space.** RULE-006 fixes one canonical space
> — square-cell lattice units, floats — and every consumer from LoS to token snapping
> reads it. A hex map does not merely re-skin the grid; axial hex coordinates are a
> different space with different neighbours, different distance, and no meaningful
> `pointInFloorUnion`. **The rule must be amended before implementation begins**, in its
> own standalone change (RULE-017), to scope the square-lattice guarantee to
> square-grid map types. Do not begin WI-037 without that amendment.

### §1 — Coordinates

Axial hex coordinates, integer. **`0,0` is the map's centre**; both axes run positive and
negative from there. Every hex shows its own `x,y` in a small translucent pill at its
bottom edge.

These coordinates **supersede map labels as the addressing scheme** — a hex is identified
by its coordinate, not by a name a referee has to invent and place.

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
