## SPEC-037 — Selection model: one Select tool, lasso, and vertex deletion

**Status: Completed** (2026-08-11) — WI-078.

_(New with the 2026-08-11 playtest batch; supersedes the Select-tool portion of WI-030's
three-tool split, per DEC-060. No `R`-number predecessor.)_

### §1 — One Select tool

`selectVertex`, `selectEdge` and `selectObject` (WI-030) collapse into one `select`
`MapToolId`, in the `select` group of `TOOL_GROUPS` (`map/tool-groups.ts`). `selectEdge` is
retired outright — an edge is not a first-class handle in the merged model (DEC-060). A
single click still single-picks: a vertex handle takes priority over an object under the
same pointer, matching WI-030's existing vertex-mode precedence; failing that, the click
falls through to object-picking (`pickObject`).

### §2 — The lasso

A click-and-drag over open canvas (not starting on a handle or object, which is a
single-pick or a move-drag instead) sweeps a rectangular region and collects, on release:

- every vertex handle (`vertexHandles`) whose point lies inside the region;
- every object (`pickObject`'s catalog — symbol, mapRoom/label, door, drawing) whose
  hit-test point or bounding box lies inside the region.

The result is one multi-selection set, mixing vertex handles and objects freely. A lasso
with nothing inside it clears the current selection, matching a click on open canvas today.

### §3 — Deletion

Backspace (and Delete) removes the entire current selection — extending
`deleteSelectedObject`'s existing single-target behaviour to the multi-selection set. Each
member is removed through its existing store call (`removeSymbol` / `removeMapRoom` /
`removeDoor` / `deleteDrawing` for objects); a selected vertex is removed from the
`FloorRegion` ring (or wall/door segment) it belongs to.

### §4 — Vertex removal preserves the loop where possible

Removing a vertex from a closed `FloorRegion` ring re-stitches the ring across the gap —
the two neighbours of the removed vertex become adjacent, exactly as if the vertex had
never been placed. This is a new geometric edit on committed floor geometry (Model A has no
construction history to replay, per `README.md`'s Data model section), so it ships as a
`VectorEditorOp` with an inverse for undo, the same pattern every other floor edit uses.

**Where the loop cannot be preserved:**

- Removing a vertex that leaves a ring with fewer than 3 points drops the **whole ring** —
  a 2-point or 1-point ring is not a polygon. If the ring being emptied is a hole
  (`rings[1..]`), only the hole is dropped, restoring the solid region beneath it; if it is
  the outer boundary (`rings[0]`), the entire `FloorRegion` is deleted.
- Removing a vertex shared between two rings (a rare degenerate case from a boolean
  boundary merge) is treated as removing it from the ring the pick landed on; the other
  ring's copy, if any, is untouched — rings do not share point identity in the stored shape.
- A selected wall/door-segment endpoint is not "a loop" — removing it removes the segment,
  same as today's single-object delete.

### §5 — What does not change

Object drag-to-move, the object highlight/bounding-box readout, and every non-Select tool
are unaffected. The snap-mode selector does not apply to Select (it has none today and
gains none — a lasso's region is drawn in screen/world space, not lattice-snapped).
