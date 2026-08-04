/** Shell media signals (SPEC-033 §7, DEC-052).
 *
 * **Screen width picks the layout. Pointer coarseness picks the hit-target
 * size. They are independent and are never read as one boolean.**
 *
 * The predecessor here was a single `MOBILE_MEDIA_QUERY =
 * '(max-width: 899px), (pointer: coarse)'` feeding one `isMobile` flag, which
 * switched the entire shell on either condition — so a touchscreen laptop at
 * 1920px and an iPad Pro in landscape both ran the phone layout with most of
 * the screen unused. The clause conflated two genuinely different needs: touch
 * needs bigger targets, a small screen needs a simpler layout.
 *
 * - `isNarrow` — which shell renders, `.shell` or `.mshell`. Width alone.
 * - `isCoarsePointer` — control sizing and spacing, and anything SPEC-033 §4
 *   adds for a coarse pointer, **in either shell**. Pointer alone.
 *
 * Two `matchMedia` queries rather than one, so the shell reacts live to
 * rotation, window resize, or a coarse-pointer device attaching — no polling.
 * Runs in a `.svelte.ts` module so both `$state` flags are reactive in
 * components.
 *
 * The hit-target *sizes* themselves are plain CSS — `theme/sizing.css` bumps
 * `--hit` / `--hit-inline` / `--hit-gap` under the same `(pointer: coarse)`
 * query, so no component needs to read `isCoarsePointer` merely to be sized.
 * The flag exists for the behavioural half: an affordance that must *become*
 * something else on touch rather than just grow (SPEC-033 §4).
 */

/** Layout signal: below this width the mobile shell renders. Width only —
 * `QuickSheetCard`'s own `@media (max-width: 899px)` expanded-sheet rule is
 * the same breakpoint stated in CSS. */
export const NARROW_LAYOUT_QUERY = '(max-width: 899px)';

/** Input signal: the primary pointer cannot hit small targets precisely.
 * Mirrored by `theme/sizing.css`, which must stay in step with it. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export interface ShellMedia {
  /** Reactive: true while the viewport is phone-width. Picks the **layout**
   * (`.mshell` vs `.shell`) and nothing else — never read as "is this touch". */
  readonly isNarrow: boolean;
  /** Reactive: true while the primary pointer is coarse (touch/stylus). Picks
   * **hit-target** treatment and nothing else — never read as "is this the
   * mobile layout". */
  readonly isCoarsePointer: boolean;
  /** Detach both media listeners (call from `onDestroy`). */
  dispose(): void;
}

export function createShellMedia(): ShellMedia {
  let isNarrow = $state(false);
  let isCoarsePointer = $state(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    // SSR / test env without matchMedia — default to a wide, precise-pointer
    // desktop, which is what the single-flag predecessor also defaulted to.
    return {
      get isNarrow() {
        return isNarrow;
      },
      get isCoarsePointer() {
        return isCoarsePointer;
      },
      dispose() {},
    };
  }

  const narrowMql = window.matchMedia(NARROW_LAYOUT_QUERY);
  const coarseMql = window.matchMedia(COARSE_POINTER_QUERY);
  isNarrow = narrowMql.matches;
  isCoarsePointer = coarseMql.matches;

  const onNarrow = (e: MediaQueryListEvent): void => {
    isNarrow = e.matches;
  };
  const onCoarse = (e: MediaQueryListEvent): void => {
    isCoarsePointer = e.matches;
  };
  narrowMql.addEventListener('change', onNarrow);
  coarseMql.addEventListener('change', onCoarse);

  return {
    get isNarrow() {
      return isNarrow;
    },
    get isCoarsePointer() {
      return isCoarsePointer;
    },
    dispose() {
      narrowMql.removeEventListener('change', onNarrow);
      coarseMql.removeEventListener('change', onCoarse);
    },
  };
}
