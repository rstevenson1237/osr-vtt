# POC Scaffold — Vector Floor Unification (R9.1 Extension)

This folder is the **isolated proof-of-concept scaffold** for the Vector Floor
Unification spec. It is deliberately self-contained and touches no production
code under `apps/` or `packages/` — so the whole POC can be rolled back by
deleting `poc/` with zero blast radius on the shipping app.

## The spec is the center of gravity

**[`SPEC.md`](./SPEC.md) is the single governing document for this POC and for
every future work item (WI-A … WI-D).** Anything built in this scaffold traces
back to a section of that spec. It is *not yet an approved work item* — per its
own §0 and §9, the POC gate (§9 step 1) and the §8 benchmark questions must be
answered before the Firestore schema (`FloorRegion`, `doors/{doorId}`) is
locked and before WI-A writes any code in `packages/shared/`.

## Read order

1. **[`SPEC.md`](./SPEC.md)** — the governing spec (verbatim).
2. **[`REVIEW.md`](./REVIEW.md)** — codebase-grounded findings: 5 conflicts, 8
   missing integration points, 2 open questions the code already answers. Read
   this before treating any spec section as final.
3. **`sandbox/`** — where §9 step 1's disposable single-user harness lands
   *after* the review's blocking items are triaged. See `sandbox/README.md`.

## Status

| Gate | State |
|---|---|
| Spec adopted as POC center of gravity | ✅ this scaffold |
| Review / conflict pass (§0, §8 "flag cost first") | ✅ [`REVIEW.md`](./REVIEW.md) |
| §8 open questions answered (library, vertex ceiling, tolerance) | ⏳ blocked on POC build |
| §9.1 disposable sandbox (5 primitives + hole tool + door overlay) | ⏳ not started |
| §9.2 schema lock (`FloorRegion`, `doors/{doorId}`) | 🔒 gated on sandbox findings |
| WI-A … WI-D | 🔒 gated |

## Work-item map (from SPEC §9)

- **POC (§9.1)** — `sandbox/`, in-memory only, no Firestore/store/rules. Answers §8.
- **Schema lock (§9.2)** — amend SPEC §2 from what the POC revealed.
- **WI-A** — pure geometry in `packages/shared/src/map/`, unit-tested.
- **WI-B** — `CampaignStore` contract, security rules, RTDB draft / Firestore commit.
- **WI-C** — Wall/LoS unification (perimeter-as-`SightWall`, door excision).
- **WI-D** — production editor UI, undo/redo, overlay-layer coexistence.

## Non-negotiable boundary for this scaffold

Nothing in `poc/` may be imported by `apps/` or `packages/` production code.
The scaffold consumes the real geometry-library *candidates* (SPEC §8.1) so its
benchmarks are meaningful, but its data lives in browser memory only (SPEC §9.1).
When a proven primitive graduates, it is **re-implemented** in
`packages/shared/src/map/` under WI-A with its own tests — not imported from here.
