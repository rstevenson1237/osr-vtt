## SPEC-010 — Vector Map System

**Status: Completed** — non-goals below are a standing constraint.

_(Cited in the Master Plan as `R9′`.)_

**The authoritative map spec.** Its full content is `README.md` § "Map system — vector
(II.2)" (data model, walls/doors/LoS, six-layer stack, carve pipeline, tools, fog,
schema versioning), which is written descriptively because the system shipped. The
decision log behind it is `DECISIONS.md` → vector map decision log.

Explicit non-goals, still binding:

- No change to dice, encounter, session, account or logging systems from map work.
- No per-frame point-in-polygon in any hot path.
- No dual-live bitmask+polygon representation — the bitmask model is gone.
- No custom polygon clipping/offsetting math — use a vetted library.
