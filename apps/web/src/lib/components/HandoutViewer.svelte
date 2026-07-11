<script lang="ts">
  import { getContext } from 'svelte';
  import type { AssetStore, HandoutState } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY } from '../context';

  /**
   * The "reveal image to players" surface (Plan §7 Phase 5) — every seat
   * renders this the same way; there's nothing GM-only here, since by the
   * time `Room.handout` is non-null the image is deliberately public.
   */
  let { handout }: { handout: HandoutState } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
</script>

{#if handout}
  <div class="handout-viewer" data-testid="handout-viewer">
    <img data-testid="handout-image" src={assets.resolve(handout.ref)} alt={handout.title ?? 'Handout'} />
    {#if handout.title}
      <p class="caption" data-testid="handout-caption">{handout.title}</p>
    {/if}
  </div>
{/if}

<style>
  .handout-viewer {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(10, 8, 6, 0.92);
  }
  .handout-viewer img {
    max-width: 90%;
    max-height: 80%;
    object-fit: contain;
    border-radius: 6px;
    box-shadow: 0 0 2rem rgba(0, 0, 0, 0.6);
  }
  .caption {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.85;
  }
</style>
