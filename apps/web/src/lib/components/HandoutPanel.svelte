<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import type { AssetStore, CampaignStore, HandoutRecord, Unsubscribe } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, ASSET_STORE_KEY } from '../context';

  /**
   * GM-only handout library + "reveal image to players" flow (Plan §7 Phase
   * 5). Saved handouts live in `gmPrivate` — the same physical-denial
   * pattern as the Blind Drawer (Plan §3) keeps a prepped library off
   * players' clients. Revealing copies a ref onto the player-readable
   * `Room.handout` pointer, which `HandoutViewer` shows to everyone.
   */
  let {
    roomId,
    isGM,
    revealedRef,
  }: {
    roomId: string;
    isGM: boolean;
    revealedRef: string | null;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  let library = $state<HandoutRecord[]>([]);
  let title = $state('');
  let ref = $state('');

  let unsub: Unsubscribe | null = null;
  onMount(() => {
    // Only the GM may read gmPrivate; subscribing as a player would be denied.
    if (isGM) unsub = store.subscribeHandoutLibrary(roomId, (h) => (library = h));
  });
  onDestroy(() => unsub?.());

  async function save(): Promise<void> {
    if (!ref.trim()) return;
    await store.saveHandout(roomId, {
      ts: Date.now(),
      title: title.trim() || 'Untitled handout',
      ref: ref.trim(),
    });
    title = '';
    ref = '';
  }

  function reveal(handout: HandoutRecord): void {
    void store.revealHandout(roomId, handout);
  }

  function hide(): void {
    void store.hideHandout(roomId);
  }

  function remove(handoutId: string): void {
    void store.deleteHandout(roomId, handoutId);
  }
</script>

{#if isGM}
  <div class="handout-panel" data-testid="handout-panel">
    <h2>Handouts</h2>
    <p class="hint">Saved images stay hidden from players until you reveal one.</p>

    <input class="title" data-testid="handout-title" placeholder="Title" bind:value={title} />
    <div class="row">
      <input
        class="ref"
        data-testid="handout-ref"
        placeholder="Bundled ref or image URL"
        bind:value={ref}
      />
      <button data-testid="handout-save" onclick={() => void save()} disabled={!ref.trim()}
        >Save</button
      >
    </div>

    {#if revealedRef}
      <button class="hide-btn" data-testid="handout-hide" onclick={hide}>Hide revealed image</button>
    {/if}

    <ul class="handout-list">
      {#each library as handout (handout.id)}
        <li data-testid={`handout-row-${handout.id}`}>
          <img class="thumb" src={assets.resolve(handout.ref)} alt={handout.title} />
          <span class="handout-title">{handout.title}</span>
          {#if revealedRef === handout.ref}
            <span class="tag">revealed</span>
          {:else}
            <button data-testid={`handout-reveal-${handout.id}`} onclick={() => reveal(handout)}
              >Reveal</button
            >
          {/if}
          <button
            class="delete"
            data-testid={`handout-delete-${handout.id}`}
            onclick={() => remove(handout.id)}>✕</button
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .handout-panel {
    background: #201a24;
    border: 1px solid #3a2f4a;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .handout-panel h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .hint {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .title,
  .ref {
    box-sizing: border-box;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    font-size: 0.8rem;
  }
  .title {
    width: 100%;
    margin-bottom: 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }
  .ref {
    flex: 1;
  }
  button {
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #362d20;
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .hide-btn {
    width: 100%;
    margin-bottom: 0.4rem;
  }
  .handout-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .handout-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    background: #14110d;
  }
  .thumb {
    width: 2rem;
    height: 2rem;
    object-fit: cover;
    border-radius: 3px;
  }
  .handout-title {
    flex: 1;
  }
  .tag {
    font-size: 0.65rem;
    opacity: 0.7;
  }
  .delete {
    color: #e08080;
  }
</style>
