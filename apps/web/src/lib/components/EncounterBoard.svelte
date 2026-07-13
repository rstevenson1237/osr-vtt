<script lang="ts">
  import { getContext } from 'svelte';
  import {
    currentActorTokenIds,
    visibleTokenIds,
    type AssetStore,
    type CampaignStore,
    type Encounter,
    type Group,
    type PlayerSeat,
    type ProfileInstance,
    type ProfileTemplateField,
    type Roll,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../context';
  import { diceTray } from '../dice/staged-store';
  import { buildProfileRows } from '../profile/profile-view';
  import { assignmentUpdates, groupColor } from '../encounter/board-view';
  import CombatTracker from './CombatTracker.svelte';
  import RollStrip from './RollStrip.svelte';
  import TensionBar from './TensionBar.svelte';
  import GroupsPanel from './GroupsPanel.svelte';
  import BlindDrawer from './BlindDrawer.svelte';
  import TableRunner from './TableRunner.svelte';

  /**
   * The theater-of-the-mind Encounter Board v2 (Master Plan v2, R8). The cast
   * area shows who's present as redesigned actor cards — portrait over name +
   * pinned profile fields + status/roll chips — gathered into per-Group boxes
   * with an "Unassigned" bin at the bottom. It stays clean for everyone: the
   * GM's management chrome (Groups roster, reveal toggles, Blind Drawer,
   * Tables) lives in the right Tools rail (R8.3), not here. No grid or
   * movement; that's Map View.
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
    gmChromeInline = false,
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
    /** Mobile has no Tools rail, so the GM's management chrome (R8.3) renders
     * inline below the cast area there instead of in the rail. Desktop keeps
     * the cast area clean and hosts this chrome in the Tools rail. */
    gmChromeInline?: boolean;
  } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const boardVisibleIds = $derived(visibleTokenIds(tokens, groups, 'board'));
  // GM sees the full cast (unrevealed foes included, flagged hidden);
  // players only ever see [Board]-visible tokens (Spec §8).
  const boardTokens = $derived(isGM ? tokens : tokens.filter((t) => boardVisibleIds.has(t.id)));
  const currentIds = $derived(encounter ? currentActorTokenIds(encounter, groups) : new Set<string>());

  /** Display name for a card: the linked player's seat name if the token is
   * owned, else a short id-derived label. Never a game value. */
  function cardName(token: Token): string {
    if (token.ownerSeatId) {
      const player = players.find((p) => p.seatId === token.ownerSeatId);
      if (player) return player.displayName;
    }
    const basename = token.imageRef.split('/').pop() ?? token.imageRef;
    return basename.replace(/\.[a-z0-9]+$/i, '');
  }

  /** Pinned profile rows for a card (Master Plan v2, R8.1): the `pinned`
   * template fields resolved against the token's linked Profile, rendered
   * read-only as `label: value`. Empty unless the token is owner-linked. */
  function pinnedRows(token: Token): { fieldId: string; label: string; value: string }[] {
    if (!token.ownerSeatId) return [];
    const hasPinned = template.some((f) => f.pinned);
    if (!hasPinned) return [];
    const profile = profiles.find((p) => p.seatId === token.ownerSeatId);
    return buildProfileRows(template, profile)
      .filter((row) => row.field.pinned)
      .map((row) => ({ fieldId: row.field.id, label: row.field.label, value: String(row.value) }));
  }

  /** A token's roll-field shortcuts (Spec §5): the `roll` fields of the
   * Profile linked via `ownerSeatId`, if any. */
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

  /** GM card menu (Master Plan v2, R8.2): reassign a token to exactly one
   * group, or to the Unassigned bin (`''`). Writes only the groups that
   * actually change (`assignmentUpdates`). */
  async function assign(token: Token, groupId: string): Promise<void> {
    const updates = assignmentUpdates(groups, token.id, groupId || null);
    for (const u of updates) {
      await store.updateGroup(roomId, u.groupId, { memberTokenIds: u.memberTokenIds });
    }
  }

  interface CastSection {
    key: string;
    groupId: string | null;
    label: string;
    color: string | null;
    collapsed: boolean;
    tokens: Token[];
  }

  const castSections = $derived.by((): CastSection[] => {
    const sections: CastSection[] = [];
    const assigned = new Set<string>();
    for (const group of groups) {
      const members = boardTokens.filter((t) => group.memberTokenIds.includes(t.id));
      for (const t of members) assigned.add(t.id);
      if (members.length > 0) {
        sections.push({
          key: group.id,
          groupId: group.id,
          label: group.name,
          color: groupColor(group.id),
          collapsed: Boolean(group.collapsed),
          tokens: members,
        });
      }
    }
    const unassigned = boardTokens.filter((t) => !assigned.has(t.id));
    if (unassigned.length > 0) {
      sections.push({
        key: 'unassigned',
        groupId: null,
        label: 'Unassigned',
        color: null,
        collapsed: false,
        tokens: unassigned,
      });
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
      <section
        class="cast-section"
        class:unassigned-bin={section.groupId === null}
        data-testid={`cast-section-${section.key}`}
      >
        {#if section.color}
          <span class="color-strip" style={`background:${section.color}`} aria-hidden="true"></span>
        {/if}
        <h3>
          {section.label}
          <span class="count" data-testid={`cast-count-${section.key}`}>{section.tokens.length}</span>
        </h3>

        {#if section.collapsed && section.groupId}
          <!-- Collapse-to-one-token board view (R8.4): a single stacked group
          card standing in for the whole formation, with a member count. -->
          <div class="cards">
            <div class="card collapsed-card" data-testid={`board-collapsed-${section.groupId}`}>
              <div class="stack" aria-hidden="true">
                <span class="disc"></span>
                <span class="disc"></span>
                <span class="disc"></span>
              </div>
              <span class="name">{section.label}</span>
              <span class="collapsed-count" data-testid={`board-collapsed-count-${section.groupId}`}>
                {section.tokens.length} stacked
              </span>
            </div>
          </div>
        {:else}
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
                <div class="portrait">
                  <img src={assets.resolve(token.imageRef)} alt="" />
                  {#if !boardVisibleIds.has(token.id)}
                    <span class="hidden-tag" data-testid={`board-token-hidden-${token.id}`}>hidden</span>
                  {/if}
                </div>

                <div class="body">
                  <span class="name">{cardName(token)}</span>
                  <span class="pos" data-testid={`board-token-pos-${token.id}`}
                    >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
                  >

                  {#if pinnedRows(token).length > 0}
                    <dl class="pinned" data-testid={`board-pinned-${token.id}`}>
                      {#each pinnedRows(token) as row (row.fieldId)}
                        <div class="pinned-row" data-testid={`board-pinned-${token.id}-${row.fieldId}`}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      {/each}
                    </dl>
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

                  {#if isGM}
                    <select
                      class="assign"
                      data-testid={`board-assign-${token.id}`}
                      value={section.groupId ?? ''}
                      onclick={(e) => e.stopPropagation()}
                      onchange={(e) => {
                        e.stopPropagation();
                        void assign(token, e.currentTarget.value);
                      }}
                    >
                      <option value="">Unassigned</option>
                      {#each groups as g (g.id)}
                        <option value={g.id}>{g.name}</option>
                      {/each}
                    </select>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>

  <RollStrip {rolls} {players} />

  {#if gmChromeInline && isGM}
    <div class="gm-panels" data-testid="encounter-gm-panels">
      <GroupsPanel {roomId} {groups} {tokens} {players} />
      <BlindDrawer {roomId} {isGM} authorUid={myUid} />
      <TableRunner {roomId} {isGM} authorUid={myUid} />
    </div>
  {/if}

  <CombatTracker {roomId} {groups} {encounter} {tokens} {isGM} {myUid} {players} {rolls} />
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
  .cast-section {
    position: relative;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.5rem 0.75rem 0.6rem 0.9rem;
    background: var(--bg-panel);
  }
  .cast-section.unassigned-bin {
    background: var(--bg-inset);
    border-style: dashed;
  }
  .color-strip {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    border-radius: 8px 0 0 8px;
  }
  .cast-section h3 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .cast-section h3 .count {
    font-size: 0.7rem;
    opacity: 0.6;
    background: var(--bg-inset);
    border-radius: 999px;
    padding: 0.05rem 0.4rem;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    width: 132px;
    position: relative;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-inset);
  }
  .portrait {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 2;
    background: var(--bg-panel-alt);
  }
  .portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem 0.45rem 0.5rem;
  }
  .name {
    font-weight: 600;
    font-size: 0.82rem;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pos {
    font-size: 0.65rem;
    opacity: 0.55;
  }
  .card.current-turn {
    outline: 3px solid var(--accent);
    outline-offset: 1px;
  }
  .card.hidden-actor .portrait img {
    opacity: 0.5;
  }
  .card.selectable {
    cursor: pointer;
  }
  .card.selected {
    outline: 3px solid var(--focus);
    outline-offset: 1px;
  }
  .hidden-tag {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: var(--complication-bg);
    color: var(--complication);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
    font-size: 0.6rem;
  }
  .pinned {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .pinned-row {
    display: flex;
    justify-content: space-between;
    gap: 0.4rem;
    font-size: 0.68rem;
  }
  .pinned-row dt {
    opacity: 0.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pinned-row dd {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .roll-shortcuts {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .roll-shortcut {
    padding: 0.1rem 0.3rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-panel-alt);
    color: inherit;
    font-size: 0.65rem;
    cursor: pointer;
  }
  .assign {
    margin-top: 0.1rem;
    padding: 0.15rem 0.2rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-panel);
    color: inherit;
    font-size: 0.68rem;
  }
  /* Collapsed group card (R8.4) — a single stacked-token stand-in. */
  .collapsed-card {
    align-items: center;
    padding: 0.6rem 0.5rem;
    gap: 0.35rem;
  }
  .collapsed-card .stack {
    position: relative;
    width: 48px;
    height: 40px;
  }
  .collapsed-card .disc {
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-panel-alt);
    border: 2px solid var(--line-strong);
  }
  .collapsed-card .disc:nth-child(1) {
    left: 0;
    top: 6px;
  }
  .collapsed-card .disc:nth-child(2) {
    left: 9px;
    top: 3px;
  }
  .collapsed-card .disc:nth-child(3) {
    left: 18px;
    top: 0;
  }
  .collapsed-card .collapsed-count {
    font-size: 0.68rem;
    opacity: 0.7;
  }
  .gm-panels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
