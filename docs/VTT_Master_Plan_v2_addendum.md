# VTT Master Plan v2 — Addendum C (Drawing / Settings / Assets / Character / Dice)

Extends `VTT_Master_Plan_v2.md`. Same conventions: reference specs (`R#`),
sequenced work items (`WI-#`) with a **model target**, **effort**, **gate**,
and explicit `[HUMAN]` / `[AGENT]` step markers. New specs continue the R-series
(R10–R21); new work items continue the WI-series (WI-13–WI-24).

Model targets follow the established allocation:
`claude-opus-4-8` for architecture-heavy items (schema/model changes, new render
passes, migrations), the current Sonnet release as the default workhorse. Effort
is `high` / `medium` / `low`. One work item per Claude Code prompt; each gate must
pass before the next item starts.

Mockups for every UI-affecting change are in the companion file
`vtt-ui-mockups-addendum-c.html` — **[HUMAN] approval of the relevant board is a
gate on the corresponding WI** and is called out per item.

---

## PART I — Codebase assessment: utility issues & poorly-thought-out workflows

These are the concrete problems found in the current tree, with root cause. Each
maps to a reference spec below. Items marked **(reported)** correspond to your
list; the rest are adjacent issues surfaced during the read that are cheap to fix
in the same pass.

**A1. Settings section-nav collides with the hash router. (reported)**
`SessionActivity.svelte` renders its jump-links as raw hash anchors:
`{#each SECTIONS as s}<a href={`#${s.id}`}>`. The app uses hash routing
(`routes.ts`): `parseHash` matches only `^/r/([^/]+)` and returns `{name:'lobby'}`
for anything else. Clicking a section link sets `location.hash = '#session-room'`,
fires `hashchange`, fails the `/r/…` match, and navigates the whole app to the
Lobby (the "front login page"). This is exactly the "all settings tabs link to
the login page due to a misformed URL" report. → **R16.**

**A2. Advantage/disadvantage looks non-functional because the dropped die is
never shown. (reported)** `rollTray()` already computes advantage correctly at
the data layer (rolls each die twice, keeps higher/lower, records `dropped`), and
it is unit-tested. But `scene.roll()` is handed only the final `RolledDie[]`
(kept faces) — the `dropped` value is never rendered, and the roll strip/log show
only the kept result. So a player toggling Advantage sees one dance and one number,
identical to a normal roll. Separately, you've specified a **different semantic**
than what's implemented (a pool of *n+1* dice, keep the *n* highest/lowest), which
is a model change, not just a viz fix. → **R20.**

**A3. Wall "style" is a per-room binary, not a per-wall property. (reported)**
`WallStyle = 'masonry' | 'natural'` lives on the `MapRoom` doc, and the engine
renders a wall organically only when its *hosting mapRoom* is natural
(`hostingRoom(cell).wallStyle === 'natural'`). The Wall tool's toolbar
`wallStyle` select writes the controller field but individual walls persist **no
style of their own** — so toggling "natural" in the toolbar changes nothing unless
the wall happens to fall in a natural-styled room. This is the "natural-walls
checkbox does nothing / walls look identical" report. Angled (diagonal) walls are
stored as `SightWall` and rendered dashed when `style==='natural'` and solid
otherwise, so an angled masonry wall is fine but an angled run drawn in the
default flow reads dashed. → **R10.**

**A4. Doors are a boolean-ish appendage on a grid wall, with no door types.
(reported)** `MapWall.door?: MapDoor` carries only `{state, secret}`, cycled
through a hard-coded 3-step `doorCycle` (closed → open → secret → none). Rendering
is ad hoc: a line plus an 8px rect for "closed", a dashed line for secret. There is
no door-type concept (trapped, one-way, barred, single, double), no icon overlay,
and diagonal `SightWall` doors are explicitly out of scope. The requested model —
"door is a special wall type, an icon overlaid and centered on any wall segment,
type=none removes it" — needs its own type enum and a dedicated icon render pass.
→ **R11.**

**A5. Labels are created through a prompt dialog and can't be edited in place,
deleted, or renumbered. (reported)** A `label`-tool click floods the room region
and opens `dialogs.promptText` for the name; the `mapRoom` doc stores an
auto-incremented `key`. There is no inline text edit, no delete affordance, and no
way to change the numbering order — the `EditorOp` supports `mapRoom` delete/replace
(so undo works), but nothing in the UI surfaces it. → **R13.**

**A6. The starter map background is an un-managed raw sprite. (reported)**
`MapView.onMount` loads `STARTER_MAP_REF` and adds it straight to
`engine.layers.background` as a PixiJS sprite. It's not an entity in any store, so
there is no way to select, replace, or remove it. → **R15.**

