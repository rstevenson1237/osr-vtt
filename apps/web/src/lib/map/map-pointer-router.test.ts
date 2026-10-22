import { describe, expect, it, vi } from 'vitest';
import { MapPointerRouter, type StageHost, type StagePointerEvent } from './map-pointer-router';
import type { StageInput } from './map-seam';

/** A stage that records its listeners and lets a test fire them. */
function fakeStage() {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const stage = {
    on: (event: string, fn: (e: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off: (event: string, fn: (e: unknown) => void) => {
      listeners.get(event)?.delete(fn);
    },
  };
  const host: StageHost = {
    app: { stage },
    // Distinguishable from the global point, so a test can tell it was converted.
    toWorld: (g) => ({ x: g.x * 10, y: g.y * 10 }),
  };
  const count = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  const fire = (event: string, e: Partial<StagePointerEvent> = {}) => {
    for (const fn of [...(listeners.get(event) ?? [])]) {
      fn({ button: 0, altKey: false, global: { x: 1, y: 2 }, ...e });
    }
  };
  return { host, fire, count };
}

/** A handler that logs every call into the shared `calls` list under `name`. */
function recorder(
  name: string,
  calls: string[],
  consume: Partial<Record<'down' | 'move' | 'up', boolean>> = {},
): StageInput {
  return {
    hover: () => void calls.push(`${name}.hover`),
    pointerDown: () => (calls.push(`${name}.down`), consume.down ?? false),
    pointerMove: () => (calls.push(`${name}.move`), consume.move ?? false),
    pointerUp: async () => (calls.push(`${name}.up`), consume.up ?? false),
    pointerOut: () => void calls.push(`${name}.out`),
    cancel: () => void calls.push(`${name}.cancel`),
  };
}

const idle = () => false;

describe('MapPointerRouter down', () => {
  it('offers the press in order and stops at the first consumer', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter(
      [recorder('a', calls), recorder('b', calls, { down: true }), recorder('c', calls)],
      { gestureActive: idle },
    );
    expect(router.pointerDown({ x: 0, y: 0 })).toBe(true);
    expect(calls).toEqual(['a.down', 'b.down']);
  });

  it('reports nothing consumed when no handler takes it', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter([recorder('a', calls)], { gestureActive: idle });
    expect(router.pointerDown({ x: 0, y: 0 })).toBe(false);
  });

  it('hands every handler the same raw world pixels, converted once', () => {
    const seen: unknown[] = [];
    const tap: StageInput = { pointerDown: (w) => (seen.push(w), false) };
    const { host, fire } = fakeStage();
    new MapPointerRouter([tap, tap], { gestureActive: idle }).attach(host);
    fire('pointerdown');
    expect(seen).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 20 },
    ]);
    expect(seen[0]).toBe(seen[1]);
  });

  it('ignores a press during a gesture, a non-primary button or Alt', () => {
    const down = vi.fn(() => true);
    const { host, fire } = fakeStage();
    let gesture = true;
    new MapPointerRouter([{ pointerDown: down }], { gestureActive: () => gesture }).attach(host);
    fire('pointerdown');
    gesture = false;
    fire('pointerdown', { button: 2 });
    fire('pointerdown', { altKey: true });
    expect(down).not.toHaveBeenCalled();
    fire('pointerdown');
    expect(down).toHaveBeenCalledTimes(1);
  });
});

describe('MapPointerRouter move', () => {
  it('runs every hover before any pointerMove, even when the first handler consumes', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter(
      [recorder('a', calls, { move: true }), recorder('b', calls), recorder('c', calls)],
      { gestureActive: idle },
    );
    expect(router.pointerMove({ x: 0, y: 0 })).toBe(true);
    expect(calls).toEqual(['a.hover', 'b.hover', 'c.hover', 'a.move']);
  });

  it('stops at the first consumer after the hovers', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter(
      [recorder('a', calls), recorder('b', calls, { move: true }), recorder('c', calls)],
      { gestureActive: idle },
    );
    router.pointerMove({ x: 0, y: 0 });
    expect(calls.filter((c) => c.endsWith('.move'))).toEqual(['a.move', 'b.move']);
  });

  it('is not guarded by a gesture: the hovers still observe', () => {
    const hover = vi.fn();
    const { host, fire } = fakeStage();
    new MapPointerRouter([{ hover }], { gestureActive: () => true }).attach(host);
    fire('pointermove');
    expect(hover).toHaveBeenCalledWith({ x: 10, y: 20 });
  });
});

describe('MapPointerRouter up', () => {
  it('awaits each handler in turn and stops at the first to resolve true', async () => {
    const order: string[] = [];
    const slow = (name: string, result: boolean): StageInput => ({
      pointerUp: async () => {
        order.push(`${name}:start`);
        await Promise.resolve();
        await Promise.resolve();
        order.push(`${name}:end`);
        return result;
      },
    });
    const router = new MapPointerRouter([slow('a', false), slow('b', true), slow('c', true)], {
      gestureActive: idle,
    });
    await expect(router.pointerUp({ x: 0, y: 0 })).resolves.toBe(true);
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('fires from both pointerup and pointerupoutside', async () => {
    const up = vi.fn(async () => true);
    const { host, fire } = fakeStage();
    new MapPointerRouter([{ pointerUp: up }], { gestureActive: idle }).attach(host);
    fire('pointerup');
    fire('pointerupoutside');
    await Promise.resolve();
    expect(up).toHaveBeenCalledTimes(2);
  });
});

describe('MapPointerRouter list and fan-outs', () => {
  it('drops null entries and skips handlers missing a hook', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter([null, {}, recorder('a', calls, { down: true }), null], {
      gestureActive: idle,
    });
    expect(router.pointerDown({ x: 0, y: 0 })).toBe(true);
    expect(calls).toEqual(['a.down']);
  });

  it('pointerOut and cancel reach every handler', () => {
    const calls: string[] = [];
    const router = new MapPointerRouter(
      [recorder('a', calls, { down: true, move: true }), recorder('b', calls)],
      { gestureActive: idle },
    );
    router.pointerOut();
    router.cancel();
    expect(calls).toEqual(['a.out', 'b.out', 'a.cancel', 'b.cancel']);
  });

  it('routes the stage pointerout event to every handler', () => {
    const out = vi.fn();
    const { host, fire } = fakeStage();
    new MapPointerRouter([{ pointerOut: out }, { pointerOut: out }], {
      gestureActive: idle,
    }).attach(host);
    fire('pointerout');
    expect(out).toHaveBeenCalledTimes(2);
  });
});

describe('MapPointerRouter attach', () => {
  it('detach removes every listener it added, and destroy detaches', () => {
    const { host, count } = fakeStage();
    const router = new MapPointerRouter([], { gestureActive: idle });
    router.attach(host);
    expect(count()).toBe(5);
    router.detach();
    expect(count()).toBe(0);
    router.attach(host);
    router.destroy();
    expect(count()).toBe(0);
  });

  it('re-attaching does not double the listeners', () => {
    const { host, count } = fakeStage();
    const router = new MapPointerRouter([], { gestureActive: idle });
    router.attach(host);
    router.attach(host);
    expect(count()).toBe(5);
  });
});
