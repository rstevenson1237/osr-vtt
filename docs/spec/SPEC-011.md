## SPEC-011 — Wall line-type system

**Status: Completed**

`WallStyle` is the union `'solid' | 'masonry' | 'natural' | 'dashed'`; a wall carries
its **own** optional `style`, falling back to the hosting room's default when absent.
Effective style resolves as `wall.style ?? hostingRoom?.wallStyle ?? 'masonry'`, then
dispatches: `solid` → single stroke; `masonry` → solid + masonry treatment; `dashed` →
`strokeDashed(…, 5, 3)`; `natural` → `naturalizePolyline` + `drawSmoothCurve`, so a
single natural wall reads irregular even in a masonry room. The chaining seed is
`hashSeed(roomId + runKey)` for cross-client determinism. Displacement is clamped to
≤0.25 cell so the art never visibly disagrees with the true geometry LoS uses.

**Angled/diagonal walls default to `solid`**, not dashed. Dashed is produced only when
the effective style is explicitly `dashed`. The Wall tool's style select is a 4-way.

> **⚠️ Circular walls (§5) superseded.** The dedicated `CircleWall` doc — with its
> `gaps: Arc[]`, reserved `doors: ArcDoor[]`, and circle→N-gon LoS sampling that skipped
> gap arcs — **is not a storage type in the vector system** (successor: **SPEC-010**). A
> circular room is a `FloorRegion` with a circular ring; a standalone circular blocker
> is an `explicit` closed segment loop from the regular-polygon primitive. The
> ring→segment sampling helper survives as a draw-time utility. "A circular room must
> never be dead-sealed" is satisfied natively: an opening is just floor geometry.
