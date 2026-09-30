import { describe, expect, it } from 'vitest';
import {
  createMapRenderer,
  RENDER_LAYERS,
  type FrameScheduler,
  type RenderLayer,
} from './map-renderer';

/** WI-193 / SPEC-057 §4.2: per-layer `invalidate` with one coalesced flush. */

/** A frame scheduler stepped by hand: `frame()` runs whatever is pending. */
function manualFrames() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const scheduler: FrameScheduler = {
    request(cb) {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  return {
    scheduler,
    get pending() {
      return pending.size;
    },
    frame() {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb();
    },
  };
}

function setup() {
  const frames = manualFrames();
  const drawn: RenderLayer[] = [];
  const passes = Object.fromEntries(
    RENDER_LAYERS.map((l) => [l, () => void drawn.push(l)]),
  ) as Record<RenderLayer, () => void>;
  const renderer = createMapRenderer(passes, frames.scheduler);
  return { frames, drawn, renderer, passes };
}

describe('createMapRenderer', () => {
  it('draws nothing until the frame, then only the invalidated layers', () => {
    const { frames, drawn, renderer } = setup();
    renderer.invalidate('tools');
    renderer.invalidate('floor');
    expect(drawn).toEqual([]);
    expect(renderer.isDirty('floor')).toBe(true);
    expect(renderer.isDirty('grid')).toBe(false);
    frames.frame();
    expect(drawn).toEqual(['floor', 'tools']);
    expect(renderer.isDirty()).toBe(false);
  });

  it('coalesces any number of invalidations into one pass per layer and one frame', () => {
    const { frames, drawn, renderer } = setup();
    for (let i = 0; i < 20; i++) renderer.invalidate('floor', 'tools');
    expect(frames.pending).toBe(1);
    frames.frame();
    expect(drawn).toEqual(['floor', 'tools']);
  });

  it('runs passes in z-order, whatever order they were invalidated in', () => {
    const { frames, drawn, renderer } = setup();
    renderer.invalidate('tools', 'fog', 'overlay', 'floor', 'grid');
    frames.frame();
    expect(drawn).toEqual(['grid', 'floor', 'overlay', 'fog', 'tools']);
  });

  it('with no argument invalidates every layer (the old renderAll)', () => {
    const { frames, drawn, renderer } = setup();
    renderer.invalidate();
    frames.frame();
    expect(drawn).toEqual([...RENDER_LAYERS]);
  });

  it('flush draws now and cancels the pending frame', () => {
    const { frames, drawn, renderer } = setup();
    renderer.invalidate('fog');
    renderer.flush();
    expect(drawn).toEqual(['fog']);
    expect(frames.pending).toBe(0);
    frames.frame();
    expect(drawn).toEqual(['fog']);
  });

  it('a layer invalidated by a pass is drawn on the next frame, not lost or re-entered', () => {
    const frames = manualFrames();
    const drawn: RenderLayer[] = [];
    const renderer = createMapRenderer(
      {
        grid: () => drawn.push('grid'),
        floor: () => {
          drawn.push('floor');
          renderer.invalidate('tools');
        },
        overlay: () => drawn.push('overlay'),
        fog: () => drawn.push('fog'),
        tools: () => drawn.push('tools'),
      },
      frames.scheduler,
    );
    renderer.invalidate('floor');
    frames.frame();
    expect(drawn).toEqual(['floor']);
    expect(frames.pending).toBe(1);
    frames.frame();
    expect(drawn).toEqual(['floor', 'tools']);
  });

  it('after dispose, nothing is scheduled or drawn', () => {
    const { frames, drawn, renderer } = setup();
    renderer.invalidate('grid');
    renderer.dispose();
    expect(frames.pending).toBe(0);
    renderer.invalidate('floor');
    renderer.flush();
    frames.frame();
    expect(drawn).toEqual([]);
  });
});
