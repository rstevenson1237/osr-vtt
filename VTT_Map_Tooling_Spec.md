# Map & Dungeon-Building Tooling Specification (v2 — cellular / negative-space)

**Authoritative for Plan §7 Phases 1 & 4.** This is a **map-making tool, not a drawing program.** Primitives are floor, walls, doors, symbols, and labels on a grid — not brushstrokes. Everything is optimized for the **mapper-draws-while-the-GM-describes** workflow. Claude Code implements this exactly.

---

## 0. Reference & Aesthetic

- **Inspiration:** early Dungeon Scrawl and classic blue/white keyed dungeon maps (see the supplied reference image — solid blue = rock, white = carved floor, clean auto-walls, keyed rooms 1–38, door squares, "S" secret doors, stair shafts, column dots, cave vs. masonry wall styles, water/rubble textures).
- **v1 core target (must hit):** two-tone negative-space rendering, grid overlay, auto-walls at floor/rock boundaries, cell-bound symbols, room-bound keyed labels, masonry vs. natural wall styling.
- **Aspirational polish (aim toward, do NOT gate v1 on):** rubble/water/vegetation textures, torn map-edge boundary, fine cartographic flourishes. The reference is deliberately at the far end of ambition; ballpark is success.

---

## 1. The Model — three rules, formalized

The map is a **grid of cells**; each cell is **solid** (rock, the default) or **floor** (carved, empty). From that, everything derives:

- **Room** = a region of floor cells (optionally named/keyed as an entity).
- **Wall** = a divider on a **grid edge** between two cells.
  - **Perimeter walls** (floor↔solid) are **auto-generated** — you never draw them.
  - **Explicit walls** are placed on **floor↔floor** edges to subdivide open space — this is the literal "divider between two empty spaces."
- **Door** = a wall edge flagged as a door (open / closed / secret).
- **Symbol** = an icon bound to **one grid cell**.
- **Label / Key** = text bound to a **room**, rendered at its anchor, moving with the room.

Nothing is a free-floating vector shape. This is graph-paper dungeon logic, formalized.

---

## 2. Primary UX Loop (the entire point of the tool)

**GM narrates → mapper carves.** Every design choice favors the mapper's speed and forgiveness:

- **Rectangle carve is the workhorse:** drag a rectangle, or type `W×H`, to carve a room in one action ("a twenty-by-thirty hall opens up").
- **Corridor mode:** carve a 1-cell-wide path between two points ("a passage runs north forty feet").
- **Always-on grid snapping**, single-key **undo/redo**, minimal chrome, mouse-light.
- The mapper is a **player** by default; the GM can also carve/annotate. This is the old caller/mapper role, digitized.

Functions will *look* like a drawing app (rectangles, a "brush"), but they operate on the floor/rock grid — the end goal is a navigable keyed map, not art.

---

## 3. Tool Catalog

| Tool | Operates on | Modes / options | Avail. |
|---|---|---|---|
| **Carve (Floor)** | cells → floor | single-cell brush · **rectangle drag / typed W×H** · **corridor (1-wide)** | all |
| **Fill (Solid)** | cells → rock | brush · rectangle · "fill room" | all |
| **Wall** | grid edges | place/remove explicit wall; drag a run; snap to edges | all |
| **Door** | wall edges | cycle **open / closed / secret**; renders the door glyph | all* |
| **Symbol** | one cell | pick from palette; rotate; place | all |
| **Label / Key** | a room | auto-incrementing key (1, 2, 3, 2a…) + optional text; sits at room anchor | all |
| **Select** | rooms/walls/symbols/labels | move, delete, rename, re-key, restyle | all |
| **Pan / Zoom / Ruler / Ping** | canvas | ruler measures in squares/feet | all |
| **Fog: Reveal / Hide / Reset** | fog mask | GM reveal for **prepped** maps | GM |
| **Theme / Wall-style** | region | two-tone theme; per-region **masonry** (solid) vs **natural** (dashed) walls | all |
| **Annotate (freehand/text)** | overlay | *optional* loose pen/text for notes — demoted, not the core | all |

*Door placement is available to all, but toggling a **secret** door's visibility is GM-only.

**Symbol palette (v1 starter, from the reference + OSR canon):** stairs-down (striped shaft), spiral stair / shaft (concentric squares), column/pillar (dot), secret-door (S), feature/compass star, water (wavy), rubble/debris (stipple), altar, statue, chest, trap, pit, portcullis, lever, campfire, note-pin. Extensible via the bundled asset pack.

