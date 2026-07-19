# POC Scaffold — Vector Floor Unification (R9.1 Extension)

This folder is the **isolated proof-of-concept scaffold** for the Vector Floor
Unification spec. It is deliberately self-contained and touches no production
code under `apps/` or `packages/` — so the whole POC can be rolled back by
deleting `poc/` with zero blast radius on the shipping app.

This is a **full replacement** of the existing cellular map system, not an
extension. Clean-going-forward is the priority; past decisions are not preserved
for their own sake. Migration, backwards compat, and fog are out of POC scope.

## The spec is the center of gravity

**[`SPEC.md`](./SPEC.md) is the single governing document for this POC and for
every future work item (WI-A … WI-D).** Anything built in this scaffold traces
back to a section of that spec. It is *not yet an approved work item* — per its
own §0 and §9, the POC gate (§9 step 1) and the §8 benchmark questions must be
answered before the schema (`FloorRegion`, `walls/{wallId}`, `doors/{doorId}`) is
locked and before WI-A writes any code in `packages/shared/`.

## Read order

1. **[`SPEC.md`](./SPEC.md)** — the working spec (ratified decisions folded in).
2. **[`DECISIONS.md`](./DECISIONS.md)** — the decision log: every REVIEW finding
   mapped to its ruling (user direction vs. recommendation), plus the doors/walls
   recommendation and the resolved design questions.
3. **[`FINDINGS.md`](./FINDINGS.md)** — POC results and evidence-backed §8 answers
   from the built sandbox.
4. **[`sandbox/`](./sandbox/)** — the §9.1 in-memory drawing showcase (**built**);
   `npm run dev` to drive it, `npm run check` to verify. See `sandbox/README.md`.
5. **[`REVIEW.md`](./REVIEW.md)** — the original codebase-grounded analysis that
   produced the decisions (historical; `DECISIONS.md` is the current view).

## Status

| Gate | State |
|---|---|
| Spec adopted as POC center of gravity | ✅ this scaffold |
| Review / conflict pass (§0, §8 "flag cost first") | ✅ [`REVIEW.md`](./REVIEW.md) |
| Framing + doors/walls + integration decisions ratified | ✅ [`DECISIONS.md`](./DECISIONS.md) |
| Fog removed from POC scope | ✅ SPEC §4 |
| **§9.1 sandbox — 5 primitives + hole tool + wall + door overlay + LoS** | ✅ [`sandbox/`](./sandbox/) (11/11 geom + UI smoke pass) |
| §8 answers (doc-size ceiling, perf, undo) | ✅ [`FINDINGS.md`](./FINDINGS.md) |
| Floor storage model (Model A — baked union, no retained identity) | ✅ [`DECISIONS.md`](./DECISIONS.md#model-a) |
| §8.1 offset library measured (offset stand-in vs true Clipper offset) | ✅ [`OFFSET-SPIKE.md`](../../packages/shared/src/map/vector/OFFSET-SPIKE.md) — keep polygon-clipping + decimation-guarded stand-in |
| §9.2 schema lock (`FloorRegion`, `walls`, `doors`) | ✅ types locked in `packages/shared/src/map/vector/types.ts` (Model A) |
| **WI-A — pure geometry graduated to `packages/shared`** | ✅ [`packages/shared/src/map/vector/`](../../packages/shared/src/map/vector/) (71 unit tests) |
| WI-B … WI-D | 🔜 build on WI-A |

**Open design questions for the user** (non-blocking, in
[`DECISIONS.md`](./DECISIONS.md)): durable door↔wall binding, standalone vision
blockers, whether the POC editor exposes sight≠movement wall toggles.

## Work-item map (from SPEC §9)

- **POC (§9.1)** — `sandbox/`, in-memory only, no Firestore/store/rules. Answers §8.
- **Schema lock (§9.2)** — amend SPEC §2 from what the POC revealed.
- **WI-A** ✅ — pure geometry graduated to
  [`packages/shared/src/map/vector/`](../../packages/shared/src/map/vector/),
  unit-tested. Namespaced as `vectorMap.*` off the package root so its
  `Point`/`Segment`/`Door` types don't collide with the cellular system. Ships
  the carve pipeline, boolean-op backend seam, `pointInFloorUnion` (SPEC §7 /
  REVIEW M5 — the `isFloor` replacement, new in WI-A), perimeter-segment
  derivation, build-time door reconciliation, and Douglas-Peucker simplify.
  **Open follow-ups (unchanged from the POC):** `bufferPolyline` is still the M6
  union-of-quads offset stand-in (a true offset rides the §8.1 library lock), and
  the Clipper2/martinez shootout is still to run behind the `backend.ts` seam.
- **WI-B** — `CampaignStore` contract, security rules, RTDB draft / Firestore commit.
- **WI-C** — Wall/LoS unification (perimeter-as-`SightWall`, door excision).
- **WI-D** — production editor UI, undo/redo, overlay-layer coexistence.

## Non-negotiable boundary for this scaffold

Nothing in `poc/` may be imported by `apps/` or `packages/` production code.
The scaffold consumes the real geometry-library *candidates* (SPEC §8.1) so its
benchmarks are meaningful, but its data lives in browser memory only (SPEC §9.1).
When a proven primitive graduates, it is **re-implemented** in
`packages/shared/src/map/` under WI-A with its own tests — not imported from here.
