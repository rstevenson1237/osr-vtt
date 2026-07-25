<script lang="ts">
  import { getContext } from 'svelte';
  import type {
    CampaignStore,
    PlayerSeat,
    ProfileInstance,
    ProfileTemplateField,
    Token,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../../context';
  import { quickRollDie } from '../../../dice/quick-roll';
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
    authorUid,
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
    authorUid: string;
    players?: PlayerSeat[];
    tokens?: Token[];
    readOnly?: boolean;
    canSetOwnToken?: boolean;
    showBack?: boolean;
    onBackToMine?: () => void;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const displayName = $derived(
    players.find((p) => p.seatId === seatId)?.displayName ?? 'Unnamed seat',
  );
  const initial = $derived((displayName.trim()[0] ?? '?').toUpperCase());

  let rolling = $state(false);
  async function quickAttack(): Promise<void> {
    if (rolling) return;
    rolling = true;
    try {
      await quickRollDie(store, roomId, authorUid, 20);
    } finally {
      rolling = false;
    }
  }
</script>

<div class="character-sheet">
  <div class="ident">
    <span class="avatar" aria-hidden="true">{initial}</span>
    <span class="name" data-testid="character-sheet-name">{displayName}</span>
  </div>

  {#if showBack}
    <button class="backlink" data-testid="dock-back-to-mine" onclick={() => onBackToMine?.()}>
      ← Back to my sheet
    </button>
  {/if}

  <button
    class="quick-attack"
    data-testid="character-quick-d20"
    disabled={rolling || !authorUid}
    onclick={() => void quickAttack()}
  >
    Quick roll d20
  </button>

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
  .ident {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex: 0 0 auto;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .quick-attack {
    align-self: flex-start;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-panel);
    color: var(--text);
    cursor: pointer;
    font-size: 0.78rem;
  }
  .quick-attack:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
