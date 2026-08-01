# PLAN — completed items · milestone `vector-map`

**Closed 2026-07-24.** WI-A – WI-D. The Vector Map System: pure geometry, store
contract, wall/door/LoS unification, and the hard cellular cutover.

Archived from `docs/VTT_Master_Plan.md` Part IV §1 (shipped ledger). The lettered
series keeps its letters — these were never numbered and are not renumbered here.
Spec citations are given in both the Master Plan's `R` numbering and the current
`SPEC-` numbering — see the crosswalk at the top of `SPEC.md`.

The decision log behind this milestone (Model A, the B1–B6 and D1–D6 calls, the POC
evidence) is in `DECISIONS.md` → vector map decision log, not here.

This file is immutable (RULE-020).

| WI       | Spec (old) | Spec (new) | Model | Effort | What it delivered                                                                        |
| -------- | ---------- | ---------- | ----- | ------ | ---------------------------------------------------------------------------------------- |
| **WI-A** | R9′        | SPEC-010   | —     | —      | Pure vector geometry in `packages/shared/src/map/` (carve pipeline, `pointInFloorUnion`) |
| **WI-B** | R9′        | SPEC-010   | —     | —      | Store contract, rules, RTDB draft / Firestore commit for the vector primitives           |
| **WI-C** | R9′        | SPEC-010   | —     | —      | Wall/door/LoS unification; build-time door reconciliation; `store/vector-los.ts`          |
| **WI-D** | R9′        | SPEC-010   | —     | —      | Production vector editor; hard cellular cutover; `VTTCAMP_FORMAT_VERSION` → 2            |