**A7. Collapsing the Tools rail doesn't reclaim stage width. (reported)**
`.tools-rail.collapsed` only sets `align-items:center`; the rail's grid column
keeps its width, so the map stays boxed out even when tools are hidden — which
also undercuts the "≥90% stage when rails collapsed" Gate 2 intent. → **R14.**

**A8. Token snap and token scale are presented together but scoped
differently. (reported)** In `MapToolbar`, the Snap select always renders while
the Scale slider is gated behind `{#if selectedToken}`. Snap is really a *global
drop default*; Scale is *per-selected-token*. Showing them in the same cluster
(and snap with no selection) reads as clutter/ambiguity. → **R14.**

**A9. Asset removal is asymmetric and the "remove" target is ambiguous.
(reported)** Saved-URL refs *can* be deleted (`AssetsActivity.deleteSaved →
store.deleteAssetRef`), but bundled refs, the starter map, and already-placed
tokens have no removal path, and Uploads is Blaze-gated/disabled. "Unable to
remove assets" most likely means one of: (a) the saved-URL delete isn't discoverable,
(b) you want to remove *placed* tokens/assets from the scene, or (c) bundled entries.
→ **R17** (needs the one clarification below).

**A10. There is no UI to manage multiple (dungeon) rooms within a session.
(reported)** `MapRoom` docs model keyed regions, but nothing surfaces a
multi-room manager. You've asked to place this in the Assets screen and in the
already-visible GM controls. → **R17.**

**A11. Carve/Fill has no live dimension readout. (reported)** The carve/fill/
ellipse tools publish a draft-cell preview but display no size feedback while
dragging. → **R12.**

**A12. `d4` numerals render at the tetrahedron corners and `d6` numerals sit
diagonal to the face edges. (reported)** `textures.ts` builds each face's UV
basis from `pts[0].sub(centroid)` as the U axis. For a square (d6) face that
vector points at a *corner*, so the number is rotated ~45° off the edges. For the
d4, the value is composed at the three face corners (the "read the up-apex"
convention) but with the current basis the glyphs crowd the points and the visible
face reads empty. Both are UV-orientation bugs. → **R19.**

**A13. Dice are oversized, numerals are oversized, and there is an underlay
beneath the tray. (reported)** `SCALE` in `geometry.ts` and the font sizes in
`textures.ts` set the current dimensions; `scene.ts` builds an **octagonal**
`CylinderGeometry` tray plus a radial-gradient shadow per die. (Note: the tray is
octagonal in code, not hexagonal — confirm on the mockup which element reads as
the "hexagonal underlay" so we remove the right thing.) → **R19.**

---

## PART II — Reference specs

### R10 — Wall line-type system (masonry / natural / dashed / solid + circular)

**Goal.** A wall carries its *own* render style, independent of its hosting
room; the Wall tool paints with the currently-selected style; angled runs render
solid by default; natural walls read as irregular cave edges; a new circular-wall
tool anchors to a point + radius.

**R10.1 Model.** Extend the shared `WallStyle` union to
`'solid' | 'masonry' | 'natural' | 'dashed'`. Add an optional `style?: WallStyle`
to `MapWall` (grid walls) so a wall persists its own look; when absent, fall back
to the hosting `MapRoom.wallStyle` (preserves existing rooms). `SightWall` already
has `style?` — widen it to the same union. Keep `MapRoom.wallStyle` as the *default
for new walls drawn inside that room*, not the sole determinant.

**R10.2 Migration.** `schemaVersion` bump. Existing grid walls have no `style` →
they keep deriving from the room (no visual change). Existing rooms' `wallStyle`
(`'masonry' | 'natural'`) are already valid members of the widened union. No
data rewrite required; the migration only records the new `CURRENT_SCHEMA_VERSION`
and documents the widened enum (mirrors the R2 theme backfill pattern).

**R10.3 Rendering.** In `engine.ts`, resolve a wall's effective style as
`wall.style ?? hostingRoom?.wallStyle ?? 'masonry'`, then dispatch:
- `solid` → single stroke, `theme.wall`, width 3.
- `masonry` → current solid stroke plus the existing masonry treatment (unchanged look).
- `dashed` → `strokeDashed(…, 5, 3)` (the existing helper), `theme.wall`.
- `natural` → the existing `naturalizePolyline` + `drawSmoothCurve` organic pass,
  now keyed off the wall's own style so a single natural wall reads irregular even
  in a masonry room. The chaining seed stays `hashSeed(roomId + runKey)` for
  cross-client determinism (unchanged from R9.4). **Angled/diagonal** natural walls
  must also route through the organic pass instead of `strokeDashed` — fixes the
  "angled walls display dashed" report for the natural case; for every non-natural
  angled wall, render solid (A3).

**R10.4 Angled walls → solid. (reported)** Default angled/diagonal wall render
is `solid` (not dashed). Dashed is now only produced when a wall's effective
style is explicitly `dashed`.

