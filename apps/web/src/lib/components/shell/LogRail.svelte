<script lang="ts">
  import type { LogEntry, PlayerSeat } from '@osr-vtt/shared';
  import ChatInput from './ChatInput.svelte';

  /** Bottom rail (Master Plan v2, R1.1). Collapsed = last-entry ticker (34px);
   * expanded = peek drawer with the last ~8 entries (author + time + type tint),
   * a chat input (R5.3, `L`-focus), and an "Open full view" link to the Log
   * activity. */
  let {
    entries,
    players,
    expanded,
    roomId,
    authorUid,
    onToggle,
    onOpenFull,
  }: {
    entries: LogEntry[];
    players: PlayerSeat[];
    expanded: boolean;
    roomId: string;
    authorUid: string;
    onToggle: () => void;
    onOpenFull: () => void;
  } = $props();

  const nameByUid = $derived(new Map(players.map((p) => [p.uid, p.displayName])));
  function authorName(uid: string): string {
    return nameByUid.get(uid) ?? '—';
  }
  function clock(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const last = $derived(entries.length > 0 ? entries[entries.length - 1]! : null);
  const peek = $derived(entries.slice(-8));
</script>

<div class="log-rail" class:expanded>
  {#if !expanded}
    <button class="ticker" data-testid="log-ticker" onclick={onToggle}>
      {#if last}
        <span class="tick-time">{clock(last.ts)}</span>
        <span class="tick-author">{authorName(last.authorUid)}</span>
        <span class="tick-body">{last.text}</span>
      {:else}
        <span class="tick-body dim">No activity yet</span>
      {/if}
      <span class="hint">click to expand ▲</span>
    </button>
  {:else}
    <div class="drawer" data-testid="log-peek">
      <button class="handle" aria-label="Collapse log" onclick={onToggle}></button>
      <ul class="lines">
        {#each peek as entry (entry.id)}
          <li
            class={`logline ${entry.resultClass ?? ''} ${entry.type}`}
            data-testid="log-peek-entry"
          >
            <span class="t">{clock(entry.ts)}</span>
            <span class="a">{authorName(entry.authorUid)}</span>
            <span class="body">{entry.text}</span>
          </li>
        {/each}
        {#if peek.length === 0}
          <li class="logline dim">No activity yet</li>
        {/if}
      </ul>
      <div class="footer">
        <ChatInput {roomId} {authorUid} location="drawer" />
        <button class="fulllink" data-testid="log-open-full" onclick={onOpenFull}>Full log →</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .log-rail {
    height: 100%;
    background: var(--bg-panel);
    border-top: 1px solid var(--line);
    box-sizing: border-box;
  }
  .ticker {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.78rem;
    text-align: left;
  }
  .tick-time {
    color: var(--text-dim);
    flex: 0 0 auto;
  }
  .tick-author {
    color: var(--text);
    font-weight: 600;
    flex: 0 0 auto;
  }
  .tick-body {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    margin-left: auto;
    flex: 0 0 auto;
    color: var(--text-dim);
    font-size: 0.7rem;
  }
  .dim {
    color: var(--text-dim);
  }
  .drawer {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.75rem 0.6rem;
    box-sizing: border-box;
  }
  .handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
    border: none;
    margin: 0 auto 0.5rem;
    cursor: pointer;
    flex: 0 0 auto;
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .logline {
    display: flex;
    gap: 0.5rem;
    font-size: 0.78rem;
    margin: 0.1rem 0;
    color: var(--text-dim);
  }
  .logline .t {
    color: var(--text-dim);
    flex: 0 0 auto;
  }
  .logline .a {
    color: var(--text);
    font-weight: 600;
    flex: 0 0 auto;
  }
  .logline.success .body {
    color: var(--success);
  }
  .logline.failure .body {
    color: var(--failure);
  }
  .logline.complication .body {
    color: var(--complication);
  }
  .footer {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.4rem;
    flex: 0 0 auto;
  }
  .footer :global(.chat-input) {
    width: 100%;
  }
  .fulllink {
    align-self: flex-end;
  }
  .fulllink {
    background: transparent;
    border: none;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 0.75rem;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
