<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, MapRoom } from '@osr-vtt/shared';
  import {
    CAMPAIGN_STORE_KEY,
    DIALOG_KEY,
    MAP_TOOL_KEY,
    ROOM_NOTES_KEY,
    SHELL_STATE_KEY,
  } from '../../context';
  import type { DialogService } from '../../shell/dialogs.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';
  import type { ShellState } from '../../shell/shell-state.svelte';
  import type { RoomNotesDoc } from '../../collab/room-notes.svelte';
  import MarkdownEditor from '../MarkdownEditor.svelte';
  import MarkdownView from '../MarkdownView.svelte';
  import { UndoStack } from '../../map/undo';
  import {
    invertOp,
    isNoopOp,
    isMapRoomKeyUnique,
    mapRoomCellCount,
    nextMapRoomKey,
    renumberMapRoomsByOrder,
    sortMapRoomsByKey,
    type MapRoomOp,
  } from '../../map/map-room-tools';

  /**
   * Rooms manager (Master Plan v2, R17.2 / R13.3 / WI-20; restructured by the
   * Shell UI Redesign into the Room quick sheet). Lists every dungeon `MapRoom`
   * in the session with rename, renumber, reorder, jump-to and delete, plus the
   * per-room **players' notes** — long-form markdown any seat may write, shown
   * as a hover preview on each row and edited inline for the selected room.
   *
   * Two presentations off one component:
   *
   * - `mode="selected"` (the docked Room quick sheet) — just the currently
   *   selected room, with a hint that Select → Object picks one on the map.
   * - `mode="full"` (the expanded sheet, and the Assets activity) — the whole
   *   list plus the notes editor.
   *
   * It reads the shared `mapRooms` subscription and writes undoable `mapRoom` /
   * `mapRoomBatch` ops straight to the store, carrying its own local undo
   * history for the edits it makes. Notes are CRDT-backed (`RoomNotesDoc`), so
   * two players writing at once converge rather than stomping — and no
   * `MapRoom` schema change was needed to add them. Selection is shared with
   * the map canvas through `MapToolController.selectedMapRoomId`.
   */
  let {
    roomId,
    mapId,
    isGM,
    mode = 'full',
    showNotes = false,
  }: {
    roomId: string;
    mapId: string;
    isGM: boolean;
    mode?: 'full' | 'selected';
    showNotes?: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);
  const shell = getContext<ShellState>(SHELL_STATE_KEY);
  const roomNotes = getContext<RoomNotesDoc | undefined>(ROOM_NOTES_KEY);

  let rooms = $state<MapRoom[]>([]);
  // Re-subscribes if the GM switches the active map while this panel stays
  // mounted (Master Plan v2, R17.3) — mapRooms are per-map data.
  $effect(() => {
    return store.subscribeMapRooms(roomId, mapId, (r) => (rooms = r));
  });

  const ordered = $derived(sortMapRoomsByKey(rooms));
  const selected = $derived(ordered.find((r) => r.id === mapCtrl.selectedMapRoomId) ?? null);
  /** The rows this presentation renders. */
  const visible = $derived(mode === 'selected' ? (selected ? [selected] : []) : ordered);

  // Local, panel-scoped undo history (see the component doc above).
  const undoStack = new UndoStack<MapRoomOp>();
  let canUndo = $state(false);
  let canRedo = $state(false);
  function syncFlags(): void {
    canUndo = undoStack.canUndo();
    canRedo = undoStack.canRedo();
  }

  async function commitForward(op: MapRoomOp): Promise<void> {
    if (op.kind === 'mapRoom') {
      if (op.to) await store.upsertMapRoom(roomId, mapId, op.to);
      else await store.removeMapRoom(roomId, mapId, op.id);
    } else if (op.kind === 'mapRoomBatch') {
      for (const c of op.changes) await store.upsertMapRoom(roomId, mapId, c.to);
    }
  }

  async function applyOp(op: MapRoomOp): Promise<void> {
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

  // ---- selection (shared with the map's Select → Object tool) ----

  function selectRoom(room: MapRoom): void {
    mapCtrl.selectedMapRoomId = room.id;
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

  // ---- add / delete ----

  /** A room added from the list has no carved region to sit on yet, so its
   * label lands near the lattice origin; the GM drags it into place with
   * Select → Object. (The Label tool remains the in-place way to key a
   * region — this is the list-side equivalent the redesign calls for.) */
  async function addRoom(): Promise<void> {
    const id = `room-${crypto.randomUUID()}`;
    const room: MapRoom = {
      id,
      key: nextMapRoomKey(rooms.map((r) => r.key)),
      name: 'New room',
      bbox: { x: 1, y: 1, w: 2, h: 2 },
      labelAnchor: { x: 2, y: 2 },
      wallStyle: 'masonry',
    };
    await applyOp({ kind: 'mapRoom', id, from: null, to: room });
    mapCtrl.selectedMapRoomId = id;
  }

  async function deleteRoom(room: MapRoom): Promise<void> {
    const ok = await dialogs.confirm({
      title: 'Delete room',
      message: `Delete "${room.name || `Room ${room.key}`}"? Its label is removed from the map.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await applyOp({ kind: 'mapRoom', id: room.id, from: room, to: null });
    if (mapCtrl.selectedMapRoomId === room.id) mapCtrl.selectedMapRoomId = null;
  }

  // ---- jump-to (centers the map viewport on the room) ----

  function jumpTo(room: MapRoom): void {
    mapCtrl.jumpToMapRoomId = room.id;
    mapCtrl.selectedMapRoomId = room.id;
    shell.setMainView('map');
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

  // ---- players' notes (CRDT-backed, editable by any seat) ----

  let hoverNotesId = $state<string | null>(null);
  let notesPreview = $state(true);

  function noteText(id: string): string {
    return roomNotes?.get(id) ?? '';
  }

  function onNotesInput(id: string, e: Event): void {
    roomNotes?.set(id, (e.currentTarget as HTMLTextAreaElement).value);
  }
</script>

<div class="rooms-panel" data-testid="rooms-panel" data-mode={mode}>
  <div class="rooms-head">
    <h3>{mode === 'selected' ? 'Selected room' : 'Rooms'}</h3>
    {#if isGM && mode === 'full'}
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

  {#if visible.length === 0}
    <p class="hint" data-testid="rooms-empty">
      {#if mode === 'selected'}
        No room selected. Use Select → Object, then click a room label on the map.
      {:else}
        No rooms yet. Use the Label tool on the map to key a carved region.
      {/if}
    </p>
  {:else}
    {#if mode === 'full'}
      <div class="rooms-cols">
        <span>Key</span>
        <span>Name</span>
        <span class="num">Cells</span>
        <span></span>
      </div>
    {/if}
    <ul class="rooms-list">
      {#each visible as room (room.id)}
        <li
          class="room-row"
          class:dragover={dragOverId === room.id && dragId !== room.id}
          class:selected={mapCtrl.selectedMapRoomId === room.id}
          data-testid={`room-row-${room.id}`}
          draggable={isGM && mode === 'full' && editingId === null}
          ondragstart={(e) => onDragStart(e, room.id)}
          ondragover={(e) => onDragOver(e, room.id)}
          ondrop={() => void onDrop(room.id)}
          ondragend={onDragEnd}
          onmouseenter={() => (hoverNotesId = room.id)}
          onmouseleave={() => (hoverNotesId = null)}
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
            <!-- The key doubles as the row's select control, so selecting a
            room is keyboard-reachable and the notes preview has something to
            hang off focus as well as hover. -->
            <button
              type="button"
              class="room-key"
              data-testid={`room-key-${room.id}`}
              title={`Select room ${room.key}`}
              onclick={() => selectRoom(room)}
              onfocus={() => (hoverNotesId = room.id)}
              onblur={() => (hoverNotesId = null)}>{room.key}</button
            >
            <span class="room-name" data-testid={`room-name-${room.id}`}
              >{room.name || '(unnamed)'}</span
            >
            <span class="num muted" data-testid={`room-cells-${room.id}`}
              >{mapRoomCellCount(room)}</span
            >
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
                {#if mode === 'full'}
                  <span
                    class="drag-handle"
                    data-testid={`room-drag-${room.id}`}
                    title="Drag to reorder">⋮⋮</span
                  >
                {/if}
              {/if}
            </span>
          {/if}

          <!-- Hover preview of the room's players' notes. Suppressed while the
          notes editor for that same room is on screen just below. -->
          {#if hoverNotesId === room.id && !(showNotes && selected?.id === room.id)}
            <div class="notes-pop" data-testid={`room-notes-preview-${room.id}`}>
              <MarkdownView text={noteText(room.id)} empty="No player notes yet." />
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if mode === 'selected'}
    <p class="legend">Tip: use Select → Object, then click a room label on the map to select it.</p>
  {:else if isGM}
    <button type="button" class="add-room" data-testid="room-add" onclick={() => void addRoom()}>
      + Add room
    </button>
    <p class="legend">⤢ jump-to · ✎ rename/renumber · ✕ delete · ⋮⋮ drag to reorder</p>
  {/if}

  {#if showNotes && selected}
    <div class="notes-editor">
      <MarkdownEditor
        label={`Players' notes — ${selected.key}`}
        value={noteText(selected.id)}
        bind:preview={notesPreview}
        minHeight="5.5rem"
        placeholder="Long-form notes any player can add or read on hover… supports **markdown**."
        empty="No player notes yet."
        testidPrefix={`room-notes-${selected.id}`}
        oninput={(e) => onNotesInput(selected.id, e)}
      />
    </div>
  {/if}
</div>

<style>
  .rooms-panel {
    max-width: 460px;
  }
  .rooms-panel[data-mode='selected'] {
    max-width: none;
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
  .rooms-panel[data-mode='selected'] .rooms-head h3 {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
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
    position: relative;
  }
  .room-row.selected {
    border-color: var(--accent);
  }
  .room-row.dragover {
    border-color: var(--accent);
    box-shadow: 0 -2px 0 var(--accent) inset;
  }
  button.room-key {
    justify-self: start;
    padding: 0.05rem 0.2rem;
    font: inherit;
    font-weight: 600;
    color: var(--accent-text, var(--accent));
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
  }
  button.room-key:hover {
    border-color: var(--line-strong);
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
  .notes-pop {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 4px;
    width: 220px;
    z-index: 5;
    background: var(--bg-inset);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }
  .add-room {
    margin-top: 0.5rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.74rem;
    border-radius: 5px;
    border: 1px dashed var(--line-strong);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }
  .add-room:hover {
    color: var(--text);
    border-color: var(--accent);
  }
  .notes-editor {
    margin-top: 0.7rem;
    padding-top: 0.7rem;
    border-top: 1px solid var(--line);
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
