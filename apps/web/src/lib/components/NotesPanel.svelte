<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import type { CampaignStore } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { YRoomProvider } from '../collab/yprovider';
  import { applyTextDiff } from '../collab/text-diff';
  import MarkdownEditor from './MarkdownEditor.svelte';

  /**
   * Shared party notes, CRDT-backed via Yjs (Plan §7 Phase 5). Any seat can
   * edit; two clients typing at once converge with no last-write-wins
   * stomp (Gate 5) — `YRoomProvider` handles the merge, this component just
   * mirrors a `Y.Text` into `MarkdownEditor`, which edits it WYSIWYG while the
   * stored value stays plain markdown.
   *
   * A remote update rewrites `text` out from under whatever the local user is
   * doing. No data is lost in the CRDT merge itself, but the caret has to
   * survive the repaint or the user's *next* keystroke lands at the wrong
   * offset and visibly splits their own words apart. `MarkdownEditor` owns
   * that now — it repaints only on a genuinely remote value and restores the
   * caret by offset (see its header for the limits of that).
   */
  let { roomId }: { roomId: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let provider: YRoomProvider | null = null;
  let text = $state('');

  onMount(() => {
    const p = new YRoomProvider(store, roomId, 'notes');
    provider = p;
    const ytext = p.doc.getText('notes');

    const sync = () => {
      text = ytext.toString();
    };

    ytext.observe(sync);
    p.connect();
    sync();

    return () => {
      ytext.unobserve(sync);
    };
  });

  onDestroy(() => {
    provider?.disconnect();
  });

  function handleInput(newValue: string): void {
    const ytext = provider?.doc.getText('notes');
    if (!ytext || !provider) return;
    const oldValue = ytext.toString();
    provider.doc.transact(() => applyTextDiff(ytext, oldValue, newValue));
  }
</script>

<div class="notes-panel" data-testid="notes-panel">
  <MarkdownEditor
    label="Shared party notes"
    value={text}
    minHeight="10rem"
    placeholder="Shared party notes…"
    empty="No party notes yet."
    testidPrefix="notes"
    onchange={handleInput}
  />
</div>

<style>
  .notes-panel {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
</style>
