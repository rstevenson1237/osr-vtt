<script lang="ts">
  import { TokenPickerDialogStrings as S } from '../../strings/TokenPickerDialog';
  import { getContext, onMount } from 'svelte';
  import {
    GEN_TOKEN_PALETTE,
    genColorToken,
    genTokenDataUri,
    roomImageRef,
    type AssetRef,
    type AssetStore,
    type CampaignStore,
    type RoomImage,
  } from '@osr-vtt/shared';
  import Dialog from './Dialog.svelte';
  import type { TokenPickerRequest, TokenPickerResult } from '../../shell/dialogs.svelte';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../../context';
  import { STARTER_TOKEN_REFS } from '../../assets';
  import { resizeToWebp } from '../../image-resize';

  /**
   * Add-creature (GM) / My-token (player) — Master Plan v2, R7.3. Replaces
   * the old debug "drop starter token" button: pick a ref from the bundled
   * starter pack, a saved URL (Assets activity "By URL" tab, R7.2), or fall
   * back to a generated default disc (R7.1) — then, for `mode: 'creature'`,
   * what it is called, how many, and what to group them as (SPEC-040 §2).
   */
  let {
    request,
    onConfirm,
    onCancel,
  }: {
    request: TokenPickerRequest;
    onConfirm: (value: TokenPickerResult) => void;
    onCancel: () => void;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  type Tab = 'bundled' | 'saved' | 'images' | 'generate';

  let activeTab = $state<Tab>('bundled');
  let selectedBundled = $state<string>(STARTER_TOKEN_REFS[0] ?? '');
  let selectedSaved = $state<string | null>(null);
  let savedRefs = $state<AssetRef[]>([]);
  // Portrait images stored in the room itself (SPEC-057 §6) — resized to at
  // most 256×256 WebP here, before anything is written.
  let roomImages = $state<RoomImage[]>([]);
  let selectedImage = $state<string | null>(null);
  let imageBusy = $state(false);
  let imageError = $state<string | null>(null);
  let gmUid = $state<string | null>(null);
  const myUid = store.currentUid();
  let count = $state(1);
  let groupName = $state('');
  // SPEC-040 §2: the creature's name, and the quantity beside it. Empty is a
  // legitimate answer — the caller then writes no `Token.name` and the
  // `creatureLabel` fallback keeps doing what it did before v28.
  let creatureName = $state('');

  onMount(() => {
    const unsubs = [
      store.subscribeAssetRefs(request.roomId, (items) => (savedRefs = items)),
      store.subscribeImages(request.roomId, (items) => {
        roomImages = items;
        if (selectedImage && !items.some((i) => roomImageRef(i.id) === selectedImage)) {
          selectedImage = null;
        }
      }),
      store.subscribeRoom(request.roomId, (room) => (gmUid = room?.gmUid ?? null)),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  });

  /** The creator or the referee may remove an image — the same pair the
   * rules admit, shown here so nobody is offered a button that will fail. */
  function canDeleteImage(image: RoomImage): boolean {
    return myUid !== null && (image.by === myUid || gmUid === myUid);
  }

  async function addImage(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    imageBusy = true;
    imageError = null;
    try {
      // `resizeToWebp`'s errors are written for the user; the store's are not.
      let image: Awaited<ReturnType<typeof resizeToWebp>>;
      try {
        image = await resizeToWebp(file);
      } catch (err) {
        imageError = err instanceof Error ? err.message : 'That image could not be read.';
        return;
      }
      try {
        selectedImage = roomImageRef(await store.putImage(request.roomId, image));
      } catch {
        imageError = 'That image could not be stored.';
      }
    } finally {
      imageBusy = false;
    }
  }

  async function removeImage(image: RoomImage): Promise<void> {
    imageError = null;
    try {
      await store.deleteImage(request.roomId, image.id);
    } catch {
      imageError = 'That image could not be removed.';
    }
  }

  // Generate-default tab (Plan R18.1): pre-fills the auto letter/color the
  // caller would otherwise fall back to, then lets the referee/player
  // override either. Left untouched, the picker still resolves to `''` (the
  // caller's own default-ref sentinel) so per-context behavior — the seat
  // letter progression, the per-group A–Z creature batch — is unchanged.
  // Re-mounted per request (guarded by `{#if dialogs.tokenPicker}`), so seeding
  // once from `request` is intentional.
  // eslint-disable-next-line svelte/valid-compile
  const autoLabel = request.genDefaultLabel ?? 'A';
  let genLabel = $state(autoLabel);
  let pickedColor = $state<string | null>(null);
  let labelCustomized = $state(false);

  /** The colour the preview shows and the batch takes. A creature's auto
   * colour is seeded from the **name being typed** (SPEC-040 §4 — the name
   * identifies the kind now, where the type letter used to), so the disc
   * follows the field live; a portrait keeps its caller-supplied seed. A
   * picked swatch wins over both. */
  const autoColor = $derived(
    genColorToken(
      request.mode === 'creature'
        ? creatureName.trim() || 'creature'
        : (request.genDefaultColorSeed ?? 'token-picker-preview'),
    ),
  );
  const genColor = $derived(pickedColor ?? autoColor);

  function setGenLabel(value: string): void {
    genLabel = value;
    labelCustomized = true;
  }

  function setGenColor(value: string): void {
    pickedColor = value;
  }

  // A real pick (bundled/saved) is a concrete ref; the "generate" tab never
  // produces one at all (SPEC-048 §5) — its label/colour ride separately in
  // `TokenPickerResult.genLabel`/`genColor` instead of being baked into a
  // `gen:disc:` ref, so a customized *character* still collapses the whole
  // batch onto one shared symbol (every token wears the typed one, which is
  // what the referee asked for) while a customized **colour** does not — or
  // picking a colour for three goblins would silently take away the A/B/C
  // SPEC-040 §4 is about.
  const currentRef = $derived(
    activeTab === 'bundled'
      ? selectedBundled
      : activeTab === 'saved'
        ? (selectedSaved ?? '')
        : activeTab === 'images'
          ? (selectedImage ?? '')
          : '',
  );
  const canConfirm = $derived(
    (activeTab !== 'saved' || selectedSaved !== null) &&
      (activeTab !== 'images' || selectedImage !== null),
  );
  const previewSrc = $derived(
    activeTab !== 'generate' && currentRef
      ? assets.resolve(currentRef)
      : genTokenDataUri(genLabel.trim() || autoLabel, genColor),
  );

  function basename(ref: string): string {
    const file = ref.split('/').pop() ?? ref;
    return file.replace(/\.[a-z0-9]+$/i, '');
  }

  // Suggests a group name the moment the GM adds a second creature — a
  // convenience default, not a lock (still just a plain text input the GM can
  // overwrite). The typed name leads now that there is one (SPEC-040 §2:
  // "Goblin" ×3 wants to be the Goblins), and the chosen ref's basename is
  // the fallback it always was.
  $effect(() => {
    if (request.mode !== 'creature' || count < 2 || groupName.trim()) return;
    const base = creatureName.trim() || (currentRef ? basename(currentRef) : 'Creatures');
    groupName = /s$/i.test(base) ? base : `${base}s`;
  });

  function submit(e: Event): void {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm({
      ref: currentRef,
      count: Math.max(1, Math.floor(count)),
      groupName: groupName.trim(),
      name: request.mode === 'creature' ? creatureName.trim() : '',
      // Only when the character field was actually touched — an untouched
      // field means "keep using the caller's own per-token/group default",
      // exactly as leaving `ref` at `''` does.
      ...(activeTab === 'generate' && labelCustomized
        ? { genLabel: genLabel.trim() || autoLabel }
        : {}),
      ...(activeTab === 'generate' && pickedColor ? { genColor: pickedColor } : {}),
    });
  }
</script>

<Dialog title={request.title} onClose={onCancel} testid="token-picker-dialog">
  <form id="token-picker-form" onsubmit={submit}>
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        data-testid="token-picker-tab-bundled"
        class:active={activeTab === 'bundled'}
        onclick={() => (activeTab = 'bundled')}>Bundled</button
      >
      <button
        type="button"
        role="tab"
        data-testid="token-picker-tab-saved"
        class:active={activeTab === 'saved'}
        onclick={() => (activeTab = 'saved')}>Saved URLs</button
      >
      <button
        type="button"
        role="tab"
        data-testid="token-picker-tab-images"
        class:active={activeTab === 'images'}
        onclick={() => (activeTab = 'images')}>Images</button
      >
      <button
        type="button"
        role="tab"
        data-testid="token-picker-tab-generate"
        class:active={activeTab === 'generate'}
        onclick={() => (activeTab = 'generate')}>Generate default</button
      >
    </div>

    {#if activeTab === 'bundled'}
      <div class="grid">
        {#each STARTER_TOKEN_REFS as ref (ref)}
          <button
            type="button"
            class="option"
            data-testid={`asset-option-bundled-${basename(ref)}`}
            class:selected={selectedBundled === ref}
            onclick={() => (selectedBundled = ref)}
          >
            <img src={assets.resolve(ref)} alt="" />
            <span>{basename(ref)}</span>
          </button>
        {/each}
      </div>
    {:else if activeTab === 'saved'}
      {#if savedRefs.length === 0}
        <p class="hint">
          No saved URLs yet — paste one in the Assets activity's "By URL" tab, then it'll show up
          here.
        </p>
      {:else}
        <div class="grid">
          {#each savedRefs as saved (saved.id)}
            <button
              type="button"
              class="option"
              data-testid={`asset-option-saved-${saved.id}`}
              class:selected={selectedSaved === saved.ref}
              onclick={() => (selectedSaved = saved.ref)}
            >
              <img src={assets.resolve(saved.ref)} alt="" />
              <span>{saved.label || basename(saved.ref)}</span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'images'}
      <p class="hint">
        Pick an image from this device. It is shrunk to at most 256×256 and stored in the room, so
        everyone at the table sees it. There is no room-wide limit enforced — please keep it to the
        portraits you use.
      </p>
      <label class="upload" class:busy={imageBusy}>
        {imageBusy ? 'Adding…' : 'Add image…'}
        <input
          data-testid="token-picker-image-input"
          type="file"
          accept="image/*"
          disabled={imageBusy}
          onchange={addImage}
        />
      </label>
      {#if imageError}
        <p class="error" role="alert" data-testid="token-picker-image-error">{imageError}</p>
      {/if}
      {#if roomImages.length === 0}
        <p class="hint" data-testid="token-picker-images-empty">{S.noImagesInThisRoom}</p>
      {:else}
        <div class="grid">
          {#each roomImages as image (image.id)}
            <div class="image-cell">
              <button
                type="button"
                class="option"
                data-testid={`asset-option-image-${image.id}`}
                class:selected={selectedImage === roomImageRef(image.id)}
                onclick={() => (selectedImage = roomImageRef(image.id))}
              >
                <img src={assets.resolve(roomImageRef(image.id))} alt="" />
                <span>{image.w}×{image.h}</span>
              </button>
              {#if canDeleteImage(image)}
                <button
                  type="button"
                  class="remove"
                  aria-label={S.removeImage}
                  data-testid={`token-picker-image-delete-${image.id}`}
                  onclick={() => removeImage(image)}>×</button
                >
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <p class="hint">
        A colored circled letter, assigned automatically (players by seat order, creatures A, B, C…
        within their group) — no art required. Customize the character or color below, or leave both
        alone to keep the auto default.
      </p>
      <div class="gen-row">
        <img class="preview" src={previewSrc} alt={S.generatedDefaultTokenPreview} />
        <div class="gen-fields">
          <label class="field gen-char">
            Character
            <input
              data-testid="token-picker-gen-label"
              type="text"
              maxlength="6"
              value={genLabel}
              oninput={(e) => setGenLabel((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div class="swatches" role="group" aria-label={S.color}>
            {#each GEN_TOKEN_PALETTE as swatch, i (swatch)}
              <button
                type="button"
                class="sw"
                class:on={genColor === swatch}
                style={`background:${swatch}`}
                aria-label={`Use color ${swatch}`}
                data-testid={`token-picker-gen-swatch-${i}`}
                onclick={() => setGenColor(swatch)}
              ></button>
            {/each}
            <input
              class="sw-custom"
              data-testid="token-picker-gen-custom-color"
              type="color"
              aria-label={S.customColor}
              oninput={(e) => setGenColor((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
        </div>
      </div>
    {/if}

    {#if request.mode === 'creature'}
      <label class="field">
        Name
        <input
          data-testid="token-picker-name"
          type="text"
          placeholder={S.goblin}
          bind:value={creatureName}
        />
      </label>
      <label class="field">
        Quantity
        <input data-testid="token-picker-count" type="number" min="1" max="20" bind:value={count} />
      </label>
      {#if count > 1}
        <label class="field">
          Group name
          <input data-testid="token-picker-group-name" type="text" bind:value={groupName} />
        </label>
      {/if}
    {/if}
  </form>
  {#snippet footer()}
    <button type="button" class="ghost" data-testid="token-picker-cancel" onclick={onCancel}
      >{S.cancel}</button
    >
    <button
      type="submit"
      form="token-picker-form"
      class="primary"
      data-testid="token-picker-confirm"
      disabled={!canConfirm}
    >
      {request.confirmLabel}
    </button>
  {/snippet}
</Dialog>

<style>
  .tabs {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
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
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
    font-size: 0.7rem;
  }
  .option.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .option img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .preview {
    display: block;
    width: 64px;
    height: 64px;
    margin: 0.5rem 0;
    flex: 0 0 auto;
  }
  .gen-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  .gen-fields {
    flex: 1 1 auto;
    min-width: 0;
  }
  .swatches {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.6rem;
    align-items: center;
  }
  .sw {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .sw.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--bg-panel);
  }
  .sw-custom {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px dashed var(--line-strong);
    padding: 0;
    background: transparent;
    cursor: pointer;
  }
  .upload {
    display: inline-block;
    padding: 0.35rem 0.7rem;
    margin-bottom: 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .upload.busy {
    opacity: 0.6;
    cursor: default;
  }
  .upload input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .image-cell {
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--bg-panel);
    color: inherit;
    cursor: pointer;
    line-height: 1;
  }
  .error {
    color: var(--danger, #c0392b);
    font-size: 0.78rem;
    margin: 0 0 0.6rem;
  }
  .hint {
    font-size: 0.78rem;
    opacity: 0.75;
    margin: 0 0 0.75rem;
  }
  .field {
    display: block;
    font-size: 0.85rem;
    margin-top: 0.6rem;
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
  button.primary {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button.ghost {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
</style>
