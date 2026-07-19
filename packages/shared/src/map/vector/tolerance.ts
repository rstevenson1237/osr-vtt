/**
 * Per-tool simplification tolerance policy (SPEC §5.4, §8.3).
 *
 * Simplification is a per-commit decision keyed on the *emitting tool*, because
 * different primitives tolerate vertex reduction very differently: a circle /
 * n-gon facets badly under aggressive Douglas-Peucker, while a freeform brush
 * stroke carries redundant vertices that should be pruned. Model A (baked union)
 * means a committed shape keeps no primitive identity — so the tolerance must be
 * chosen at commit time, while we still know which tool produced the stroke, and
 * then baked in. `commitCarve` only re-simplifies the regions a new stroke
 * actually touches (bbox-gated), so a crisp circle stays crisp even as unrelated
 * carves happen elsewhere on the map.
 *
 * Curved *storage* is deliberately not a thing (the whole pipeline is
 * straight-segment polygons: boolean ops, offset, LoS, point-in-polygon all
 * assume segments). Smooth *appearance* is a render-time concern (WI-D draws a
 * spline through these vertices); here we just keep enough vertices that the
 * render reads smooth. Doc-size is a non-issue for that (FINDINGS §8.2: ~11 KiB
 * worst-case region with simplify fully off, 90× under the Firestore limit).
 *
 * Values are lattice units and are intended to be tuned by eye with the POC
 * §8.3 slider; they live here so there is one place to change them.
 */

/** The five §2.5 drawing primitives (the tools that emit carve strokes). */
export type ToolKind = 'room' | 'corridor' | 'path' | 'polygon' | 'regular';

/**
 * Default simplification tolerance per tool (lattice units). `0` = never drop a
 * vertex (Douglas-Peucker is a no-op), which is what keeps curved/parametric
 * shapes crisp.
 */
export const DEFAULT_TOOL_TOLERANCE: Record<ToolKind, number> = {
  // Curved / parametric / deliberate — keep every sampled vertex so they never
  // facet. Doc-size headroom makes this free.
  regular: 0, // circles & n-gons — the faceting-sensitive case
  polygon: 0, // hand-placed vertices are intentional
  room: 0, // axis-aligned rectangle — 4 corners, nothing to prune anyway
  // Freeform / boolean-seam heavy — prune redundant vertices.
  corridor: 0.05, // mostly axis-aligned; light cleanup of union seams
  path: 0.15, // freeform brush — the POC §8.3 visually-clean sweet spot
};

/** Tolerance a tool commits at, unless the caller overrides it (e.g. a live
 * slider). Falls back to the freeform `path` value for unknown kinds. */
export function toolTolerance(tool: ToolKind, override?: number): number {
  if (override !== undefined) return override;
  return DEFAULT_TOOL_TOLERANCE[tool] ?? DEFAULT_TOOL_TOLERANCE.path;
}
