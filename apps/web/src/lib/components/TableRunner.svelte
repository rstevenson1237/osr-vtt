<script lang="ts">
  import { getContext } from 'svelte';
  import {
    parseTableCsv,
    parseTableJson,
    rollOnTable,
    buildRegistry,
    type AssetStore,
    type CampaignStore,
    type ParsedTable,
    type TableRegistry,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../context';
  import { SAMPLE_TABLE_REFS } from '../assets';

  /**
   * The CSV/JSON random-table runner (Plan §7 Phase 4). The GM imports referee
   * tables, rolls on them — resolving nested `[[table:…]]` / `[[NdM]]` tokens
   * via `tables/runner.ts` — and pushes the resolved result to the shared chat
   * (Action Log). Pure referee content: the app rolls and displays; it never
   * authors or interprets the outcome as a mechanic.
   */
  let {
    roomId,
    isGM,
    authorUid,
  }: {
    roomId: string;
    isGM: boolean;
    authorUid: string;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  interface ImportedTable {
    id: string;
    table: ParsedTable;
    registry: TableRegistry;
  }

  let imported = $state<ImportedTable[]>([]);
  let importError = $state('');
  let lastResult = $state('');

  function addImported(entry: ImportedTable): void {
    imported = [...imported.filter((t) => t.table.name !== entry.table.name), entry];
    // Persist the flat table to Firestore too (referee content, GM-writable).
    void store.upsertTable(roomId, {
      id: entry.id,
      name: entry.table.name,
      rows: entry.table.rows.map((r) => r.text),
    });
  }

  function importJson(raw: string, fallbackName: string): void {
    const { table, registry } = parseTableJson(raw, fallbackName);
    addImported({ id: `tbl-${Date.now()}-${imported.length}`, table, registry });
  }

  function importCsv(raw: string, name: string): void {
    const table = parseTableCsv(raw, name);
    addImported({ id: `tbl-${Date.now()}-${imported.length}`, table, registry: buildRegistry([table]) });
  }

  async function loadSamples(): Promise<void> {
    importError = '';
    try {
      for (const { ref, kind } of SAMPLE_TABLE_REFS) {
        const text = await (await fetch(assets.resolve(ref))).text();
        const name = ref.split('/').pop() ?? ref;
        if (kind === 'json') importJson(text, name);
        else importCsv(text, name);
      }
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Failed to load samples';
    }
  }

  async function onFileChange(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importError = '';
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.csv')) importCsv(text, file.name);
      else importJson(text, file.name);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Import failed';
    }
  }

  async function roll(entry: ImportedTable): Promise<void> {
    const result = rollOnTable(entry.table, entry.registry, Math.random);
    lastResult = result.text;
    // Push the resolved result to the shared chat/log (Spec §6 "then the
    // outcome is written to the Action Log").
    await store.writeLog(roomId, {
      ts: Date.now(),
      authorUid,
      type: 'chat',
      text: `🎲 ${entry.table.name}: ${result.text}`,
    });
  }
</script>

{#if isGM}
  <div class="table-runner" data-testid="table-runner">
    <h2>Random Tables</h2>

    <div class="controls">
      <button data-testid="load-sample-tables" onclick={() => void loadSamples()}
        >Load sample tables</button
      >
      <label class="file-label">
        Import CSV/JSON
        <input
          type="file"
          data-testid="import-table-file"
          accept=".csv,.json,application/json,text/csv"
          onchange={onFileChange}
        />
      </label>
    </div>

    {#if importError}
      <p class="error" data-testid="table-import-error">{importError}</p>
    {/if}

    {#if imported.length === 0}
      <p class="hint">No tables loaded. Load the samples or import your own.</p>
    {/if}

    <ul class="table-list">
      {#each imported as entry (entry.id)}
        <li data-testid={`table-row-${entry.id}`}>
          <span class="table-name" data-testid={`table-name-${entry.id}`}>{entry.table.name}</span>
          <span class="table-count">{entry.table.rows.length} rows</span>
          <button data-testid={`table-roll-${entry.id}`} onclick={() => void roll(entry)}>Roll</button>
        </li>
      {/each}
    </ul>

    {#if lastResult}
      <p class="last-result" data-testid="table-last-result">{lastResult}</p>
    {/if}
  </div>
{/if}

<style>
  .table-runner {
    background: #182420;
    border: 1px solid #2f4a3a;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .table-runner h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .file-label {
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .hint {
    font-size: 0.78rem;
    opacity: 0.7;
    margin: 0.25rem 0;
  }
  .error {
    color: #e08080;
    font-size: 0.78rem;
  }
  .table-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .table-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    background: #14110d;
  }
  .table-name {
    font-weight: 600;
    flex: 1;
  }
  .table-count {
    opacity: 0.6;
    font-size: 0.72rem;
  }
  button {
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #362d20;
    color: inherit;
    cursor: pointer;
  }
  .last-result {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: #bdf2c4;
  }
</style>
