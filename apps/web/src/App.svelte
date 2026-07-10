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
    <RoomShell roomId={$route.roomId} />
  {:else}
    <Lobby />
  {/if}
</main>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: #1b1712;
    color: #ece6d8;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }

  main {
    min-height: 100vh;
  }
</style>
