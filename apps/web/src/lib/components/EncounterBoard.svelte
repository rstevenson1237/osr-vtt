<script lang="ts">
  import { getContext } from 'svelte';
  import {
    currentActorTokenIds,
    visibleTokenIds,
    type AssetStore,
    type Encounter,
    type Group,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY } from '../context';
  import GroupsPanel from './GroupsPanel.svelte';
  import CombatTracker from './CombatTracker.svelte';

  /**
   * The theater-of-the-mind Encounter Board (Encounter Screen Spec). Shows
   * who's present — grouped by side — plus the Groups roster (GM) and the
   * combat tracker. No grid, positions, or movement; that's Map View.
   */
  let {
    roomId,
    tokens,
    groups,
    encounter,
    isGM,
  }: {
    roomId: string;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
  } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  const boardVisibleIds = $derived(visibleTokenIds(tokens, groups, 'board'));
  // GM sees the full cast (unrevealed foes included, flagged hidden);
  // players only ever see [Board]-visible tokens (Spec §8).
  const boardTokens = $derived(isGM ? tokens : tokens.filter((t) => boardVisibleIds.has(t.id)));
  const currentIds = $derived(encounter ? currentActorTokenIds(encounter, groups) : new Set<string>());

  interface CastSection {
    key: string;
    label: string;
    tokens: Token[];
  }

  const castSections = $derived.by((): CastSection[] => {
    const sections: CastSection[] = [];
    const assigned = new Set<string>();
    for (const group of groups) {
      const members = boardTokens.filter((t) => group.memberTokenIds.includes(t.id));
      for (const t of members) assigned.add(t.id);
      if (members.length > 0) sections.push({ key: group.id, label: group.name, tokens: members });
    }
    const unassigned = boardTokens.filter((t) => !assigned.has(t.id));
    if (unassigned.length > 0) {
      sections.push({ key: 'unassigned', label: 'Unassigned', tokens: unassigned });
    }
    return sections;
  });
</script>

<div class="encounter-board" data-testid="encounter-board">
  <div class="cast-area">
    {#if castSections.length === 0}
      <p class="empty">No one is on the board yet.</p>
    {/if}
    {#each castSections as section (section.key)}
      <section class="cast-section" data-testid={`cast-section-${section.key}`}>
        <h3>{section.label}</h3>
        <div class="cards">
          {#each section.tokens as token (token.id)}
            <div
              class="card"
              class:hidden-actor={!boardVisibleIds.has(token.id)}
              class:current-turn={currentIds.has(token.id)}
              data-testid={`board-token-${token.id}`}
            >
              <img src={assets.resolve(token.imageRef)} alt="" />
              <span data-testid={`board-token-pos-${token.id}`}
                >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
              >
              {#if !boardVisibleIds.has(token.id)}
                <span class="hidden-tag" data-testid={`board-token-hidden-${token.id}`}>hidden</span>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  {#if isGM}
    <div class="gm-panels">
      <GroupsPanel {roomId} {groups} {tokens} />
    </div>
  {/if}

  <CombatTracker {roomId} {groups} {encounter} {tokens} {isGM} />
</div>

<style>
  .encounter-board {
    position: absolute;
    inset: 0;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
  }
  .cast-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .empty {
    opacity: 0.6;
  }
  .cast-section h3 {
    margin: 0 0 0.4rem;
    font-size: 0.9rem;
    opacity: 0.85;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    width: 96px;
    position: relative;
  }
  .card img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
  }
  .card span {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .card.current-turn img {
    outline: 3px solid #a6763f;
    outline-offset: 2px;
  }
  .card.hidden-actor img {
    opacity: 0.5;
  }
  .hidden-tag {
    position: absolute;
    top: -0.3rem;
    right: -0.3rem;
    background: #332d16;
    color: #f2e2ab;
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
    font-size: 0.65rem;
  }
  .gm-panels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
