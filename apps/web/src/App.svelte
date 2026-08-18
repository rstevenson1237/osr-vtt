<script lang="ts">
  import { setContext } from 'svelte';
  import { AppRoot, MULTIPLAYER, getAssetStore } from './lib/firebase/client';
  import { ASSET_STORE_KEY, SESSION_MODE_KEY, type SessionMode } from './lib/context';

  // Which build this is, and what it renders, both come from the same module
  // the store comes from (SPEC-041 §§3, 6). In a local build Vite resolves that
  // import to `client.local.ts` instead, so nothing below — and nothing in the
  // bundle — reaches Firebase.
  setContext(ASSET_STORE_KEY, getAssetStore());
  setContext(SESSION_MODE_KEY, { multiplayer: MULTIPLAYER } satisfies SessionMode);
</script>

<main>
  <AppRoot />
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: var(--bg-root);
    color: var(--text);
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
    /* Root-pinned: a drag that misses a scrollable pane inside the shell must
       not rubber-band the whole document (SPEC-033 §1). */
    overscroll-behavior: none;
  }

  /* Full-screen is the app *frame*, not the map canvas (SPEC-033 §5), so the
     element that goes full-screen is the document root and the layout below it
     is unchanged — `dvh` simply resolves to the whole display. Only the paint
     needs saying: the UA's default backdrop is black, which would show as a
     letterbox edge on a display whose aspect ratio differs from the window's. */
  :global(:root:fullscreen),
  :global(:root::backdrop) {
    background: var(--bg-root);
  }

  main {
    /* `dvh` is the small viewport — sized with a mobile browser's URL bar
       collapsed. A bare `100vh` here made the document taller than what's
       actually on screen, so it scrolled and the bottom-pinned mobile chrome
       rode out from under the bar (SPEC-033 §1). Fallback first: `dvh` is
       silently invalid in browsers that don't support it. */
    min-height: 100vh;
    min-height: 100dvh;
  }
</style>
