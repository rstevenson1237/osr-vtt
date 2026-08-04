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

/**
 * Fraction of a stroke's own governed width the effective tolerance may not
 * exceed (SPEC-028 §10 clause 1) — well under ½, so Douglas-Peucker prunes
 * redundant vertices without ever eating into the width itself.
 */
export const TOLERANCE_WIDTH_FRACTION = 0.25;

/**
 * The tolerance a stroke actually commits at (SPEC-028 §10). The per-tool
 * `policy` (`toolTolerance`'s result, default or explicitly overridden)
 * predates sub-cell band widths, so it is bounded here by the stroke's own
 * governed `width` — a tolerance wider than the shape it is pruning collapses
 * a thin band toward a sliver. `exactBand` is true exactly when the caller
 * knows the stroke is a Path or Corridor band under Cell or Half snap
 * (SPEC-028 §7/§9): axis-aligned rectilinear geometry with no redundant
 * vertices to prune, which forces 0 and subsumes the width bound. Free-snap
 * Path, and the free-form Carve brush at every snap level, are governed by
 * the width bound alone.
 */
export function boundedTolerance(policy: number, width: number, exactBand: boolean): number {
  if (exactBand) return 0;
  return Math.min(policy, width * TOLERANCE_WIDTH_FRACTION);
}
