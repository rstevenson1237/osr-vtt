# `map/vector/` — Vector Map System geometry (WI-A)

Pure, lattice-space geometry for the Vector Map System. This is the WI-A
graduation of the `poc/vector-floor/` §9.1 sandbox — **re-implemented with tests,
not imported** from the POC. No store, rules, render, or app dependencies live
here; the render/LoS boundary multiplies by `cellSize` once, elsewhere.

Governing spec & decisions: [`poc/vector-floor/SPEC.md`](../../../../../poc/vector-floor/SPEC.md),
[`DECISIONS.md`](../../../../../poc/vector-floor/DECISIONS.md),
[`FINDINGS.md`](../../../../../poc/vector-floor/FINDINGS.md).

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
| `pipeline.ts` | `commitCarve` — union/difference → simplify → metrics (§5, §8.2/§8.4) |
| `region.ts` | `FloorRegion` construction + derived bbox (§2.1) |
| `point-in-floor.ts` | `pointInFloorUnion` — occupancy query (§7, REVIEW M5) |
| `los.ts` | perimeter derivation, build-time door reconciliation, visibility polygon (§3) |

## Known follow-ups (carried from the POC, not regressions)

- **`bufferPolyline` is the M6 offset stand-in** — a union of per-segment quads,
  not a true polygon offset. A real offset (Clipper2 `ClipperOffset`) rides the
  §8.1 library lock.
- **§8.1 library shootout is still open.** `polygon-clipping` is the locked
  default (proven correct + tiny in the POC); Clipper2/martinez swap behind the
  `backend.ts` seam when measured.
