<script lang="ts">
  import type { LogEntry, PlayerSeat } from '@osr-vtt/shared';
  import Icon from './shell/Icon.svelte';
  import { absoluteTime, authorName, iconForType, nameLookup, relativeTime } from '../log/format';

  /** Entry anatomy (Master Plan v2, R5.1): a type icon, the resolved author
   * name, a relative + absolute timestamp, and the body — roll entries keep
   * their result-class tint. Presentational only; filters/search/pagination
   * live in the Log activity that hosts this. */
  let {
    entries,
    players = [],
  }: {
    entries: LogEntry[];
    players?: PlayerSeat[];
  } = $props();

  const names = $derived(nameLookup(players));

  // One ticking clock drives every entry's relative time rather than each
  // reading Date.now() on its own — updated a couple times a minute.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(id);
  });
</script>

<ul class="log" data-testid="action-log">
  {#each entries as entry (entry.id)}
    <li
      data-testid="log-entry"
      data-log-type={entry.type}
      data-result-class={entry.resultClass ?? ''}
      class={`entry ${entry.type} ${entry.resultClass ?? ''}`}
    >
      <span class="ico" aria-hidden="true"><Icon name={iconForType(entry.type)} size={16} /></span>
      <span class="head">
        <span class="author" data-testid="log-author">{authorName(entry.authorUid, names)}</span>
        <time
          class="time"
          data-testid="log-time"
          datetime={new Date(entry.ts).toISOString()}
          title={absoluteTime(entry.ts)}
        >
          {relativeTime(entry.ts, now)}
        </time>
      </span>
      <span class="body">{entry.text}</span>
    </li>
  {/each}
  {#if entries.length === 0}
    <li class="empty" data-testid="log-empty">No activity matches.</li>
  {/if}
</ul>

<style>
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .entry {
    display: grid;
    grid-template-columns: 20px 1fr;
    grid-template-rows: auto auto;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    padding: 0.3rem 0.45rem;
    border-radius: 4px;
    font-size: 0.85rem;
    /* A shared roll's grouped entry (R3.6.4) is a header plus one indented
     * line per seat — render its newlines as line breaks. */
    white-space: pre-line;
  }
  .ico {
    grid-row: 1 / span 2;
    display: flex;
    align-items: flex-start;
    padding-top: 0.1rem;
    color: var(--text-dim);
  }
  .entry.roll .ico {
    color: var(--group-play);
  }
  .entry.chat .ico {
    color: var(--group-records);
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .author {
    font-weight: 600;
    color: var(--text);
  }
  .time {
    font-size: 0.7rem;
    color: var(--text-dim);
  }
  .body {
    color: var(--text);
  }
  .entry.success .body {
    color: var(--success);
  }
  .entry.complication .body {
    color: var(--complication);
  }
  .entry.failure .body {
    color: var(--failure);
  }
  .empty {
    font-size: 0.8rem;
    color: var(--text-dim);
    padding: 0.5rem 0.45rem;
  }
</style>
