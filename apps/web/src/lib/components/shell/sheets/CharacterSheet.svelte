<script lang="ts">
  import type { PlayerSeat, ProfileInstance, ProfileTemplateField, Token } from '@osr-vtt/shared';
  import CharacterDock from '../../CharacterDock.svelte';

  /** Character quick sheet (Shell UI Redesign) — the player's own sheet,
   * always to hand over whichever stage is up. It re-houses `CharacterDock`
   * verbatim (every `profile-*` / `field-input-*` / `token-snap-*` testid
   * preserved), so the fields shown are the session's Profile template rather
   * than a fixed stat list — the app still interprets nothing.
   *
   * Selecting an actor on the Encounter board swaps this to their card; the
   * "back to my sheet" link returns. */
  let {
    template,
    profile,
    seatId,
    roomId,
    players = [],
    tokens = [],
    readOnly = false,
    canSetOwnToken = false,
    showBack = false,
    onBackToMine,
  }: {
    template: ProfileTemplateField[];
    profile: ProfileInstance | undefined;
    seatId: string;
    roomId: string;
    players?: PlayerSeat[];
    tokens?: Token[];
    readOnly?: boolean;
    canSetOwnToken?: boolean;
    showBack?: boolean;
    onBackToMine?: () => void;
  } = $props();

  // The player's name is deliberately *not* repeated here — the top status
  // bar's presence chips already carry it. Nor is there a quick d20: the Roll
  // quick sheet's one-tap die buttons cover that.
</script>

<div class="character-sheet">
  {#if showBack}
    <button class="backlink" data-testid="dock-back-to-mine" onclick={() => onBackToMine?.()}>
      ← Back to my sheet
    </button>
  {/if}

  <CharacterDock
    {template}
    {profile}
    {seatId}
    {roomId}
    {players}
    {tokens}
    {readOnly}
    {canSetOwnToken}
  />
</div>

<style>
  .character-sheet {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .backlink {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 0.78rem;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
