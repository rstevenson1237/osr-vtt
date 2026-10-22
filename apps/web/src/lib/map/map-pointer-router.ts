import type { Point } from './vector-tools';
import type { StageInput } from './map-seam';

/**
 * Stage pointer dispatch (SPEC-069, DEC-136). An ordered list of `StageInput`s;
 * the router wires the stage's listeners, applies the guards, converts each event
 * once to raw world pixels, and offers it to each handler in turn until one
 * consumes it.
 *
 * It is not a seam: it holds no map state, is handed no store and no coordinate
 * conversion, and never draws (RULE-006 — only the handlers convert).
 */

/** The part of a Pixi federated pointer event the router reads. */
export interface StagePointerEvent {
  button: number;
  altKey: boolean;
  global: Point;
}

/** The part of the vector engine the router reads: the stage to listen on and
 * the one screen → world conversion. A fake of this is all a unit test needs. */
export interface StageHost {
  app: { stage: StageEmitter };
  toWorld(global: Point): Point;
}

/** Structural stand-in for the Pixi stage's emitter, so a test can drive the
 * router without Pixi. */
export interface StageEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, fn: (e: any) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, fn: (e: any) => void): unknown;
}

export interface MapPointerRouterOptions {
  /** A two-finger pan/pinch is in progress: a press is not a tool press (SPEC-059). */
  gestureActive: () => boolean;
}

export class MapPointerRouter {
  readonly #handlers: StageInput[];
  readonly #gestureActive: () => boolean;
  #detach: (() => void) | null = null;

  /** `handlers` is the dispatch order; `null` entries (the hex controller on a
   * square map) are dropped. */
  constructor(handlers: ReadonlyArray<StageInput | null>, options: MapPointerRouterOptions) {
    this.#handlers = handlers.filter((h): h is StageInput => h !== null);
    this.#gestureActive = options.gestureActive;
  }

  attach(host: StageHost): void {
    this.detach();
    const stage = host.app.stage;
    const down = (e: StagePointerEvent) => {
      // No `e.target !== stage` guard: the scene layers are non-interactive
      // (see `createVectorMapEngine`), so a click on rendered floor still
      // targets the stage; token sprites `stopPropagation`, so their drags
      // never reach this handler. Guarding on target dropped floor clicks
      // (e.g. placing a label inside a carved region).
      if (this.#gestureActive()) return;
      if (e.button !== 0 || e.altKey) return;
      this.pointerDown(host.toWorld(e.global));
    };
    const move = (e: StagePointerEvent) => this.pointerMove(host.toWorld(e.global));
    const up = (e: StagePointerEvent) => void this.pointerUp(host.toWorld(e.global));
    const out = () => this.pointerOut();
    stage.on('pointerdown', down);
    stage.on('pointermove', move);
    stage.on('pointerup', up);
    stage.on('pointerupoutside', up);
    stage.on('pointerout', out);
    this.#detach = () => {
      stage.off('pointerdown', down);
      stage.off('pointermove', move);
      stage.off('pointerup', up);
      stage.off('pointerupoutside', up);
      stage.off('pointerout', out);
    };
  }

  detach(): void {
    this.#detach?.();
    this.#detach = null;
  }

  destroy(): void {
    this.detach();
  }

  /** First handler to return `true` consumes the press. */
  pointerDown(worldPx: Point): boolean {
    for (const h of this.#handlers) if (h.pointerDown?.(worldPx)) return true;
    return false;
  }

  /** Every `hover` runs first, whatever consumes the move; then first consumer wins. */
  pointerMove(worldPx: Point): boolean {
    for (const h of this.#handlers) h.hover?.(worldPx);
    for (const h of this.#handlers) if (h.pointerMove?.(worldPx)) return true;
    return false;
  }

  /** Awaits each handler in turn; the first to resolve `true` consumes the release. */
  async pointerUp(worldPx: Point): Promise<boolean> {
    for (const h of this.#handlers) if (await h.pointerUp?.(worldPx)) return true;
    return false;
  }

  pointerOut(): void {
    for (const h of this.#handlers) h.pointerOut?.();
  }

  /** Escape, a pan gesture, a tool change: every handler drops its in-progress
   * gesture. The caller redraws — it clears other state in the same breath. */
  cancel(): void {
    for (const h of this.#handlers) h.cancel?.();
  }
}
