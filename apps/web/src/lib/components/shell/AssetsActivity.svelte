<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AssetRef, AssetStore, CampaignStore } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../../context';
  import { STARTER_TOKEN_REFS, STARTER_MAP_REF } from '../../assets';
  import RoomsPanel from './RoomsPanel.svelte';

  /**
   * Assets activity (Master Plan v2, R7.2): the starter pack browser
   * (Bundled), the referee-or-player URL-import flow that feeds the
   * Add-creature / My-token pickers (By URL), the Blaze-gated uploads
   * slot (visible, disabled, until [HUMAN] flips the storage upgrade), and
   * the multi-room manager (R17.2 / WI-20).
   */
  let {
    roomId,
    mapId,
    myUid,
    isGM,
  }: { roomId: string; mapId: string | null; myUid: string; isGM: boolean } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  type Tab = 'bundled' | 'url' | 'uploads';
  let activeTab = $state<Tab>('bundled');

  const bundledRefs: { ref: string; label: string }[] = [
    ...STARTER_TOKEN_REFS.map((ref) => ({ ref, label: basename(ref) })),
    { ref: STARTER_MAP_REF, label: basename(STARTER_MAP_REF) },
  ];

  function basename(ref: string): string {
    const file = ref.split('/').pop() ?? ref;
    return file.replace(/\.[a-z0-9]+$/i, '');
  }

  let savedRefs = $state<AssetRef[]>([]);
  onMount(() => store.subscribeAssetRefs(roomId, (items) => (savedRefs = items)));

  let urlInput = $state('');
  let labelInput = $state('');
  let previewOk = $state<boolean | null>(null); // null = not checked yet
  let saving = $state(false);

  const looksLikeUrl = $derived(/^https?:\/\/\S+$/i.test(urlInput.trim()));

  function onPreviewLoad(): void {
    previewOk = true;
  }
  function onPreviewError(): void {
    previewOk = false;
  }

  async function saveUrl(): Promise<void> {
    const ref = urlInput.trim();
    if (!looksLikeUrl || previewOk !== true || saving) return;
    saving = true;
    try {
      await store.saveAssetRef(roomId, {
        ref,
        ...(labelInput.trim() ? { label: labelInput.trim() } : {}),
        addedBy: myUid,
        ts: Date.now(),
      });
      urlInput = '';
      labelInput = '';
      previewOk = null;
    } finally {
      saving = false;
    }
  }

  function deleteSaved(id: string): void {
    void store.deleteAssetRef(roomId, id);
  }
</script>

<div class="assets-activity" data-testid="assets-activity">
  <div class="tabs" role="tablist">
    <button
      type="button"
      role="tab"
      data-testid="assets-tab-bundled"
      class:active={activeTab === 'bundled'}
      onclick={() => (activeTab = 'bundled')}>Bundled</button
    >
    <button
      type="button"
      role="tab"
      data-testid="assets-tab-url"
      class:active={activeTab === 'url'}
      onclick={() => (activeTab = 'url')}>By URL</button
    >
    <button
      type="button"
      role="tab"
      data-testid="assets-tab-uploads"
      class:active={activeTab === 'uploads'}
      onclick={() => (activeTab = 'uploads')}>Uploads</button
    >
  </div>

  {#if activeTab === 'bundled'}
    <div class="grid">
      {#each bundledRefs as item (item.ref)}
        <div class="tile" data-testid={`bundled-asset-${item.label}`}>
          <img src={assets.resolve(item.ref)} alt="" />
          <span>{item.label}</span>
        </div>
      {/each}
    </div>
  {:else if activeTab === 'url'}
    <div class="url-form">
      <label class="field">
        Image URL
        <input
          data-testid="asset-url-input"
          type="text"
          placeholder="https://example.com/goblin.png"
          bind:value={urlInput}
          oninput={() => (previewOk = null)}
        />
      </label>
      <label class="field">
        Label (optional)
        <input data-testid="asset-url-label" type="text" bind:value={labelInput} />
      </label>
      {#if looksLikeUrl}
        <div class="preview-row">
          <img
            data-testid="asset-url-preview"
            src={urlInput.trim()}
            alt="Preview"
            onload={onPreviewLoad}
            onerror={onPreviewError}
          />
          {#if previewOk === false}
            <span class="error" data-testid="asset-url-preview-error">Couldn't load that URL as an image.</span>
          {/if}
        </div>
      {/if}
      <button
        data-testid="asset-url-save"
        onclick={() => void saveUrl()}
        disabled={!looksLikeUrl || previewOk !== true || saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>

    <h2>Saved</h2>
    {#if savedRefs.length === 0}
      <p class="hint">Nothing saved yet — paste a URL above.</p>
    {:else}
      <ul class="saved-list">
        {#each savedRefs as saved (saved.id)}
          <li data-testid={`asset-saved-${saved.id}`}>
            <img src={assets.resolve(saved.ref)} alt="" />
            <span class="saved-label">{saved.label || saved.ref}</span>
            <button data-testid={`asset-saved-delete-${saved.id}`} onclick={() => deleteSaved(saved.id)}
              >✕</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <div class="uploads-note" data-testid="uploads-disabled-note">
      <p>
        Direct image uploads require the Firebase project's Blaze plan (Cloud Storage isn't
        available on the free Spark plan). This stays off until that upgrade — plus a budget
        alert — is done deliberately by a human, not flipped on automatically.
      </p>
      <p class="hint">Until then: use the Bundled starter pack or paste an image URL instead.</p>
    </div>
  {/if}

  {#if mapId}
    <div class="rooms-section">
      <RoomsPanel {roomId} {mapId} {isGM} />
    </div>
  {/if}
</div>

<style>
  .assets-activity {
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
    box-sizing: border-box;
  }
  .tabs {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .tabs button {
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .tabs button.active {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.6rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--bg-panel);
    font-size: 0.72rem;
  }
  .tile img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .url-form {
    max-width: 420px;
    margin-bottom: 1.25rem;
  }
  .field {
    display: block;
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
  }
  .field input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.3rem;
    padding: 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
  }
  .preview-row {
    margin-bottom: 0.6rem;
  }
  .preview-row img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .error {
    display: block;
    color: var(--failure);
    font-size: 0.78rem;
  }
  button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  h2 {
    font-size: 0.95rem;
    margin: 0 0 0.5rem;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }
  .saved-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 420px;
  }
  .saved-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-panel);
  }
  .saved-list img {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  .saved-label {
    flex: 1;
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .saved-list button {
    padding: 0.15rem 0.4rem;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: inherit;
    font-weight: normal;
  }
  .uploads-note {
    max-width: 480px;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .rooms-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--line);
  }
</style>
