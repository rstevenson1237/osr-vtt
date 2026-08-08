/** One presentation model: full-screen and standalone (SPEC-033 §5).
 *
 * Full-screen (the Fullscreen API) and standalone (an installed PWA launched
 * from the home screen with no browser chrome) are **two routes to the same
 * state** — the app frame owning the whole display. They are modelled together
 * because they must produce the *same* layout, and because each independently
 * changes the viewport height SPEC-033 §1 pins the frame to.
 *
 * The frame is `document.documentElement`, not the map host: full-screening the
 * canvas alone would strand the toolbars this is about (SPEC-033 §5). Since the
 * frame already sizes against `100dvh` (§1) and pads by the safe-area insets
 * (§3), both routes land on one layout with no per-route CSS.
 *
 * **Neither is an authority boundary.** Nothing here gates a tool, hides
 * information, or reads `isGM`; it changes presentation only.
 *
 * Sibling of `layout.svelte.ts`: same shape (a `create*` returning reactive
 * getters plus `dispose`), same reason for existing in a `.svelte.ts` module —
 * `$state` so components re-render when the browser changes the state out from
 * under them (Escape leaves full-screen without going through our control).
 */

/** Standalone display mode: an installed PWA, no browser chrome. Deliberately
 * *not* `(display-mode: fullscreen)`, which some browsers also report while the
 * Fullscreen API is engaged — the two routes stay separately observable even
 * though they produce one layout. */
export const STANDALONE_QUERY = '(display-mode: standalone)';

/** Safari (desktop and iPadOS) still ships the Fullscreen API prefixed, and
 * Safari is the browser SPEC-033 exists for — so both spellings are read. */
interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** iOS Safari's pre-`display-mode` standalone flag, still the only signal on an
 * iPhone home-screen launch. */
interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export interface Presentation {
  /** The Fullscreen API is usable here. False on an iPhone (no element
   * full-screen at all), which is exactly where standalone is the route — so
   * the control hides rather than failing. */
  readonly canFullscreen: boolean;
  /** Reactive: the frame is currently full-screen. */
  readonly isFullscreen: boolean;
  /** Reactive: the app was launched as an installed standalone app. */
  readonly isStandalone: boolean;
  /** Reactive: the frame owns the whole display, by either route. */
  readonly ownsDisplay: boolean;
  /** Enter full-screen, or leave it if already there. Rejected requests (no
   * user gesture, a policy block) resolve quietly — `isFullscreen` simply
   * stays as it was, and the control keeps showing the true state. */
  toggleFullscreen(): Promise<void>;
  /** Detach the listeners (call from `onDestroy`). */
  dispose(): void;
}

export function createPresentation(): Presentation {
  let isFullscreen = $state(false);
  let isStandalone = $state(false);

  const expose = (
    canFullscreen: boolean,
    toggleFullscreen: () => Promise<void>,
    dispose: () => void,
  ): Presentation => ({
    canFullscreen,
    get isFullscreen() {
      return isFullscreen;
    },
    get isStandalone() {
      return isStandalone;
    },
    get ownsDisplay() {
      return isFullscreen || isStandalone;
    },
    toggleFullscreen,
    dispose,
  });

  // SSR / a test env without a DOM: nothing to observe and nothing to toggle.
  if (typeof document === 'undefined') {
    return expose(
      false,
      async () => {},
      () => {},
    );
  }

  const doc = document as PrefixedDocument;
  const frame = doc.documentElement as PrefixedElement;

  const fullscreenElement = (): Element | null =>
    doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

  const canFullscreen =
    (doc.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true) &&
    (typeof frame.requestFullscreen === 'function' ||
      typeof frame.webkitRequestFullscreen === 'function');

  async function toggle(): Promise<void> {
    try {
      if (fullscreenElement()) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        await (frame.requestFullscreen?.() ?? frame.webkitRequestFullscreen?.());
      }
    } catch {
      // A denied request is a normal outcome, not an error to surface: the
      // `fullscreenchange` listener below never fires, so the flag — and the
      // control reading it — stays truthful.
    }
  }

  isFullscreen = fullscreenElement() !== null;
  const onFullscreenChange = (): void => {
    isFullscreen = fullscreenElement() !== null;
  };
  doc.addEventListener('fullscreenchange', onFullscreenChange);
  doc.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // `navigator.standalone` is a launch-time fact and cannot change; the media
  // query can (a browser tab and an installed window share this code).
  const iosStandalone = (doc.defaultView?.navigator as StandaloneNavigator | undefined)?.standalone;
  isStandalone = iosStandalone === true;

  const mql =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(STANDALONE_QUERY)
      : null;
  const onStandalone = (e: MediaQueryListEvent): void => {
    isStandalone = e.matches || iosStandalone === true;
  };
  if (mql) {
    isStandalone = mql.matches || iosStandalone === true;
    mql.addEventListener('change', onStandalone);
  }

  return expose(canFullscreen, toggle, () => {
    doc.removeEventListener('fullscreenchange', onFullscreenChange);
    doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mql?.removeEventListener('change', onStandalone);
  });
}