**R10.5 Circular walls. (reported)** New tool `wallCircle`: pointer-down sets the
center (snapped to intersection), drag sets the radius (live ghost circle with a
radius readout), release commits. **Decision R10.5a is settled: a dedicated
`CircleWall` doc** (per your call) — editing radius/gaps later stays trivial and
LoS sampling is a pure derivation. Storage (pixel space):
```
Arc        = { start: number; end: number }   // radians, CCW; the OPEN span
CircleWall = { id; cx; cy; r; style: WallStyle; gaps?: Arc[]; doors?: ArcDoor[] }
ArcDoor    = { angle: number; door: MapDoor }  // centered on the arc at `angle`
```
LoS: sample the circle into an N-gon (N∝radius, cap ~64) fed into `sightSegments`
like other vector walls, **but skip any segment whose midpoint angle falls inside a
`gaps` arc** — so a gap is a real opening light and movement pass through. Undoable
via a new `EditorOp` variant.

**R10.5b Gaps & doorways (reserve now, finish later). (your note)** A solid ring
you can't enter is useless, so the model reserves for openings from day one:
`gaps` are open arcs (rendered as breaks in the stroke; excluded from LoS), and
`doors` are `MapDoor`s (R11) centered at an angle on the ring. **v1 scope:** ship
`CircleWall` + rendered/LoS-aware `gaps`, plus a "cut a gap" interaction (drag along
the ring to erase an arc, mirroring the line-wall erase). **Deferred to a follow-on
WI:** placing typed doors *on* an arc (`doors[]` render + picker) — the field exists
so no migration is needed when it lands. This keeps WI-14 bounded while guaranteeing
circular rooms are never dead-sealed.

**R10.6 Tool UI.** The Wall tool's `wall-style` select becomes a 4-way
(Solid / Masonry / Natural / Dashed). Add the `wallCircle` tool to the palette,
with an erase mode that cuts gaps into an existing ring. See mockup **Board 1**.

---

### R11 — Door type system (door as a styled wall overlay)

**Goal.** A door is a *type* set on any wall segment (grid or, later, diagonal),
drawn as a centered icon overlaid on that segment; `type: 'none'` removes it.

