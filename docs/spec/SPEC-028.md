## SPEC-028 — Snap-aware carve tool geometry

**Status: Completed** — reopened 2026-08-02 by DEC-032 (IN-028), closed at WI-052
(2026-08-03), and **reopened again the same day** by IN-038 – IN-040, which are playtest
findings against what WI-051/WI-052 shipped. §§4 and 7 shipped at WI-051; §6's band
indicator (its dot clause was separately amended and shipped by WI-048, IN-029) shipped at
WI-052; §10 shipped at WI-059, §9 at WI-061 and §11 at WI-062 (all 2026-08-04), which
closed that reopening. **Reopened a third time (2026-08-11) by IN-050/DEC-061**, adding
§12 (free snap's vertex attraction); **WI-079 landed it 2026-08-11**, closing that
reopening and the spec with it. The cell-anchoring rule in
§2 is a **standing constraint** on any new floor tool and binds future work regardless of
this status (DEC-012).

_(New with WI-030; no `R`-number predecessor.)_

### §1 — The problem: vertices are not cells

Every floor tool routed its pointer through `snapPoint`, which rounds to the nearest
lattice **vertex** — a grid intersection. A referee laying out a dungeon thinks in
**cells**. The two disagree by half a cell in each axis, and the disagreement is not
cosmetic:

- A snapped n-gon centres on a grid corner, so a "3-cell circle" straddles four cells
  evenly instead of sitting in one.
- A snapped corridor's band is quantized against the centerline's vertex, so it hugs a
  grid line rather than filling the cell the pointer was in.
- A Room click that never moves produces a zero-area rectangle, which `rectPoly` rejects
  — the tool does nothing at all.

Vertex snapping remains correct for **Wall** and **Door**, whose geometry genuinely runs
_between_ intersections, and for **Polygon**, where the gesture is placing corners.

### §2 — Cell anchoring (standing constraint)

Room, Corridor, N-gon and Carve are **cell-anchored**. They receive raw lattice points
and do their own snapping, because "which cell is the pointer in" is not recoverable from
a point that has already been rounded to the nearest vertex.

> **WI-042 correction.** Carve was omitted from this list at WI-030 and kept taking
> vertex-snapped points: under cell/half snap, a cell's centre sits `0.707 × step` from
> every vertex regardless of where inside the cell the pointer actually was, so a brush
> width ≤ 1 (radius = `step / 2`) never reached any cell's centre and a dab committed
> nothing (IN-012), and a wider brush painted a block centred on the nearest corner
> instead of the cell aimed at (IN-013). WI-042 added Carve here and anchors each raw
> sample to `snapCellCenter` before the brush's radius test, matching Room/Corridor/N-gon.

Three shared helpers express the rule (`packages/shared/src/map/vector/snap.ts`):

| Helper                    | Meaning                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `snapCellCenter(p, mode)` | The centre of the cell (half-cell) containing `p`. The anchor.                                     |
| `snapAngle(theta, mode)`  | A direction at the mode's compass resolution: 4 points at cell snap, 8 at half, raw when free.     |
| `snapSpan(v, mode)`       | A measurement across a shape, quantized and **never below one step** — a zero span is not a shape. |

`snapSpan`'s floor is what makes "a click with no drag is one cell" fall out of the
geometry rather than needing a special case in each tool.

### §3 — Room

The whole-cell rectangle spanning the cells the two drag points are in, **both ends
inclusive** (`cellRectPoly`). A click with no drag is exactly 1×1; the rect grows a whole
cell at a time from there. Free snap keeps corner-to-corner `rectPoly`, where a partial
cell is the point.

### §4 — Corridor

> **Amended by WI-051 (DEC-032, user 2026-08-02), shipped.** The width set below is
> now the shared **⅛, ¼, ½, 1, 2** set the Corridor holds in common with the Path tool,
> the default is **½ under half snap and 2 under cell and free**, and the quantization
> rule below is replaced by plain centring — see §7. The original text is kept for the
> reasoning it records about why the band is centred on the cell at all.

Fixed widths: **½, 1, 2** cells. The default follows the snap mode — ½ under half snap,
1 under cell and free — because half snap _is_ half-cell work.

Snapped, each leg's band is centred on the pointed-at cell and then quantized to
`min(step, width)`: a quantum never coarser than the band itself, so a ½-wide corridor
can still sit on a half-cell line under full snap. Width 1 under cell snap fills exactly
the pointed-at cell; width ½ under half snap fills exactly the pointed-at half-cell;
width 2 straddles the pointed-at cell evenly. Leg _length_ follows the same inclusive
whole-cell rule as a Room, so the flat caps land on grid lines.

Which legs exist is decided from the **snapped cells**, not the raw endpoints — a
corridor dragged straight along a row carries a few hundredths of cross-axis drift, and
comparing raw coordinates would read that as a turn and grow a one-cell stub off the end.

### §5 — N-gon

Sides: **circle, 3, 4, 5, 6, 7, 8**, defaulting to **circle**. Above 8 a polygon reads as
a circle anyway.

The drag vector carries three things at once:

- **Centre** — the cell centre the drag started in.
- **Size** — its length is the radius **across the flats**; the diameter (`2 × length`)
  snaps to whole cells. Across-flats, not across-vertices: it is what makes a snapped
  polygon sit flush inside a whole number of cells. The circumscribed measure would leave
  a square's edges off the grid by a factor of `cos(π/n)`.
- **Orientation** — its direction is where one flat face's outward normal points, snapped
  to the nearest cardinal under cell snap, the nearest of eight under half, and left raw
  when free. A square dragged east is grid-aligned; the same square dragged north-east is
  a diamond.

The circle is its own inscribed circle and takes the same diameter, so "diameter" means
one thing across every side count.

### §6 — The targeted-cell indicator

Room highlights the cell (half-cell) under the pointer, filled faintly and outlined, in
the same `snapCursorColors` palette the snap dot uses — so a subtract-mode highlight
reads as rock and an add-mode one as floor. It follows the pointer **before** any button
is pressed, which is what makes it an indicator rather than a drag readout. Absent under
free snap, where there is no cell to target.

Not the N-gon or Carve: both anchor to a cell but extend well past it, so a centre-cell
highlight would advertise the wrong extent. Their live ghosts already show the real one.

The snap **dot** moves with the anchor for every cell-anchored tool — pointing it at a
vertex that no longer means anything to them would be worse than not drawing it.

> **Amended by WI-048 (IN-029).** The dot is drawn _in addition to_ the cell highlight,
> on top of it — so Room under Cell or Half snap shows a dot in the middle of the tile it
> already highlights, restating the anchor the tile has already given. Where a tile or
> shape indicator supersedes the point, the point is no longer drawn. N-gon and Carve
> keep their dot (they have no tile highlight); Wall, Door and Polygon keep theirs (a
> vertex is genuinely what they snap to).

> **Amended by WI-052 (DEC-032), shipped.** With Path and Corridor offering widths
> **below** the snap step (⅛, ¼), "the tile you are pointing at" and "the area you will
> carve" stop being the same rectangle, so Corridor and Path **moved off the whole-tile
> highlight onto their own band indicator** (`targetedBandFor`, replacing
> `targetedCellFor` for these two). The indicator shows **the band that will actually be
> carved** — width across, on exactly the lines `targetedBandRect`/`bandLo`/`cornerBlock`
> give the committed shape, so it coincides with the tile exactly at width 1. Under free
> snap — where Room's indicator has nothing to show — it is a circle of the chosen width,
> matching the round cap a free-snap Path produces, so Corridor and Path always have an
> indicator once the pointer has been anywhere. The dot is suppressed under the band the
> same way it is under Room's cell highlight. Mirrored for tests as
> `snap-band-readout` (`x,y @size` for the rect, `⌀ size` for the circle), alongside
> `snap-cell-readout`, which stays Room-only.

### §7 — Sub-tile widths and the centring rule _(added and shipped by WI-051, DEC-032)_

Path and Corridor share one width set: **⅛, ¼, ½, 1, 2** cells. Defaults follow the snap
mode — **½ under half snap, 2 under cell and free**.

**When `width` is smaller than the snap step, the carved band is centred inside the
snapped tile.** This is what makes the sub-half widths mean something, and it makes two
otherwise-identical settings deliberately distinct:

| Setting                    | Result                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `width = ½`, `snap = cell` | A ½-wide band centred in a full tile — ¼ cell of rock on each side. |
| `width = ½`, `snap = half` | Fills the pointed-at half-tile exactly, edge to edge.               |

Formally the snapped band's low edge is `snapCellCenter(centerline) - width / 2`, with no
further quantization. This **replaces** §4's `min(step, width)` rounding, which was what
collapsed the first row of that table onto the second. Every expectation §4 states
survives the simpler rule: width 1 under cell snap fills the pointed-at cell, width ½
under half snap fills the pointed-at half-cell, width 2 straddles evenly. Sub-cell widths
land on ⅛ and ¼ lattice offsets, which RULE-006 permits — lattice units are floats, and
nothing is stored in pixels.

> **Amended by §9 (IN-038, DEC-046), shipped in WI-061 (2026-08-04).** The along-axis half of this section —
> "the length covers whole cells, both ends inclusive" — is withdrawn for any leg end that
> meets **another leg**, and kept for the gesture's two terminal ends. Spanning whole cells
> at a bend makes each leg overshoot the other by `(step − width) / 2`, which at width ⅛
> reads as floor sprayed into all four cardinals from one corner. The cross-axis centring
> rule this section is mostly about is untouched.

**Terminations.** Under Cell or Half snap a Path's caps are **squared at 90°**, not
rounded: a path drawn between right-angle points is then geometrically identical to the
corridor. Under free snap the cap stays round, which is what the free-snap circle
indicator advertises. Carve is unaffected and keeps its free-form width and round brush —
it becomes the only organic floor tool, which is the cost DEC-032 accepts.

**As built (WI-051).** A snapped Path is a chain of Corridor legs: each clicked point
anchors to its cell centre (Path joins `CELL_ANCHORED_TOOLS`), an axis-aligned pair of
anchors goes through the Corridor's own `bandRect`, and every _interior_ vertex takes the
Corridor's `cornerBlock` — so the right-angle case is not merely similar to a corridor,
it is the same polygons. A **diagonal** run has no cell-aligned band to sit in, so it
stays a quad between the two cell centres, squared off at the path's two ends by half a
step (the "reach the edge of the cell you clicked" rule `bandRect` gives the axis-aligned
case); interior ends are left flush, because a cap that overshot an interior vertex would
spur out past a sharp turn, and `cornerBlock` — a square of side `width`, which contains
the round join of radius `width / 2` — covers the join at any angle. A single clicked
point is one cell of path, matching the Corridor's click-with-no-drag (DEC-038).

### §8 — The dimension chip

Reports the shape that will commit, not the distance the hand travelled: under snap, a
drag inside one cell still reads `1 × 1`. The N-gon reports `⌀ <diameter>` rather than a
radius, since the diameter is now the number being steered.

### §9 — A leg runs centre to centre; only the gesture's two ends are capped _(IN-038, DEC-046)_

> **Shipped in WI-061 (2026-08-04).** `bandSpan`
> (`packages/shared/src/map/vector/primitives.ts`) now spans cell centre to cell centre and
> takes an `extendA`/`extendB` pair; `bandRect` passes them through, defaulting both to
> `true` (the straight-run case). `corridorPoly` marks the corner end of each leg interior
> whenever both legs exist, and `pathPoly` marks every leg end interior except the
> gesture's first and last — the same `i === 0` / `i === cells.length - 2` test its
> diagonal branch already used for `cappedQuad`. Nothing else changed: `bandLo`,
> `cornerBlock`, `targetedBandRect` and both tools' call sites are untouched, and the
> exported signatures of `corridorPoly`/`pathPoly` are unchanged.

**This supersedes §7's "the length covers whole cells, both ends inclusive" for every leg
that meets another leg.** §7's rule is kept for a _terminal_ end and withdrawn for an
_interior_ one.

A snapped band leg between two cell-centre anchors spans, along its own axis, **from the
first anchor to the second** — centre to centre — extended by **half a snap step** at an
end only when that end is one of the two terminal ends of the whole gesture. Its
cross-axis extent is unchanged: `snapCellCenter(centerline) − width / 2`, width across,
exactly as §7 defines it.

**Why the old rule fails.** Spanning whole cells at _both_ ends of _every_ leg makes each
leg of a bend overshoot the other by `(step − width) / 2`. At width ⅛ under cell snap that
is 0.4375 cells in each of two directions, and the L reads as a plus — floor sprayed into
all four cardinals from a single corner. The narrower the band, the worse it gets, which is
why WI-051's ⅛ and ¼ widths are what exposed a rule that had looked correct at width 1 and 2. See `PLAN.md` IN-038 for the worked extents.

**What this buys, beyond removing the overshoot.** With the legs stopping at the corner
anchor, `leg ∪ leg ∪ cornerBlock` unions to a clean six-vertex L: the inside corner and
the outside corner are each **one vertex**, not a staircase of boolean seams. That is the
second half of the report and it falls out of the same change rather than needing its own.

**Scope.** One rule, both tools. `bandRect` gains explicit per-end extension, and both
`corridorPoly`'s two legs and `pathPoly`'s axis-aligned legs pass through it — so the
right-angle identity §7 asserts between a Path and the Corridor drawn through the same
points survives, and is re-asserted by the existing differencing test.

**Consistency with what already ships.** `pathPoly`'s _diagonal_ branch already works this
way: `cappedQuad` extends the two terminal ends by half a step and leaves interior ends
flush, on the reasoning DEC-038 records — a cap that overshoots an interior vertex spurs
out past a sharp turn. §9 is that same rule finally applied to the axis-aligned branch,
which is the one that never got it.

**Unchanged.** A straight run with no bend: both of its ends are terminal, so it still
covers whole cells and its flat caps still land on grid lines. A single click with no
drag: still one cell of floor. `cornerBlock`, `targetedBandRect` and the §6 band indicator
are untouched — the indicator already draws the band's cross-section, which is what §9
leaves alone.

### §10 — Simplification tolerance is bounded by the stroke's own width _(IN-039, DEC-047)_

> **Shipped in WI-059 (2026-08-04).** `boundedTolerance(policy, width, exactBand)`
> (`packages/shared/src/map/vector/tolerance.ts`) implements both clauses below, with
> `k = TOLERANCE_WIDTH_FRACTION = 0.25`. `VectorMapView`'s `strokeTolerance()` computes
> `width` (`bandWidth` for Corridor/Path, `width` for Carve) and `exactBand`
> (`tool ∈ {corridor, path} && effectiveSnap() !== 'free'`) and passes the result to
> `commitCarve` in place of the bare `toolTolerance` call, at both the floor and fog carve
> commit sites. `k`'s value is an agent default within DEC-047's ruling, a tuning constant
> like the per-tool policy values it bounds.

**A carve stroke is never simplified at a tolerance that its own geometry cannot survive.**

The per-tool tolerances in `tolerance.ts` are a _policy_, chosen at commit time while the
emitting tool is still known (§5.4, §8.3). That policy predates sub-cell band widths: it
was tuned when Path meant one thing, a free-form organic ribbon, and `path: 0.15` was the
POC's visually-clean sweet spot for exactly that. Since WI-051, Path also emits bands of
**⅛ and ¼ of a cell** — narrower than the tolerance that is then run over them. Douglas-
Peucker with a tolerance wider than the shape keeps only each side's two endpoints, so a
long thin band collapses toward a sliver, worsening with length.

Two clauses, and the second subsumes the first for the snapped case:

1. **Bounded by width.** For any tool whose stroke has a governed width, the effective
   tolerance is `min(policy, width · k)` for a fraction `k` well under ½ — the stroke's
   own width is the smallest feature it is _required_ to preserve, so no policy value may
   exceed it. The user's framing states the requirement directly: the selected width is
   maintained strictly through the entire length of the stroke, and rounding happens only
   where the stroke actually deviates.
2. **A snapped band is exact.** Under Cell or Half snap, Path and Corridor emit
   axis-aligned rectilinear geometry with no redundant vertices to prune — the same
   situation `room: 0` is already justified by ("axis-aligned rectangle — 4 corners,
   nothing to prune anyway"). They take tolerance **0**. Free-snap Path keeps `0.15`,
   bounded by clause 1, because that is the case the value was tuned for.

**Not a pipeline contract change.** `commitCarve`'s inputs and outputs are unchanged and
so is `simplifyAffected`'s survivor-pinning; what changes is only the number handed to it.
`toolTolerance(tool, override?)` already takes a caller override, which is the seam.

**Carve is unaffected** — its brush width is free-form and it is the organic tool by
design (DEC-032), so clause 1 binds it and clause 2 does not.

### §11 — The corridor latches its bend axis from the drag _(IN-040, DEC-048)_

> **Shipped in WI-062 (2026-08-04).** `corridorPoly`
> (`packages/shared/src/map/vector/primitives.ts`) takes a sixth argument,
> `firstAxis: BendAxis = 'h'` — the corner becomes `{ x: b.x, y: a.y }` under `'h'` and
> `{ x: a.x, y: b.y }` under `'v'`, and the two legs are read in gesture order rather than
> in x/y order so §9's interior/terminal rule is written once for both latches. The
> default preserves the pre-latch shape exactly, which is what a gesture that never
> declared an axis (a click with no drag) still gets. `latchBendAxis`
> (`apps/web/src/lib/map/vector-tools.ts`) is the rule itself, pure and unit-tested;
> `FloorToolOptions.bendAxis` carries it into `buildFloorStroke`; `VectorMapView` holds
> the latch beside `dragStartRaw`/`dragCurRaw`, updates it on every `pointermove` while
> the Corridor is active, and clears it everywhere those two are cleared.
> `BEND_LATCH_LATTICE = 0.5` — half a cell, in lattice units — is the threshold, an agent
> default within DEC-048's ruling and a tuning constant like `TOLERANCE_WIDTH_FRACTION`.
> Nothing else changed: `bandRect`, `bandLo`, `cornerBlock`, `targetedBandRect`, the §6
> indicator, `pathPoly` and the RTDB draft payload are untouched.

`corridorPoly` builds its corner as `{ x: b.x, y: a.y }` — horizontal leg first,
unconditionally. The bend therefore lands in a different place relative to the gesture
depending on which way the referee happened to drag, which is the reported asymmetry:
drawn horizontally the bend reads as mid-corridor, drawn vertically it reads as sitting on
the origin.

**The rule.** The corridor's **first** leg follows the axis the drag first commits to.
Once a drag has moved further than a latch threshold along one axis than the other, that
axis is the first leg for the remainder of the gesture and does not change again, however
the pointer moves afterwards. Before the threshold is met there is no bend to place —
the stroke is a single straight leg — so the latch is never guessed.

**Consequences this must answer.**

- The latch is **per gesture**, held in `VectorMapView`'s drag state and cleared on
  pointer-up, alongside the existing `dragStart`/`dragCur` pair. It is not a tool setting
  and it is never persisted.
- `corridorPoly` takes the latched axis as an argument rather than deriving it. Deriving
  it inside the primitive from `a` and `b` alone is precisely what cannot work: the same
  two endpoints must be able to produce either L, and only the gesture's history
  distinguishes them.
- The live preview must show the same L the commit will produce, which is what makes the
  latch legible rather than surprising.
- The threshold is expressed in **lattice units**, not pixels (RULE-006), so it behaves
  the same at every zoom.

**What "declared an axis" means, as built** (DEC-053). The latch fires the first time the
drag's **longer** axis passes the threshold, and takes that axis; a drag that is exactly
diagonal has declared nothing and waits. The alternative reading — latch only once one
axis leads the other _by_ the threshold — leaves a persistently diagonal drag unlatched at
any distance, and §11's "before the threshold there is no bend to place" is only true
while the gesture is still small. Both readings agree on the case the rule is for.

**The live preview and the peers' preview.** The drawer's ghost is rebuilt from the same
`buildFloorStroke` call the commit uses, so it shows the latched L by construction. The
RTDB draft channel is unaffected: it carries the two raw centerline points and peers draw
a polyline through them (B4, M7), never the resolved shape, so there is nothing on the
wire for the latch to disagree with.

### §12 — Free snap attracts to an existing vertex _(added by IN-050, DEC-061)_

Free snap (`mode: 'free'`) is documented in `map/vector/snap.ts` as pure identity — the
raw pointer position, untouched. This section adds the one exception: when the pointer is
within the tool's existing pick radius (`pickPx(isCoarsePointer)` — `PICK_PX_FINE` /
`PICK_PX_COARSE`, `vector-tools.ts`) of an existing vertex, Free snaps to that vertex
exactly, so a free-drawn wall, door or polygon edge can be pulled flush against geometry
that already exists rather than landing a fraction of a lattice unit off it — the whole
point of the request being "makes it easier to connect existing free-snap work."

Applies to the tools whose gesture already places points on vertices under snap — Wall,
Door, Polygon — and to the Select lasso's vertex handles. It does **not** apply to the
cell-anchored tools (Room, Corridor, N-gon, Carve, Path — §2's list): their anchor is a
cell, not a vertex, and attracting their raw sample point to a vertex would contradict §2's
standing constraint that they receive unrounded points and do their own cell-based
snapping.

Outside the pick radius, Free stays exactly what it always was: `snapPoint(p, 'free')`
returns `p` unchanged.
