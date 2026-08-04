import { afterEach, describe, expect, it } from 'vitest';
import { COARSE_POINTER_QUERY, NARROW_LAYOUT_QUERY, createShellMedia } from './layout.svelte';

/** `createShellMedia` reads `window.matchMedia` and nothing else, so a stand-in
 * that records its listeners is enough to drive both signals — including the
 * combinations no CI browser gives us: a wide coarse-pointer tablet, and a
 * narrow precise-pointer desktop window. */
interface FakeMql {
  matches: boolean;
  listeners: Set<(e: MediaQueryListEvent) => void>;
  addEventListener(type: 'change', fn: (e: MediaQueryListEvent) => void): void;
  removeEventListener(type: 'change', fn: (e: MediaQueryListEvent) => void): void;
}

function installMatchMedia(initial: Record<string, boolean>): Map<string, FakeMql> {
  const made = new Map<string, FakeMql>();
  (globalThis as { window?: unknown }).window = {
    matchMedia(query: string): FakeMql {
      const mql: FakeMql = {
        matches: initial[query] ?? false,
        listeners: new Set(),
        addEventListener(_type, fn) {
          this.listeners.add(fn);
        },
        removeEventListener(_type, fn) {
          this.listeners.delete(fn);
        },
      };
      made.set(query, mql);
      return mql;
    },
  };
  return made;
}

function emit(mql: FakeMql, matches: boolean): void {
  mql.matches = matches;
  for (const fn of mql.listeners) fn({ matches } as MediaQueryListEvent);
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('createShellMedia', () => {
  it('reads the two queries independently at construction', () => {
    installMatchMedia({ [NARROW_LAYOUT_QUERY]: true, [COARSE_POINTER_QUERY]: true });
    const media = createShellMedia();
    expect(media.isNarrow).toBe(true);
    expect(media.isCoarsePointer).toBe(true);
    media.dispose();
  });

  it('a touchscreen laptop is coarse but not narrow — it keeps the desktop layout', () => {
    // The case IN-036 reported: 1920px with a touch screen used to run the
    // phone shell because one query matched either condition.
    installMatchMedia({ [NARROW_LAYOUT_QUERY]: false, [COARSE_POINTER_QUERY]: true });
    const media = createShellMedia();
    expect(media.isNarrow).toBe(false);
    expect(media.isCoarsePointer).toBe(true);
    media.dispose();
  });

  it('a narrow mouse-driven window is the mobile layout with precise hit targets', () => {
    installMatchMedia({ [NARROW_LAYOUT_QUERY]: true, [COARSE_POINTER_QUERY]: false });
    const media = createShellMedia();
    expect(media.isNarrow).toBe(true);
    expect(media.isCoarsePointer).toBe(false);
    media.dispose();
  });

  it('each signal reacts to its own query only', () => {
    const made = installMatchMedia({});
    const media = createShellMedia();
    expect(media.isNarrow).toBe(false);
    expect(media.isCoarsePointer).toBe(false);

    // Rotating an iPad into portrait crosses the width breakpoint; the pointer
    // has not changed and must not be touched by it.
    emit(made.get(NARROW_LAYOUT_QUERY)!, true);
    expect(media.isNarrow).toBe(true);
    expect(media.isCoarsePointer).toBe(false);

    emit(made.get(COARSE_POINTER_QUERY)!, true);
    expect(media.isNarrow).toBe(true);
    expect(media.isCoarsePointer).toBe(true);

    emit(made.get(NARROW_LAYOUT_QUERY)!, false);
    expect(media.isNarrow).toBe(false);
    expect(media.isCoarsePointer).toBe(true);
    media.dispose();
  });

  it('dispose detaches both listeners', () => {
    const made = installMatchMedia({});
    const media = createShellMedia();
    media.dispose();
    expect(made.get(NARROW_LAYOUT_QUERY)!.listeners.size).toBe(0);
    expect(made.get(COARSE_POINTER_QUERY)!.listeners.size).toBe(0);
  });

  it('defaults to a wide, precise-pointer desktop with no matchMedia', () => {
    const media = createShellMedia();
    expect(media.isNarrow).toBe(false);
    expect(media.isCoarsePointer).toBe(false);
    media.dispose();
  });
});
