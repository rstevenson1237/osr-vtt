# `map/vector/` — Vector Map System geometry (WI-A)

Pure, lattice-space geometry for the Vector Map System. This is the WI-A
graduation of the original `poc/vector-floor/` §9.1 sandbox — **re-implemented
with tests, not imported** from the POC (that scaffold has since been deleted).
No store, rules, render, or app dependencies live here; the render/LoS boundary
multiplies by `cellSize` once, elsewhere.

Governing spec & decisions: [`VectorMapSystem_Spec.md`](../../../../../docs/VectorMapSystem_Spec.md),
[`VectorMapSystem_Decisions.md`](../../../../../docs/VectorMapSystem_Decisions.md).

## Consuming it

Re-exported from the package root under the `vectorMap` namespace so its
`Point` / `Segment` / `Door` names don't collide with the cellular map system
(`map/natural.ts` `Point`, `map/los.ts` `Segment`):

```ts
import { vectorMap } from '@osr-vtt/shared';

const backend = vectorMap.polygonClippingBackend;
let floor = vectorMap.commitCarve([], [vectorMap.rectPoly({ x: 0, y: 0 }, { x: 8, y: 6 })!], 'add', 0.1, backend).floor;
const onFloor = vectorMap.pointInFloorUnion({ x: 4, y: 3 }, floor); // SPEC §7 (isFloor replacement)
const sight = vectorMap.buildSightSegments(floor, [], doors);        // SPEC §3.3
```

## Modules

| File | Role (SPEC ref) |
|---|---|
| `types.ts` | `Point`/`Ring`/`Poly`/`MultiPoly`, `FloorRegion`, `Segment`, `Door` (§2.0–§3) |
| `backend.ts` | `BooleanBackend` seam + `polygonClippingBackend` (§5.3, §8.1) |
| `snap.ts` | per-point snap / half / free (§2.5) |
| `primitives.ts` | 5 shape emitters + `bufferPolyline` (§2.5, §5.1–2) |
| `simplify.ts` | iterative Douglas-Peucker (§5.4) |
| `tolerance.ts` | per-tool simplification defaults (§8.3) — circles crisp, freeform tolerant |
| `pipeline.ts` | `commitCarve` — union/difference → bbox-gated simplify → metrics (§5, §8.2/§8.4) |
| `region.ts` | `FloorRegion` construction + derived bbox (§2.1) |
| `point-in-floor.ts` | `pointInFloorUnion` — occupancy query (§7, REVIEW M5) |
| `los.ts` | perimeter derivation, build-time door reconciliation, visibility polygon (§3) |

## §8.1 offset library — decided (see [`OFFSET-SPIKE.md`](./OFFSET-SPIKE.md))

Measured, not guessed. `polygon-clipping` stays the boolean backend;
`bufferPolyline` stays the offset (a true Clipper offset is quality-equivalent
after simplify). Its one weakness — per-stroke perf that scales with point count
— is fixed by `decimatePolyline` (wired into `bufferPolyline`), not by adding a
WASM lib. martinez stays eliminated; `clipper-lib` (pure JS) is the ready
fallback if an exact offset is ever needed, dropping in behind the offset seam.
`clipper-lib` is a **devDependency**, used only by the spike — not shipped.
