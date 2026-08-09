## SPEC-029 — Battle Map

**Status: Active** — partly built. Work items WI-033 – WI-036. **WI-033 landed** (the
§3 schema: `GameMap.battle`, schema v22, and the export strip), **WI-034 landed** (the
§1 capture tool), and **WI-035 landed** (the §4 render differences — bounded camera,
doubled grid, view-tools-only palette). All three are derived from `GameMap.battle`,
and **nothing writes that field yet**: WI-036 — the quick sheet, with the Start button
that creates the temporary map and the Exit that drops it — is what makes any of it
reachable, and is all that remains.

A smaller-scale, bounded map the referee cuts out of the main map for a single fight,
pulls the table into, and drops when the fight ends.

### §1 — Authoring

Referee-only, and only while the **Map** main view is on stage. A new capture tool takes
a click-and-drag (or click, then second click) bounding box over the map, rendered like a
Room carve but in a distinct colour. **Full cells only** — this tool ignores the snap
mode and always snaps to whole cells, because the derived grid must divide evenly.

### §2 — What is captured

The **rect**, in lattice units — not a raster (DEC-025). Firebase Storage is unavailable
on the Spark tier, so there is nowhere to put a PNG; and since every client already holds
the geometry, re-rendering from it keeps the battle map live rather than frozen.

The battle map renders the source map's **background, floor and overlay** layers
(labels, symbols, doors, pen strokes) clipped to that rect. It does **not** render the
source grid — see §4.

The existing `exportPng` (`vector-engine.ts`) already renders an arbitrary `world`-space
frame with a per-layer cutoff, and is reused for the quick sheet's local preview
thumbnail. **The PNG path stays wired** so that a future `[HUMAN]` Blaze upgrade can
persist a real capture with no re-architecture; until then the blob is local and
throwaway. Note `exportPng`'s standing gotcha: a solid background _colour_ lives on the
renderer clear colour, not in `layers.background`, so it is not in the extract and must
be composited.

### §3 — Lifecycle

A **temporary `GameMap` in the same room** (DEC-026), switched into view for everyone
through the existing `Room.activeMapId` — so seats, tokens, encounter, dice and log all
carry across unchanged, which is the entire point of a battle map. Exactly one may exist
at a time. "Exit" switches `activeMapId` back to the source map and deletes the temporary
one.

This is a `GameMap` schema change and therefore ships a migration and a `.vttcamp`
round-trip test (RULE-007). A battle map must never survive an export.

### §4 — Rendering differences

All three are **derived from `GameMap.battle` at render time, not stored** (WI-035): the
captured rect already lives in the source map's lattice units, so a battle map shares
that lattice space and a second stored space would only contradict it.

- **Bounded, not infinite.** The camera clamps to the captured rect. The zoom floor is
  the scale that **fits** the rect, not the one that covers the screen with it — a
  capture whose aspect differs from the viewer's canvas has to be viewable whole, so
  full zoom-out letterboxes on the looser axis instead of refusing to go that far. A
  battle map opened with no remembered camera fits the rect.
- **Grid at double density.** The source grid is not drawn; a fresh grid is drawn at half
  the cell size, so a 10′ main map reads as 5′ squares. `RoomMeasure.perSquare` halves to
  match — that is what one *drawn square* is worth. Measured distances do not change:
  they are a span in lattice cells times the stored per-square value, and a doubled
  square count against a halved value is the same ground.
- **View tools only.** Pan, Eye, Measure, Ping. Every carve, overlay and select tool is
  hidden — the map is a snapshot, and editing it would desynchronize it from its source.
  `MapToolbar` renders `TOOL_GROUPS` unconditionally otherwise, so this is a tool-subset
  prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`, plus the rule that
  entering a battle map drops a carve/edit tool back to Pan.

### §5 — The quick sheet

Referee-only (`QuickSheetDef.availability: 'gm'`), self-disabling when the Map view is
off stage the way `MapToolsSheet` already does. Holds the preview, the **Start** button
that performs the map change for all players, and the **Exit** button that returns to the
main map.
