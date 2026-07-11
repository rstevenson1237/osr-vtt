<script lang="ts">
  import type { LogEntry } from '@osr-vtt/shared';
  import ActionLog from '../ActionLog.svelte';
  import NotesPanel from '../NotesPanel.svelte';

  /** Log activity full-stage view. WI-2 re-houses the existing `ActionLog` plus
   * the Records-group `NotesPanel` as a tab. Author/time anatomy, filters,
   * search, chat input and `/r` are R5/WI-7. */
  let { entries, roomId }: { entries: LogEntry[]; roomId: string } = $props();

  let tab = $state<'log' | 'notes'>('log');
</script>

<div class="log-activity" data-testid="log-activity">
  <div class="tabs">
    <button class:active={tab === 'log'} data-testid="log-tab-log" onclick={() => (tab = 'log')}>
      Log
    </button>
    <button class:active={tab === 'notes'} data-testid="log-tab-notes" onclick={() => (tab = 'notes')}>
      Notes
    </button>
  </div>
  <div class="surface">
    {#if tab === 'log'}
      <ActionLog {entries} />
    {:else}
      <NotesPanel {roomId} />
    {/if}
  </div>
</div>

<style>
  .log-activity {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    box-sizing: border-box;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
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
  .surface {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
