<script lang="ts">
  import { getContext, onMount, onDestroy } from 'svelte';
  import type {
    CampaignStore,
    Encounter,
    Group,
    LogEntry,
    PlayerSeat,
    ProfileInstance,
    Roll,
    Room,
    Token,
    Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { roomShareUrl } from '../routes';
  import MainStage from './MainStage.svelte';
  import CharacterDock from './CharacterDock.svelte';
  import ProfileTemplateEditor from './ProfileTemplateEditor.svelte';
  import DiceTray from './DiceTray.svelte';
  import DiceOverlay from './DiceOverlay.svelte';
  import ActionLog from './ActionLog.svelte';

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
        </p>
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
      {/if}
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
    background: #241f18;
    border: 1px solid #3a3226;
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
    border: 1px solid #4a4030;
    background: #14110d;
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
    color: #e08080;
  }
  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    background: #a6763f;
    color: #14110d;
    font-weight: 600;
    cursor: pointer;
  }
  .link-btn {
    margin-top: 0;
    padding: 0.1rem 0.5rem;
    font-size: 0.8rem;
    background: transparent;
    border: 1px solid #4a4030;
    color: inherit;
    font-weight: normal;
  }
  .back-to-mine {
    align-self: flex-start;
  }
</style>
