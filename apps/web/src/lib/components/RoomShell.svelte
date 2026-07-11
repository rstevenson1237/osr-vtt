<script lang="ts">
  import { getContext, onMount, onDestroy } from 'svelte';
  import {
    archiveToSnapshot,
    snapshotToArchive,
    type CampaignStore,
    type Encounter,
    type Group,
    type LogEntry,
    type PlayerSeat,
    type ProfileInstance,
    type Roll,
    type Room,
    type Token,
    type Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { navigateToRoom, roomShareUrl } from '../routes';
  import { applyTheme, resolveThemeName } from '../theme';
  import MainStage from './MainStage.svelte';
  import CharacterDock from './CharacterDock.svelte';
  import ProfileTemplateEditor from './ProfileTemplateEditor.svelte';
  import DiceTray from './DiceTray.svelte';
  import DiceOverlay from './DiceOverlay.svelte';
  import ActionLog from './ActionLog.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import HandoutPanel from './HandoutPanel.svelte';

  let { roomId }: { roomId: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let myUid = $state<string | null>(null);
  let room = $state<Room | null>(null);
  let players = $state<PlayerSeat[]>([]);
  let tokens = $state<Token[]>([]);
  let profiles = $state<ProfileInstance[]>([]);
  let log = $state<LogEntry[]>([]);
  let rolls = $state<Roll[]>([]);
  let groups = $state<Group[]>([]);
  let encounter = $state<Encounter | null>(null);

  let joinName = $state('');
  let joining = $state(false);
  let joinError = $state('');
  let selectedSeatId = $state<string | null>(null);

  let unsubs: Unsubscribe[] = [];

  const me = $derived(players.find((p) => p.uid === myUid) ?? null);
  const hasJoined = $derived(me !== null);
  const isGM = $derived(room !== null && myUid !== null && room.gmUid === myUid);
  // The Dock shows whichever actor's card was last selected on the
  // Encounter Board (Spec §5), defaulting back to my own sheet.
  const dockSeatId = $derived(selectedSeatId ?? myUid ?? '');
  const dockProfile = $derived(profiles.find((p) => p.seatId === dockSeatId));
  const dockReadOnly = $derived(dockSeatId !== myUid && !isGM);

  onMount(async () => {
    myUid = await store.ensureAuth();
    unsubs.push(store.subscribeRoom(roomId, (r) => (room = r)));
    unsubs.push(store.subscribePlayers(roomId, (p) => (players = p)));
    unsubs.push(store.subscribeTokens(roomId, (t) => (tokens = t)));
    unsubs.push(store.subscribeProfiles(roomId, (p) => (profiles = p)));
    unsubs.push(store.subscribeLog(roomId, (l) => (log = l)));
    unsubs.push(store.subscribeRolls(roomId, (r) => (rolls = r)));
    unsubs.push(store.subscribeGroups(roomId, (g) => (groups = g)));
    unsubs.push(store.subscribeEncounter(roomId, (e) => (encounter = e)));
  });

  // Room-level theme (Master Plan v2, R2/R4) — GM-set, so every player sees
  // the same map colors; re-applies whenever the room doc changes.
  $effect(() => {
    if (room) applyTheme(resolveThemeName(room.settings.theme));
  });

  onDestroy(() => {
    for (const unsub of unsubs) unsub();
    unsubs = [];
  });

  async function join() {
    if (!joinName.trim() || joining) return;
    joining = true;
    joinError = '';
    try {
      await store.joinRoom(roomId, joinName.trim());
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Failed to join room';
    } finally {
      joining = false;
    }
  }

  let linkCopied = $state(false);

  async function copyShareLink() {
    await navigator.clipboard.writeText(roomShareUrl(roomId));
    linkCopied = true;
    setTimeout(() => (linkCopied = false), 1500);
  }

  // ---- `.vttcamp` export/import (Plan §5, §7 Phase 5) ----

  let exporting = $state(false);
  let importing = $state(false);
  let importError = $state('');

  function downloadArchive(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes.slice()], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportRoomFile(): Promise<void> {
    if (exporting) return;
    exporting = true;
    try {
      const snapshot = await store.exportRoom(roomId);
      const archive = snapshotToArchive(snapshot);
      const safeName = (room?.name ?? 'campaign').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      downloadArchive(archive, `${safeName || 'campaign'}.vttcamp`);
    } finally {
      exporting = false;
    }
  }

  async function importRoomFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importError = '';
    importing = true;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const snapshot = archiveToSnapshot(bytes);
      const newRoomId = await store.importRoom(snapshot);
      navigateToRoom(newRoomId);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Failed to import .vttcamp';
    } finally {
      importing = false;
      input.value = '';
    }
  }
