/**
 * Per-layer dirty tracking for the vector map (WI-193, SPEC-057 §4.2).
 *
 * `VectorMapView` used to call one `renderAll()` on every change, which
 * redrew every layer — and it did so synchronously, from every pointer move
 * and from every `$effect` that happened to call it, so one change could
 * redraw the whole map several times before a frame was painted. This is the
 * replacement: callers `invalidate` the layers a change touches, and one
 * `requestAnimationFrame` later `flush` runs each dirty layer's pass once, in
 * z-order. Any number of invalidations between two frames cost one pass per
 * dirty layer.
 *
 * The keys are the engine's layer names (`README.md`, "Layer model"), and a
 * pass is whatever the view draws into that layer — this module neither knows
 * nor changes what a layer means or the order the layers stack in (RULE-006).
 * `background` and `tokens` keep their own sprite lifecycles and are not
 * passes here; `grid` is the unnamed container between `floor` and
 * `overlay`.
 */

/** Flush order: the engine's z-order, bottom to top. */
export const RENDER_LAYERS = ['grid', 'floor', 'overlay', 'fog', 'tools'] as const;
export type RenderLayer = (typeof RENDER_LAYERS)[number];

/** One draw pass per layer; each redraws its whole layer from current state. */
export type RenderPasses = Record<RenderLayer, () => void>;

/** When the coalesced flush runs. Injected so a test can step frames by hand;
 * the default is the browser's own frame callback. */
export interface FrameScheduler {
  request(cb: () => void): number;
  cancel(handle: number): void;
}

const animationFrames: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface MapRenderer {
  /** Marks layers dirty and schedules the flush if none is pending. No
   * argument marks every layer — the old `renderAll()`, now coalesced. */
  invalidate(...layers: RenderLayer[]): void;
  /** Runs every dirty layer's pass now, in z-order, and cancels the pending
   * frame. For callers that must read the drawn result before the next frame
   * (a PNG export). */
  flush(): void;
  /** Whether a layer (or, with no argument, any layer) awaits a flush. */
  isDirty(layer?: RenderLayer): boolean;
  /** Cancels the pending frame; later invalidations are ignored. */
  dispose(): void;
}

export function createMapRenderer(
  passes: RenderPasses,
  scheduler: FrameScheduler = animationFrames,
): MapRenderer {
  const dirty = new Set<RenderLayer>();
  let pending: number | null = null;
  let disposed = false;

  function flush(): void {
    if (pending !== null) {
      scheduler.cancel(pending);
      pending = null;
    }
    if (disposed || dirty.size === 0) return;
    // Taken and cleared before any pass runs, so a pass that invalidates
    // (directly or through state it touches) schedules the next frame rather
    // than being lost, and never re-enters this one.
    const layers = RENDER_LAYERS.filter((l) => dirty.has(l));
    dirty.clear();
    for (const layer of layers) passes[layer]();
  }

  return {
    invalidate(...layers) {
      if (disposed) return;
      for (const layer of layers.length ? layers : RENDER_LAYERS) dirty.add(layer);
      if (pending === null) {
        pending = scheduler.request(() => {
          pending = null;
          flush();
        });
      }
    },
    flush,
    isDirty(layer) {
      return layer ? dirty.has(layer) : dirty.size > 0;
    },
    dispose() {
      disposed = true;
      dirty.clear();
      if (pending !== null) scheduler.cancel(pending);
      pending = null;
    },
  };
}
