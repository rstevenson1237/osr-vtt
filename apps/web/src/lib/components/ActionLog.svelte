<script lang="ts">
  import {
    summarizeRoll,
    type LogEntry,
    type PlayerSeat,
    type Roll,
    type RollConvention,
  } from '@osr-vtt/shared';
  import Icon from './shell/Icon.svelte';
  import { absoluteTime, authorName, iconForType, nameLookup, relativeTime } from '../log/format';

  /** Entry anatomy (Master Plan v2, R5.1): a type icon, the resolved author
   * name, a relative + absolute timestamp, and the body — roll entries keep
   * their result-class tint. Presentational only; filters/search/pagination
   * live in the Log activity that hosts this.
   *
   * A `roll` entry that carries a `rollId` still in the loaded `rolls` window
   * renders the *structured* result — per-die badges, dimmed dropped dice,
   * convention band chips — instead of its baked `text`. `text` remains the
   * durable record (and what search matches), so an entry whose roll has aged
   * out of the window, or one written before v16, renders exactly as before. */
  let {
    entries,
    players = [],
    rolls = [],
    conventions = [],
  }: {
    entries: LogEntry[];
    players?: PlayerSeat[];
    rolls?: Roll[];
    conventions?: RollConvention[];
  } = $props();

  const names = $derived(nameLookup(players));
  const rollsById = $derived(new Map(rolls.map((r) => [r.id, r])));

  function summaryFor(entry: LogEntry) {
    if (entry.type !== 'roll' || !entry.rollId) return null;
    const roll = rollsById.get(entry.rollId);
    return roll ? summarizeRoll(roll, conventions) : null;
  }

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
      {#if summaryFor(entry)}
        {@const summary = summaryFor(entry)!}
        <span class="body">
          {#each summary.parts as part (part.slotId)}
            <span class="roll-line" data-testid="log-roll-part">
              {#if summary.parts.length > 1}
                <span class="part-name">{authorName(part.slotId, names)}</span>
              {/if}
              {#each part.dice as die, i (i)}
                <span
                  class={`die ${die.band?.class ?? 'unbanded'}`}
                  class:pool-dropped={die.poolDropped}
                  title={die.band?.label ?? ''}>{die.kept}</span
                >
                {#if die.dropped !== undefined}
                  <span class="dropped">{die.dropped}</span>
                {/if}
              {/each}
              {#if part.modifier !== 0}
                <span class="mod">{part.modifier > 0 ? '+' : '−'}{Math.abs(part.modifier)}</span>
              {/if}
              {#if part.total !== undefined}
                <span class="total">= {part.total}</span>
              {/if}
              {#if part.band}
                <span class={`band ${part.band.class}`}>{part.band.label}</span>
              {/if}
            </span>
          {/each}
          {#if summary.label}
            <span class="roll-label">{summary.label}</span>
          {/if}
        </span>
      {:else}
        <span class="body">{entry.text}</span>
      {/if}
    </li>
  {/each}
  {#if entries.length === 0}
    <li class="empty" data-testid="log-empty">No activity matches.</li>
  {/if}
</ul>

<style>
  .roll-line {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-right: 0.5rem;
  }
  .part-name {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.75;
  }
  .die {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-family: monospace;
    font-size: 0.8rem;
    background: var(--bg-panel-alt);
  }
  .die.success {
    background: var(--success-bg-strong);
    color: var(--success);
  }
  .die.complication {
    background: var(--complication-bg-strong);
    color: var(--complication);
  }
  .die.failure {
    background: var(--failure-bg-strong);
    color: var(--failure);
  }
  .die.pool-dropped,
  .dropped {
    opacity: 0.45;
    text-decoration: line-through;
    font-size: 0.72rem;
  }
  .total {
    font-weight: 600;
  }
  .band {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .band.success {
    background: var(--success-bg-strong);
    color: var(--success);
  }
  .band.complication {
    background: var(--complication-bg-strong);
    color: var(--complication);
  }
  .band.failure {
    background: var(--failure-bg-strong);
    color: var(--failure);
  }
  .roll-label {
    font-size: 0.72rem;
    opacity: 0.7;
  }
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
