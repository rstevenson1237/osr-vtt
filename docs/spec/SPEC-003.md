## SPEC-003 — Dice renderer v2

**Status: Completed** — with §5 as a permanent standing constraint.

Shipped as described in `README.md` § "Dice (II.6)". §1 (no-flip settle), §2 (real
polyhedra), §3 (presentation quality), §4 (overlay lifecycle), §6 (shared rolls) are
all live.

**§5 Prior art — license discipline (BINDING, permanently · standing constraint).**
`owlbear-rodeo/dice` (GPL-3.0) was examined as reference _during planning only_. Its
techniques informed §1 (threshold settle, locator-based face detection, rest locking,
world-per-roll, throw-toward-center feel), all restated in our own terms. Its
architecture also validates our divergence: Owlbear is physics-authoritative (remote
clients render **static** dice); our seed-authoritative invariant requires every client
to animate, which is exactly what pre-rotation provides.

- Claude Code must **not** clone, fetch, open, or otherwise place the Owlbear repo (or
  any GPL-3.0 code) in its context. This spec section is the sole channel for its
  ideas.
- **No assets** (GLB meshes, textures, materials, audio) from that repo may be copied
  or traced — geometry and number textures are generated procedurally. See
  `ATTRIBUTION.md`.
