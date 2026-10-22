import type { CampaignStore } from '@osr-vtt/shared';
import type { RenderLayer } from './map-renderer';
import type { Point } from './vector-tools';

/**
 * What every map seam controller is handed (SPEC-060 §2). A seam is a
 * `map/<seam>.svelte.ts` class that owns its `$state`; this is the part of its
 * constructor argument that is the same for all of them. A seam extends it with
 * only what it uses — the coordinate conversions its map kind declares and the
 * engine handles it actually reads (RULE-006) — never the whole component.
 *
 * Anything the component owns and changes over time (props, `$state`, engine
 * handles that may not exist yet) is handed as a function, so the controller
 * reads the current value at call time and a `$derived` inside the controller
 * tracks it.
 */
export interface MapSeamDeps {
  /** The renderer's own funnel (`map-renderer.ts`). A seam never draws and
   * never calls `renderAll`. */
  invalidate: (...layers: RenderLayer[]) => void;
  store: CampaignStore;
  roomId: string;
  mapId: string;
}

/** A seam on a square-lattice map: handed the lattice conversion only, never a
 * hex one, so a lattice consumer cannot be reached from a hex map (SPEC-060 §2). */
export interface SquareSeamDeps extends MapSeamDeps {
  toLatticeRaw: (world: { x: number; y: number }) => Point;
}

/**
 * What a seam (or the component's own `editor`) implements to take stage input
 * from the `MapPointerRouter` (SPEC-069 §3). Every hook is optional and gets the
 * raw world pixel (SPEC-060 §4); a consumer converts it with the functions its
 * own deps carry.
 *
 * `hover` is the one hook that never consumes: it runs on every move, before any
 * `pointerMove`, so a handler that takes the move cannot starve the others'
 * observation of it (the cursor publish, the label tooltip, the hex note hover).
 */
export interface StageInput {
  hover?(worldPx: Point): void;
  pointerDown?(worldPx: Point): boolean;
  pointerMove?(worldPx: Point): boolean;
  pointerUp?(worldPx: Point): boolean | Promise<boolean>;
  pointerOut?(): void;
  cancel?(): void;
}
