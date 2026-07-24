# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

A browser-based virtual tabletop (VTT) for OSR/tabletop RPGs. Serverless on
Firebase (Spark tier) — no custom backend.

## Repo map

- `apps/web` — the app. Svelte 5 + Vite, PixiJS v8 for the map canvas,
  Firebase (Firestore/RTDB/Auth), Rapier3D + Three.js for dice physics, Yjs
  for collaborative notes.
- `packages/shared` — framework-agnostic logic shared by the app (and any
  future client): the `CampaignStore`/`AssetStore` abstractions and their
  Firebase/in-memory implementations, schemas, map geometry, dice, encounter,
  rules, tables, portability (`.vttcamp` import/export).
- `firebase/` — `firestore.rules`, `firestore.indexes.json`,
  `database.rules.json`. Security rules are tested code, not an afterthought.
- `docs/` — the documentation set (read order below).
- pnpm workspace (`pnpm-workspace.yaml`): `packages/*` + `apps/*`.

There is no `poc/` directory — a prior Vector Map System POC lived there
during design; it fully graduated into `packages/shared/src/map/vector/` and
`apps/web/src/lib/{components/VectorMapView.svelte,map/vector-*.ts}`, and the
scaffold was deleted once its governing docs moved into `docs/`. If you see a
comment or old branch referencing `poc/vector-floor/...`, treat it as a
historical pointer to `docs/VectorMapSystem_Spec.md` /
`docs/VectorMapSystem_Decisions.md`, not a live path.

## Documentation — read order & precedence

1. **[`docs/VTT_Master_Plan_v2.md`](./docs/VTT_Master_Plan_v2.md)** — the
   primary product spec. Part I is a codebase assessment (what to protect,
   what's missing, tech decisions); Part II carries forward invariants; Part
   III is reference specs **R1–R9**; Part IV is the sequenced work-item
   history (WI-0…WI-12, all shipped); Part V is locked decisions. Its map
   sections (§1.1.2, §1.3, R9) describe the **retired cellular map model** and
   are annotated in place as superseded — see next item.
2. **[`docs/VTT_Master_Plan_v2_addendum.md`](./docs/VTT_Master_Plan_v2_addendum.md)**
   ("Addendum C") — continues the same series: specs **R10–R21**, work items
   **WI-13–WI-24** (all shipped).
3. **[`docs/VectorMapSystem_Spec.md`](./docs/VectorMapSystem_Spec.md)** — the
   **authoritative spec for the current map system** (floor/wall/door
   geometry, the five-layer Pixi renderer model, snap/freeform drawing,
   carve pipeline). Supersedes the Master Plan's cellular-model sections
   wherever they conflict.
4. **[`docs/VectorMapSystem_Decisions.md`](./docs/VectorMapSystem_Decisions.md)**
   — the decision log behind the vector map system, plus a condensed
   historical record of the POC review/findings that produced it. Includes
   two flagged, unratified items worth knowing about: map-edit permissions
   (the vector toolbar is currently shown to all room members, not GM-only)
   and a quarantined flaky e2e spec (`portability.spec.ts`).
5. **[`docs/ShellUIRedesign.md`](./docs/ShellUIRedesign.md)** — the
   **authoritative spec for the current session shell** (main views vs. quick
   sheets, the expanded/docked/bottom-sheet model, Log & Session modals, the
   Room quick sheet and its per-room players' notes, the markdown renderer).
   Supersedes the Master Plan's R1 shell structure wherever they conflict;
   R1.5 (layering), R1.6 (dialog primitives) and R1.4's colour palette still
   stand.
6. Supporting assets: `docs/mockups/vtt-ui-mockups.html` (Activity Shell —
   pre-redesign, historical), `docs/vtt-ui-mockups-addendum-c.html` (Addendum C
   boards), `docs/dice-preview.html` / `docs/dice-reference.png` (dice renderer
   reference).

**When docs conflict:** the Vector Map System docs (3–4) win for anything
map-related; the Shell UI Redesign (5) wins for the session shell; the Master
Plan + Addendum (1–2) are authoritative for everything else (dice, encounter,
accounts, assets, session config).
Don't silently reconcile a real conflict you find elsewhere — flag it and add
a superseded-note annotation the way the existing ones are done, rather than
deleting/rewriting history.

## Golden rules (carried forward from the Master Plan, still binding)

1. **Store abstraction only.** All Firebase access goes through
   `CampaignStore`/`AssetStore` (`packages/shared/src/store/`). Components
   never touch the Firebase SDK directly. Any new store method must be added
   to the shared contract suite (`campaign-store.contract.ts`) and pass
   against both `MemoryStore` and `FirebaseStore`.
2. **No game mechanics.** The app stores and displays data but never
   interprets it — no stat logic, no value-triggered behavior, ever.
3. **Write discipline.** RTDB for high-frequency ephemeral state (cursors,
   drags, in-progress carve strokes); Firestore for settled commits. New
   high-frequency features follow the same split.
4. **Security rules are tested code.** Rule changes ship with rule tests
   (`packages/shared/src/rules/`).
5. **Preserve `data-testid`s.** The Playwright e2e suite depends on stable
   testids; moving a control (e.g. between panels) must carry its testid with
   it or update the spec in the same change.
6. **Vector map coordinate space.** All floor/wall/door geometry is stored in
   lattice (cell) units as floats; `cellSize` is a render-time-only
   multiplier applied at the render/LoS-build boundary. Never store pixel
   coordinates.
7. **Migrations for schema changes.** Any `GameMap`/store schema change ships
   a migration + migration test (`packages/shared/src/migrations/`).

## Dev commands

Run from the repo root unless noted:

```sh
pnpm install                 # workspace install
pnpm dev                     # apps/web dev server (Vite)
pnpm build                   # build packages + apps
pnpm typecheck               # svelte-check across the workspace
pnpm lint                    # eslint .
pnpm format                  # prettier --write .
pnpm test:unit                # vitest (all packages)
pnpm test:rules               # Firestore rules tests (packages/shared)
pnpm test:store               # CampaignStore contract suite, both impls
pnpm test:e2e                 # Playwright (apps/web) — needs a browser
pnpm emulators                 # firebase emulators:start
pnpm test:all:emulators        # full suite against the Firebase emulator
```

## Map tools (current state)

The map view is `apps/web/src/lib/components/VectorMapView.svelte`
(rendering: `apps/web/src/lib/map/vector-engine.ts`, tool logic:
`apps/web/src/lib/map/vector-tools.ts`, pure geometry:
`packages/shared/src/map/vector/`). Draw tools (Select, Room, Corridor, Path,
Polygon, N-gon, Wall, Door, Eye, Annotate, Ping, Label) and their contextual
parameters (Carve/Snap/Width/Sides/Door/Simplify) live in one unified panel in
the **Map tools quick sheet** (`sheets/MapToolsSheet.svelte` →
`MapToolPalette.svelte` → `MapToolbar.svelte`) — the right Tools rail was
retired by the Shell UI Redesign — driven by the shared `MapToolController`
(`apps/web/src/lib/shell/map-tool-controller.svelte.ts`). Token snap-mode
defaults live on the character quick sheet, not the map toolbar. The lattice
grid renders between the background and floor layers (`vector-engine.ts`'s
`renderGrid`); a map's background is either an image ref or a solid
`#rrggbb` color (`GameMap.background`), set from Session Config; floor
corners are rounded at render time only (a fixed pixel radius clamped per
edge) — the stored geometry stays straight-line polygons (Model A).
