<script lang="ts">
  import type {
    Encounter,
    Group,
    PlayerSeat,
    ProfileInstance,
    Roll,
    Room,
    Token,
  } from '@osr-vtt/shared';
  import MapView from './MapView.svelte';
  import EncounterBoard from './EncounterBoard.svelte';
  import HandoutViewer from './HandoutViewer.svelte';

  let {
    roomId,
    room,
    tokens,
    groups,
    encounter,
    isGM,
    myUid,
    players,
    profiles,
    rolls,
    selectedSeatId,
    onSelectActor,
  }: {
    roomId: string;
    room: Room;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
    myUid: string;
    players: PlayerSeat[];
    profiles: ProfileInstance[];
    rolls: Roll[];
    selectedSeatId: string | null;
    onSelectActor: (seatId: string) => void;
  } = $props();

  let activeTab = $state<'map' | 'board'>('map');
</script>

<div class="stage">
  <div class="tabs">
    <button
      data-testid="stage-tab-map"
      class:active={activeTab === 'map'}
      onclick={() => (activeTab = 'map')}
    >
      Map View
    </button>
    <button
      data-testid="stage-tab-board"
      class:active={activeTab === 'board'}
      onclick={() => (activeTab = 'board')}
    >
      Encounter Board
    </button>
  </div>

  <div class="surface">
    {#if activeTab === 'map'}
      <MapView {roomId} {room} {tokens} {groups} {encounter} {isGM} />
    {:else}
      <EncounterBoard
        {roomId}
        {tokens}
        {groups}
        {encounter}
        {isGM}
        {myUid}
        {players}
        {profiles}
        template={room.profileTemplate}
        {rolls}
        {selectedSeatId}
        {onSelectActor}
      />
    {/if}
    <HandoutViewer handout={room.handout} />
  </div>
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
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
    border: 1px solid var(--line);
    border-radius: 0 6px 6px 6px;
    background: var(--bg-inset);
    position: relative;
  }
</style>
