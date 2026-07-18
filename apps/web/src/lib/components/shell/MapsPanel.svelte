<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, GameMap } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, DIALOG_KEY } from '../../context';
  import type { DialogService } from '../../shell/dialogs.svelte';

  /**
   * Maps manager (Master Plan v2, R17.3): multiple full map builds per
   * session (each with its own background/grid/fog/floor/walls/etc.),
   * sharing the same players/tokens/encounter/log. The GM creates/renames/
   * deletes maps here and picks the one "active" map every player's client
   * renders. Creation and rename both use in-place editing (no modal dialog
   * — matches the Rooms/Labels convention), mirroring `RoomsPanel.svelte`'s
   * structure but without its per-key renumber/undo machinery, which maps
   * don't need.
   */
  let { roomId, activeMapId }: { roomId: string; activeMapId: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);

  let maps = $state<GameMap[]>([]);
  $effect(() => {
    return store.subscribeMaps(roomId, (m) => (maps = m));
  });

  const ordered = $derived([...maps].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)));

  let creating = $state(false);
  async function addMap(): Promise<void> {
    if (creating) return;
    creating = true;
    try {
      const id = await store.createMap(roomId, { name: `Map ${maps.length + 1}` });
      startEdit(id, `Map ${maps.length + 1}`);
    } finally {
      creating = false;
    }
  }

  // ---- inline rename ----
  let editingId = $state<string | null>(null);
  let editName = $state('');

  function startEdit(id: string, name: string): void {
    editingId = id;
    editName = name;
  }

  function cancelEdit(): void {
    editingId = null;
  }

  async function saveEdit(): Promise<void> {
    const id = editingId;
    if (!id) return;
    const existing = maps.find((m) => m.id === id);
    editingId = null;
    const name = editName.trim();
    if (!existing || !name || name === existing.name) return;
    await store.renameMap(roomId, id, name);
  }

  async function switchActive(mapId: string): Promise<void> {
    if (mapId === activeMapId) return;
    await store.setActiveMap(roomId, mapId);
  }

  async function deleteMap(map: GameMap): Promise<void> {
    if (map.id === activeMapId) return; // guarded in the UI too — see the disabled button below
    const ok = await dialogs.confirm({
      title: 'Delete map',
      message: `Delete "${map.name}"? Its background, floor, walls, and everything else on it are gone for good.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await store.deleteMap(roomId, map.id);
  }
</script>

<div class="maps-panel" data-testid="maps-panel">
  <div class="maps-head">
    <button type="button" data-testid="maps-add" onclick={() => void addMap()} disabled={creating}>
      + New map
    </button>
  </div>

  <ul class="maps-list">
    {#each ordered as m (m.id)}
      <li class="map-row" class:active={m.id === activeMapId} data-testid={`map-row-${m.id}`}>
        {#if editingId === m.id}
          <input
            class="edit-name"
            data-testid={`map-edit-name-${m.id}`}
            aria-label="Map name"
            bind:value={editName}
            onblur={() => void saveEdit()}
            onkeydown={(e) => {
              if (e.key === 'Enter') void saveEdit();
              else if (e.key === 'Escape') cancelEdit();
            }}
          />
        {:else}
          <button
            type="button"
            class="map-name"
            data-testid={`map-name-${m.id}`}
            title="Rename"
            onclick={() => startEdit(m.id, m.name)}
          >
            {m.name}
          </button>
        {/if}

        {#if m.id === activeMapId}
          <span class="active-badge" data-testid={`map-active-${m.id}`}>Active</span>
        {:else}
          <button
            type="button"
            class="switch"
            data-testid={`map-switch-${m.id}`}
            onclick={() => void switchActive(m.id)}
          >
            Switch to this map
          </button>
        {/if}

        <button
          type="button"
          class="icon danger"
          data-testid={`map-delete-${m.id}`}
          title={m.id === activeMapId ? 'Switch to another map first' : 'Delete map'}
          disabled={m.id === activeMapId}
          onclick={() => void deleteMap(m)}
        >
          ✕
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .maps-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .maps-head {
    display: flex;
    justify-content: flex-end;
  }
  .maps-head button {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .maps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .map-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 0.85rem;
  }
  .map-row.active {
    border-color: var(--accent);
  }
  .map-name {
    flex: 1;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.15rem 0.3rem;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: 4px;
  }
  .map-name:hover {
    background: var(--bg-inset);
  }
  .edit-name {
    flex: 1;
    box-sizing: border-box;
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
  }
  .active-badge {
    border: 1px solid var(--accent);
    color: var(--accent-text, var(--accent));
    border-radius: 5px;
    padding: 0.1rem 0.5rem;
    font-size: 0.72rem;
  }
  .switch,
  .icon {
    font-size: 0.78rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .icon.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
  .icon.danger:disabled {
    opacity: 0.4;
    cursor: default;
    color: inherit;
    border-color: var(--line-strong);
  }
</style>
