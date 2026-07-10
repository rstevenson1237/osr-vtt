<script lang="ts">
  import { getContext } from 'svelte';
  import type { AssetStore, Token } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY } from '../context';

  let { tokens }: { tokens: Token[] } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
</script>

<div class="board" data-testid="encounter-board">
  {#if tokens.length === 0}
    <p class="empty">No tokens on the table yet.</p>
  {/if}
  {#each tokens as token (token.id)}
    <div class="card" data-testid={`board-token-${token.id}`}>
      <img src={assets.resolve(token.imageRef)} alt="" />
      <span data-testid={`board-token-pos-${token.id}`}
        >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
      >
    </div>
  {/each}
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    padding: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-content: flex-start;
    overflow: auto;
  }
  .empty {
    opacity: 0.6;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    width: 96px;
  }
  .card img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
  }
  .card span {
    font-size: 0.75rem;
    opacity: 0.7;
  }
</style>
