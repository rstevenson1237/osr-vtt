import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDALONE_QUERY, createPresentation } from './presentation.svelte';

/** `createPresentation` reads `document` (fullscreen state + its change event),
 * `navigator.standalone` and one media query, and nothing else — so a stand-in
 * for those three is enough to drive every combination, including the ones no
 * CI browser can produce (an installed standalone launch, a Safari-prefixed
 * Fullscreen API, a request the browser refuses). */
interface FakeDoc {
  documentElement: Record<string, unknown>;
  fullscreenElement: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  defaultView: { navigator: { standalone?: boolean } };
  listeners: Map<string, Set<() => void>>;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  /** Drive the browser's own notification: set the element, then fire. */
  enter(type: string): void;
}

interface FakeMql {
  matches: boolean;
  listeners: Set<(e: MediaQueryListEvent) => void>;
  addEventListener(type: 'change', fn: (e: MediaQueryListEvent) => void): void;
  removeEventListener(type: 'change', fn: (e: MediaQueryListEvent) => void): void;
}

const FRAME = { tagName: 'HTML' } as unknown as Element;

function installDom(
  options: {
    prefixed?: boolean;
    enabled?: boolean;
    iosStandalone?: boolean;
    standaloneMatches?: boolean;
    reject?: boolean;
  } = {},
): { doc: FakeDoc; mql: FakeMql | undefined; request: ReturnType<typeof vi.fn> } {
  const { prefixed = false, enabled = true, reject = false } = options;
  const request = vi.fn(() => (reject ? Promise.reject(new Error('denied')) : Promise.resolve()));
  const exit = vi.fn(() => Promise.resolve());

  const doc: FakeDoc = {
    documentElement: prefixed
      ? { webkitRequestFullscreen: request }
      : { requestFullscreen: request },
    fullscreenElement: null,
    defaultView: { navigator: { standalone: options.iosStandalone } },
    listeners: new Map(),
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn);
    },
    enter(type) {
      for (const fn of this.listeners.get(type) ?? []) fn();
    },
  };
  if (prefixed) {
    doc.webkitFullscreenElement = null;
    doc.webkitFullscreenEnabled = enabled;
    doc.webkitExitFullscreen = exit;
  } else {
    doc.fullscreenEnabled = enabled;
    doc.exitFullscreen = exit;
  }

  let mql: FakeMql | undefined;
  (globalThis as { document?: unknown }).document = doc;
  (globalThis as { window?: unknown }).window = {
    matchMedia(query: string): FakeMql {
      mql = {
        matches: query === STANDALONE_QUERY && options.standaloneMatches === true,
        listeners: new Set(),
        addEventListener(_type, fn) {
          this.listeners.add(fn);
        },
        removeEventListener(_type, fn) {
          this.listeners.delete(fn);
        },
      };
      return mql;
    },
  };
  return {
    doc,
    get mql() {
      return mql;
    },
    request,
  };
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
  delete (globalThis as { window?: unknown }).window;
});

describe('createPresentation', () => {
  it('with no DOM at all, the control has nothing to offer and nothing throws', async () => {
    const p = createPresentation();
    expect(p.canFullscreen).toBe(false);
    expect(p.ownsDisplay).toBe(false);
    await expect(p.toggleFullscreen()).resolves.toBeUndefined();
    p.dispose();
  });

  it('full-screens the frame — the document root, not the map canvas', async () => {
    const { doc, request } = installDom();
    const p = createPresentation();
    expect(p.canFullscreen).toBe(true);
    expect(p.isFullscreen).toBe(false);

    await p.toggleFullscreen();
    expect(request).toHaveBeenCalledTimes(1);
    // The request goes to `documentElement`: full-screening the canvas alone
    // would strand the toolbars SPEC-033 §5 is about.
    expect(request.mock.instances[0]).toBe(doc.documentElement);
    p.dispose();
  });

  it('tracks the browser rather than the click, so Escape is not missed', () => {
    const { doc } = installDom();
    const p = createPresentation();

    doc.fullscreenElement = FRAME;
    doc.enter('fullscreenchange');
    expect(p.isFullscreen).toBe(true);
    expect(p.ownsDisplay).toBe(true);

    // Escape leaves full-screen without going through the control.
    doc.fullscreenElement = null;
    doc.enter('fullscreenchange');
    expect(p.isFullscreen).toBe(false);
    p.dispose();
  });

  it('a second toggle exits, and a refused request leaves the state truthful', async () => {
    const { doc } = installDom();
    const p = createPresentation();
    doc.fullscreenElement = FRAME;
    await p.toggleFullscreen();
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    p.dispose();

    const refused = installDom({ reject: true });
    const q = createPresentation();
    await expect(q.toggleFullscreen()).resolves.toBeUndefined();
    expect(refused.request).toHaveBeenCalledTimes(1);
    expect(q.isFullscreen).toBe(false);
    q.dispose();
  });

  it("reads Safari's prefixed spelling — the browser SPEC-033 exists for", async () => {
    const { doc, request } = installDom({ prefixed: true });
    const p = createPresentation();
    expect(p.canFullscreen).toBe(true);
    await p.toggleFullscreen();
    expect(request).toHaveBeenCalledTimes(1);

    doc.webkitFullscreenElement = FRAME;
    doc.enter('webkitfullscreenchange');
    expect(p.isFullscreen).toBe(true);
    p.dispose();
  });

  it('reports no full-screen where the API is disabled — an iPhone browser', () => {
    installDom({ enabled: false });
    const p = createPresentation();
    expect(p.canFullscreen).toBe(false);
    p.dispose();
  });

  it('standalone owns the display by the other route, without the API', () => {
    installDom({ enabled: false, standaloneMatches: true });
    const p = createPresentation();
    expect(p.isStandalone).toBe(true);
    expect(p.isFullscreen).toBe(false);
    expect(p.ownsDisplay).toBe(true);
    p.dispose();
  });

  it("honours iOS's pre-`display-mode` standalone flag", () => {
    installDom({ enabled: false, iosStandalone: true });
    const p = createPresentation();
    expect(p.isStandalone).toBe(true);
    expect(p.ownsDisplay).toBe(true);
    p.dispose();
  });

  it('dispose detaches every listener', () => {
    const dom = installDom();
    const p = createPresentation();
    p.dispose();
    expect(dom.doc.listeners.get('fullscreenchange')?.size ?? 0).toBe(0);
    expect(dom.doc.listeners.get('webkitfullscreenchange')?.size ?? 0).toBe(0);
    expect(dom.mql?.listeners.size ?? 0).toBe(0);
  });
});
