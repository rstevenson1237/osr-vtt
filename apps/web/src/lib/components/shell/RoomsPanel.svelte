<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { CampaignStore, MapRoom } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY, SHELL_STATE_KEY } from '../../context';
  import type { DialogService } from '../../shell/dialogs.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';
  import type { ShellState } from '../../shell/shell-state.svelte';
  import { UndoStack } from '../../map/undo';
  import {
    invertOp,
    isNoopOp,
    isMapRoomKeyUnique,
    mapRoomCellCount,
    renumberMapRoomsByOrder,
    sortMapRoomsByKey,
    type EditorOp,
  } from '../../map/tools';

  /**
   * Rooms manager (Master Plan v2, R17.2 / R13.3 / WI-20). Lists every dungeon
   * `MapRoom` in the session with rename, renumber, reorder, jump-to and
   * delete. Housed in the Assets activity and mirrored into the GM controls
   * (SessionActivity). It reads the shared `mapRooms` subscription and writes
   * undoable `mapRoom` / `mapRoomBatch` ops straight to the store — the map
   * stage is unmounted while this panel is on screen (one-activity-at-a-time
   * shell), so it carries its own local undo history for the edits it makes.
   * Jump-to hands the target to the map controller and switches to the Map
   * activity, where `MapView` centers the viewport.
   */
  let { roomId, isGM }: { roomId: string; isGM: boolean } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);
  const shell = getContext<ShellState>(SHELL_STATE_KEY);

  let rooms = $state<MapRoom[]>([]);
  onMount(() => store.subscribeMapRooms(roomId, (r) => (rooms = r)));

  const ordered = $derived(sortMapRoomsByKey(rooms));

  // Local, panel-scoped undo history (see the component doc above).
  const undoStack = new UndoStack<EditorOp>();
  let canUndo = $state(false);
  let canRedo = $state(false);
  function syncFlags(): void {
    canUndo = undoStack.canUndo();
    canRedo = undoStack.canRedo();
  }

  async function commitForward(op: EditorOp): Promise<void> {
    if (op.kind === 'mapRoom') {
      if (op.to) await store.upsertMapRoom(roomId, op.to);
      else await store.removeMapRoom(roomId, op.id);
    } else if (op.kind === 'mapRoomBatch') {
      for (const c of op.changes) await store.upsertMapRoom(roomId, c.to);
    }
  }

  async function applyOp(op: EditorOp): Promise<void> {
    if (isNoopOp(op)) return;
    await commitForward(op);
    undoStack.push(op);
    syncFlags();
  }

  async function undo(): Promise<void> {
    const op = undoStack.undo();
    if (!op) return;
    await commitForward(invertOp(op));
    syncFlags();
  }

  async function redo(): Promise<void> {
    const op = undoStack.redo();
    if (!op) return;
    await commitForward(op);
    syncFlags();
  }

  // ---- inline rename / renumber ----

  let editingId = $state<string | null>(null);
  let editKey = $state('');
  let editName = $state('');

  const editError = $derived.by(() => {
    if (editingId === null) return '';
    if (!editKey.trim()) return 'Key is required.';
    if (!isMapRoomKeyUnique(editKey.trim(), rooms, editingId)) return 'Key already in use.';
    return '';
  });

  function startEdit(room: MapRoom): void {
    editingId = room.id;
    editKey = room.key;
    editName = room.name;
  }

  function cancelEdit(): void {
    editingId = null;
  }

  async function saveEdit(): Promise<void> {
    const id = editingId;
    if (id === null || editError) return;
    const existing = rooms.find((r) => r.id === id);
    editingId = null;
    if (!existing) return;
    const key = editKey.trim();
    const name = editName;
    if (key === existing.key && name === existing.name) return;
    await applyOp({ kind: 'mapRoom', id, from: existing, to: { ...existing, key, name } });
  }

  // ---- delete ----

  async function deleteRoom(room: MapRoom): Promise<void> {
    const ok = await dialogs.confirm({
      title: 'Delete room',
      message: `Delete "${room.name || `Room ${room.key}`}"? Its label is removed from the map.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await applyOp({ kind: 'mapRoom', id: room.id, from: room, to: null });
  }

  // ---- jump-to (centers the map viewport on the room) ----

  function jumpTo(room: MapRoom): void {
    mapCtrl.jumpToMapRoomId = room.id;
    shell.setActivity('map');
  }

  // ---- drag reorder → sequential renumber (R13.3) ----

  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);

  function onDragStart(e: DragEvent, id: string): void {
    dragId = id;
    // Firefox requires data for a drag to actually start.
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: DragEvent, id: string): void {
    if (dragId === null) return;
    e.preventDefault();
    dragOverId = id;
  }

  async function onDrop(targetId: string): Promise<void> {
    const from = dragId;
    dragId = null;
    dragOverId = null;
    if (from === null || from === targetId) return;
    const list = ordered;
    const fromIdx = list.findIndex((r) => r.id === from);
    const toIdx = list.findIndex((r) => r.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    const changes = renumberMapRoomsByOrder(next);
    if (changes.length === 0) return;
    await applyOp({ kind: 'mapRoomBatch', changes });
  }

  function onDragEnd(): void {
    dragId = null;
    dragOverId = null;
  }
</script>

<div class="rooms-panel" data-testid="rooms-panel">
  <div class="rooms-head">
    <h3>Rooms</h3>
    {#if isGM}
      <div class="rooms-history">
        <button
          type="button"
          data-testid="rooms-undo"
          title="Undo"
          disabled={!canUndo}
          onclick={() => void undo()}>↶ Undo</button
        >
        <button
          type="button"
          data-testid="rooms-redo"
          title="Redo"
          disabled={!canRedo}
          onclick={() => void redo()}>Redo ↷</button
        >
      </div>
    {/if}
  </div>

  {#if ordered.length === 0}
    <p class="hint" data-testid="rooms-empty">
      No rooms yet. Use the Label tool on the map to key a carved region.
    </p>
  {:else}
    <div class="rooms-cols">
      <span>Key</span>
      <span>Name</span>
      <span class="num">Cells</span>
      <span></span>
    </div>
    <ul class="rooms-list">
      {#each ordered as room (room.id)}
        <li
          class="room-row"
          class:dragover={dragOverId === room.id && dragId !== room.id}
          data-testid={`room-row-${room.id}`}
          draggable={isGM && editingId === null}
          ondragstart={(e) => onDragStart(e, room.id)}
          ondragover={(e) => onDragOver(e, room.id)}
          ondrop={() => void onDrop(room.id)}
          ondragend={onDragEnd}
        >
          {#if editingId === room.id}
            <input
              class="edit-key"
              data-testid={`room-edit-key-${room.id}`}
              aria-label="Room key"
              bind:value={editKey}
            />
            <input
              class="edit-name"
              data-testid={`room-edit-name-${room.id}`}
              aria-label="Room name"
              bind:value={editName}
              onkeydown={(e) => {
                if (e.key === 'Enter') void saveEdit();
                else if (e.key === 'Escape') cancelEdit();
              }}
            />
            <span class="num muted">{mapRoomCellCount(room)}</span>
            <span class="row-actions">
              <button
                type="button"
                class="icon"
                data-testid={`room-edit-save-${room.id}`}
                title="Save"
                disabled={!!editError}
                onclick={() => void saveEdit()}>✓</button
              >
              <button
                type="button"
                class="icon"
                data-testid={`room-edit-cancel-${room.id}`}
                title="Cancel"
                onclick={cancelEdit}>✕</button
              >
            </span>
            {#if editError}
              <span class="edit-error" data-testid={`room-edit-error-${room.id}`}>{editError}</span>
            {/if}
          {:else}
            <span class="room-key" data-testid={`room-key-${room.id}`}>{room.key}</span>
            <span class="room-name" data-testid={`room-name-${room.id}`}
              >{room.name || '(unnamed)'}</span
            >
            <span class="num muted" data-testid={`room-cells-${room.id}`}>{mapRoomCellCount(room)}</span>
            <span class="row-actions">
              <button
                type="button"
                class="icon"
                data-testid={`room-jump-${room.id}`}
                title="Jump to room"
                onclick={() => jumpTo(room)}>⤢</button
              >
              {#if isGM}
                <button
                  type="button"
                  class="icon"
                  data-testid={`room-edit-${room.id}`}
                  title="Rename / renumber"
                  onclick={() => startEdit(room)}>✎</button
                >
                <button
                  type="button"
                  class="icon danger"
                  data-testid={`room-delete-${room.id}`}
                  title="Delete room"
                  onclick={() => void deleteRoom(room)}>✕</button
                >
                <span
                  class="drag-handle"
                  data-testid={`room-drag-${room.id}`}
                  title="Drag to reorder">⋮⋮</span
                >
              {/if}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if isGM}
      <p class="legend">⤢ jump-to · ✎ rename/renumber · ✕ delete · ⋮⋮ drag to reorder</p>
    {/if}
  {/if}
</div>

<style>
  .rooms-panel {
    max-width: 460px;
  }
  .rooms-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .rooms-head h3 {
    font-size: 0.95rem;
    margin: 0 0 0.4rem;
  }
  .rooms-history {
    display: flex;
    gap: 0.3rem;
  }
  .rooms-history button {
    padding: 0.15rem 0.45rem;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .rooms-history button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .rooms-cols {
    display: grid;
    grid-template-columns: 2.5rem 1fr 3rem auto;
    gap: 0.4rem;
    padding: 0 0.5rem 0.25rem;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.6;
  }
  .rooms-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .room-row {
    display: grid;
    grid-template-columns: 2.5rem 1fr 3rem auto;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 0.82rem;
  }
  .room-row.dragover {
    border-color: var(--accent);
    box-shadow: 0 -2px 0 var(--accent) inset;
  }
  .room-key {
    font-weight: 600;
    color: var(--accent-text, var(--accent));
  }
  .room-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .num {
    text-align: right;
  }
  .muted {
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
  }
  .row-actions {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }
  button.icon {
    padding: 0.1rem 0.3rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: inherit;
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
  }
  button.icon:hover:not(:disabled) {
    border-color: var(--line-strong);
    background: var(--bg-inset);
  }
  button.icon:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.icon.danger:hover:not(:disabled) {
    color: var(--failure);
    border-color: var(--failure);
  }
  .drag-handle {
    cursor: grab;
    opacity: 0.5;
    padding: 0 0.2rem;
    user-select: none;
  }
  .edit-key,
  .edit-name {
    box-sizing: border-box;
    width: 100%;
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
    font-size: 0.8rem;
  }
  .edit-error {
    grid-column: 1 / -1;
    color: var(--failure);
    font-size: 0.72rem;
  }
  .legend {
    font-size: 0.68rem;
    opacity: 0.6;
    margin: 0.5rem 0 0;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }
</style>
