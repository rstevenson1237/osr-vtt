<script lang="ts">
  import { getContext } from 'svelte';
  import {
    LIVE_LOG_LIMIT,
    type CampaignStore,
    type LogEntry,
    type PlayerSeat,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';
  import { authorName, nameLookup } from '../../log/format';
  import ActionLog from '../ActionLog.svelte';
  import NotesPanel from '../NotesPanel.svelte';
  import ChatInput from './ChatInput.svelte';

  /** Log activity full-stage view (Master Plan v2, R5). Hosts the entry list
   * (author/time anatomy lives in `ActionLog`), per-type filter chips + search
   * over the loaded entries, "load older" pagination across the live-cap
   * boundary via `listLogBefore`, and the chat input. The Records-group
   * `NotesPanel` rides along as a second tab (WI-2). */
  let {
    entries,
    roomId,
    players = [],
    authorUid = '',
  }: {
    entries: LogEntry[];
    roomId: string;
    players?: PlayerSeat[];
    authorUid?: string;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let tab = $state<'log' | 'notes'>('log');

  // ---- filters (persisted locally per user, R5.2) ----
  const TYPES: { id: LogEntry['type']; label: string }[] = [
    { id: 'roll', label: 'Rolls' },
    { id: 'chat', label: 'Chat' },
    { id: 'system', label: 'System' },
  ];
  // roomId is stable for this component instance (RoomShell is keyed on it),
  // so reading it once to key localStorage is correct, not a missed dep.
  // eslint-disable-next-line svelte/valid-compile
  const FILTER_KEY = `vtt-log-filters:${roomId}`;

  function loadFilters(): Record<LogEntry['type'], boolean> {
    const all = { roll: true, chat: true, system: true };
    if (typeof localStorage === 'undefined') return all;
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (!raw) return all;
      const parsed = JSON.parse(raw) as Partial<Record<LogEntry['type'], boolean>>;
      return {
        roll: parsed.roll ?? true,
        chat: parsed.chat ?? true,
        system: parsed.system ?? true,
      };
    } catch {
      return all;
    }
  }

  let filters = $state(loadFilters());
  let search = $state('');

  function toggleFilter(type: LogEntry['type']): void {
    filters = { ...filters, [type]: !filters[type] };
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      // Storage disabled (private mode) — filters still work this session.
    }
  }

  // ---- pagination (older pages prepended to the live window) ----
  let older = $state<LogEntry[]>([]);
  let loadingOlder = $state(false);
  let reachedStart = $state(false);

  const names = $derived(nameLookup(players));

  // Merge older pages with the live window, de-duped by id and sorted oldest-
  // first — the single set every filter/search runs over.
  const loaded = $derived.by(() => {
    const map = new Map<string, LogEntry>();
    for (const e of older) map.set(e.id, e);
    for (const e of entries) map.set(e.id, e);
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  });

  const visible = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return loaded.filter((e) => {
      if (!filters[e.type]) return false;
      if (!q) return true;
      const hay = `${e.text} ${authorName(e.authorUid, names)}`.toLowerCase();
      return hay.includes(q);
    });
  });

  // The live window already holds the very first entries when it isn't full,
  // so there's nothing older to fetch in that case.
  const canLoadOlder = $derived(
    !reachedStart && !(older.length === 0 && entries.length < LIVE_LOG_LIMIT),
  );

  async function loadOlder(): Promise<void> {
    if (loadingOlder || loaded.length === 0) return;
    loadingOlder = true;
    try {
      const oldestTs = loaded[0]!.ts;
      const page = await store.listLogBefore(roomId, oldestTs, LIVE_LOG_LIMIT);
      if (page.length < LIVE_LOG_LIMIT) reachedStart = true;
      if (page.length > 0) older = [...page, ...older];
    } finally {
      loadingOlder = false;
    }
  }
</script>

<div class="log-activity" data-testid="log-activity">
  <div class="tabs">
    <button class:active={tab === 'log'} data-testid="log-tab-log" onclick={() => (tab = 'log')}>
      Log
    </button>
    <button
      class:active={tab === 'notes'}
      data-testid="log-tab-notes"
      onclick={() => (tab = 'notes')}
    >
      Notes
    </button>
  </div>

  {#if tab === 'log'}
    <div class="controls">
      <div class="chips" role="group" aria-label="Filter by type">
        {#each TYPES as t (t.id)}
          <button
            class="chip"
            class:on={filters[t.id]}
            data-testid={`log-filter-${t.id}`}
            aria-pressed={filters[t.id]}
            onclick={() => toggleFilter(t.id)}
          >
            {t.label}
          </button>
        {/each}
      </div>
      <input
        class="search"
        data-testid="log-search"
        type="search"
        placeholder="Search loaded entries…"
        bind:value={search}
      />
    </div>

    <div class="surface" data-testid="log-surface">
      {#if canLoadOlder}
        <div class="older-row">
          <button
            data-testid="log-load-older"
            onclick={() => void loadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Loading…' : 'Load older'}
          </button>
        </div>
      {:else if older.length > 0}
        <div class="older-row">
          <span class="start" data-testid="log-history-start">Start of history</span>
        </div>
      {/if}
      <ActionLog entries={visible} {players} />
    </div>

    <ChatInput {roomId} {authorUid} location="stage" />
  {:else}
    <div class="surface">
      <NotesPanel {roomId} />
    </div>
  {/if}
</div>

<style>
  .log-activity {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    box-sizing: border-box;
    gap: 0.5rem;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    flex: 0 0 auto;
  }
  .tabs button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px 4px 0 0;
    border: 1px solid var(--line);
    background: var(--bg-panel);
    color: inherit;
    cursor: pointer;
  }
  .tabs button.active {
    background: var(--bg-panel-alt);
    border-bottom-color: transparent;
    font-weight: 600;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    flex: 0 0 auto;
  }
  .chips {
    display: flex;
    gap: 0.3rem;
  }
  .chip {
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text-dim);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .search {
    flex: 1;
    min-width: 8rem;
    box-sizing: border-box;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  .surface {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.5rem;
  }
  .older-row {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0 0.4rem;
  }
  .older-row button {
    padding: 0.25rem 0.9rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .older-row button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .start {
    font-size: 0.72rem;
    color: var(--text-dim);
  }
</style>
