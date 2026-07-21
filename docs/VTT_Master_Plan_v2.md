# OSR VTT — Master Plan v2 (Shell & Polish Era)

**Status:** This document is **self-contained** and replaces `VTT_Implementation_Plan.md`, `VTT_Execution_Roadmap.md`, `VTT_Map_Tooling_Spec.md`, and `VTT_Encounter_Screen_Spec.md`, all of which are retired from the tree. Every invariant, pending item, and behavioral rule still in force has been re-stated here. If it isn't in this document, it is not a requirement.

> **⚠️ Map model superseded (2026-07-20).** This plan's map sections (Part I §1.1.2, §1.3, and R9) were written against the **cellular** map model and explicitly rejected a vector rewrite. That verdict was later reversed: the **Vector Map System** ([`VectorMapSystem_Spec.md`](./VectorMapSystem_Spec.md) / [`VectorMapSystem_Decisions.md`](./VectorMapSystem_Decisions.md)) fully replaced the cellular model in the WI-D cutover. Those sections are annotated in place rather than rewritten — for current map-system behavior, the Vector Map System docs are authoritative over this plan. See root [`CLAUDE.md`](../CLAUDE.md) for the full doc index and precedence order.

**Companion file:** `vtt-ui-mockups.html` — visual mockups for the Activity Shell (desktop Options A & B, mobile), referenced by R1 and WI-2/WI-3.

**WI-0 decision (locked 2026-07-11):** Shell option **A** (docked flyouts) is the final choice — the recommended default per Part V, adopted as-is with no hybrid. No icon/color deviations from R1.4. This is binding for the WI-2 prompt.

---

## 0. How to Use This Document

