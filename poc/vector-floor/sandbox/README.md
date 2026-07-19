# sandbox/ — §9.1 disposable POC harness (not started)

This directory is reserved for the single-user, in-memory harness described in
[`../SPEC.md`](../SPEC.md) §9 step 1. **It is intentionally empty of
implementation** — per SPEC §0 ("do not begin implementation from this document
alone; answer the open questions in §8 first") and the review's blocking items
in [`../REVIEW.md`](../REVIEW.md) §A, no code is written here until the gate is
opened.

## What lands here when the gate opens

A bare Vite + PixiJS page (or throwaway artifact-style harness) implementing,
against **browser-memory polygon state only** (no Firestore, no `CampaignStore`,
no security rules):

- The five §2.5 primitives — Room, Corridor, Path, Polygon, Regular n-gon —
  each with the per-stroke **snap ↔ freeform** toggle.
- One shared **point-stream → polygon-emission → buffer → boolean-combine →
  simplify** pipeline (§2.5, §5), with pluggable point-collection input modes.
- The §2.4 interior rock-carve **hole** tool (difference op, incl. the
  split-on-full-bisection case).
- The §3 door-as-stretchable-overlay-object concept.

## What this harness must MEASURE (it IS the §8 answer vehicle)

- **§8.1 library** — Clipper2 vs. martinez, bundle size + multi-ring/hole
  correctness. ⚠️ See REVIEW **M6**: martinez has **no offsetting/simplify**, so
  the eval must add "provides offsetting" as a hard requirement, not just compare
  boolean correctness.
- **§8.2 doc-size ceiling** — worst-case vertex counts / Firestore 1 MiB, with
  and without the §5.4 simplify pass.
- **§8.3 simplify tolerance** — 2–3 candidates on grid-aligned vs. organic shapes.
- **§8.4 perf** — stroke→buffer→union→simplify in isolation against a stress map.
- **§8.5 undo granularity** — REVIEW **R1** already indicates snapshot-based, per
  existing `EditorOp` precedent; the harness should confirm merge/split feels
  right under snapshot undo before WI-D commits to it.

## Boundary

Nothing here may be imported by `apps/` or `packages/`. Proven primitives are
**re-implemented** under WI-A (`packages/shared/src/map/`) with tests — never
imported from this sandbox.