**R11.1 Model.** Replace the boolean-ish `MapDoor` with:
```
DoorType = 'none' | 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred'
MapDoor  = { type: DoorType; state: 'open' | 'closed'; facing?: 'ab' | 'ba' }
```
`facing` is only meaningful for `oneWay`. `secret` becomes a *type* rather than a
flag (a secret door is GM-only until revealed, as today). Migration: an existing
`{secret:true}` → `{type:'secret'}`; `{secret:false}` → `{type:'single'}`; door
absent stays absent. `type:'none'` is the removal sentinel (writing it deletes
the door, mirroring today's cycle-to-`undefined`).

**R11.2 Interaction.** The Door tool no longer cycles through a fixed sequence.
Clicking a segment opens a small door-type picker (or uses the palette's currently
selected door type, like the symbol tool's kind select). Clicking sets the chosen
type centered on the *nearest wall segment*; choosing `none` removes it. State
(open/closed) is a separate toggle (unchanged semantics for LoS: open passes,
closed/secret/barred block).

**R11.3 Rendering.** A dedicated door-overlay pass in `engine.ts`: for each wall
carrying a door, draw the wall stroke as normal, then stamp a **centered** type
glyph on the segment midpoint (single = door leaf; double = two leaves; secret =
GM-only "S"; trapped = "T"/hazard mark; one-way = arrow along `facing`; barred =
double bar). Secret/trapped hazard details stay on the GM layer for non-revealed
GM-only cases, consistent with the current secret-door behavior. Icons are drawn
from theme tokens (no external art; consistent with R3.5). See mockup **Board 2**.

**R11.4 LoS.** `doorPassesSight` widens: `open` passes; `closed`, `secret`,
`barred`, `trapped(closed)` block; `oneWay` blocks per side is **out of v1 scope
for LoS** (it blocks like a normal door for sight; the arrow is a GM annotation).

---

### R12 — Carve/Fill dimension HUD

**Goal.** While dragging a carve/fill/ellipse rectangle, show a centered
`W × H` readout (in grid squares) that updates live and disappears on commit.

**R12.1** In `MapView`, the carve/fill/ellipse drag already computes a preview
cell set from `cellStartWorld()`→`world`. Derive the bounding `w`/`h` in cells and
render a centered label at the rectangle's centroid via a small engine method
`renderDimHud(centerWorld, 'W × H')` (a cached PIXI.Text on an overlay layer),
cleared on `handleToolEnd`. No persistence, no draft doc — purely local, like the
ruler label. See mockup **Board 3**.

---

### R13 — Labels v3 (inline edit, delete, renumber)

**R13.1 Inline edit. (reported)** Double-clicking a placed label enters an inline
text editor positioned over the label (an absolutely-positioned `contenteditable`/
`<input>` in the map overlay, not a modal). Commit on blur or Enter; Escape
cancels. Replaces the `dialogs.promptText` flow for *editing* (creation may keep a
lightweight inline entry too). Writes a `mapRoom` replace op (undoable).

**R13.2 Delete. (reported)** A label's inline editor (and a right-click/context
affordance) exposes Delete → `mapRoom` delete op (undoable). 

**R13.3 Renumber. (reported)** Add a "renumber / reorder" affordance in the room
manager (see R17.2): drag to reorder or edit a room's `key` directly; keys must
stay unique (reuse `nextMapRoomKey`/a validator). Changing order rewrites affected
`key`s in one batch op. See mockup **Board 4**.

---

### R14 — Shell: collapse reclaims stage + token-config contextualization

**R14.1 Collapse reclaims width. (reported)** When the Tools rail is collapsed,
its grid column must shrink to a thin spine (just the expand chevron) so the stage
grows. Fix the `RoomShell` grid template to use a collapsed track width (e.g.
`grid-template-columns` swaps the tools track to `~28px` when
`shellState.toolsCollapsed`), and set `.tools-rail.collapsed { width: 28px }`.
Verify against Gate 2 (≥90% stage with both rails collapsed).

**R14.2 Token config. (reported)** Snap is a global drop default → keep it in a
clearly-labeled "Map defaults" group, visible always. Scale is per-token → keep it
gated behind a selection, and when no token is selected show nothing (or a muted
"Select a token to resize" hint) rather than an empty control. This removes the
"snap/scale showing with no token" ambiguity. See mockup **Board 8**.

**R14.3 Select tool. (reported)** Single-token selection already works by
clicking a token; formalize `select` so it only ever holds one token (clear the
prior selection on a new single click; no marquee/multi-select in v1). Mostly a
confirmation + a guard, low effort.

---

### R15 — Starter / background map management

**R15.1. (reported)** Promote the background image from a hard-coded sprite to a
managed room property: `Room.background?: { ref: string } | null` (default the
starter ref for existing rooms via migration). `MapView` renders
`room.background?.ref ?? STARTER_MAP_REF`, or nothing if explicitly cleared.

**R15.2.** GM controls (Assets activity + Session/GM controls) gain: **Change
background** (pick from Bundled / Saved URL, reusing the asset picker) and
**Remove background** (sets `background: null`). No selection-on-canvas of the
background sprite is needed — management lives in the GM UI, which is simpler and
avoids accidental drags. See mockup **Board 5**.

---

### R16 — Settings navigation fix + theme reachability

**R16.1 Section-nav no longer hijacks the router. (reported)** Replace the raw
`<a href="#id">` jump-links with buttons that call
`el.scrollIntoView({behavior:'smooth'})` on the target section (no hash mutation),
OR intercept clicks and `preventDefault` before scrolling. Either way the app URL
(`#/r/{roomId}`) is untouched, so the user stays in Session. This resolves the
"settings tabs bounce to the login page" bug at root.

**R16.2 Theme engine reachable. (reported)** With R16.1 fixed, the existing
`session-theme-select` (already wired to `room.settings.theme` and `applyTheme`)
becomes reachable. Confirm the two themes (`parchment-dark`, `keyed-blue`) apply
live and sync to players. If "theme engine unavailable" means you want *more* than
reachability (e.g. custom token editing), that's a larger R2 extension — flagged
as the second clarification below.

---

### R17 — Asset removal + multi-room management

**R17.1 Removal. (resolved — you confirmed the existing control is sufficient.)**
The saved-asset ✕ on each tile (with a confirm) already covers this; no further
removal work is needed. Bundled starter assets stay non-removable by design (the
fallback pack). This is dropped from the WI-20 scope.

**R17.2 Multi-room manager. (reported)** A **Rooms** panel, placed in the Assets
activity and mirrored into the GM controls, lists every `MapRoom` (key, name,
cell-count) with: rename, renumber/reorder (feeds R13.3), jump-to (center the
viewport on the room), and delete. This is the "manage multiple rooms within a
session" surface. Reads the existing `mapRooms` subscription; writes `mapRoom`
ops. See mockup **Board 6**.

---

### R18 — Generate-default token customization

**R18.1. (reported)** The Token Picker's "Generate default" tab currently shows
only an auto-assigned disc. Extend it to expose, with the auto values pre-filled:
- a **character** input that accepts **arbitrary text** (letters, digits, a symbol/
  emoji glyph — not restricted to A–Z), defaulting to the auto seat/type letter
  from `letterLabel`. The letter-progression default is kept; the field just no
  longer *constrains* to letters. Keep a sane render cap (~2–3 glyphs) so the
  disc stays legible; `renderGenTokenSvg` already scales font by label length and
  XML-escapes, so multi-char/symbol input is safe.
- a **color picker** (defaulting to `genColorToken(seed)`), offering a small
  themed swatch palette plus a custom color.
Preview updates live via `renderGenTokenSvg(label, color)`; confirm builds the ref
with `buildGenTokenRef(label, color)`. The determinism contract is unchanged (the
ref still fully describes the SVG). One check: since the label is embedded in the
ref and `buildGenTokenRef` joins on `:`, guard/encode a `:` typed into the field so
the `gen:disc:{label}:{color}` parse stays unambiguous. See mockup **Board 7**.

---

### R19 — Dice renderer v2.1 (match the reference set)

Target is the attached reference image: glossy plastic dice on a clean background,
per-die-kind colors, crisp white numerals centered and parallel to each face's
edges, d4 with legible corner numbers. All four things you called out (shading,
size, numeral position, numeral size) are pinned to that reference below. The
reference is committed to the repo at **`docs/dice-reference.png`** as the
visual target — R3.5-safe: it tunes material/colors/numeral proportions by eye and
is **never traced into geometry** (the polyhedra stay procedural). The approved
parameter values come from the interactive preview (`dice-preview.html`), which
renders the real procedural dice with these changes live.

**R19.1 Remove the octagonal tray. (resolved — confirmed.)** Delete the octagonal
`CylinderGeometry` tray: don't build it in `buildTray`, and don't push it to the
`live` set in `scene.runRoll`. Also drop the per-die radial contact shadow so the
dice read as *floating*, matching the reference (no ground plane, no cast shadow).
If you later want a whisper of grounding we can add a faint blurred shadow, but the
reference has none, so default is none.

**R19.2 Glossy plastic shading. (reference)** Retune the face material for the
reference's glossy look: lower `roughness` to ~0.30 (from 0.45), keep `metalness`
low (~0.10), keep `flatShading: true` so facet edges stay crisp (visible on the
d8/d20 in the reference). Ensure a single soft key light from upper-front produces
a gentle specular highlight near the top of each die, with the color deepening
toward the lower edges (ambient falloff). No harsh rim light.

**R19.3 Per-die-kind colors. (reference)** Adopt the reference palette as the
default die colors, theme-overridable: **d4 crimson, d6 green, d8 blue, d10 gold,
d12 orange, d20 purple** (d100 = two tinted d10s as today). Wire these as a
`DICE_KIND_COLOR` map read by `faceColor`, so a theme can override the set but the
out-of-box look matches the reference rather than a single flat theme color. (If
you'd rather keep one themed color for all dice, this is the one item to veto — it's
isolated.)

**R19.4 Die size −10%. (reported)** Reduce each entry in `SCALE` (`geometry.ts`)
by ~10% (e.g. d6 `0.5 → 0.45`), keeping the set balanced (d4 smallest → d20 largest,
comparable on-screen sizes as in the reference). Camera framing unchanged.

**R19.5 Numeral position + size. (reference)** Two coupled fixes:
- *Parallel to edges:* fix the per-face UV basis so the U axis aligns to a face
  *edge* direction, not a corner. In `buildDieGeometry`, derive `uAxis` from the
  edge `(pts[0]→pts[1])` (or centroid→edge-midpoint) instead of `pts[0]−centroid`.
  This straightens the d6 numerals and improves d8/d10/d12/d20 alignment — the
  reference numerals all sit square to their faces.
- *Size:* set the single-digit face font to ~0.50 of the face (from 0.56) and the
  two-digit branch to ~0.38, matching the reference's prominent-but-margined
  numerals. This lands near the requested reduction once the orientation is fixed;
  the reference proportion is authoritative over a strict −20%. Keep the 6/9
  underline. See mockup **Board 9**.

**R19.6 d4 numerals on the face. (reported + reference)** The reference d4 carries
three numbers per face, one near each corner, all upright and legible, with the
value read at the upward apex. Re-anchor the three corner glyphs inboard (bias each
toward the face centroid) so all three sit *within* the visible triangle and read
upright per face — not crammed onto the point. Validate every orientation shows a
legible up-apex value via the `resolve.test.ts` round-trip plus a visual snapshot.
See mockup **Board 9 (d4)**.

---

### R20 — Advantage/disadvantage, corrected per resolution mode

**R20.1 Semantics — mode-dependent. (corrected per your note.)** Advantage/
disadvantage now behaves differently by resolution mode:

- **Summed mode → (n+1) pool.** For the staged dice, roll **one extra** die and
  keep the `n` highest (advantage) / `n` lowest (disadvantage). For a **mixed**
  summed pool, apply the rule **per die-kind group**, one extra per type (e.g.
  `2d20 + 1d6` adv → `3d20` keep 2, `2d6` keep 1). This is the new behavior.
- **Separate mode → +1 per die.** Each staged die gets its own companion die; keep
  the higher (advantage) / lower (disadvantage) of each pair, and flag each kept
  die independently. **This is exactly what today's `rollTray` already does** — so
  Separate mode is already correct at the data layer; it only lacked the dropped-die
  *visualization* (A2).

Preserve seed-authoritative determinism (same seed ⇒ same result on every client).
Consume the RNG stream in a documented, stable order for the pool case (kind groups
in a fixed order) so re-derivation matches across clients.

**R20.2 Visualization — both modes. (reported / your call.)** Render the full set
of physical dice in the 3D scene, with each **dropped** die shown **dimmed/greyed**
rather than absent, so advantage is visibly doing something (the core fix for the
"non-functional" perception). This applies to both modes: a dropped pool die
(summed) and each dropped companion (separate) render dimmed. The roll strip and log
annotate the dropped value(s). See mockup **Board 10**.

**R20.3 Compatibility.** Keep `RolledDie.dropped` for the separate/per-die case; add
an additive pool marker for summed (e.g. a `pool?: { kind; kept: number[]; dropped:
number }` on `Roll`, or a `dropped: true` flag per physical die the scene reads to
dim the mesh). All `Roll` schema changes are additive — old rolls still render.

---

### R21 — Token status ring (group / selection / ownership)

**R21.1. (your addendum.)** Every token on the map gets an **outer status ring**
drawn by the engine from live state, with this color rule:
- **black** — token is in no group;
- **group color** — token belongs to a group (use the group's palette color);
- **white** — token is currently **selected**, or is **owned** by the viewing
  player (their own character).

**R21.2 Precedence.** White wins, then group color, then black:
`selected || ownedByViewer → white`, else `groupId → groupColor`, else `black`.
Selection is transient (only while selected); ownership is persistent — so a
grouped token I own shows white, and a grouped token I select shows white until I
deselect, then returns to its group color. This ring is **separate** from a
generated disc's own baked-in art ring (R7.1/R18): it's a render-time overlay the
map engine strokes around the token sprite, driven by `token.groupId`,
`token.ownerSeatId` vs. the viewer's seat, and the current selection.

**R21.3 Note (optional).** Because *selected* and *owned* both map to white, a
player selecting their own token sees no change. If you later want them
distinguished, the cheapest split is: owned = solid white ring, selected = solid
white **+ a subtle glow/thicker stroke**. Not in v1 unless you ask. See mockup
**Board 11**.

---

## PART III — Work items (sequenced)

Dependency spine: **WI-13 first** (unblocks reaching settings). Wall/door share a
migration, so **WI-14 → WI-15** run back-to-back. Dice (WI-22, WI-23) are
independent and can run any time after WI-13. Everything else is independent.

Each item: `[HUMAN]` steps are yours (approve mockups, run/verify migrations
against real data, visual QA, flip Blaze); `[AGENT]` steps are one Claude Code
prompt.

---

### WI-13 — Settings section-nav URL fix + theme reachability  (R16)
- **Model:** current Sonnet release · **Effort:** low
- **[AGENT]** Replace hash-anchor jump-links in `SessionActivity.svelte` with
  scroll-into-view buttons; confirm `session-theme-select` applies live and syncs.
- **[HUMAN]** Verify in a real room that clicking each Session section no longer
  navigates to the Lobby, and that a theme change syncs to a second client.
- **Gate 13:** With two clients in a room, clicking every Session section keeps
  both on `#/r/{roomId}`; a theme switch round-trips to the second client.
  E2E added to `session-config.spec.ts`.

### WI-14 — Wall line-type system + circular/angled/natural per-wall  (R10)
- **Model:** `claude-opus-4-8` · **Effort:** high
- **[HUMAN]** Approve mockup **Board 1**. (Decision R10.5a is settled: dedicated
  `CircleWall`.)
- **[AGENT]** Widen `WallStyle` (solid/masonry/natural/dashed); add `MapWall.style?`;
  migration + schemaVersion bump; engine style-dispatch; angled default → solid;
  `wallCircle` tool + `CircleWall` model (incl. `gaps` + reserved `doors[]` field)
  with subscription/rules; circle→N-gon LoS that **skips gap arcs**; a "cut a gap"
  erase interaction on rings; toolbar 4-way style select; unit tests (per-wall style
  resolution, circle→N-gon LoS, gap excluded from LoS). Typed doors *on* an arc are
  deferred to a follow-on WI (field reserved now, no later migration).
- **Gate 14:** A single natural wall in a masonry room renders irregular; an angled
  wall renders solid by default; a circular wall blocks LoS as an N-gon **and a cut
  gap passes LoS/movement**; existing rooms/walls render unchanged (migration proven
  on an imported pre-migration room); two clients render an identical natural/circle
  run.

### WI-15 — Door type system  (R11)
- **Model:** `claude-opus-4-8` · **Effort:** high
- **[HUMAN]** Approve mockup **Board 2**.
- **[AGENT]** Replace `MapDoor` with the typed model; migration (`secret→'secret'`,
  else `'single'`); door-type picker on the Door tool; centered icon overlay render
  pass (single/double/secret/trapped/oneWay/barred); `type:'none'` removes; widen
  `doorPassesSight`; tests (each type blocks/passes LoS correctly; icon centered on
  any segment).
- **Gate 15:** Each door type sets on any grid segment, renders a centered icon,
  and blocks/passes LoS per R11.4; `none` removes; a pre-migration secret door
  survives as `type:'secret'`.

### WI-16 — Carve/Fill dimension HUD  (R12)
- **Model:** current Sonnet release · **Effort:** low
- **[HUMAN]** Approve mockup **Board 3**.
- **[AGENT]** Add `renderDimHud` overlay method; wire carve/fill/ellipse drag to
  update `W × H` (cells) at the rect centroid; clear on end.
- **Gate 16:** Dragging a carve rect shows a live centered `W × H` that updates and
  disappears on release; no draft/persistence writes for the HUD.

### WI-17 — Labels v3 (inline edit, delete)  (R13.1–R13.2)
- **Model:** current Sonnet release · **Effort:** medium
- **[HUMAN]** Approve mockup **Board 4**.
- **[AGENT]** Inline overlay editor on double-click (commit on blur/Enter, Escape
  cancels); delete affordance; `mapRoom` replace/delete ops; keep undo/redo intact.
  (Renumber/reorder lands with the room manager in WI-20/R13.3.)
- **Gate 17:** A label edits in place and persists on blur; delete removes it; both
  are undoable; no modal prompt in the edit path.

### WI-18 — Shell collapse-reclaim + token-config contextualization  (R14)
- **Model:** current Sonnet release · **Effort:** medium
- **[HUMAN]** Approve mockup **Board 8**.
- **[AGENT]** Fix `RoomShell` grid so a collapsed Tools rail shrinks to a spine;
  regroup Snap (global) vs. Scale (per-selection) in the palette; confirm single-
  token select guard (R14.3).
- **Gate 18:** With both rails collapsed the stage is ≥90% width (Gate 2 re-proven);
  Scale shows only with a selected token; Snap always shows under "Map defaults".

### WI-19 — Background/starter map management  (R15)
- **Model:** `claude-opus-4-8` · **Effort:** medium
- **[HUMAN]** Approve mockup **Board 5**; verify migration backfills the starter
  ref on an existing room.
- **[AGENT]** Add `Room.background`; migration; `MapView` reads it; GM
  Change/Remove-background controls reusing the asset picker.
- **Gate 19:** GM can change and remove the background; existing rooms still show
  the starter map after migration; a removed background renders empty (rock).

### WI-20 — Multi-room manager + renumber/reorder  (R17.2, R13.3)
- **Model:** `claude-opus-4-8` · **Effort:** high
- **[HUMAN]** Approve mockup **Board 6**. (Asset removal is resolved — out of scope.)
- **[AGENT]** Build the **Rooms** panel (list/rename/renumber/reorder/jump/delete) in
  the Assets activity + GM controls, reading the `mapRooms` subscription; renumber
  batch op keeping keys unique (R13.3); undoable `mapRoom` ops throughout.
- **Gate 20:** A GM can rename, renumber, reorder, jump-to, and delete `MapRoom`s
  from the Rooms panel; renumber keeps keys unique and is undoable; a second client
  sees the changes sync.

### WI-21 — Generate-default token customization  (R18)
- **Model:** current Sonnet release · **Effort:** medium
- **[HUMAN]** Approve mockup **Board 7**.
- **[AGENT]** Add character + color inputs (pre-filled with the auto letter/color)
  to the Generate-default tab; **accept arbitrary characters** (not just A–Z) with a
  ~2–3 glyph render cap and a guard/encoding for a typed `:`; live `renderGenTokenSvg`
  preview; confirm via `buildGenTokenRef`; keep determinism tests green.
- **Gate 21:** The Generate-default tab lets a user set an arbitrary character (with
  the letter-progression default) + color, previews live, and produces a token whose
  ref round-trips to the identical SVG; a `:` in the label doesn't break the ref parse.

### WI-22 — Dice renderer v2.1 (match reference set)  (R19)
- **Model:** `claude-opus-4-8` · **Effort:** medium  *(geometry/UV math is fiddly
  and touches the shared face-detection round-trip)*
- **[HUMAN]** Dial in the look in the interactive preview (`dice-preview.html`) and
  record the approved values (roughness, metalness, key-light, die scale, numeral
  scale, per-kind vs single color, tray/shadow off); commit the reference image to
  `docs/dice-reference.png`. Those recorded params are the AGENT's spec.
- **[AGENT]** Remove the octagonal tray (and per-die shadow) from build + live set;
  glossy material retune (roughness ~0.30, key-light specular); per-die-kind color
  map (`DICE_KIND_COLOR`, theme-overridable); `SCALE` −10%; single-digit face font
  ~0.50 / two-digit ~0.38; UV U-axis → edge-aligned (d6 + general); d4 corner-glyph
  re-anchor inboard; keep `geometry.test.ts` / `resolve.test.ts` round-trips green;
  add a numeral-orientation snapshot where feasible.
- **Gate 22:** On a real roll the dice read like the reference — no tray/shadow;
  glossy plastic with a soft specular; per-kind colors; ~10% smaller; numerals
  centered, parallel to face edges, ~half the face; every d4 result reads three
  legible corner numbers with the value at the up-apex; face-detection round-trips
  still pass.

### WI-23 — Advantage/disadvantage by mode  (R20)
- **Model:** `claude-opus-4-8` · **Effort:** medium
- **[HUMAN]** Approve mockup **Board 10**. (Mode split + per-kind "1 extra per type"
  for summed are confirmed.)
- **[AGENT]** Summed mode → (n+1) pool keep-n, per-kind grouping for mixed pools
  (one extra per type); Separate mode → keep the existing +1-per-die behavior
  (already correct) and just surface the dropped die. Add an additive `Roll` marker
  for dropped dice; render the full set with dropped dice **dimmed** in both modes;
  update strip/log annotations; rewrite/extend `engine.test.ts` for both modes and
  cross-client determinism.
- **Gate 23:** Summed advantage rolls `n+1` and keeps the `n` highest (disadvantage:
  lowest), per-kind for mixed; Separate advantage keeps the higher of each die's
  pair; determinism holds across two clients for a fixed seed; every dropped die is
  visibly dimmed in the tray and annotated in the strip/log.

### WI-24 — Token status ring  (R21)
- **Model:** current Sonnet release · **Effort:** low
- **[HUMAN]** Approve mockup **Board 11**.
- **[AGENT]** Add an engine render-time ring around each map token: white if
  selected or owned-by-viewer, else group color, else black (precedence
  selected/owned > group > none). Drive from `token.groupId`, `token.ownerSeatId`
  vs. viewer seat, and current selection. Keep it separate from a gen-disc's baked
  art ring.
- **Gate 24:** A grouped token shows its group color; an ungrouped one shows black;
  selecting any token or viewing one's own shows white; the ring updates live as
  group/selection/ownership change.

---

## PART IV — Clarifications

**Resolved from your review:**
- *Asset removal (was #1):* resolved — the existing saved-asset ✕ is sufficient;
  dropped from WI-20.
- *Dice underlay (was #3):* resolved — remove the octagonal tray (and, to match the
  reference, the per-die shadow too).
- *Circular walls (R10.5a):* settled — dedicated `CircleWall`, with `gaps` reserved
  now and typed arc-doors deferred to a follow-on WI.
- *Advantage semantics:* settled — summed = (n+1) pool (1 extra per kind for mixed);
  separate = +1 per die (existing); dropped dice dimmed in both.
- *Generate-default:* arbitrary characters allowed, letter default kept.
- *Token ring:* added as R21 / WI-24.

**Still open (one):**
1. **(WI-13 / R16.2) "Theme engine unavailable" — reachability or authoring?**
   The theme select is wired and, once WI-13 lands, reachable. Do you want just
   that, or a fuller theme *engine* (edit/create custom token sets), which is a
   larger R2 extension? Only WI-13's scope depends on the answer.

---

## Model-target summary

| WI | Spec | Model | Effort |
|----|------|-------|--------|
| 13 | R16 | Sonnet (current) | low |
| 14 | R10 | claude-opus-4-8 | high |
| 15 | R11 | claude-opus-4-8 | high |
| 16 | R12 | Sonnet (current) | low |
| 17 | R13.1–2 | Sonnet (current) | medium |
| 18 | R14 | Sonnet (current) | medium |
| 19 | R15 | claude-opus-4-8 | medium |
| 20 | R17.2 / R13.3 | claude-opus-4-8 | high |
| 21 | R18 | Sonnet (current) | medium |
| 22 | R19 | claude-opus-4-8 | medium |
| 23 | R20 | claude-opus-4-8 | medium |
| 24 | R21 | Sonnet (current) | low |

*(Your plan's convention names the workhorse `claude-sonnet-4-6`; the current
Sonnet release is a drop-in bump if you want it.)*
