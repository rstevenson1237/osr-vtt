<script lang="ts">
  import { getContext } from 'svelte';
  import {
    currentActorTokenIds,
    visibleTokenIds,
    type AssetStore,
    type Encounter,
    type Group,
    type PlayerSeat,
    type ProfileInstance,
    type ProfileTemplateField,
    type Roll,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY } from '../context';
  import { diceTray } from '../dice/staged-store';
  import { buildProfileRows } from '../profile/profile-view';
  import GroupsPanel from './GroupsPanel.svelte';
  import CombatTracker from './CombatTracker.svelte';
  import RollStrip from './RollStrip.svelte';
  import TensionBar from './TensionBar.svelte';
  import BlindDrawer from './BlindDrawer.svelte';
  import TableRunner from './TableRunner.svelte';

  /**
   * The theater-of-the-mind Encounter Board (Encounter Screen Spec). Shows
   * who's present — grouped by side — plus the Groups roster (GM), the roll
   * strip, and the combat tracker. No grid, positions, or movement; that's
   * Map View.
   */
  let {
    roomId,
    tokens,
    groups,
    encounter,
    isGM,
    myUid,
    players,
    profiles,
    template,
    rolls,
    selectedSeatId,
    onSelectActor,
  }: {
    roomId: string;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
    myUid: string;
    players: PlayerSeat[];
    profiles: ProfileInstance[];
    template: ProfileTemplateField[];
    rolls: Roll[];
    selectedSeatId: string | null;
    onSelectActor: (seatId: string) => void;
  } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  const boardVisibleIds = $derived(visibleTokenIds(tokens, groups, 'board'));
  // GM sees the full cast (unrevealed foes included, flagged hidden);
  // players only ever see [Board]-visible tokens (Spec §8).
  const boardTokens = $derived(isGM ? tokens : tokens.filter((t) => boardVisibleIds.has(t.id)));
  const currentIds = $derived(encounter ? currentActorTokenIds(encounter, groups) : new Set<string>());

  /** A token's roll-field shortcuts (Spec §5): the `roll` fields of the
   * Profile linked via `ownerSeatId`, if any. Purely a display/UI-shortcut
   * lookup — never inspects a value for game meaning. */
  function rollShortcuts(token: Token): { fieldId: string; label: string; die: string }[] {
    if (!token.ownerSeatId) return [];
    const profile = profiles.find((p) => p.seatId === token.ownerSeatId);
    return buildProfileRows(template, profile)
      .filter((row) => row.field.type === 'roll')
      .map((row) => ({ fieldId: row.field.id, label: row.field.label, die: String(row.value) }));
  }

  function stageRoll(die: string): void {
    diceTray.stage(die);
  }

  function selectCard(token: Token): void {
    if (token.ownerSeatId) onSelectActor(token.ownerSeatId);
  }

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
  <TensionBar {roomId} {encounter} {isGM} />

  <div class="cast-area">
    {#if castSections.length === 0}
      <p class="empty">No one is on the board yet.</p>
    {/if}
    {#each castSections as section (section.key)}
      <section class="cast-section" data-testid={`cast-section-${section.key}`}>
        <h3>{section.label}</h3>
        <div class="cards">
          {#each section.tokens as token (token.id)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="card"
              class:hidden-actor={!boardVisibleIds.has(token.id)}
              class:current-turn={currentIds.has(token.id)}
              class:selected={selectedSeatId !== null && token.ownerSeatId === selectedSeatId}
              class:selectable={Boolean(token.ownerSeatId)}
              data-testid={`board-token-${token.id}`}
              role={token.ownerSeatId ? 'button' : undefined}
              tabindex={token.ownerSeatId ? 0 : undefined}
              onclick={() => selectCard(token)}
              onkeydown={(e) => e.key === 'Enter' && selectCard(token)}
            >
              <img src={assets.resolve(token.imageRef)} alt="" />
              <span data-testid={`board-token-pos-${token.id}`}
                >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
              >
              {#if !boardVisibleIds.has(token.id)}
                <span class="hidden-tag" data-testid={`board-token-hidden-${token.id}`}>hidden</span>
              {/if}
              {#if rollShortcuts(token).length > 0}
                <div class="roll-shortcuts">
                  {#each rollShortcuts(token) as shortcut (shortcut.fieldId)}
                    <button
                      class="roll-shortcut"
                      data-testid={`board-roll-${token.id}-${shortcut.fieldId}`}
                      onclick={(e) => {
                        e.stopPropagation();
                        stageRoll(shortcut.die);
                      }}
                    >
                      🎲 {shortcut.label}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <RollStrip {rolls} {players} />

  {#if isGM}
    <div class="gm-panels">
      <GroupsPanel {roomId} {groups} {tokens} {players} />
      <BlindDrawer {roomId} {isGM} authorUid={myUid} />
      <TableRunner {roomId} {isGM} authorUid={myUid} />
    </div>
  {/if}

  <CombatTracker {roomId} {groups} {encounter} {tokens} {isGM} {players} />
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
  .card.selectable {
    cursor: pointer;
  }
  .card.selected img {
    outline: 3px solid #6fa8dc;
    outline-offset: 2px;
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
  .roll-shortcuts {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 100%;
  }
  .roll-shortcut {
    padding: 0.1rem 0.3rem;
    border-radius: 999px;
    border: 1px solid #a6763f;
    background: #362d20;
    color: inherit;
    font-size: 0.65rem;
    cursor: pointer;
  }
  .gm-panels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