- **Part I** — critical assessment of the codebase as it stands (what to protect, what's broken, what to refactor).
- **Part II** — carried-forward invariants and reference specs from the retired docs (condensed, still authoritative).
- **Part III** — reference specs for the new work (R1–R9). Work items cite these; do not improvise behavior they define.
- **Part IV** — sequenced work items (WI-0 …), each with owner, model target, effort, steps, acceptance gate, and stop condition.
- **Part V** — open decisions with locked defaults, and the database-maintenance answer.

**Golden rules (unchanged from v1, still binding):**

1. One work item per Claude Code prompt. Never batch WIs.
2. Every prompt ends with a stop condition; a WI is done only when its PR passes CI and merges green to `main`.
3. All Firebase access stays behind `CampaignStore` / `AssetStore`. Components never touch the SDK. This is what keeps the PocketBase swap cheap and is proven by the shared contract suite — **any new store method must be added to the contract tests and pass on both `MemoryStore` and `FirebaseStore`.**
4. If a gate fails, fix that WI; never move on broken.
5. The **no-game-mechanics hard limit** stands: the app stores and displays data but never interprets it. No stat logic, no value-triggered behavior, ever.

**Model targets.** Each WI names a Claude Code model and a reasoning-effort level:

| Target                                           | Use for                                                                       | Notes                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------- |
| `claude-opus-4-8`, effort **high**               | Architecture-changing work: new shell, geometry/physics, auth & rules changes | Slower/costlier; use only where marked |
| `claude-sonnet-4-6`, effort **medium** (default) | Standard feature implementation against a written spec                        | The workhorse                          |
| `claude-sonnet-4-6`, effort **low**              | Mechanical, well-bounded tasks (export button, doc moves)                     |                                        |
| **[HUMAN]**                                      | Console setup, playtests, option selection, credentials                       | Never delegate                         |
| **[OTHER AGENT]**                                | Art direction / image generation / design review outside Claude Code          | Optional steps                         |

---

# PART I — CODEBASE ASSESSMENT

## 1.1 What works well — protected, do not regress

These are the load-bearing strengths. Any WI that would weaken one of these must stop and flag instead.

1. **The store abstraction is real, not aspirational.** `CampaignStore`/`AssetStore` interfaces in `/packages/shared`, one concrete `FirebaseStore`, one `MemoryStore`, and **one shared behavioral contract suite run unmodified against both** (`campaign-store.contract.ts`). This is the single most valuable structural asset in the repo. Every new persistence need goes through it.
2. **The cellular map model.** Solid/floor cells in 16×16 bit-packed chunks; perimeter walls _derived_, never stored; explicit walls only on floor↔floor edges; doors as edge flags; symbols cell-bound; labels room-bound. It is simple, write-cheap, conflict-free (a cell is floor or it isn't — no z-order), and it makes LoS exact. **Verdict: keep. Do not migrate to a vector map model** — every "organic shapes" request in this plan is solved by rasterizing to cells + smarter _rendering_ (R9), not by changing the model.
   > **⚠️ Superseded (2026-07-20).** This verdict was reversed: the Vector Map System (see [`VectorMapSystem_Spec.md`](./VectorMapSystem_Spec.md) / [`VectorMapSystem_Decisions.md`](./VectorMapSystem_Decisions.md)) replaced the cellular model entirely in the WI-D cutover. The cellular map, its chunked storage, and `MapView`/`map/engine.ts` were deleted; `VectorMapView.svelte` is now the only map view. Kept here for the historical rationale — do not use this item to justify new cellular-model work.
3. **Deterministic dice, decorative physics.** Seed → `mulberry32` → faces; the Roll doc is the source of truth; the 3D tumble is cosmetic. The _architecture_ is correct — the _presentation_ is what's broken (R3). Keep the seed/result pipeline byte-for-byte.
4. **Write discipline.** RTDB for cursors/drags/draft strokes, Firestore commit-on-pointer-release, chunk-batched carves. This is what keeps the app on Spark. Every new high-frequency feature (collapsed-group drags, dice overlay) must follow the same pattern.
5. **Security-rules-as-authority, tested.** `gmPrivate` boundary with a real rules test suite; copy-on-reveal patterns (Blind Drawer, handout library). Rules changes are code changes: PR + tests.
6. **Portability.** `.vttcamp` export/import with `schemaVersion` migrations, exercised by tests. Every schema change in this plan **must** ship a migration and a migration test.
7. **Test culture.** Vitest units, rules tests, Playwright two-context e2e with stable `data-testid`s, CI green-gate. New UI work must preserve existing testids or update the specs in the same PR.

## 1.2 Critical missing features

1. **There is no UI shell.** `RoomShell` is a fixed 3-column CSS grid; every panel (template editor, handout, notes, dock, tray, dice, groups, blind drawer, tables, tracker) is permanently stacked in a sidebar or under the board. Nothing is discoverable, nothing is collapsible, the stage gets ~50% of the viewport, and there is **zero mobile support** — the grid simply overflows on a phone.
2. **No session configuration surface.** Grid dimensions/cell size are compile-time defaults; measurement is hardcoded in the UI; fog mode is a bare `<select>` floating in the map toolbar; the profile-template editor sits permanently in the GM's sidebar; there is no player management at all (no rename, no role change, no kick, no GM transfer).
3. **No out-of-session management.** No "my rooms" list (room IDs live in browser history or nowhere), no room rename/delete, no way to reclaim GM from a new device (anonymous auth = identity dies with the browser profile), rooms and their subcollections accumulate in Firestore forever.
4. **The log is a dumb list.** No timestamps, no author names, no search, no filters, no scroll-back pagination, and — despite `type: 'chat'` existing in the schema and being written by the table runner — **no way for a human to type a chat message.**
5. **Asset handling is a stub.** Two bundled tokens, one map, a paste-a-URL field. No library UI, no per-character default tokens, no referee creature picker.
6. **No map export** (.png download).
7. **The encounter board is not the intended design.** Cards are a circle + coordinates, not the image-over-stats rectangle; no group boxes; no unassigned bin; GM panels are always-visible clutter below the cast.

## 1.3 Technology decisions — review

**Keep (re-affirmed):** Firebase serverless on Spark; Svelte 5 + Vite; PixiJS v8 for the map; pnpm monorepo; static bundle + hash routing (GitHub Pages compatible); Playwright/Vitest/rules-tests CI; Yjs for notes.

**Refactor (high-impact, in-scope):**

1. **The dice presentation pipeline (replace).** Root causes of the reported bugs, confirmed in `dice/scene.ts` / `DiceOverlay.svelte`:
   - _Post-settle face flip:_ `settle()` slerps each mesh from its physics-final orientation to a precomputed `quaternionForFace(...)` target. The physics ends on an arbitrary face, so the correction is routinely a large visible rotation — the flip is designed in, not a glitch.
   - _Only d6:_ one `BoxGeometry` mesh; every die size is mapped `((kept-1)%6)+1` onto a cube.
   - _Poor visual quality:_ no `renderer.setPixelRatio(devicePixelRatio)` (blurry on HiDPI), flat `MeshStandardMaterial` with one directional light, no shadow/contact grounding, SVG pip textures loaded per-die per-roll (no caching).
   - _Dice persist:_ `scene.roll()` never calls `clear()`; old meshes stay in the scene until dispose.
   - _It isn't an overlay:_ it's a small sidebar box titled "Dice."
     R3 replaces this module. The seed→result engine is untouched.
2. **Color system (extract).** Hex values are hardcoded in ~every component `<style>` block _and_ as constants in `map/engine.ts`. Extract to CSS custom properties + a `MapTheme` object the Pixi engine consumes. Prerequisite for theming (R2) and the color-coded shell (R1).
3. **`window.prompt()` and debug-grade inputs.** Room labels via `prompt()`, token creation via a "drop token" dev button. Replace with shell-native dialogs/popovers (R1 provides the primitives).
4. **seat/uid conflation.** `seatId == uid` throughout (rules comment admits it). Acceptable for v1, but Google-account identity (R6) and future seat reassignment need the distinction to at least be honored where it already exists in the schema (`players/{uid}.seatId`). No migration required now; new code must read `seatId` from the seat doc rather than assuming `uid`.
5. **Wall interaction model (extend, don't replace).** Axis-aligned wall runs stay edge-walls (cellular). Diagonal walls become **vector walls**, reusing the already-shipped `SightWall` machinery (render + LoS both exist) with a `visible` flag. See R9.2.
   > **⚠️ Superseded (2026-07-20).** `SightWall`/edge-walls no longer exist; every wall (axis-aligned or diagonal) is now a `Segment` in the Vector Map System — see [`VectorMapSystem_Spec.md`](./VectorMapSystem_Spec.md) §3.1.

**Explicitly rejected refactors** (considered, not worth it):

- Vector/freeform map model rewrite — the cellular model + organic rendering (R9.4) achieves the visual goal at a fraction of the risk.
  > **⚠️ Superseded (2026-07-20).** This rejection was later reversed by product direction; the vector rewrite was built and shipped as the Vector Map System (WI-A–WI-D). See [`VectorMapSystem_Spec.md`](./VectorMapSystem_Spec.md).
- Any server/backend introduction — trust model stands.
- Framework or renderer swaps — Svelte 5 and Pixi v8 are pulling their weight.
- Full-viewport-diff rendering optimizations — `renderMap` redraws everything per change; fine at 64×64. **Watch item:** re-evaluate if grids grow past ~128×128 or Chromebook playtests dip below budget.

## 1.4 Utility issues & poorly-thought-out workflows (consolidated bug/UX list)

| #   | Issue                                                                                               | Where                             | Resolved by                    |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------ |
| U1  | Dice: post-settle face flip                                                                         | `dice/scene.ts settle()`          | R3 / WI-4                      |
| U2  | Dice: only d6 geometry, all sizes drawn as cubes                                                    | `dice/scene.ts`, `DiceOverlay`    | R3 / WI-4                      |
| U3  | Dice: old dice persist when new roll arrives                                                        | `scene.roll()` never clears       | R3 / WI-4                      |
| U4  | Dice: low visual quality (no pixel ratio, flat lighting, uncached textures)                         | `dice/scene.ts`                   | R3 / WI-4                      |
| U5  | Dice results not surfaced as a true overlay                                                         | `DiceOverlay` is a sidebar box    | R1+R3 / WI-2, WI-4             |
| U6  | Labels: rendered at anchor top-left, single line, no centering/wrap                                 | `engine.ts renderMap` room labels | R9.5 / WI-5a                   |
| U7  | Wall tool: one click per edge; spec's "drag a run" never implemented; no diagonals                  | `MapView` wall handling           | R9.2 / WI-5a                   |
| U8  | Measurement hardcoded to "sq / ft" & 5 ft in the UI (engine already takes `feetPerSquare` — unused) | `MapView` ruler wiring            | R9.3 / WI-5a                   |
| U9  | "Natural" wall style is a straight dashed line, not organic                                         | `engine.ts strokeDashed`          | R9.4 / WI-5b                   |
| U10 | `window.prompt()` for room labels                                                                   | `MapView` label tool              | WI-2 (dialog primitive), WI-5a |
| U11 | Token creation is a debug "drop token" button; only one starter token                               | RoomShell/MapView                 | R7 / WI-9                      |
| U12 | Pan requires right-click or Alt; no space-drag, no touch pan                                        | `engine.ts setupPanZoom`          | WI-3 (touch), WI-5a (space)    |
| U13 | GM panels (Groups, Blind Drawer, Tables) permanently stacked under the board                        | `EncounterBoard`                  | R1/R8 / WI-2, WI-8             |
| U14 | Handout viewer overlays both stage modes with no dismiss affordance for players                     | `MainStage`/`HandoutViewer`       | R1 / WI-2                      |
| U15 | Log entries lack author/time; no chat input despite `type:'chat'` in schema                         | `ActionLog`                       | R5 / WI-7                      |
| U16 | No keyboard shortcut map (undo/redo exist; nothing else, nothing documented)                        | app-wide                          | R1.7 / WI-2                    |
| U17 | Zoom has no bounds and zooms to center, not cursor                                                  | `setupPanZoom`                    | WI-5a                          |
| U18 | Rolls/log grow unbounded; subscriptions load everything                                             | store subscriptions               | R5.4, R6.4 / WI-7, WI-10       |

---

# PART II — CARRIED-FORWARD REFERENCE SPEC (self-contained)

Everything in Part II was previously spread across the four retired docs. It remains **authoritative**. It is condensed, not weakened.

## 2.1 Invariants (hard rules)

- **Trust model:** all players trusted; no anti-cheat, no authoritative server. Security Rules enforce exactly one boundary: GM-hidden information (`gmPrivate/**`, readable/writable only by `gmUid`).
- **Backend:** Firebase serverless. Firestore = durable state; RTDB = high-frequency ephemeral (cursors, drag frames, pings, stroke drafts); Anonymous Auth (+ optional Google link per R6) = identity; static hosting (Firebase Hosting or GitHub Pages, hash routing, Vite `base` configured).
- **No game mechanics:** character data = referee-defined Profiles; field types `text · longtext · number · counter · checkbox · roll`; only `roll` touches other UI (stages a die in the tray). The app never computes, validates, or triggers on any value. A test asserts no value-derived logic exists — keep it green.
- **Dice authority:** rolling client writes `{seed, dice[], modifier, advantage, mode, total?}`; every client derives the same faces from the seed (`hashSeed`+`mulberry32`); animation is decorative and never load-bearing.
- **Write discipline:** if it updates many times per second it rides RTDB; Firestore gets one settled write (drag-end, stroke-release, chunk-batched carves). Target: comfortably inside 20k Firestore writes/day.
- **Portability:** `schemaVersion` on the room doc; every schema change ships a migration + test; `.vttcamp` export/import must round-trip identically.
- **Interfaces rule:** components see only `CampaignStore`/`AssetStore` via Svelte context; `apps/web/src/lib/firebase/client.ts` is the sole concrete-store touchpoint.

## 2.2 Cellular map model (condensed, authoritative)

- Map = grid of cells, each **solid** (rock, default) or **floor** (carved). Room = named/keyed floor region (`MapRoom`: key, name, bbox, labelAnchor, wallStyle `masonry|natural`). Wall = grid-edge divider; **perimeter walls derived** from floor↔solid boundaries, **only explicit floor↔floor walls stored** (`walls/{edgeId}`). Door = wall-edge flag `{state: open|closed, secret}`; secret doors render as "S" to GM only. Symbol = icon bound to one cell. Label = text bound to a room's anchor cell.
- Storage: `floorChunks/{cx_cy}` and `fogChunks/{cx_cy}` = 16×16 bit-packed chunks; carve strokes preview locally, stream via RTDB drafts, **commit whole chunks on release**.
- Interaction semantics: overlapping carves union; adjacency separation is decided solely by presence of a wall/door on the shared edge; carve/fill idempotent; explicit walls persist as neighbors change; grid snapping always on for structure (Alt = loose annotation only).
- Fog modes: `emergent` (uncarved = unknown; the default mapper workflow), `manual` (GM reveal mask), `dynamic` (raycast LoS from token viewpoints against derived+explicit edges and vector `sightWalls`; open doors pass sight, closed/secret block).
- `.uvtt`/`.dd2vtt` import populates vector `sightWalls` + `lights` (lights stored, not yet used for vision ranges — still out of scope).
- Tool catalog in force: Carve (brush · rectangle drag/typed W×H · corridor) · Fill · Wall · Door (cycle open/closed/secret) · Symbol (palette, rotate) · Label/Key (auto-incrementing keys) · Select (move/delete/rename/re-key/restyle) · Pan/Zoom/Ruler/Ping · Fog Reveal/Hide/Reset (GM) · wall-style per room · Annotate (demoted freehand/text overlay). R9 extends this catalog; it does not replace it.
- **Still out of scope:** typed lighting/vision ranges, elevation/multi-floor, animated effects, terrain cost, hex grids (revisit post-shell).

## 2.3 Encounter model (condensed, authoritative)

- Cast area of actor cards grouped by side (Group); Groups carry `[Map] [Board] [Active]` visibility toggles (GM-controlled reveal).
- Initiative modes: **side/group** (default; one number per side, typed or dropped from a roll), **individual**, **free/caller** (rotating Caller marker). The app arranges and steps order; it never derives order from a stat. Round counter increments on advance/wrap; `acted` and defeated are flags, never HP math.
- Roll strip: ephemeral row where simultaneous results collect and sort. Tension widgets: global Difficulty Die + Danger Die (die value or clock), GM-set, all-visible.
- Separate-mode result classes: Success 4+ / Complication 2–3 / Failure 1 — classifies the rolled face only.

## 2.4 Pending items inherited from v1 (still open, tracked here)

| Item                                                | Status                                                                                   | Where it lives now       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| In-app image uploads (`FirebaseStorageAssetStore`)  | Deferred — requires **[HUMAN]** Blaze upgrade + budget alert; interface already in place | R7 note; unlock any time |
| Hex grid                                            | Deferred post-shell                                                                      | Part V open decisions    |
| GM recovery code                                    | **Superseded** by Google account linking                                                 | R6 / WI-10               |
| PocketBase second backend                           | Option kept alive by the contract suite; not scheduled                                   | Golden rule 3            |
| Chromebook performance playtest per merge           | **Still required** every WI                                                              | Every WI gate            |
| Map textures polish (water/rubble/vegetation fills) | Aspirational, non-gating                                                                 | R9.4 stretch             |
| Room password field (stored, unused)                | Dormant; revisit with R6 if ever needed                                                  | —                        |

---

# PART III — REFERENCE SPECS FOR NEW WORK (R1–R9)

## R1 — The Activity Shell (UI architecture)

**Mockups:** `vtt-ui-mockups.html` — Board 1 (legend), Boards 2–3 (desktop Option A), Board 4 (desktop Option B, alternate), Boards 5–7 (mobile). **[HUMAN]** picks A or B (or a hybrid) before WI-2 starts; the WI-2 prompt names the choice.

### R1.1 Concept

The room UI becomes a **near-fullscreen stage** hosting exactly one **Activity** at a time, framed by four **slim edge tabs**:

- **Top — Session tab:** room name, connection state, player presence chips (initials, colored, referee crowned), invite-link button, and (GM) a shortcut into the Session Configuration activity.
- **Left — Activities rail:** one single-color icon per registered activity, visually clustered into **color-coded group boxes** (see R1.4). Click = expand a **mini-card**; the mini-card carries the activity's most-needed controls plus an **"Open full view"** button that swaps the stage to that activity.
- **Right — Tools rail:** context-sensitive to the _current stage activity_ (map tools for Map, tray controls for Dice, tracker controls for Encounter…). Same slim-tab → mini-card/palette behavior.
- **Bottom — Chat/Log tab:** collapsed = last entry ticker; expanded = a peek drawer (last ~8 entries + chat input); "Open full view" = the Log activity on stage (R5).

**Dice rolls always render as a full-stage overlay** (R3), regardless of active activity. Results are always written to the log; when a roll originates from or lands during an encounter, it also appears on the encounter roll strip (existing behavior, kept).

### R1.2 Activity registry

```ts
interface ToolDef {
  id: string;
  icon: IconId;
  label: string;
  kind: 'mode' | 'action' | 'toggle';
  gmOnly?: boolean;
}
interface ActivityDef {
  id: 'map' | 'encounter' | 'dice' | 'characters' | 'assets' | 'log' | 'session';
  title: string;
  icon: IconId; // single-color stroke icon, rendered currentColor
  group: 'world' | 'play' | 'records' | 'referee';
  stage: Component; // full-stage view
  miniCard?: Component; // flyout quick controls; omit = icon opens stage directly
  tools?: ToolDef[]; // populates the right rail while on stage
  availability: 'all' | 'gm';
}
```

Registered v2 activities: **Map** (stage = current MapView, tools = map tool catalog), **Encounter** (stage = Board v2 per R8; tools = tracker/reveal/tension controls), **Dice** (stage = full tray + macro manager; mini-card = quick tray: die buttons, modifier, mode, Roll), **Characters** (stage = dock grid of all seats; mini-card = own sheet quick fields), **Assets** (R7), **Log** (R5), **Session** (R4, GM-only, referee group).

Existing panels map into this registry — nothing is rewritten, only re-housed: ProfileTemplateEditor → Session; HandoutPanel → Session (reveal action also surfaced as an Encounter tool); NotesPanel → Records group mini-card (and a tab within Log stage); GroupsPanel/BlindDrawer/TableRunner → Encounter tools (GM); CombatTracker → Encounter stage region; DiceTray → Dice activity + mini-card.

### R1.3 Interaction states

Each rail tab: `collapsed` (slim strip, 36 px, icons only) → `mini-card` (docked flyout ~320 px in Option A; floating card in Option B) → `stage` (dedicated view). Exactly one mini-card open per rail at a time; `Esc` closes; clicking the stage closes flyouts (Option A) / floating cards persist until dismissed (Option B). Active-activity icon shows a filled state + group-color left border. Shell state (active activity, open flyouts, bottom-drawer height) persists per room in `localStorage` (`vtt-shell:{roomId}`), never in Firestore.

### R1.4 Color groups & icons

Groups and their design-token colors (final hex set by R2/WI-1):

- **world** (Map, Assets) — map blue
- **play** (Encounter, Dice) — rust red
- **records** (Log/Chat, Characters/Notes) — moss green
- **referee** (Session) — violet, rendered only for the GM

Icons: **simplistic, single-color, stroke-based SVGs** drawn as `currentColor` so group/hover/active color is pure CSS. No multicolor art, no emoji (replace the current 🎲 spans and unicode symbol glyphs used in UI chrome — map _symbols on canvas_ keep their glyph rendering until the sprite pass, which stays aspirational).

### R1.5 Layering (z-order, top last)

stage activity → rails/flyouts → bottom drawer → **dice overlay** → dialogs/toasts. The dice overlay canvas is `position:fixed`, full-viewport, `pointer-events:none`.

### R1.6 Dialog primitives

Ship a shell-owned `<Dialog>` and `<Popover>` (focus-trapped, Esc-dismiss, styled by tokens). Retire every `window.prompt`/`confirm`.

### R1.7 Keyboard map (desktop)

`1–7` switch activities · `Esc` close flyout/overlay · `Ctrl+Z/Ctrl+Shift+Z` undo/redo (existing) · `Space+drag` pan · `L` focus chat input · `/` in chat = commands (R5.3). Document in a `?` shortcut sheet dialog.

### R1.8 Mobile / tablet mode

Trigger: viewport `< 900px` **or** coarse-pointer media query. Layout: compact top bar (room name, presence count, invite) · full-screen single activity · **bottom activity bar** (icon per activity, group-colored underline; no mini-cards — tapping switches the stage directly) · tools in a **bottom sheet** (drag handle, half/full snap points) · log as a normal activity plus an unread badge on its icon · dice overlay identical. Touch: one-finger = active tool, two-finger drag = pan, pinch = zoom (engine work in WI-3).

## R2 — Design tokens & theming

- Extract every color/space/radius/type decision into CSS custom properties on `:root` under a `data-theme` attribute: `--bg-deep --bg-panel --line --text --text-dim --accent --success --complication --failure --group-world --group-play --group-records --group-referee --map-rock --map-floor --map-wall --map-door --map-secret --map-fog --map-grid --map-selection`.
- The Pixi engine cannot read CSS vars cheaply per-frame: add `readMapTheme(): MapTheme` that resolves the `--map-*` vars once (and on theme change) into the numeric constants `engine.ts` currently hardcodes; engine takes a `MapTheme` and exposes `setTheme()` triggering a re-render.
- Themes shipped: `parchment-dark` (current look, default) and `keyed-blue` (blue rock / white floor — the classic reference aesthetic). Theme choice = **room-level** setting (`room.settings.theme`, GM-set in Session Config) so all players see the same map colors; a personal UI-only override can come later.
- No new theme design work is in scope beyond these two; the deliverable is the _system_.

## R3 — Dice renderer v2 (replaces `dice/scene.ts` presentation; engine untouched)

### R3.1 The no-flip settle (core fix)

Replace target-quaternion slerp with **pre-rotation**:

1. On roll arrival, run the full Rapier sim **headlessly first** (same seed-derived throw, no rendering — sub-frame cost), recording each die's final orientation. Settle detection is **threshold-based, not step-counted**: finished when `|linvel| + |angvel|` drops below a small epsilon and the die is inside the tray bounds, with a hard step cap (~5 s of sim time) that force-reads whatever face is most up.
2. Compute which face ends up via **per-face locator points** baked into each generated geometry (one point per face, at the face centroid direction; d4 locators at vertices per its reading convention): the landed face = locator direction with the highest dot product against world-up. One uniform mechanism for every die shape — no per-shape normal tables.
3. **Pre-rotate each die's initial orientation** (equivalently, remap its face→value material assignment) so that the face destined to land up carries the required `kept` value.
4. Replay the identical sim visually, then **lock the body** at rest (zero velocities, disable rotations/translations) so nothing drifts. The die simply lands — zero correction, zero flip. A face _change_ after rest is a gate failure.
5. **One physics world per roll:** a new roll tears down and recreates the world and scene contents, which makes "old dice persist" (U3) impossible by construction rather than by cleanup code.

Cross-client float drift is irrelevant: each client pre-rotates against its _own_ sim, so every client lands on the correct value even if tumbles differ microscopically. Throw feel: seed-derived uniform-random initial quaternion, spawn above the tray, launch velocity aimed toward tray center (a throw, not a drop), angular velocity in a tuned band.

### R3.2 Real polyhedra

d4 (tetra; value readable at the top — number each face near its apex vertex so the upward vertex convention reads correctly), d6 (box, kept), d8 (octa), d10 & d% (pentagonal trapezohedron — custom vertex data; d100 = paired d10s tinted differently), d12 (dodeca), d20 (icosa). Number textures generated at runtime on canvas (crisp at DPR, themed ink/face colors from tokens, underline 6/9), one cached texture atlas + geometry per die type per theme — never rebuilt per roll.

### R3.3 Presentation quality bar

`renderer.setPixelRatio(min(devicePixelRatio, 2))` · soft contact shadow (radial-gradient plane or shadow map) · hemisphere + key light · slight bevel look (normal-mapped edges or geometry bevel on the box) · invisible walls so dice stay in frame · dice scale relative to viewport.

### R3.4 Overlay lifecycle

Full-viewport fixed transparent canvas above the stage (R1.5). New roll ⇒ previous dice **cleared immediately**. After settle, a result chip (per-die faces + total/flags, author name) anchors near the dice for ~4 s, then fades; the canvas releases (renderer paused when idle). Rapid successive rolls queue at most one deep — latest wins. Reduced-motion preference ⇒ skip tumble, show chip only. Log/roll-strip writes unchanged.

### R3.5 Prior art — Owlbear Rodeo `dice` (clean-room notes)

`owlbear-rodeo/dice` (GPL-3.0) was examined as reference during planning. Its **techniques** informed R3.1 (threshold settle, locator-based face detection, rest locking, world-per-roll, throw-toward-center feel), all restated above in our own terms. Its architecture also _validates_ our divergence: Owlbear is physics-authoritative (value read from wherever physics lands; remote clients receive final transforms and render **static** dice, no remote tumble). Our seed-authoritative invariant requires every client to animate, which is exactly what pre-rotation provides.

**License discipline (binding):**

- Claude Code must **not** clone, fetch, open, or otherwise place the Owlbear repo (or any GPL-3.0 code) in its context during WI-4. This spec section is the sole channel for its ideas.
- No assets (GLB meshes, textures, materials, audio) from that repo may be copied or traced — geometry and number textures are generated procedurally per R3.2 (this repo already documented and avoided the same trap in `ATTRIBUTION.md`).

### R3.6 Shared rolls (referee-triggered simultaneous roll)

The table mechanic: each participating player stages a die; the referee presses one Roll; every die tumbles and resolves **simultaneously on every client**. (Use cases: 5e-style individual initiative; house encounter-resolution rolls.) This is native to the seed-authoritative model — a shared roll is **one composite Roll doc authored by the referee's client**.

1. **Staging doc:** `rooms/{roomId}/sharedRoll/current = { status: 'staging'|'resolved', label?: string, openedBy, slots: { [seatId]: { die: string, modifier: number, advantage: AdvantageMode, ready: boolean } } }`. Referee opens (optionally from the encounter tracker with a label); players write only their own slot (rules: own-seat-or-GM, mirroring profiles); everyone subscribes and sees readiness live. Low-frequency — plain Firestore.
2. **Trigger:** referee's client generates one seed and expands slots into dice **in deterministic seat-id-sorted order** — the invariant that lets every client re-derive identical faces from the one seed. Writes one Roll doc extended with `parts?: [{ seatId, dice: RolledDie[], modifier, advantage, total?, flags? }]` (schemaVersion bump + migration; ordinary rolls leave `parts` unset). Marks the staging doc `resolved`. Single writer ⇒ no race; slot edits after the press are simply ignored.
3. **Unstaged seats:** referee sees per-seat readiness and may fill a default die for a slow/absent seat or roll without them (unstaged seats excluded). Referee may also include their own slots (e.g., monster sides).
4. **Presentation:** overlay renders all parts at once, dice tinted per seat color; per-part result chips carry player names; the log gets one grouped entry (per-part lines nested/indented). Roll strip shows parts individually, sorted — its existing job.
5. **Initiative hand-off (within the no-mechanics limit):** results are _routed_, never derived — the encounter spec has always allowed "roll a die → drop it in the slot." A shared roll opened from the tracker offers an explicit one-tap GM action **"Apply results to initiative"**, matching seats (individual mode) or sides (side mode) to tracker rows. Explicit tap, not automatic.

## R4 — Session Configuration activity (GM-only) + player management

Stage view with sections (single scroll, anchored nav):

1. **Room:** name (inline edit), invite link + copy/QR, theme select (R2), export `.vttcamp` / import (moves here from the header).
2. **Grid & measurement:** grid w/h (grow-only warning if shrinking would orphan carved chunks — block shrink below carved bbox), cell size px, **half-size grid toggle** (R9.6), measurement `perSquare` number + `unit` free text — **defaults `10` and `feet`** (see migration note R9.3).
3. **Fog:** mode select (emergent/manual/dynamic) + Reset Fog (moves out of the map toolbar; a quick toggle stays as a GM map tool).
4. **Profile template:** the existing editor, re-housed.
5. **Tension defaults:** difficulty/danger die defaults.
6. **Players (in-session management):** list of seats — display name (GM-editable), role select `player|viewer`, **remove player** (deletes `players/{uid}`; their profile is kept unless "also delete character sheet" checked), **transfer referee** (writes `gmUid`, demotes self to player; double-confirm dialog). Rules already permit GM writes to seats and the room doc; add a rules test for GM transfer.

New schema: `room.settings = { theme, measure: { perSquare: number, unit: string }, grid: { subdivide: boolean } }` (grid w/h/cellSize stay where they are) + `schemaVersion` bump + migration seeding defaults.

## R5 — Log activity (full-screen) + chat

1. **Entry anatomy:** icon by `type` (roll/chat/table/reveal/system), author display name (resolved from seats, fall back "—"), relative + absolute timestamp, body; roll entries keep result-class tinting.
2. **Filters & search:** client-side filter chips per type (persisted locally per user); substring search over loaded entries; "load older" pagination (subscribe to last 200, page back in 200s via a new `listLogBefore(roomId, ts, limit)` store method — added to the contract suite).
3. **Chat input:** text box at bottom of both the peek drawer and the stage view; writes `{type:'chat', authorUid, text}`. Slash command `/r <expr>` parses via the existing `parseDieExpr`/tray engine and performs a real roll (writes Roll + log, triggers overlay). Unknown `/` commands post nothing and hint inline.
4. **What is logged (config):** recording stays always-on for roll/chat/table/reveal; add room-level toggles (Session Config) only for optional noise sources introduced later (e.g., "log token group reveals"). Per-user _view_ filters are the primary control — cheap and non-destructive.

## R6 — Accounts, out-of-session management & maintenance

### R6.1 Google account linking (optional, additive)

- `linkWithPopup(GoogleAuthProvider)` upgrades the **existing anonymous uid in place** — same uid, zero data migration; on a new device, Google sign-in restores that uid ⇒ **GM recovery solved**. Players may stay anonymous forever.
- **[HUMAN]**: enable Google sign-in provider in Firebase console; confirm authorized domains include the Pages/Hosting hostnames.
- UI: "Save your identity" affordance in the Session tab (subtle; never a login wall). Handle `credential-already-in-use` (Google account already bound to another uid) by offering sign-in-instead with a clear "this switches who you are" warning — no merge attempt in v1.

### R6.2 Lobby v2 — My Rooms

`users/{uid}/rooms/{roomId} = { name, role, lastSeenAt }`, written on create/join/open (self-owned; rules: user may write only their own index). Lobby lists My Rooms (name, role badge, last seen, open/delete) above Create/Join. Index entries are best-effort convenience data — a dangling entry after external deletion just renders a "room gone — remove?" row.

### R6.3 Room deletion (GM)

Client-side recursive delete: iterate the known subcollection list (players, profiles, tokens, groups, drawings, log, rolls, macros, tables, walls, symbols, mapRooms, floorChunks, fogChunks, sightWalls, lights, encounter, gmPrivate) in ≤400-doc batches, then the room doc, then the RTDB `/rooms/{roomId}` node. Offer "export first" in the confirm dialog. Add `deleteRoom(roomId)` to `CampaignStore` + contract tests + a rules test (only GM may delete the room doc — already true).

### R6.4 Database-level maintenance — the direct answer

**Is a DB-admin UI needed?** Mostly no. What is actually needed:

| Concern                                               | Resolution                                                                                                                    | Owner                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Orphaned rooms accumulating                           | R6.3 in-app GM delete + My Rooms visibility                                                                                   | app                     |
| Unbounded `rolls`/`log` growth in long campaigns      | Cap live subscriptions (last 200–500) + optional GM "prune entries older than N days (export first)" button in Session Config | app                     |
| Stale RTDB cursors/drags/pings                        | Already ts-filtered client-side; add `onDisconnect().remove()` on the cursor node if missing; pings self-expire               | app (small)             |
| Firestore TTL auto-expiry on `rolls`                  | Optional belt-and-braces: TTL policy on a `ts`-derived field — **console-only setup**                                         | **[HUMAN]**             |
| Usage/quota monitoring, orphaned anonymous Auth users | Firebase console _is_ the admin UI; anonymous user records are inert and harmless                                             | **[HUMAN]**, occasional |

No custom admin panel, no cloud functions, no card required.

## R7 — Asset management activity + default tokens

1. **Generated default tokens:** extend `AssetStore.resolve` with a `gen:` ref scheme — `gen:disc:{label}:{colorToken}` renders a circled alphanumeric SVG data-URI (themed ring, high-contrast letterform). Deterministic label assignment: players A, B, C… by seat join order (overridable); referee creatures a1, a2… per creature type letter. These are the **default** everywhere a token/portrait ref is missing.
2. **Assets activity (stage):** tabs — _Bundled_ (starter pack browser), _By URL_ (validated paste, preview, saved to a room-level `assetRefs` list so URLs are reusable), _Uploads_ (visible but disabled with an explanatory note until **[HUMAN]** Blaze upgrade activates `FirebaseStorageAssetStore` — the interface slot already exists).
3. **Token creation flows (kills the debug button):** GM: "Add creature" (pick/generate ref, count, group) placing tokens at view center; Player: "My token" — pick ref for own seat's token(s)/portrait. Board cards and map tokens share the ref.

## R8 — Encounter Board v2

1. **Actor card:** rectangle; top half = portrait (or `gen:` disc); bottom half = name + **pinned profile fields** (template fields gain a `pinned` boolean, GM-set; render label:value rows, read-only on card) + status tags; roll-shortcut chips; turn highlight; hidden badge (GM). Click = raise Character dock (existing behavior).
2. **Grouping:** cards gathered into labeled boxes per Group (group color strip); **unassociated tokens collect in a bottom "Unassigned" bin** (drag or menu to assign).
3. **GM controls** move to the right tools rail (R1): reveal toggles, initiative controls, tension widgets, Blind Drawer, Tables — the cast area itself stays clean for everyone.
4. **Collapse group to one token (map):** `group.collapsed: boolean` + stored member offsets relative to an anchor member. Collapsed ⇒ map renders one stacked-badge token (count bubble); dragging it moves all members by delta — RTDB drag frames for the anchor only, one **batch** Firestore write of all member positions on release (write-discipline compliant). Expand restores offsets. Board shows a collapsed group as a single group card with a count. Contract-test the batch move (`moveTokens(roomId, updates[])`).

## R9 — Map geometry & tooling pack

> **⚠️ Superseded (2026-07-20).** This entire R9 pack was designed against the
> cellular model (per the R9.1 scope note below) and was **overtaken by the
> Vector Map System cutover**, which replaced the cellular map wholesale
> rather than extending it. R9.2 (vector walls as an extension of edge-walls),
> R9.4 (rasterize-to-cells "natural" rendering), and R9.1's premise are all
> moot — see [`VectorMapSystem_Spec.md`](./VectorMapSystem_Spec.md) for what
> actually shipped. R9.3 (measurement units), R9.6 (half-grid), R9.7 (token
> snapping), and R9.8 (PNG export) describe _behavior_ that survived the
> cutover largely as specified, just re-implemented against `GameMap`/the
> vector engine instead of the cellular store — kept below for that intent,
> not as an accurate description of the current implementation. R9.5 (Labels
> v2) was superseded again by Addendum C's R13 (Labels v3, inline edit).

### R9.1 Scope note

All of R9 preserves the cellular model (Part I verdict). Anything organic is rasterize-to-cells + rendering.

### R9.2 Wall tool v2 (drag runs + diagonals)

- **Interaction:** pointer-down snaps to nearest grid **intersection**; drag shows ghost run; release snaps the end intersection.
- **Axis-aligned runs** decompose into the run's edge walls, written as one batch (`setWalls(roomId, walls[])` added to store + contract). Dragging along an existing run with the same tool in "erase" mode (modifier or toolbar toggle) removes.
- **Diagonal runs (enabled):** stored as **vector walls** — reuse `SightWall` records with a new `style: 'masonry'|'natural'` and `visible: true` flag (existing `.uvtt` imports remain `visible:false`-equivalent unless flagged). They render like walls and already block LoS. No doors on diagonals in v2. Endpoints always snap to intersections.
- Door tool unchanged (grid edges only).

### R9.3 Configurable measurement units

- `room.settings.measure = { perSquare: 10, unit: 'feet' }` **defaults 10/feet** (migration: existing rooms get the new defaults; note this changes the previous implicit 5-ft assumption — deliberate, per referee preference). Ruler renders `${squares} sq / ${squares*perSquare} ${unit}`; Chebyshev distance kept. Half-grid hint: when `subdivide` is on, ruler additionally shows the half-square count.

### R9.4 Organic "natural" wall rendering

- Replace the dashed line for `wallStyle:'natural'`: chain contiguous natural-style perimeter/explicit edges into polylines → subdivide → displace intermediate points with **seeded value noise** (seed = `hash(roomId + runKey)` so every client renders identically and re-renders stably) → draw as a smoothed quadratic curve, rounded joins, slightly heavier stroke. Corners rounded; displacement clamped to ≤0.25 cell so geometry/LoS (which still uses the true edges) never visibly disagrees with the art. Doors on natural runs interrupt the curve cleanly. Stretch (non-gating): stipple accents on the rock side.

### R9.5 Labels v2

- Room labels render **centered horizontally and vertically on the anchor cell's center**, support explicit `\n` newlines, auto-wrap at a max width of 4 cells, may overflow the anchor cell while staying anchored to it. Optional subtle backing chip for legibility over floor. Select tool: drag a label to re-anchor (updates `labelAnchor`); edit via shell dialog (replaces `window.prompt`, U10).

### R9.6 Half-size grid

- `room.settings.grid.subdivide: boolean` (Session Config). Rendering only: half-spacing lines at reduced alpha/weight between full grid lines (10′/5′ dual-mark style). No model change.

### R9.7 Token snapping

- Default: tokens snap to full-cell centers on drop (currently free-floating pixel positions — this is a behavior tightening). **Force in-between:** hold `Alt` while dropping (desktop) / snap-mode toggle in tools (mobile) ⇒ snap to **half-grid** intersections; `Alt+Shift` ⇒ free placement. Snap honors token size (2×2 snaps to cell corners so it covers whole cells).

### R9.8 Map PNG export

- "Download map as PNG" (Map tools, all users): Pixi v8 `renderer.extract.image(world)` over the carved bbox + margin, honoring the viewer's role (players never export hidden/GM layers or fogged cells; GM gets an "include hidden layer" toggle). Downloads via object-URL. e2e: exported blob is a decodable PNG of nonzero size; a player export of a fogged map differs from the GM's.

---

# PART IV — WORK ITEMS (sequenced)

**Pattern every WI:** send the prompt → review PR → check the gate → **[HUMAN]** Chromebook playtest → merge green → only then start the next WI. Every Claude Code prompt ends: _"Stop after the gate; do not start the next work item."_

Dependency spine: `WI-1 → WI-2 → (WI-3 · WI-4 → WI-4b · WI-5a → WI-5b · WI-6 → WI-7 · WI-8 · WI-9) → WI-10 → WI-11 → WI-12`. Items inside the parentheses can interleave after WI-2 lands, in the order listed below unless noted.

---

### WI-0 — Adopt this plan · **[HUMAN]** · ~15 min

1. Tag current `main` (`v1-complete`).
2. Delete the four retired docs; commit this file as `docs/MASTER_PLAN_v2.md` and `vtt-ui-mockups.html` as `docs/mockups/`.
3. Review the mockups; **record the shell choice (Option A, B, or hybrid) and any icon/color notes at the top of this doc.** Optional **[OTHER AGENT]**: a design-review pass on the chosen option (typography/spacing critique) before WI-2.

**Gate 0:** docs retired · plan + mockups committed · shell option recorded.

---

### WI-1 — Design tokens & theming foundation · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R2**. Steps: introduce the token sheet + `data-theme`; sweep every component `<style>` to tokens; add `readMapTheme()`/`engine.setTheme()`; ship `parchment-dark` + `keyed-blue`; temporary theme switcher behind a query param (real UI arrives in WI-6); migration for `room.settings.theme` (default `parchment-dark`).

**Gate 1:** zero raw hex left in component styles (grep-clean except the token sheet) · both themes render map + UI correctly · theme switch re-renders the Pixi map without reload · migration test green · all existing tests green.

---

### WI-2 — Activity Shell, desktop · Claude Code · `claude-opus-4-8` · effort **high** · **Status: ✅ Complete**

Spec: **R1** (+ chosen mockup option). The largest single item; it re-houses every existing panel without changing their internals. Steps: shell layout (four rails + stage) · activity registry + the seven activities wired to existing components · mini-cards for Dice/Characters/Log-peek · tools rail fed by `ActivityDef.tools` (map tools migrate off the canvas-top toolbar) · Dialog/Popover primitives; replace `window.prompt` call sites (U10) · bottom log peek + ticker · session top tab with presence chips + invite copy · keyboard map + `?` sheet · shell-state persistence · update e2e testids/specs accordingly (keep two-context flows green).

**Gate 2:** every pre-existing capability reachable through the shell (checklist in PR description mapping old panel → new home) · stage occupies ≥ 90% of viewport with rails collapsed · rails expand/collapse per spec, one flyout per rail · GM-only activities invisible to players (e2e) · full existing e2e suite green post-testid updates · **[HUMAN]** playtest sign-off on feel.

---

### WI-3 — Mobile / tablet shell mode · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R1.8**. Steps: breakpoint/pointer detection · bottom activity bar · tool bottom-sheet · compact top bar · touch input in the Pixi engine (one-finger tool, two-finger pan, pinch zoom — replaces U12's touch gap) · log unread badge · Playwright mobile-viewport project added to CI (smoke: join, switch activities, carve a cell, roll dice).

**Gate 3:** phone-sized viewport shows single-activity UI with no horizontal overflow · pinch/pan/tool-touch work on a real tablet (**[HUMAN]**) · mobile smoke suite green in CI.

---

### WI-4 — Dice renderer v2 · Claude Code · `claude-opus-4-8` · effort **high** · **Status: ✅ Complete**

Spec: **R3** (R3.5 license discipline is binding — the WI-4 prompt must include it verbatim and must not point Claude Code at any GPL source). Fixes U1–U5. Pre-read `dice/scene.ts`, `DiceOverlay.svelte`, `dice/engine.ts` (engine is read-only). Steps: headless pre-sim + pre-rotation with threshold settle, locator face detection, rest locking, world-per-roll (R3.1) · polyhedra + generated texture atlases + programmatic face locators (R3.2) · quality bar (R3.3) · overlay lifecycle on the shell's overlay layer (R3.4) · unit tests for face-detection math (given an orientation, locator scan returns the right face — pure functions) · e2e: roll d20 → both contexts show identical value; new roll clears old dice; result chip fades.

**[HUMAN]** before starting (optional but useful): collect 2–3 reference _screenshots_ of dice renderers whose look you want matched (screenshots convey aesthetics without importing code); paste into the prompt.

**Gate 4:** no visible face change after a die rests (manual + a frame-sampling assertion if feasible) · all seven die shapes render with correct values · d100 = paired d10s · previous dice cleared on new roll · crisp on HiDPI · reduced-motion path works · two-context value agreement e2e green.

---

### WI-4b — Shared rolls · Claude Code · `claude-sonnet-4-6` · effort **high** · **Status: ✅ Complete**

Spec: **R3.6**. Depends on WI-4 (multi-die overlay). Steps: `sharedRoll` staging doc + rules (own-slot-or-GM writes) + rules tests · `Roll.parts` schema extension + migration + deterministic seat-sorted expansion in `/packages/shared` (unit test: same seed + same slots ⇒ identical faces regardless of slot-write order) · store methods (`openSharedRoll`, `stageSharedSlot`, `resolveSharedRoll`) + contract tests on both stores · staging UI in the Dice activity/mini-card + readiness in the Encounter tools · tinted overlay parts + grouped log entry · "Apply results to initiative" tap on the tracker · e2e: two players stage different dice, GM rolls once, both contexts show both dice land simultaneously with identical values; apply-to-initiative fills the tracker rows.

**Gate 4b:** the two-context simultaneous e2e is green · a seat that never staged is cleanly skipped · re-deriving a `parts` roll from its seed on a third client matches exactly · rules test: player A cannot write player B's slot · initiative apply is explicit and correct in both side and individual modes.

---

### WI-5a — Map tooling batch 1: wall drag, labels, units, pan/zoom · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R9.2, R9.3, R9.5** (+ U12 space-pan, U17 cursor-anchored bounded zoom). Steps: wall drag-run interaction with batch `setWalls` (+ contract tests) · diagonal vector walls (`SightWall.visible/style`) with migration · measurement settings + migration to `10/feet` · labels centered/wrapped/re-anchorable via dialog · space-drag pan; zoom to cursor with min/max clamps · e2e: drag a 6-edge wall run in one gesture; place a diagonal wall that blocks LoS; ruler reflects configured units; a multiline label renders centered.

**Gate 5a:** all four e2e checks green · wall run = one gesture, one batch write (assert Firestore write count) · migrations tested · no regression in existing map e2e.

---

### WI-5b — Map geometry batch 2: organic walls, half-grid, shape carves, token snapping · Claude Code · `claude-opus-4-8` · effort **high** · **Status: ✅ Complete**

Spec: **R9.4, R9.6, R9.7** + new carve shapes (ellipse-drag and click-polygon rasterizers → cells; pure functions unit-tested against known rasters). Steps: seeded-noise natural-wall polylines (deterministic-render unit test: same inputs ⇒ identical point lists) · half-grid rendering + ruler hint · snap modes for tokens (cell / half / free with modifiers) · ellipse + polygon carve tools registered in the tools rail.

**Gate 5b:** a carved ellipse with `natural` style reads as a rounded cave, identically on two clients · half-grid toggle renders lighter interlines · token snaps to cell by default, half-grid with Alt, free with Alt+Shift · rasterizer unit tests green · LoS still uses true edges (test unchanged).

---

### WI-6 — Session Configuration activity + player management · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R4**. Steps: the stage view + sections · re-house template editor, export/import, fog mode, theme select · `room.settings` migration consolidation (theme/measure/grid.subdivide land together if not already) · player rename/role/remove/GM-transfer with rules test for transfer + e2e (GM transfers → old GM loses gmPrivate read, new GM gains it).

**Gate 6:** every setting round-trips and syncs to a second client · removing a player ejects their live session to the join gate · GM transfer e2e + rules tests green · nothing GM-only leaks to players (e2e).

---

### WI-7 — Log activity + chat · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R5**. Steps: entry anatomy (author resolution, timestamps) · filter chips + search · `listLogBefore` store method + contract tests + pagination UI · chat input in drawer + stage · `/r` command through the real dice pipeline · cap live subscription at 200.

**Gate 7:** chat from player appears for GM < ~200 ms with author + time · `/r 2d6` produces an overlay roll + log entry identical on both clients · filters/search operate on loaded entries · "load older" pages correctly across the 200 boundary · contract suite green on both stores.

---

### WI-8 — Encounter Board v2 · Claude Code · `claude-sonnet-4-6` · effort **high** · **Status: ✅ Complete**

Spec: **R8**. Steps: card redesign with `pinned` template fields (+ migration) · group boxes + Unassigned bin with assignment interactions · GM controls to tools rail · group collapse/expand with offset storage + `moveTokens` batch (+ contract tests) · e2e: pin a field → appears on card for both clients; collapse a 3-token group, drag it, expand — relative positions preserved on both clients; batch move = one logical write burst.

**Gate 8:** all three e2e checks green · cast area shows no GM chrome for players · roll strip and tracker behavior unchanged (existing e2e green).

---

### WI-9 — Assets activity + default tokens · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Spec: **R7**. Steps: `gen:` scheme in `AssetStore` (+ unit tests for deterministic SVG output) · Assets stage (Bundled / By URL / Uploads-disabled note) · room `assetRefs` list (+ store methods + contract tests) · Add-creature / My-token flows replacing the debug drop button (update every e2e that used it).

**[OTHER AGENT]** (optional, parallel): generate a small original token-art pack (image model of choice) → **[HUMAN]** commits under `public/assets/tokens/` with attribution; the Bundled tab picks it up with zero code.

**Gate 9:** a fresh seat automatically has a colored circled-letter token/portrait · GM adds 3 goblins in one flow, grouped · URL asset previews, saves, reuses · debug button gone, suite green.

---

### WI-10 — Accounts, My Rooms, room lifecycle · Claude Code · `claude-opus-4-8` · effort **high** · **Status: ✅ Complete**

Spec: **R6**. **[HUMAN] first:** enable Google provider in Firebase console; verify authorized domains. Steps: link-with-Google flow + error paths · `users/{uid}/rooms` index (+ rules: owner-only, + rules tests) · Lobby v2 My Rooms · `deleteRoom` recursive delete (+ contract tests, + e2e: delete → room unreachable, RTDB node gone) · prune-old-entries button · cursor `onDisconnect` cleanup if absent.

**Gate 10:** link → sign out → Google sign-in on a fresh context recovers the same uid and GM seat (emulator supports this) · My Rooms lists and opens rooms · delete removes every subcollection (assert via admin context count) · rules tests green · **players remain able to join anonymously with zero prompts**.

---

### WI-11 — Map PNG export · Claude Code · `claude-sonnet-4-6` · effort **low** · **Status: ✅ Complete**

Spec: **R9.8**. **Gate 11:** GM and player exports decode as PNGs; player export excludes hidden/fogged content (pixel-compare or hidden-layer marker test).

---

### WI-12 — Hardening & closeout · Claude Code · `claude-sonnet-4-6` · effort **medium** · **Status: ✅ Complete**

Broaden e2e over the shell (activity switching, flyouts, mobile), re-verify both `CampaignStore` impls against the grown contract suite, dependency/audit pass, and a final **[HUMAN]** Chromebook + phone playtest against the budget (dice overlay ≥ 30 fps on the Chromebook; if not, move dice physics to a Web Worker + OffscreenCanvas — pre-approved fallback).

**Gate 12:** CI fully green · contract parity holds · playtest within budget.

---

# PART V — OPEN DECISIONS (locked defaults) & NOTES

| Decision             | Default (locked unless overridden at WI start)                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Shell option         | **LOCKED at WI-0 (2026-07-11): Option A** (docked flyouts) — lower pointer travel, simpler focus management       |
| Diagonal walls       | **Enabled**, as snap-endpoint vector walls (R9.2); no doors on diagonals                                          |
| Measurement defaults | `perSquare: 10`, `unit: "feet"` — applied to existing rooms by migration                                          |
| Token snapping       | Cell-center default; Alt = half-grid; Alt+Shift = free                                                            |
| Google auth          | Optional link only; anonymous join stays the zero-friction default                                                |
| Theming scope        | System + two themes (R2); more themes are content, not code                                                       |
| Hex grid             | Still deferred; re-evaluate after WI-12                                                                           |
| Log recording config | View-side filters primary; room-level recording toggles only for future noisy types                               |
| Uploads (Blaze)      | Unchanged: **[HUMAN]** card decision unlocks `FirebaseStorageAssetStore`; Assets activity ships the disabled slot |

**Prompting note for every WI:** paste the relevant R-spec section(s) plus the WI block verbatim into the Claude Code prompt, name the files it should read first, and keep golden rules 1–5 in the prompt preamble. Plan reviews and spec amendments happen here (claude.ai) before code sessions, and amendments are committed to this file so it stays the single source of truth.
