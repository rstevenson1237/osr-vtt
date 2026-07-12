/** Mobile / tablet layout detection (Master Plan v2, R1.8).
 *
 * Mobile mode triggers below 900px **or** on a coarse pointer (touch tablet at
 * any width). A single `matchMedia` query watches both so the shell reacts live
 * to rotation, window resize, or a coarse-pointer device attaching — no polling.
 * Runs in a `.svelte.ts` module so the `$state` flag is reactive in components.
 */
export const MOBILE_MEDIA_QUERY = '(max-width: 899px), (pointer: coarse)';

export interface LayoutMode {
  /** Reactive: true while the viewport is phone/tablet-sized or coarse-pointer. */
  readonly isMobile: boolean;
  /** Detach the media listener (call from `onDestroy`). */
  dispose(): void;
}

export function createLayoutMode(): LayoutMode {
  let isMobile = $state(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    // SSR / test env without matchMedia — default to desktop, nothing to watch.
    return { get isMobile() { return isMobile; }, dispose() {} };
  }

  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  isMobile = mql.matches;
  const onChange = (e: MediaQueryListEvent): void => {
    isMobile = e.matches;
  };
  mql.addEventListener('change', onChange);

  return {
    get isMobile() {
      return isMobile;
    },
    dispose() {
      mql.removeEventListener('change', onChange);
    },
  };
}
