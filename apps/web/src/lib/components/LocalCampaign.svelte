<script lang="ts">
  import { onDestroy, setContext } from 'svelte';
  import type { LocalSaveState, LocalStore } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import RoomShell from './RoomShell.svelte';

  /**
   * One open campaign: the session shell over a `LocalStore`, plus the one
   * piece of chrome local mode adds — where the campaign file is at
   * (SPEC-041 §2).
   *
   * This is the local build's `setContext(CAMPAIGN_STORE_KEY, …)` call, and it
   * lives here rather than in `LocalRoot` because the store does not exist
   * until the referee has chosen a file. `LocalRoot` keys this component on the
   * campaign's room id, so a second campaign gets a fresh instance and a fresh
   * context rather than inheriting the first one's.
   */
  let { store, roomId, onClose }: { store: LocalStore; roomId: string; onClose: () => void } =
    $props();

  // `store` is stable for the life of this instance — `LocalRoot` keys the
  // component on the campaign's room id, so opening a different campaign makes
  // a new instance rather than swapping this prop. Reading it at construction
  // is correct, not a missed reactive dependency (the same argument `RoomShell`
  // makes for its `roomId`).
  /* eslint-disable svelte/valid-compile */
  setContext(CAMPAIGN_STORE_KEY, store);

  let save = $state<LocalSaveState>(store.saveState());
  const unsubSave = store.subscribeSaveState((state) => (save = state));
  /* eslint-enable svelte/valid-compile */
  onDestroy(unsubSave);

  let saving = $state(false);

  async function saveNow(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await store.save();
    } finally {
      saving = false;
    }
  }

  const label = $derived.by(() => {
    if (save.error) return `Not saved — ${save.error}`;
    if (save.saving) return 'Saving…';
    if (save.dirty) return save.autosave ? 'Unsaved changes' : 'Unsaved — press Save';
    return save.lastSavedAt ? 'Saved' : 'No changes yet';
  });

  // The one thing a browser can do about a closing tab with work in it. It
  // matters most on the fallback path, where nothing writes on its own, but a
  // dirty autosaving campaign is worth a prompt too: the debounce may not have
  // fired yet.
  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!save.dirty && !save.error) return;
    event.preventDefault();
  }
</script>

<svelte:window onbeforeunload={onBeforeUnload} />

<RoomShell {roomId} />

<div
  class="campaign-file"
  class:dirty={save.dirty || !!save.error}
  data-testid="local-save-status"
  data-dirty={save.dirty}
  data-autosave={save.autosave}
>
  <span class="file-name" title={save.fileName}>{save.fileName}</span>
  <span class="state" data-testid="local-save-state">{label}</span>
  {#if !save.autosave || save.dirty || save.error}
    <button data-testid="local-save-now" disabled={saving || save.saving} onclick={saveNow}>
      Save
    </button>
  {/if}
  <button class="close" data-testid="local-close-campaign" onclick={onClose}>Close</button>
</div>

<style>
  /* Sits above the shell's bottom bar rather than in it: the shell's grid is
     shared with the hosted build and this chrome exists only here. The offset
     is stated from `--hit` for the same reason the bar's own height is
     (SPEC-033 §7) — it tracks pointer coarseness. */
  .campaign-file {
    position: fixed;
    right: 0.75rem;
    bottom: calc(var(--hit) + 14px);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: min(90vw, 26rem);
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--bg-panel);
    color: var(--text-dim);
    font-size: 0.75rem;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
  }
  .campaign-file.dirty {
    border-color: var(--accent);
  }
  .file-name {
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .state {
    white-space: nowrap;
  }
  button {
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  button.close {
    border-color: var(--line);
  }
</style>
