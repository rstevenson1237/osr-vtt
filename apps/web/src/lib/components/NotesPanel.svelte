<script lang="ts">
  import { getContext, onDestroy, onMount, tick } from 'svelte';
  import type { CampaignStore } from '@osr-vtt/shared';
  import type { YTextEvent } from 'yjs';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { YRoomProvider } from '../collab/yprovider';
  import { applyTextDiff } from '../collab/text-diff';
  import { mapCursorThroughDelta } from '../collab/cursor-map';

  /**
   * Shared party notes, CRDT-backed via Yjs (Plan §7 Phase 5). Any seat can
   * edit; two clients typing at once converge with no last-write-wins
   * stomp (Gate 5) — `YRoomProvider` handles the merge, this component just
   * mirrors a `Y.Text` into a `<textarea>`.
   *
   * A remote update rewrites `text` (and so the textarea's DOM value) out
   * from under whatever the local user is doing — without care, that resets
   * the browser's native cursor position, so the user's *next* keystroke
   * lands at the wrong offset and visibly splits their own words apart
   * (no data is lost in the CRDT merge itself, but it reads as corruption).
   * `mapCursorThroughDelta` re-derives where the local cursor should land
   * after a *remote* change (never a local one — the browser already places
   * the caret correctly after the user's own typing) from the Yjs delta.
   */
  let { roomId }: { roomId: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let provider: YRoomProvider | null = null;
  let text = $state('');
  let textareaEl: HTMLTextAreaElement | undefined;

  onMount(() => {
    const p = new YRoomProvider(store, roomId, 'notes');
    provider = p;
    const ytext = p.doc.getText('notes');

    const sync = (event?: YTextEvent) => {
      const el = textareaEl;
      const isFocused = !!el && document.activeElement === el;
      const selStart = el?.selectionStart ?? null;
      const selEnd = el?.selectionEnd ?? null;

      text = ytext.toString();

      if (isFocused && el && event && !event.transaction.local && selStart !== null && selEnd !== null) {
        const newStart = mapCursorThroughDelta(event.changes.delta, selStart);
        const newEnd = mapCursorThroughDelta(event.changes.delta, selEnd);
        void tick().then(() => el.setSelectionRange(newStart, newEnd));
      }
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

  function handleInput(e: Event): void {
    const newValue = (e.currentTarget as HTMLTextAreaElement).value;
    const ytext = provider?.doc.getText('notes');
    if (!ytext || !provider) return;
    const oldValue = ytext.toString();
    provider.doc.transact(() => applyTextDiff(ytext, oldValue, newValue));
  }
</script>

<div class="notes-panel" data-testid="notes-panel">
  <h2>Notes</h2>
  <textarea
    data-testid="notes-input"
    bind:this={textareaEl}
    value={text}
    oninput={handleInput}
    placeholder="Shared party notes…"
  ></textarea>
</div>

<style>
  .notes-panel {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .notes-panel h2 {
    margin: 0;
    font-size: 1rem;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 6rem;
    resize: vertical;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    font: inherit;
  }
</style>