</script>

{#if room === null}
  <p class="loading">Loading room…</p>
{:else if !hasJoined}
  <div class="join-gate">
    <h1 data-testid="room-name">{room.name}</h1>
    <p data-testid="room-id" class="room-id">Room ID: <code>{roomId}</code></p>
    <label>
      Display name
      <input
        data-testid="join-display-name"
        bind:value={joinName}
        placeholder="Your name at the table"
      />
    </label>
    <button data-testid="join-submit" onclick={join} disabled={joining}>
      {joining ? 'Joining…' : 'Join room'}
    </button>
    {#if joinError}
      <p class="error">{joinError}</p>
    {/if}
  </div>
{:else}
  <div class="room-shell">
    <aside class="left">
      <ActionLog entries={log} />
    </aside>

    <section class="center">
      <header>
        <h1 data-testid="room-name">{room.name}</h1>
        <p data-testid="room-id" class="room-id">
          Room ID: <code>{roomId}</code> · You are <span data-testid="my-role">{me?.role}</span>
          ·
          <button data-testid="copy-share-link" class="link-btn" onclick={copyShareLink}
            >{linkCopied ? 'Copied!' : 'Copy invite link'}</button
          >
          ·
          <button
            data-testid="export-room"
            class="link-btn"
            onclick={() => void exportRoomFile()}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export .vttcamp'}
          </button>
          ·
          <label class="link-btn import-label">
            {importing ? 'Importing…' : 'Import .vttcamp'}
            <input
              type="file"
              accept=".vttcamp"
              data-testid="import-room-file"
              disabled={importing}
              onchange={(e) => void importRoomFile(e)}
            />
          </label>
        </p>
        {#if importError}
          <p class="error" data-testid="import-error">{importError}</p>
        {/if}
      </header>
      <MainStage
        {roomId}
        {room}
        {tokens}
        {groups}
        {encounter}
        {isGM}
        myUid={myUid ?? ''}
        {players}
        {profiles}
        {rolls}
        {selectedSeatId}
        onSelectActor={(seatId) => (selectedSeatId = seatId)}
      />
    </section>

    <aside class="right">
      {#if isGM}
        <ProfileTemplateEditor {roomId} template={room.profileTemplate} />
        <HandoutPanel {roomId} {isGM} revealedRef={room.handout?.ref ?? null} />
      {/if}
      <NotesPanel {roomId} />
      {#if dockSeatId !== myUid}
        <button
          class="link-btn back-to-mine"
          data-testid="dock-back-to-mine"
          onclick={() => (selectedSeatId = null)}
        >
          ← Back to my sheet
        </button>
      {/if}
      <CharacterDock
        template={room.profileTemplate}
        profile={dockProfile}
        seatId={dockSeatId}
        readOnly={dockReadOnly}
        {roomId}
      />
      <DiceTray {roomId} authorUid={myUid ?? ''} />
      <DiceOverlay {rolls} />
    </aside>
  </div>
{/if}

<style>
  .loading {
    padding: 2rem;
  }
  .join-gate {
    max-width: 420px;
    margin: 3rem auto;
    padding: 1.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .join-gate label {
    display: block;
    margin: 0.75rem 0;
  }
  .join-gate input {
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
  .room-id code {
    user-select: all;
  }
  .room-shell {
    display: grid;
    grid-template-columns: 280px 1fr 320px;
    gap: 0.75rem;
    height: 100vh;
    box-sizing: border-box;
    padding: 0.75rem;
  }
  .left,
  .right {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  header {
    margin-bottom: 0.5rem;
  }
  header h1 {
    margin: 0;
    font-size: 1.25rem;
  }
  .error {
    color: var(--error);
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
  .link-btn {
    margin-top: 0;
    padding: 0.1rem 0.5rem;
    font-size: 0.8rem;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: inherit;
    font-weight: normal;
  }
  .import-label {
    display: inline-block;
    cursor: pointer;
  }
  .import-label input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }
  .back-to-mine {
    align-self: flex-start;
  }
</style>
