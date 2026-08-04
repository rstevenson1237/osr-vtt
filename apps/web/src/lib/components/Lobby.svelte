<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import {
    MAX_ROOMS_SOFT,
    STALE_ROOM_DAYS,
    atRoomSoftCap,
    countGmRooms,
    dormantDismissalUntil,
    isRoomDormant,
    snapshotToArchive,
    type AccountInfo,
    type CampaignStore,
    type MyRoomEntry,
    type Room,
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
  // The room docs behind the index entries, from the same existence check that
  // populates `missing` — read for `lastActivityAt` (R25.2). A room we could
  // not read is simply absent here, which reads as "not dormant".
  let roomDocs = $state<Map<string, Room>>(new Map());
  let confirmingId = $state<string | null>(null);
  let busyRoomId = $state<string | null>(null);
  let deleteError = $state('');

  // ---- Account gate on creation (R24.1) ----
  // Creating a room requires a non-anonymous provider, so the Create form has
  // to know who we are. Until the account resolves we treat it as anonymous —
  // the affordance is an invitation to sign in, so showing it a moment early is
  // harmless, whereas offering a Create button that is about to fail is not.
  let account = $state<AccountInfo | null>(null);
  let signingIn = $state(false);
  let signInError = $state('');
  const isAnonymous = $derived(account?.isAnonymous ?? true);

  // ---- Soft cap (R24.3) ----
  const gmRoomCount = $derived(countGmRooms(myRooms));
  const atCap = $derived(atRoomSoftCap(myRooms));

  let currentUid: string | null = null;
  let unsubAuth: Unsubscribe | null = null;
  let unsubMyRooms: Unsubscribe | null = null;

  onMount(() => {
    // subscribeMyRooms is scoped to the current uid, so re-point it whenever the
    // identity changes (an anonymous bootstrap completing, or a Google sign-in
    // recovering a linked uid on a fresh device).
    unsubAuth = store.subscribeAuth((a) => {
      account = a;
      const uid = a?.uid ?? null;
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
          .then((room) => [r.roomId, room] as const)
          // A read that *failed* is not a room that is gone — keep the row
          // ordinary rather than accusing a live room of being deleted.
          .catch(() => [r.roomId, undefined] as const),
      ),
    );
    missing = new Set(results.filter(([, room]) => room === null).map(([id]) => id));
    roomDocs = new Map(
      results.filter((r): r is readonly [string, Room] => !!r[1]).map(([id, room]) => [id, room]),
    );
  }

  /**
   * Dormant rooms (R25.2) — a *surface*, never an automatic deletion. Nothing
   * here removes anything; it offers the referee the three things they might
   * plausibly want, and "Keep" is one of them.
   */
  function dormant(entry: MyRoomEntry): boolean {
    return !missing.has(entry.roomId) && isRoomDormant(entry, roomDocs.get(entry.roomId));
  }

  async function exportRoomOnly(entry: MyRoomEntry): Promise<void> {
    if (busyRoomId) return;
    busyRoomId = entry.roomId;
    deleteError = '';
    try {
      const snapshot = await store.exportRoom(entry.roomId);
      downloadArchive(snapshotToArchive(snapshot), `${safeName(entry.name)}.vttcamp`);
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to export room';
    } finally {
      busyRoomId = null;
    }
  }

  async function keepRoom(entry: MyRoomEntry): Promise<void> {
    await store.dismissRoomDormancy(entry.roomId, dormantDismissalUntil());
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

  /**
   * Link the current anonymous uid to Google so this browser may create rooms
   * (R24.1). `linkWithGoogle` upgrades the uid **in place**, so anything this
   * identity already has — seats, My Rooms entries — survives. Falls back to
   * `signInWithGoogle` when the chosen account is already bound to another uid,
   * which switches identity rather than merging (R6.1's rule, unchanged).
   */
  async function signInToCreate(): Promise<void> {
    if (signingIn) return;
    signingIn = true;
    signInError = '';
    try {
      const res = await store.linkWithGoogle();
      if (!res.ok && res.reason === 'credential-already-in-use') {
        await store.signInWithGoogle();
      } else if (!res.ok && res.reason !== 'cancelled') {
        signInError = res.message ?? 'Could not sign in';
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        signInError = err instanceof Error ? err.message : 'Sign-in failed';
      }
    } finally {
      signingIn = false;
    }
  }

  async function createRoom() {
    if (!roomName.trim() || creating || isAnonymous || atCap) return;
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

            {#if dormant(entry) && confirmingId !== entry.roomId}
              <!--
                R25.2's dormant affordance. Deliberately not a modal and not a
                countdown: the room is fine, it is just quiet, and the referee
                may well want to do nothing at all.
              -->
              <div class="dormant" data-testid={`my-room-dormant-${entry.roomId}`}>
                <span class="dormant-msg">
                  No activity in over {STALE_ROOM_DAYS} days.
                </span>
                <button
                  data-testid={`my-room-dormant-export-${entry.roomId}`}
                  disabled={busyRoomId === entry.roomId}
                  onclick={() => exportRoomOnly(entry)}
                >
                  Export
                </button>
                <button
                  class="danger"
                  data-testid={`my-room-dormant-delete-${entry.roomId}`}
                  onclick={() => (confirmingId = entry.roomId)}
                >
                  Delete
                </button>
                <button
                  data-testid={`my-room-dormant-keep-${entry.roomId}`}
                  onclick={() => keepRoom(entry)}
                >
                  Keep
                </button>
              </div>
            {/if}

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
                  <span class="confirm-msg"
                    >Delete this room for everyone? This can't be undone.</span
                  >
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
                  <button
                    data-testid={`my-room-open-${entry.roomId}`}
                    onclick={() => openRoom(entry)}
                  >
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

    {#if isAnonymous}
      <!--
        R24.1: creating a room needs a real account, so we invite rather than
        letting the write fail. The copy leads with what signing in *gives*
        you — this is the one place in the app where sign-in is load-bearing,
        and it should not read as a gate. Joining a room stays anonymous and
        promptless, which is why this affordance lives here and not on the
        Join section below.
      -->
      <div class="signin-gate" data-testid="create-room-signin-gate">
        <p class="gate-lead">Sign in to create a room.</p>
        <p class="gate-why">
          Rooms you create are tied to your account, so they follow you across devices and you can
          always get back in as referee. Joining a room needs no account at all.
        </p>
        <button
          data-testid="create-room-signin"
          onclick={signInToCreate}
          disabled={signingIn}
          class="gate-btn"
        >
          {signingIn ? 'Signing in…' : 'Sign in with Google to create a room'}
        </button>
        {#if signInError}
          <p class="error" data-testid="create-room-signin-error">{signInError}</p>
        {/if}
      </div>
    {:else}
      <label>
        Room name
        <input
          data-testid="create-room-name"
          bind:value={roomName}
          placeholder="The Sunless Vault"
        />
      </label>
      <label>
        Room password <span class="hint">(optional — stored for later, not enforced yet)</span>
        <input data-testid="create-room-password" type="password" bind:value={password} />
      </label>
      <button
        data-testid="create-room-submit"
        onclick={createRoom}
        disabled={creating || atCap}
        title={atCap ? `You have ${gmRoomCount} rooms.` : undefined}
      >
        {creating ? 'Creating…' : 'Create room'}
      </button>
      {#if atCap}
        <!-- R24.3 soft cap: honest friction for honest users, not a boundary. -->
        <p class="error" data-testid="create-room-cap">
          You have {gmRoomCount} rooms. Delete or export one to make space.
        </p>
      {:else if gmRoomCount >= MAX_ROOMS_SOFT - 2}
        <p class="hint" data-testid="create-room-cap-near">
          {gmRoomCount} of {MAX_ROOMS_SOFT} rooms used.
        </p>
      {/if}
      {#if createError}
        <p class="error">{createError}</p>
      {/if}
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

  <section class="credits" data-testid="lobby-credits">
    <h2>Credits</h2>
    <ul class="credits-list">
      <li data-testid="credit-classic-dungeon-symbols">
        <strong>Classic Dungeon Map Symbols</strong><br />
        By Mark Gosbell<br />
        <a href="https://markgosbell.itch.io/classic-dungeon-map-symbols" target="_blank" rel="noopener noreferrer">markgosbell.itch.io</a><br />
        <span class="license">CC0 1.0 Universal</span>
      </li>
    </ul>
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
  /* R24.1 create-room sign-in affordance */
  .signin-gate {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }
  .gate-lead {
    margin: 0;
    font-weight: 600;
  }
  .gate-why {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-dim);
    line-height: 1.45;
  }
  .gate-btn {
    margin-top: 0.4rem;
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
  .dormant,
  .confirm {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .confirm-msg,
  .dormant-msg {
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  /* A quiet inset rather than a warning banner — a dormant room is not an
     error state (R25.2), and the row's ordinary Open/Delete actions stay
     exactly where they were. */
  .dormant {
    margin-left: auto;
    padding: 0.3rem 0.5rem;
    border: 1px dashed var(--line-strong);
    border-radius: 4px;
    background: color-mix(in srgb, var(--bg-panel) 60%, transparent);
  }
  .room-actions button,
  .dormant button,
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
  .dormant button.danger,
  .confirm button.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
  /* Credits section */
  .credits-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .credits-list li {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-dim);
  }
  .credits-list strong {
    color: inherit;
    font-weight: 600;
  }
  .credits-list a {
    color: var(--accent);
    text-decoration: none;
  }
  .credits-list a:hover {
    text-decoration: underline;
  }
  .license {
    font-size: 0.75rem;
    opacity: 0.8;
  }
</style>