---

## 4. Rendering & Themes

- **Negative-space two-tone:** rock = solid fill, floor = light fill, faint grid overlay. Blue/white is the default theme (matches the reference).
- **Auto-walls:** the floor↔rock boundary renders as a clean wall automatically; recomputed whenever cells change.
- **Wall styles per region:** **masonry** = solid double-line (worked stone); **natural** = dashed/stippled (caves), as in rooms 34–38 of the reference.
- **Symbols** render as crisp sprites locked to their cell.
- **Textures** (water bands, rubble stipple, vegetation) are aspirational fills — simple or stubbed in v1.

---

## 5. Interaction Semantics (your overlap questions, resolved by the model)

- **Overlapping rooms →** their floor simply unions. A cell is floor or it isn't; there is no z-order and nothing to reconcile.
- **Rooms sharing a side →** two floor regions adjacent across an edge. Whether they're separated is decided **solely by whether that edge carries a wall/door** — exactly "a wall is a divider between two empty spaces."
- **Carving / filling are idempotent and forgiving:** carve solid → floor; fill floor → rock; re-doing does no harm. Auto-walls recompute instantly.
- **Explicit walls persist** on their edges until removed, even as adjacent cells change.
- **Grid snapping** is always on for structure (carve/wall/door/symbol); hold **Alt** only for loose annotation.

---

## 6. Line of Sight ↔ Fog of War

- Walls (auto perimeter + explicit) are **grid-aligned edges**, so LoS is exact and cheap: raycast against edges; **open doors pass sight, closed/secret block it.**
- **Mapper mode (default):** fog is **emergent** — unexplored = uncarved = rock. The map *is* the explored area, so there's nothing to spoil. This is the common case for your workflow.
- **GM-prepped mode:** GM pre-carves a full map, then reveals via fog/LoS. Here the earlier privacy choice applies — **recommended: GM-authoritative**, GM's client computes visibility and publishes only the revealed mask, keeping unexplored layout off player clients. Moot in mapper mode.
- **UVTT import (Phase 4):** `.uvtt`/`.dd2vtt` populates floor + walls + doors from the file.

---

## 7. Data Model (cellular, chunked) & Firestore Write Discipline

Under `rooms/{roomId}` (Plan §2.1), extended:
```
grid:            { w, h, cellSize }
floorChunks/{cx_cy}: bitmask of floor cells in a 16×16 chunk   # carve = bounded writes, not per-cell
rooms/{id}:      { key, name, cellRefs|bbox, labelAnchor, wallStyle:"masonry|natural" }
walls/{edgeId}:  { edge:"x,y,side(N|E|S|W)", door?:{ state:"open|closed", secret:bool } }
                 # ONLY explicit walls + doors are stored; perimeter walls are derived, not stored
symbols/{id}:    { cell:"x,y", kind, rotation }
labels:          carried on rooms (key/name); free text is an optional annotation object
fog:             { mode:"emergent|manual|dynamic", mask }
```
**Write discipline (keeps you inside the free Firestore quota):** carving previews locally and streams in-progress to other clients via **RTDB**; it **commits to Firestore on pointer-release**, one **chunk** update per stroke — never one write per cell. A big room carve = a handful of chunk writes.

---

## 8. Layers, Visibility & Referee Secrets

- Floor, explicit walls, doors, symbols, labels are player-visible by default.
- **GM-only content** (secret rooms drawn ahead, secret doors, hidden symbols/notes) lives in the **GM/Hidden** layer backed by the `gmPrivate` subtree (Plan §3) — players' clients cannot read it.
- **Secret door** = a door with `secret:true`; renders as the "S" glyph to the GM, invisible to players until revealed (revealing flips the flag / moves it to the shared layer).

---

## 9. Explicitly OUT of Scope for v1
Sub-cell / organic freeform geometry (approximate curves on the grid instead) · typed lighting & vision ranges · elevation / multi-floor · animated effects · movement/terrain cost. The reference's finest textures are polish, not v1 gates.

---

## 10. Phase Mapping
- **Phase 1 (the map-making core):** grid + Carve/Fill + auto-walls + explicit Wall + Door + Symbol + Label/Key + Select + Pan/Zoom/Ruler/Ping + two-tone theme + masonry/natural wall styles + **manual/emergent fog**. Chunked storage + commit-on-release. *(No dynamic LoS yet.)*
- **Phase 4:** dynamic edge-based LoS from walls/doors; GM-authoritative fog for prepped maps; `.uvtt` import.
