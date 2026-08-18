<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AssetRef, AssetStore, CampaignStore, GameMap, RoomUpload } from '@osr-vtt/shared';
  import {
    ALLOWED_UPLOAD_CONTENT_TYPES,
    MAX_ROOM_UPLOAD_BYTES_SOFT,
    MAX_UPLOAD_BYTES,
    atRoomUploadSoftCap,
    checkUpload,
    formatBytes,
  } from '@osr-vtt/shared';
  import {
    ASSET_STORE_KEY,
    CAMPAIGN_STORE_KEY,
    SESSION_MODE_KEY,
    type SessionMode,
  } from '../../context';
  import { STARTER_TOKEN_REFS, STARTER_MAP_REF } from '../../assets';
  import RoomsPanel from './RoomsPanel.svelte';
  import MapsPanel from './MapsPanel.svelte';
  import BackgroundsPanel from './BackgroundsPanel.svelte';

  /**
   * Assets activity (Master Plan v2, R7.2): the starter pack browser
   * (Bundled), the referee-or-player URL-import flow that feeds the
   * Add-creature / My-token pickers (By URL), the Blaze-gated uploads
   * slot (visible, disabled, until [HUMAN] flips the storage upgrade), the
   * maps manager, and the multi-room manager (R17.2 / WI-20).
   *
   * Maps moved here from Session settings: which maps a session has is a
   * question about its assets, and it sits naturally beside the room list,
   * which is scoped to a map. The active map's **backgrounds** followed them
   * (SPEC-038 §5), for the same reason and out of the same Session settings.
   */
  let {
    roomId,
    mapId,
    map,
    myUid,
    isGM,
  }: {
    roomId: string;
    mapId: string | null;
    /** The active map itself, which `BackgroundsPanel` needs for its grid
     * dimensions and its solid background colour — `mapId` alone would mean a
     * second subscription to the doc `RoomShell` already holds. */
    map: GameMap | null;
    myUid: string;
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const { multiplayer } = getContext<SessionMode>(SESSION_MODE_KEY);

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

  // ---- Uploads (SPEC-034 §3.2) — client-side friction, NOT a boundary.
  //
  // The boundary is `firebase/storage.rules`: per-object size, an image
  // content-type allowlist, the room/uid path shape, and a membership check.
  // Everything below refuses earlier and more legibly than the rules would,
  // and the per-room total it refuses against is a number this client believes
  // rather than one anything enforces — an aggregate needs a running total and
  // RULE-010 forbids the trusted writer that would keep one. Same shape and
  // same honesty as the Lobby's `MAX_ROOMS_SOFT`.
  //
  // `assets.upload` being present is how this component knows uploads are live
  // at all: `BundledAssetStore` simply does not have it, so a Spark build falls
  // through to the disabled note without ever reading an env var.
  const uploadsEnabled = $derived(
    typeof assets.upload === 'function' && typeof assets.listRoomUploads === 'function',
  );

  let uploads = $state<RoomUpload[]>([]);
  let uploadsLoaded = $state(false);
  let uploadBusy = $state(false);
  let uploadError = $state<string | null>(null);

  const usedBytes = $derived(uploads.reduce((total, u) => total + u.bytes, 0));
  const overSoftCap = $derived(atRoomUploadSoftCap(usedBytes));

  async function refreshUploads(): Promise<void> {
    if (!assets.listRoomUploads) return;
    uploads = await assets.listRoomUploads(roomId);
    uploadsLoaded = true;
  }

  // Listing costs a storage round-trip per object, so it happens when the tab
  // is actually opened rather than on mount.
  $effect(() => {
    if (activeTab === 'uploads' && uploadsEnabled && !uploadsLoaded) void refreshUploads();
  });

  async function onUploadPicked(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so re-picking the same file fires `change` again
    if (!file || !assets.upload || uploadBusy) return;

    const verdict = checkUpload(file, usedBytes);
    if (!verdict.ok) {
      uploadError = verdict.message ?? 'That file was refused.';
      return;
    }

    uploadBusy = true;
    uploadError = null;
    try {
      await assets.upload(file, { roomId, uid: myUid });
      await refreshUploads();
    } catch {
      // The rules refuse the same writes this client does, plus anything a
      // stale membership or a revoked seat makes invalid — so a failure here
      // is expected traffic, not an impossible state.
      uploadError = 'Upload refused. Check the file is an image within the size limit.';
    } finally {
      uploadBusy = false;
    }
  }

  async function removeUpload(path: string): Promise<void> {
    if (!assets.deleteUpload) return;
    await assets.deleteUpload(path);
    await refreshUploads();
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
            <span class="error" data-testid="asset-url-preview-error"
              >Couldn't load that URL as an image.</span
            >
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
            <button
              data-testid={`asset-saved-delete-${saved.id}`}
              onclick={() => deleteSaved(saved.id)}>✕</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {:else if !uploadsEnabled}
    <div class="uploads-note" data-testid="uploads-disabled-note">
      {#if multiplayer}
        <!-- "the hosted project" rather than naming Firebase: a local build
        carries both branches of this `{#if}` in its bundle, and the one thing
        SPEC-041 §6 asks to be mechanically greppable is that no Firebase
        anything survives into it. The sentence means the same. -->
        <p>
          Direct image uploads require the hosted project's Blaze plan (Cloud Storage isn't
          available on the free Spark plan). This stays off until that upgrade — plus a budget alert
          — is done deliberately by a human, not flipped on automatically.
        </p>
      {:else}
        <!-- A local build has no hosted bucket to upgrade and no project to
        name (SPEC-041 §§4, 6) — the reason uploads are off here is simply that
        there is nowhere to upload to. -->
        <p>
          A local campaign has no server to upload to, so images come from the bundled starter pack
          or from a URL you paste.
        </p>
      {/if}
      <p class="hint">Until then: use the Bundled starter pack or paste an image URL instead.</p>
    </div>
  {:else}
    <div class="uploads-panel">
      <div class="usage" data-testid="uploads-usage" class:over={overSoftCap}>
        <span class="usage-figure">
          {formatBytes(usedBytes)} of {formatBytes(MAX_ROOM_UPLOAD_BYTES_SOFT)} used
        </span>
        <span class="hint">
          A guide, not a limit — nothing enforces a per-room total on this stack. Each image is
          capped at {formatBytes(MAX_UPLOAD_BYTES)} and must be an image; those two the server really
          does enforce.
        </span>
      </div>

      <label class="upload-picker">
        <input
          data-testid="asset-upload-input"
          type="file"
          accept={ALLOWED_UPLOAD_CONTENT_TYPES.join(',')}
          disabled={uploadBusy}
          onchange={(event) => void onUploadPicked(event)}
        />
        {uploadBusy ? 'Uploading…' : 'Choose an image'}
      </label>

      {#if uploadError}
        <p class="error" data-testid="asset-upload-error">{uploadError}</p>
      {/if}

      {#if !uploadsLoaded}
        <p class="hint">Loading this room's uploads…</p>
      {:else if uploads.length === 0}
        <p class="hint" data-testid="uploads-empty">Nothing uploaded to this room yet.</p>
      {:else}
        <ul class="saved-list">
          {#each uploads as upload (upload.path)}
            <li data-testid={`asset-upload-${upload.path}`}>
              <img src={upload.url} alt="" />
              <span class="saved-label">{upload.path.split('/').pop()}</span>
              <span class="hint">{formatBytes(upload.bytes)}</span>
              <button
                data-testid={`asset-upload-delete-${upload.path}`}
                disabled={upload.uploadedByUid !== myUid && !isGM}
                onclick={() => void removeUpload(upload.path)}>✕</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="maps-section">
    <h2>Maps</h2>
    <MapsPanel {roomId} activeMapId={mapId} />
  </div>

  <div class="backgrounds-section">
    <h2>Background</h2>
    <BackgroundsPanel {roomId} {map} {isGM} />
  </div>

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
    padding-left: calc(1rem + var(--sheet-gutter-left, 0px));
    padding-right: calc(1rem + var(--sheet-gutter-right, 0px));
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
  .uploads-panel {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    max-width: 480px;
  }
  .usage {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-panel);
  }
  /* The soft cap tints rather than blocks: it is friction, and the UI should
     not dress it up as a denial. */
  .usage.over {
    border-color: var(--complication);
  }
  .usage-figure {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .upload-picker {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    align-self: flex-start;
  }
  .maps-section,
  .backgrounds-section,
  .rooms-section {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--line);
  }
  .maps-section h2,
  .backgrounds-section h2 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
  }
</style>
