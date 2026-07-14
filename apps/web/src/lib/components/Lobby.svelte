<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import {
    snapshotToArchive,
    type CampaignStore,
    type MyRoomEntry,
    type Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { navigateToRoom } from '../routes';
  import { STARTER_PROFILE_TEMPLATE } from '../profile/starter-template';
  import AccountControls from './AccountControls.svelte';

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let roomName = $state('');
  let password = $state('');
  let creating = $state(false);
  let createError = $state('');

  let joinRoomId = $state('');

  // ---- My Rooms (Master Plan v2, R6.2) ----
  let myRooms = $state<MyRoomEntry[]>([]);
  // roomIds whose room doc no longer exists — the entry is dangling (deleted
  // elsewhere) and renders a "room gone — remove?" row (best-effort index).
  let missing = $state<Set<string>>(new Set());
  let confirmingId = $state<string | null>(null);
  let busyRoomId = $state<string | null>(null);
  let deleteError = $state('');

  let currentUid: string | null = null;
  let unsubAuth: Unsubscribe | null = null;
  let unsubMyRooms: Unsubscribe | null = null;

  onMount(() => {
    // subscribeMyRooms is scoped to the current uid, so re-point it whenever the
    // identity changes (an anonymous bootstrap completing, or a Google sign-in
    // recovering a linked uid on a fresh device).
    unsubAuth = store.subscribeAuth((account) => {
      const uid = account?.uid ?? null;
      if (uid === currentUid) return;
      currentUid = uid;
      unsubMyRooms?.();
      unsubMyRooms = store.subscribeMyRooms((rooms) => {
        myRooms = rooms;
        void checkExistence(rooms);
      });
    });
    // Bootstrap at least an anonymous identity so create/join have a uid and the
    // My Rooms index resolves.
    void store.ensureAuth();
  });

  onDestroy(() => {
    unsubMyRooms?.();
    unsubAuth?.();
  });

  async function checkExistence(rooms: MyRoomEntry[]): Promise<void> {
    const results = await Promise.all(
      rooms.map((r) =>
        store
          .getRoom(r.roomId)
          .then((room) => [r.roomId, room !== null] as const)
          .catch(() => [r.roomId, true] as const),
      ),
    );
    missing = new Set(results.filter(([, exists]) => !exists).map(([id]) => id));
  }

  function roleLabel(role: string): string {
    return role === 'gm' ? 'Referee' : role === 'viewer' ? 'Viewer' : 'Player';
  }

  function relativeTime(ts: number): string {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  async function openRoom(entry: MyRoomEntry): Promise<void> {
    // "written on … open" (Master Plan v2, R6.2) — bump lastSeenAt before nav.
    await store.recordRoomVisit(entry.roomId, { name: entry.name, role: entry.role });
    navigateToRoom(entry.roomId);
  }

  async function removeEntry(roomId: string): Promise<void> {
    await store.removeMyRoom(roomId);
    confirmingId = null;
  }

  function safeName(name: string): string {
    return (name || 'campaign').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'campaign';
  }

  function downloadArchive(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes.slice()], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteRoom(entry: MyRoomEntry, exportFirst: boolean): Promise<void> {
    if (busyRoomId) return;
    busyRoomId = entry.roomId;
    deleteError = '';
    try {
      if (exportFirst) {
        const snapshot = await store.exportRoom(entry.roomId);
        downloadArchive(snapshotToArchive(snapshot), `${safeName(entry.name)}.vttcamp`);
      }
      await store.deleteRoom(entry.roomId);
      await store.removeMyRoom(entry.roomId);
      confirmingId = null;
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to delete room';
    } finally {
      busyRoomId = null;
    }
  }

  async function createRoom() {
    if (!roomName.trim() || creating) return;
    creating = true;
    createError = '';
    try {
      const roomId = await store.createRoom({
        name: roomName.trim(),
        profileTemplate: STARTER_PROFILE_TEMPLATE,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      navigateToRoom(roomId);
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create room';
    } finally {
      creating = false;
    }
  }

  function joinExistingRoom() {
    if (!joinRoomId.trim()) return;
    navigateToRoom(joinRoomId.trim());
  }
</script>

<div class="lobby">
  <div class="lobby-head">
    <h1>OSR VTT</h1>
    <AccountControls placement="lobby" />
  </div>

  {#if myRooms.length > 0}
    <section data-testid="my-rooms">
      <h2>My rooms</h2>
      <ul class="rooms">
        {#each myRooms as entry (entry.roomId)}
          {@const gone = missing.has(entry.roomId)}
          <li class="room-row" class:gone data-testid={`my-room-${entry.roomId}`}>
            <div class="room-main">
              <span class="room-name">{entry.name}</span>
              {#if gone}
                <span class="badge gone-badge">room gone</span>
              {:else}
                <span class="badge">{roleLabel(entry.role)}</span>
              {/if}
              {#if entry.lastSeenAt}
                <span class="seen">{relativeTime(entry.lastSeenAt)}</span>
              {/if}
            </div>

            {#if confirmingId === entry.roomId}
              <div class="confirm" data-testid={`my-room-confirm-${entry.roomId}`}>
                {#if gone || entry.role !== 'gm'}
                  <span class="confirm-msg">
                    {gone ? 'This room no longer exists.' : 'Remove this room from your list?'}
                  </span>
                  <button
                    class="danger"
                    data-testid={`my-room-remove-confirm-${entry.roomId}`}
                    onclick={() => removeEntry(entry.roomId)}
                  >
                    Remove
                  </button>
                {:else}
                  <span class="confirm-msg">Delete this room for everyone? This can't be undone.</span>
                  <button
                    data-testid={`my-room-export-delete-${entry.roomId}`}
                    disabled={busyRoomId === entry.roomId}
                    onclick={() => deleteRoom(entry, true)}
                  >
                    Export &amp; delete
                  </button>
                  <button
                    class="danger"
                    data-testid={`my-room-delete-confirm-${entry.roomId}`}
                    disabled={busyRoomId === entry.roomId}
                    onclick={() => deleteRoom(entry, false)}
                  >
                    {busyRoomId === entry.roomId ? 'Deleting…' : 'Delete'}
                  </button>
                {/if}
                <button
                  data-testid={`my-room-cancel-${entry.roomId}`}
                  onclick={() => (confirmingId = null)}
                >
                  Cancel
                </button>
              </div>
            {:else}
              <div class="room-actions">
                {#if !gone}
                  <button data-testid={`my-room-open-${entry.roomId}`} onclick={() => openRoom(entry)}>
                    Open
                  </button>
                {/if}
                <button
                  class="danger"
                  data-testid={`my-room-delete-${entry.roomId}`}
                  onclick={() => (confirmingId = entry.roomId)}
                >
                  {gone || entry.role !== 'gm' ? 'Remove' : 'Delete'}
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      {#if deleteError}
        <p class="error" data-testid="my-rooms-error">{deleteError}</p>
      {/if}
    </section>
  {/if}

  <section>
    <h2>Create room as Referee</h2>
    <label>
      Room name
      <input data-testid="create-room-name" bind:value={roomName} placeholder="The Sunless Vault" />
    </label>
    <label>
      Room password <span class="hint">(optional — stored for later, not enforced yet)</span>
      <input data-testid="create-room-password" type="password" bind:value={password} />
    </label>
    <button data-testid="create-room-submit" onclick={createRoom} disabled={creating}>
      {creating ? 'Creating…' : 'Create room'}
    </button>
    {#if createError}
      <p class="error">{createError}</p>
    {/if}
  </section>

  <section>
    <h2>Join a room</h2>
    <label>
      Room ID or link
      <input data-testid="join-room-id" bind:value={joinRoomId} placeholder="Paste a room ID" />
    </label>
    <button data-testid="join-room-go" onclick={joinExistingRoom}>Go to room</button>
  </section>
</div>

<style>
  .lobby {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  .lobby-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .lobby-head h1 {
    margin: 0;
  }
  section {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
  }
  h2 {
    margin-top: 0;
  }
  label {
    display: block;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hint {
    opacity: 0.6;
    font-weight: normal;
  }
  .error {
    color: var(--error);
  }
  /* My Rooms list */
  .rooms {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .room-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-inset);
  }
  .room-row.gone {
    opacity: 0.7;
  }
  .room-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1 1 auto;
  }
  .room-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    font-size: 0.68rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    color: var(--text-dim);
    background: var(--bg-panel);
  }
  .gone-badge {
    color: var(--error);
    border-color: var(--error);
  }
  .seen {
    font-size: 0.72rem;
    color: var(--text-dim);
  }
  .room-actions,
  .confirm {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .confirm-msg {
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .room-actions button,
  .confirm button {
    margin-top: 0;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    font-weight: 500;
    background: var(--bg-panel);
    color: inherit;
    border: 1px solid var(--line-strong);
  }
  .room-actions button.danger,
  .confirm button.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
</style>
