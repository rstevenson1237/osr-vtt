<script lang="ts">
  import { setContext } from 'svelte';
  import { getStore } from './lib/firebase/client';
  import { assetStore } from './lib/assets';
  import { CAMPAIGN_STORE_KEY, ASSET_STORE_KEY } from './lib/context';
  import { route } from './lib/routes';
  import Lobby from './lib/components/Lobby.svelte';
  import RoomShell from './lib/components/RoomShell.svelte';

  // The one call in the whole component tree that touches a concrete
  // CampaignStore implementation (Plan §1.3) — everything below only ever
  // sees the interface, via context.
  setContext(CAMPAIGN_STORE_KEY, getStore());
  setContext(ASSET_STORE_KEY, assetStore);
</script>

<main>
  {#if $route.name === 'room'}
    <!-- Keyed on roomId: RoomShell's onMount sets up its subscriptions once
    per instance (Plan §7 Phase 5 — `.vttcamp` import navigates from one
    room straight into another while staying on the 'room' route, which
    would otherwise reuse the same instance and leave every subscription
    bound to the room it left). -->
    {#key $route.roomId}
      <RoomShell roomId={$route.roomId} />
    {/key}
  {:else}
    <Lobby />
  {/if}
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
