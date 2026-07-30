<script lang="ts">
  import { getContext } from 'svelte';
  import {
    LIVE_LOG_LIMIT,
    type CampaignStore,
    type LogEntry,
    type PlayerSeat,
    type Roll,
    type RollConvention,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, SHELL_STATE_KEY } from '../../context';
  import type { ShellState } from '../../shell/shell-state.svelte';
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
    rolls = [],
    conventions = [],
    authorUid = '',
  }: {
    entries: LogEntry[];
    roomId: string;
    players?: PlayerSeat[];
    rolls?: Roll[];
    conventions?: RollConvention[];
    authorUid?: string;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  // Driven by `ShellState.overlayTab`, which the shell already sets when it
  // opens the modal. It used to be written and never read, so the Log modal
  // could not deep-link to Notes and reset to Log on every open.
  const shell = getContext<ShellState>(SHELL_STATE_KEY);
  const tab = $derived(shell.overlayTab);
  function setTab(next: 'log' | 'notes'): void {
    shell.overlayTab = next;
  }

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

  // ---- scroll position ----
  // Entries render oldest-first, so an untouched scroller opens on the *first*
  // thing anyone ever said. Pin to the bottom instead, the way every chat log
  // does: land on the newest entry when the modal opens and follow new ones,
  // but let go the moment the reader scrolls up to read history or presses
  // "Load older" — otherwise the next message yanks them back down.
  let surface = $state<HTMLDivElement | null>(null);
  let stickToBottom = $state(true);
  /** Slack enough that a partially-scrolled last entry still counts as "at the
   * bottom"; roughly one line of chrome. */
  const STICK_SLACK_PX = 48;

  function onSurfaceScroll(): void {
    if (!surface) return;
    const distance = surface.scrollHeight - surface.scrollTop - surface.clientHeight;
    stickToBottom = distance <= STICK_SLACK_PX;
  }

  // Re-arms on every switch back to the Log tab (which is also what a fresh
  // open of the modal looks like from here), so reopening always lands at the
  // newest entry regardless of where the reader left the scroller.
  $effect(() => {
    if (tab === 'log') stickToBottom = true;
  });

  $effect(() => {
    // Depend on the rendered count and the tab so this re-runs when entries
    // arrive or the Log tab is shown; `surface` is null while Notes is up.
    void visible.length;
    if (tab !== 'log' || !surface || !stickToBottom) return;
    const el = surface;
    // After the DOM has the new rows — `$effect` runs post-update, but
    // `ActionLog`'s own content can settle a tick later.
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  });
</script>

<div class="log-activity" data-testid="log-activity">
  <div class="tabs">
    <button class:active={tab === 'log'} data-testid="log-tab-log" onclick={() => setTab('log')}>
      Log
    </button>
    <button
      class:active={tab === 'notes'}
      data-testid="log-tab-notes"
      onclick={() => setTab('notes')}
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

    <div class="surface" data-testid="log-surface" bind:this={surface} onscroll={onSurfaceScroll}>
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
      <ActionLog entries={visible} {players} {rolls} {conventions} />
    </div>

    <ChatInput {roomId} {authorUid} {conventions} location="stage" />
  {:else}
    <div class="surface">
      <NotesPanel {roomId} />
    </div>
  {/if}
</div>

<style>
  .log-activity {
    /* `flex: 1` + `min-height: 0` rather than `height: 100%`: this is a flex
       item of the modal body (which passes `bodyScroll={false}` precisely so
       this can bound itself), and a percentage height there had no definite
       height to resolve against — it grew to its content instead, which left
       `.surface` unable to scroll and pushed the chat input off the bottom. */
    flex: 1;
    min-height: 0;
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
