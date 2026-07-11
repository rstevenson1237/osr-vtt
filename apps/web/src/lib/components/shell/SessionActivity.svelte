<script lang="ts">
  import type { ProfileTemplateField, Room } from '@osr-vtt/shared';
  import ProfileTemplateEditor from '../ProfileTemplateEditor.svelte';
  import HandoutPanel from '../HandoutPanel.svelte';

  /** Session config activity (GM-only, referee group). WI-2 re-houses the
   * existing referee panels here — the profile-template editor and handout
   * reveal. `.vttcamp` export/import live in the top Session tab (reachable by
   * every member). The full R4 config surface (grid/measurement/fog/theme/
   * player management) arrives in WI-6; fog-mode selection remains a Map tool
   * for now (R4/WI-6 relocates it). */
  let {
    roomId,
    room,
    isGM,
  }: {
    roomId: string;
    room: Room;
    isGM: boolean;
  } = $props();

  const template = $derived(room.profileTemplate as ProfileTemplateField[]);
</script>

<div class="session-activity" data-testid="session-activity">
  <h1>Session</h1>

  <section>
    <h3>Room</h3>
    <p class="meta">
      <span class="rname">{room.name}</span>
      <span class="rid">Room ID: <code>{roomId}</code></span>
    </p>
  </section>

  {#if isGM}
    <section>
      <h3>Profile template</h3>
      <ProfileTemplateEditor {roomId} {template} />
    </section>

    <section>
      <h3>Handout</h3>
      <HandoutPanel {roomId} {isGM} revealedRef={room.handout?.ref ?? null} />
    </section>
  {/if}
</div>

<style>
  .session-activity {
    height: 100%;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.25rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  section {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.85rem 1rem;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0 0 0.6rem;
  }
  .rname {
    font-weight: 600;
  }
  .rid code {
    user-select: all;
  }
</style>
