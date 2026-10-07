## SPEC-064 — Map settings live in the Assets activity

**Status: Draft** — DEC-131 (agent default, 2026-10-07); WI-222 gate cleared (user, 2026-10-07).

_(New with IN-206, from WI-173's placement proposal for IN-157. Moves the Grid & measurement
and Fog of war controls; what they write is unchanged.)_

### §1 — One home for persisted per-map configuration

A map's grid, measurement and fog switch are `GameMap` fields: GM-set, synced, one value per
map. Their controls move out of the Session settings modal into a new **Map settings** panel
(`MapSettingsPanel.svelte`) in the GM-only Assets activity, placed **between** the Maps
section and the Background section: after the map is picked, before its backgrounds are
fitted to its grid. Like the sections it replaces, it renders only when there is an active
map, and only for the GM (the Assets view is already GM-only).

The panel carries both sections with **unchanged content**:

- **Grid & measurement** — grid w/h (validated ≥1×1), cell size px, half-grid toggle,
  measurement `perSquare` + `unit`, with the "Per square" / "Per hex" label (SPEC-049 §2).
- **Fog of war** — the per-map on/off switch and its hint text.

They call the same `CampaignStore` methods as today (`setMapGridDimensions`,
`setMapGridSubdivide`, `setMapMeasurement`, `setMapFogEnabled`). No store, schema, rules or
write-path change.

Session settings loses both sections and their two nav entries; it keeps only session-wide
configuration and the maintenance danger zone. The Map tools sheet is unchanged: snap mode,
simplify tolerance and the PNG export picker are per-client tool state, never stored on the
map, and the fog **authoring** controls (Fog carve modes, Reveal all / Reset fog) are drawing
actions.

### §2 — Testids (RULE-005)

The ids carrying the old surface's name are renamed; the rest move with the controls
unchanged (DEC-131).

| Today                   | After                |
| ----------------------- | -------------------- |
| `session-grid-w`        | `grid-w`             |
| `session-grid-h`        | `grid-h`             |
| `session-grid-cellsize` | `grid-cellsize`      |
| `session-grid-apply`    | `grid-apply`         |
| `session-grid-error`    | `grid-error`         |
| section `session-grid`  | retired              |
| section `session-fog`   | retired              |
| (new)                   | `map-settings-panel` |

Unchanged: `grid-subdivide-toggle`, `measure-per-square`, `measure-unit`, `measure-apply`,
`fog-enabled-toggle`. The retired `session-grid` / `session-fog` section ids take their
`session-nav-*` buttons with them.

Specs that follow the move in the same change: `session-config.spec.ts` (the grid and
measurement assertions open Assets; the Gate 13 section-nav list drops `session-grid`),
`backgrounds.spec.ts` (`setSmallGrid` opens Assets) and `helpers.ts` (`setFogEnabled` opens
Assets).
