## SPEC-009 — Map geometry & tooling pack (cellular)

**Status: Superseded** (2026-07-20) — successor: **SPEC-010** (Vector Map System).

> **⚠️ Superseded (2026-07-20) by the Vector Map System (SPEC-010).** This spec was
> designed against the cellular model and was overtaken wholesale rather than extended.
> §1's premise (preserve the cellular model), §2 (vector walls as an extension of
> edge-walls) and §4 (rasterize-to-cells "natural" rendering) are moot. §5 (Labels
> v2) was superseded again by SPEC-014.

**§3 Measurement units, §6 half-size grid, §7 token snapping, §8 PNG export**
describe behaviour that **survived** the cutover largely as specified, re-implemented
against `GameMap`/the vector engine:

- **§3** — `room.settings.measure = { perSquare: 10, unit: 'feet' }`, defaults 10/feet
  (a deliberate change from the previous implicit 5 ft, applied to existing rooms by
  migration).
- **§6** — `room.settings.grid.subdivide: boolean`; rendering only, half-spacing lines
  at reduced alpha/weight (10′/5′ dual-mark style). No model change.
- **§7** — tokens snap to full-cell centers on drop. **Alt** ⇒ half-grid
  intersections; **Alt+Shift** ⇒ free placement. Snap honours token size (2×2 snaps to
  cell corners so it covers whole cells).
- **§8** — "Download map as PNG" for all users, via Pixi v8
  `renderer.extract.image(world)` over the carved bbox + margin, downloaded via
  object-URL. The GM-only "include hidden layer" checkbox was replaced by an
  **"up to layer" selector available to every seat** (`map/export-layers.ts`).
