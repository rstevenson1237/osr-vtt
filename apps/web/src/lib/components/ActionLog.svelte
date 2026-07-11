<script lang="ts">
  import type { LogEntry } from '@osr-vtt/shared';

  let { entries }: { entries: LogEntry[] } = $props();
</script>

<div class="log" data-testid="action-log">
  <h2>Log</h2>
  <ul>
    {#each entries as entry (entry.id)}
      <li
        data-testid="log-entry"
        data-result-class={entry.resultClass ?? ''}
        class={entry.resultClass ?? ''}
      >
        {entry.text}
      </li>
    {/each}
  </ul>
</div>

<style>
  .log {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    flex: 1;
  }
  .log h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  li {
    font-size: 0.85rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
  }
  li.success {
    background: var(--success-bg);
    color: var(--success);
  }
  li.complication {
    background: var(--complication-bg);
    color: var(--complication);
  }
  li.failure {
    background: var(--failure-bg);
    color: var(--failure);
  }
</style>
