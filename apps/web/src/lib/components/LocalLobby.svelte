<script lang="ts">
  import type { LocalStore } from '@osr-vtt/shared';
  import {
    campaignFileName,
    downloadCampaignFile,
    hasFileSystemAccess,
    pickCampaignToCreate,
    pickCampaignToOpen,
  } from '../local/campaign-file';
  import { createLocalCampaign, openLocalCampaign } from '../firebase/client.local';

  /**
   * The local lobby (SPEC-041 §5): **Open campaign…** and **New campaign…**,
   * and nothing else. No sign-in, no rooms list, no join code — a local build
   * has no account to sign into, no index to list and nobody to invite.
   */
  let { onOpened }: { onOpened: (session: { store: LocalStore; roomId: string }) => void } =
    $props();

  const handles = hasFileSystemAccess();

  let campaignName = $state('');
  let busy = $state(false);
  let error = $state('');
  let fileInput = $state<HTMLInputElement | null>(null);

  async function run(open: () => Promise<{ store: LocalStore; roomId: string } | null>) {
    if (busy) return;
    busy = true;
    error = '';
    try {
      const session = await open();
      if (session) onOpened(session);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not open that campaign';
    } finally {
      busy = false;
    }
  }

  function openCampaign(): void {
    if (!handles) {
      fileInput?.click();
      return;
    }
    void run(async () => {
      const file = await pickCampaignToOpen();
      return file ? await openLocalCampaign(file) : null;
    });
  }

  /** The fallback path: no handle, so the bytes come from a file input and the
   * campaign is saved back by downloading it. */
  function onFileChosen(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const chosen = input.files?.[0];
    input.value = '';
    if (!chosen) return;
    void run(async () => {
      const bytes = new Uint8Array(await chosen.arrayBuffer());
      return await openLocalCampaign(downloadCampaignFile(chosen.name, bytes));
    });
  }

  function newCampaign(): void {
    const name = campaignName.trim();
    if (!name) return;
    void run(async () => {
      const file = handles
        ? await pickCampaignToCreate(campaignFileName(name))
        : downloadCampaignFile(campaignFileName(name), null);
      return file ? await createLocalCampaign(file, name) : null;
    });
  }
</script>

<div class="lobby" data-testid="local-lobby">
  <h1>OSR VTT</h1>
  <p class="lead" data-testid="local-lobby-lead">
    Local mode. Your campaign is a <code>.vttcamp</code> file on this machine — there is no account, no
    network and no second player.
  </p>

  {#if !handles}
    <!--
      SPEC-041 §2: a referee who believes their campaign is autosaving when it
      is not will lose it, so the fallback says so before they start rather
      than after.
    -->
    <p class="warn" data-testid="local-no-autosave">
      This browser can't write back to a file directly, so <strong>saving is manual</strong>: use
      Save in the session and keep the file it downloads. Chrome, Edge and other Chromium browsers
      autosave instead.
    </p>
  {/if}

  <section>
    <h2>Open campaign…</h2>
    <p class="hint">Pick a <code>.vttcamp</code> file you have played before.</p>
    <button data-testid="local-open-campaign" disabled={busy} onclick={openCampaign}>
      {busy ? 'Opening…' : 'Open campaign…'}
    </button>
    <input
      class="hidden-input"
      type="file"
      accept=".vttcamp,application/zip"
      data-testid="local-open-campaign-file"
      bind:this={fileInput}
      onchange={onFileChosen}
    />
  </section>

  <section>
    <h2>New campaign…</h2>
    <label>
      Campaign name
      <input
        data-testid="local-new-campaign-name"
        bind:value={campaignName}
        placeholder="The Sunless Vault"
      />
    </label>
    <button
      data-testid="local-new-campaign"
      disabled={busy || !campaignName.trim()}
      onclick={newCampaign}
    >
      {busy ? 'Creating…' : 'New campaign…'}
    </button>
  </section>

  {#if error}
    <p class="error" data-testid="local-lobby-error">{error}</p>
  {/if}
</div>

<style>
  .lobby {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  h1 {
    margin: 0 0 0.5rem;
  }
  .lead {
    margin: 0 0 1.25rem;
    color: var(--text-dim);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .warn {
    border: 1px dashed var(--line-strong);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    margin: 0 0 1.25rem;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--text-dim);
  }
  section {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
  }
  h2 {
    margin-top: 0;
  }
  label {
    display: block;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .hidden-input {
    display: none;
  }
  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-dim);
  }
  .error {
    color: var(--error);
  }
</style>
