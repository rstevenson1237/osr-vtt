<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, PlayerSeat, Token } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';
  import { tokenLabel } from '../../encounter/labels';

  /**
   * GM-only actor ownership: which player's Profile each token is linked to.
   *
   * Extracted from the retired `GroupsPanel` (Encounter Screen Spec §3, §8),
   * whose group roster the board itself now owns — every group's
   * `[Map]`/`[Board]`/`[Active]`/collapse control lives on the group card, and
   * membership is drag-and-drop. Ownership was never group configuration, so it
   * stayed, testids and all.
   */
  let { roomId, tokens, players }: { roomId: string; tokens: Token[]; players: PlayerSeat[] } =
    $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  async function setOwner(tokenId: string, ownerSeatId: string): Promise<void> {
    await store.setTokenOwner(roomId, tokenId, ownerSeatId || undefined);
  }
</script>

{#if tokens.length > 0}
  <div class="ownership-panel" data-testid="ownership-panel">
    <h2>Actor Ownership</h2>
    <p class="hint">
      Links a token to a player's Profile — surfaces its roll shortcuts on the board and raises the
      Dock on selection.
    </p>
    <ul class="ownership-list">
      {#each tokens as token (token.id)}
        <li data-testid={`ownership-row-${token.id}`}>
          <span class="token-name">{tokenLabel(token, token.id)}</span>
          <select
            data-testid={`ownership-select-${token.id}`}
            value={token.ownerSeatId ?? ''}
            onchange={(e) => void setOwner(token.id, e.currentTarget.value)}
          >
            <option value="">Unowned</option>
            {#each players as player (player.uid)}
              <option value={player.seatId}>{player.displayName}</option>
            {/each}
          </select>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .ownership-panel {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .ownership-panel h2 {
    margin: 0 0 0.2rem;
    font-size: 1rem;
  }
  .hint {
    margin: 0 0 0.4rem;
    font-size: 0.72rem;
    opacity: 0.65;
  }
  .ownership-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .ownership-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .token-name {
    flex: 1;
  }
  .ownership-list select {
    padding: 0.2rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
</style>
