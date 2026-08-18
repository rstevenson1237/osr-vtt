<script lang="ts">
  import { setContext } from 'svelte';
  import { getStore } from '../firebase/client';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { route } from '../routes';
  import Lobby from './Lobby.svelte';
  import RoomShell from './RoomShell.svelte';

  // The one call in the hosted component tree that touches a concrete
  // CampaignStore implementation (Plan §1.3, RULE-001) — everything below only
  // ever sees the interface, via context. A local build never mounts this
  // component: `client.local.ts` names `LocalRoot` instead (SPEC-041 §6).
  setContext(CAMPAIGN_STORE_KEY, getStore());
</script>

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
