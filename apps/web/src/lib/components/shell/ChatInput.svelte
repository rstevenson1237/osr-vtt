<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { CampaignStore } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';
  import { submitChat } from '../../log/chat';
  import { registerChatFocus, type ChatLocation } from '../../log/chat-focus';

  /** Chat box shared by the peek drawer and the Log stage (Master Plan v2,
   * R5.3). Plain text posts a `chat` entry; `/r <expr>` rolls through the real
   * dice pipeline; an unknown `/command` posts nothing and hints inline. */
  let {
    roomId,
    authorUid,
    location,
    placeholder = 'Message or /r 2d6…',
  }: {
    roomId: string;
    authorUid: string;
    location: ChatLocation;
    placeholder?: string;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let text = $state('');
  let hint = $state('');
  let sending = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  onMount(() => registerChatFocus(location, () => inputEl?.focus()));

  async function send(): Promise<void> {
    if (sending || !authorUid) return;
    const raw = text;
    if (!raw.trim()) return;
    sending = true;
    hint = '';
    try {
      const result = await submitChat(store, roomId, authorUid, raw);
      if (result.ok) {
        text = '';
      } else if (result.hint) {
        hint = result.hint;
      }
    } finally {
      sending = false;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  }
</script>

<div class="chat-input" data-testid={`chat-input-${location}`}>
  <div class="row">
    <input
      bind:this={inputEl}
      bind:value={text}
      data-testid={`chat-text-${location}`}
      {placeholder}
      disabled={!authorUid}
      oninput={() => (hint = '')}
      onkeydown={onKey}
    />
    <button
      data-testid={`chat-send-${location}`}
      onclick={() => void send()}
      disabled={!text.trim() || sending || !authorUid}
    >
      Send
    </button>
  </div>
  {#if hint}
    <p class="hint" data-testid={`chat-hint-${location}`}>{hint}</p>
  {/if}
</div>

<style>
  .chat-input {
    flex: 0 0 auto;
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  input {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  button {
    padding: 0.35rem 0.8rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .hint {
    margin: 0.3rem 0 0;
    font-size: 0.72rem;
    color: var(--complication);
  }
</style>
