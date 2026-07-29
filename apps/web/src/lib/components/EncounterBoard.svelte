<script lang="ts">
  import { getContext } from 'svelte';
  import {
    currentActorTokenIds,
    isDieField,
    addRefToEncounter,
    initiativeSlotId,
    renumberGroupsByOrder,
    visibleTokenIds,
    type AssetStore,
    type CampaignStore,
    type Encounter,
    type EncounterMode,
    type SharedRoll,
    type Group,
    type PlayerSeat,
    type ProfileInstance,
    type ProfileTemplateField,
    type Roll,
    type RollConvention,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../context';
  import { initiativeCallOpen, rollOrStage } from '../dice/roll-or-stage';
  import { tokenGroupId } from '../tokens/labels';
  import { buildProfileRows } from '../profile/profile-view';
  import { assignmentUpdates, groupColor, moveTokenUpdates } from '../encounter/board-view';
  import CombatTracker from './CombatTracker.svelte';
  import RollStrip from './RollStrip.svelte';
  import GroupsPanel from './GroupsPanel.svelte';

  /**
   * The theater-of-the-mind Encounter Board v2 (Master Plan v2, R8). The cast
   * area shows who's present as redesigned actor cards — portrait over name +
   * pinned profile fields + status/roll chips — gathered into per-Group boxes
   * with an "Unassigned" bin at the bottom.
   *
   * The GM's management chrome (the Groups roster) renders inline below the
   * cast. R8.3 put it in the right Tools rail, but the Shell UI Redesign
   * deleted that rail, so there is nowhere else for it to go — the
   * `gmChromeInline` prop that used to select between the two was always
   * `true` and is gone. The other two panels that used to live here left for
   * good reason: Random tables became their own referee-only quick sheet, and
   * the Blind Drawer was replaced by the Roll sheet's Hidden roll checkbox.
   *
   * No grid or movement; that's Map View.
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
    conventions = [],
    initiativeDie = 'd6',
    initiativeMode = 'side',
    encounterTemplate = [],
    sharedRoll = null,
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
    conventions?: RollConvention[];
    initiativeDie?: string;
    initiativeMode?: EncounterMode;
    encounterTemplate?: ProfileTemplateField[];
    sharedRoll?: SharedRoll | null;
    /** The seat whose card is currently raised in the Character sheet. */
    selectedSeatId: string | null;
    onSelectActor: (seatId: string) => void;
  } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const boardVisibleIds = $derived(visibleTokenIds(tokens, groups, 'board'));
  // GM sees the full cast (unrevealed foes included, flagged hidden);
  // players only ever see [Board]-visible tokens (Spec §8).
  const boardTokens = $derived(isGM ? tokens : tokens.filter((t) => boardVisibleIds.has(t.id)));
  const currentIds = $derived(
    encounter ? currentActorTokenIds(encounter, groups) : new Set<string>(),
  );

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
      .filter((row) => isDieField(row.field.type))
      .map((row) => ({ fieldId: row.field.id, label: row.field.label, die: String(row.value) }));
  }

  /**
   * A card's die button. Rolls immediately, unless a Call for Initiative is
   * open and this actor is part of it — then it stages that actor's slot and
   * the card shows READY, with the face kept hidden until the referee resolves
   * everyone at once (Workflow 2/3).
   */
  async function rollFromCard(token: Token, die: string, label: string): Promise<void> {
    await rollOrStage(
      store,
      roomId,
      myUid,
      die,
      {
        sharedRoll,
        mode: initiativeMode,
        refId:
          initiativeMode === 'individual' ? token.id : (tokenGroupId(token, groups) ?? undefined),
        ...(token.ownerSeatId ? { ownerUid: token.ownerSeatId } : {}),
      },
      conventions,
      label,
    );
  }

  /** The ref this token occupies in the current order, for the mode in use. */
  function refForToken(token: Token): { refType: 'side' | 'actor'; refId: string } | null {
    if (initiativeMode === 'individual') return { refType: 'actor', refId: token.id };
    const groupId = tokenGroupId(token, groups);
    return groupId ? { refType: 'side', refId: groupId } : null;
  }

  function inOrder(token: Token): boolean {
    const ref = refForToken(token);
    if (!ref || !encounter) return false;
    return encounter.order.some((e) => e.refId === ref.refId && e.refType === ref.refType);
  }

  async function addToInitiative(token: Token): Promise<void> {
    if (!encounter) return;
    // Side mode needs a side to add; an ungrouped token can only join the
    // order as itself, which is exactly what Individual mode's rows are.
    const ref = refForToken(token) ?? { refType: 'actor' as const, refId: token.id };
    await store.writeEncounter(roomId, addRefToEncounter(encounter, ref.refType, ref.refId));
  }

  /** Whether this actor's initiative slot is staged and waiting — what the
   * READY overlay renders from. */
  function isReady(token: Token): boolean {
    if (!initiativeCallOpen(sharedRoll)) return false;
    const refId =
      initiativeMode === 'individual' ? token.id : (tokenGroupId(token, groups) ?? undefined);
    if (!refId) return false;
    const slotId = initiativeSlotId(initiativeMode, {
      refId,
      ...(token.ownerSeatId ? { ownerUid: token.ownerSeatId } : {}),
      die: '',
    });
    return sharedRoll?.slots?.[slotId]?.ready === true;
  }

  /** A whole side is READY when its slot is staged (Side mode only). */
  function groupReady(groupId: string | null): boolean {
    if (!groupId || initiativeMode === 'individual' || !initiativeCallOpen(sharedRoll))
      return false;
    return sharedRoll?.slots?.[groupId]?.ready === true;
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
    const byId = new Map(boardTokens.map((t) => [t.id, t]));
    for (const group of groups) {
      // Ordered by `memberTokenIds`, not by the token roster — that array's
      // order *is* the group's card order, which is what makes a drag-reorder
      // inside a box persist rather than snap back on the next snapshot.
      const members = group.memberTokenIds
        .map((id) => byId.get(id))
        .filter((t): t is Token => t !== undefined);
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
    // Always rendered for the referee even when empty: it is the drop target
    // for pulling a card out of every group, and dragging onto a box that
    // isn't there is not a gesture. Players still only see it when occupied.
    if (unassigned.length > 0 || isGM) {
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

  // ---- drag and drop (cards between/within groups, and group reordering) ----
  //
  // HTML5 DnD, following the house pattern in `shell/RoomsPanel.svelte`: a
  // `dataTransfer` payload for Firefox's sake, `effectAllowed = 'move'`, and
  // `$state` for the in-flight ids so the drop target can style itself.
  // Referee-only — group membership and order are the referee's call.

  /** The card being dragged, and the insertion point under the pointer. */
  let dragTokenId = $state<string | null>(null);
  let dropSectionKey = $state<string | null>(null);
  let dropIndex = $state<number | null>(null);
  /** The group header being dragged (reordering whole boxes). */
  let dragGroupId = $state<string | null>(null);
  let dropGroupId = $state<string | null>(null);

  /**
   * A translucent copy of the card as the drag image. The browser's default is
   * a snapshot of the element at full opacity, which hides whatever it passes
   * over; a ghost makes the drop target readable underneath it.
   */
  function setGhostImage(e: DragEvent, node: HTMLElement): void {
    if (!e.dataTransfer) return;
    const ghost = node.cloneNode(true) as HTMLElement;
    const rect = node.getBoundingClientRect();
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = '0.6';
    ghost.style.position = 'fixed';
    ghost.style.top = '-1000px';
    ghost.style.left = '-1000px';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
    // The drag image is captured synchronously, so the node only has to exist
    // for this frame.
    requestAnimationFrame(() => ghost.remove());
  }

  function onCardDragStart(e: DragEvent, token: Token): void {
    if (!isGM) return;
    dragTokenId = token.id;
    e.dataTransfer?.setData('text/plain', token.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    setGhostImage(e, e.currentTarget as HTMLElement);
  }

  /** Insert before or after the hovered card, by which half the pointer is in
   * — the standard "the gap you're aiming at" read for a horizontal row. */
  function onCardDragOver(e: DragEvent, section: CastSection, index: number): void {
    if (dragTokenId === null) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    dropSectionKey = section.key;
    dropIndex = after ? index + 1 : index;
  }

  /** Dropping on the box itself (not on a card) appends. */
  function onSectionDragOver(e: DragEvent, section: CastSection): void {
    if (dragTokenId === null) return;
    e.preventDefault();
    dropSectionKey = section.key;
    dropIndex = section.tokens.length;
  }

  async function onSectionDrop(section: CastSection): Promise<void> {
    const tokenId = dragTokenId;
    const index = dropSectionKey === section.key ? dropIndex : null;
    endDrag();
    if (!tokenId || !isGM) return;
    // The drop index counts the section's *rendered* cards, which for a move
    // within the same group still includes the dragged card itself; the pure
    // helper removes it first, so an index past its old slot would land one
    // place early. Compensate before handing the index over.
    let target = index;
    if (target !== null && section.groupId !== null) {
      const from = section.tokens.findIndex((t) => t.id === tokenId);
      if (from !== -1 && target > from) target -= 1;
    }
    const updates = moveTokenUpdates(groups, tokenId, section.groupId, target);
    for (const u of updates) {
      await store.updateGroup(roomId, u.groupId, { memberTokenIds: u.memberTokenIds });
    }
  }

  function endDrag(): void {
    dragTokenId = null;
    dropSectionKey = null;
    dropIndex = null;
    dragGroupId = null;
    dropGroupId = null;
  }

  function onGroupDragStart(e: DragEvent, groupId: string): void {
    if (!isGM) return;
    dragGroupId = groupId;
    e.dataTransfer?.setData('text/plain', groupId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onGroupDragOver(e: DragEvent, groupId: string): void {
    if (dragGroupId === null || dragGroupId === groupId) return;
    e.preventDefault();
    dropGroupId = groupId;
  }

  /** Splice the dragged group in front of the one it was dropped on, then
   * renumber the whole list — see `renumberGroupsByOrder` for why all of it. */
  async function onGroupDrop(targetGroupId: string): Promise<void> {
    const movedId = dragGroupId;
    endDrag();
    if (!movedId || !isGM || movedId === targetGroupId) return;
    const next = groups.filter((g) => g.id !== movedId);
    const moved = groups.find((g) => g.id === movedId);
    const at = next.findIndex((g) => g.id === targetGroupId);
    if (!moved || at === -1) return;
    next.splice(at, 0, moved);
    for (const u of renumberGroupsByOrder(next)) {
      await store.updateGroup(roomId, u.groupId, { order: u.order });
    }
  }

  // ---- inline group rename ----

  /** The section key currently being renamed, and the working text. */
  let renamingKey = $state<string | null>(null);
  let renameDraft = $state('');
  /** Set while `commitRename` is running, so the input's own blur (fired when
   * the field unmounts) can't run the commit a second time. */
  let renameCommitting = false;

  function beginRename(section: CastSection): void {
    if (!isGM) return;
    renamingKey = section.key;
    // The Unassigned bin is a computed placeholder, not a group — naming it is
    // how you *create* a group, so it starts empty rather than pre-filled with
    // the word "Unassigned".
    renameDraft = section.groupId === null ? '' : section.label;
  }

  function cancelRename(): void {
    renamingKey = null;
    renameDraft = '';
  }

  /**
   * Enter or a click outside commits; Escape cancels.
   *
   * Renaming a real group is a patch. Renaming the *Unassigned* bin promotes
   * it: a new group is created holding exactly the cards that were loose, and
   * because the bin is synthetic and always rendered for the referee, an empty
   * Unassigned box reappears in its place immediately.
   */
  async function commitRename(section: CastSection): Promise<void> {
    if (renameCommitting) return;
    const name = renameDraft.trim();
    renameCommitting = true;
    try {
      cancelRename();
      if (!name || !isGM) return;
      if (section.groupId !== null) {
        if (name === section.label) return;
        await store.updateGroup(roomId, section.groupId, { name });
        return;
      }
      await store.createGroup(roomId, {
        name,
        memberTokenIds: section.tokens.map((t) => t.id),
        showMap: true,
        showBoard: true,
        active: false,
        order: groups.length,
      });
    } finally {
      renameCommitting = false;
    }
  }

  function onRenameKey(e: KeyboardEvent, section: CastSection): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRename(section);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  }
</script>

<div class="encounter-board" data-testid="encounter-board">
  <div class="cast-area">
    {#if castSections.length === 0}
      <p class="empty">No one is on the board yet.</p>
    {/if}
    {#each castSections as section (section.key)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <section
        class="cast-section"
        class:unassigned-bin={section.groupId === null}
        class:staged-ready={groupReady(section.groupId)}
        class:card-dropzone={dropSectionKey === section.key}
        class:group-dropzone={dropGroupId === section.groupId && section.groupId !== null}
        data-testid={`cast-section-${section.key}`}
        data-dragover={dropSectionKey === section.key ? 'card' : undefined}
        ondragover={(e) => {
          onSectionDragOver(e, section);
          if (section.groupId) onGroupDragOver(e, section.groupId);
        }}
        ondrop={(e) => {
          e.preventDefault();
          if (dragGroupId !== null && section.groupId) void onGroupDrop(section.groupId);
          else void onSectionDrop(section);
        }}
      >
        {#if groupReady(section.groupId)}
          <span class="ready-overlay" data-testid={`cast-ready-${section.key}`}>READY</span>
        {/if}
        {#if section.color}
          <span class="color-strip" style={`background:${section.color}`} aria-hidden="true"></span>
        {/if}
        <h3
          draggable={isGM && section.groupId !== null && renamingKey !== section.key}
          class:draggable={isGM && section.groupId !== null}
          title={isGM ? 'Double-click to rename, drag to reorder' : undefined}
          ondragstart={(e) => section.groupId && onGroupDragStart(e, section.groupId)}
          ondragend={endDrag}
          ondblclick={() => beginRename(section)}
        >
          {#if renamingKey === section.key}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename"
              data-testid={`group-name-input-${section.key}`}
              autofocus
              bind:value={renameDraft}
              placeholder={section.groupId === null ? 'Name this group…' : ''}
              onkeydown={(e) => onRenameKey(e, section)}
              onblur={() => void commitRename(section)}
            />
          {:else}
            {section.label}
          {/if}
          <span class="count" data-testid={`cast-count-${section.key}`}
            >{section.tokens.length}</span
          >
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
              <span
                class="collapsed-count"
                data-testid={`board-collapsed-count-${section.groupId}`}
              >
                {section.tokens.length} stacked
              </span>
            </div>
          </div>
        {:else}
          <div class="cards">
            {#each section.tokens as token, cardIndex (token.id)}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class="card"
                class:hidden-actor={!boardVisibleIds.has(token.id)}
                class:current-turn={currentIds.has(token.id)}
                class:selected={selectedSeatId !== null && token.ownerSeatId === selectedSeatId}
                class:selectable={Boolean(token.ownerSeatId)}
                class:staged-ready={isReady(token)}
                class:dragging={dragTokenId === token.id}
                class:drop-before={dropSectionKey === section.key && dropIndex === cardIndex}
                class:drop-after={dropSectionKey === section.key &&
                  dropIndex === cardIndex + 1 &&
                  cardIndex === section.tokens.length - 1}
                data-testid={`board-token-${token.id}`}
                role={token.ownerSeatId ? 'button' : undefined}
                tabindex={token.ownerSeatId ? 0 : undefined}
                draggable={isGM}
                ondragstart={(e) => onCardDragStart(e, token)}
                ondragover={(e) => onCardDragOver(e, section, cardIndex)}
                ondragend={endDrag}
                onclick={() => selectCard(token)}
                onkeydown={(e) => e.key === 'Enter' && selectCard(token)}
              >
                {#if isReady(token)}
                  <span class="ready-badge" data-testid={`board-ready-${token.id}`}>READY</span>
                {/if}
                <div class="portrait">
                  <img src={assets.resolve(token.imageRef)} alt="" />
                  {#if !boardVisibleIds.has(token.id)}
                    <span class="hidden-tag" data-testid={`board-token-hidden-${token.id}`}
                      >hidden</span
                    >
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
                        <div
                          class="pinned-row"
                          data-testid={`board-pinned-${token.id}-${row.fieldId}`}
                        >
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
                            void rollFromCard(token, shortcut.die, shortcut.label);
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
                    <!-- Straight into the order, no group required — the only
                    route in used to be token → Group → flip [Active]. -->
                    <button
                      class="add-init"
                      data-testid={`board-add-init-${token.id}`}
                      disabled={inOrder(token)}
                      onclick={(e) => {
                        e.stopPropagation();
                        void addToInitiative(token);
                      }}
                    >
                      {inOrder(token) ? 'In initiative' : '+ Initiative'}
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>

  <RollStrip {rolls} {players} {conventions} />

  {#if isGM}
    <!-- Random tables moved out to their own referee-only quick sheet, and the
    Blind Drawer was retired in favour of the Roll sheet's Hidden roll — a
    referee shouldn't have to be on the encounter board to make a secret roll
    or consult a table. What's left here is the group roster, which *is* about
    this board. -->
    <div class="gm-panels" data-testid="encounter-gm-panels">
      <GroupsPanel {roomId} {groups} {tokens} {players} />
    </div>
  {/if}

  <!-- Workflow 1 (Free): the app tracks nothing — no order, no rounds, no
  tracker. The referee calls for rolls and players use the Roll quick sheet.
  Any rules system, any initiative style.

  Note this also takes the Caller marker off the board with it: the caller
  controls live inside `CombatTracker`'s free branch, which is exactly what
  Workflow 1 says not to render. The feature is intact in code and schema
  (`Encounter.callerSeatId`, `caller-select`, `caller-rotate`) rather than
  deleted, so re-surfacing it behind its own toggle is a small change if the
  referee wants it back. -->
  {#if initiativeMode !== 'free'}
    <CombatTracker
      {roomId}
      {groups}
      {encounter}
      {tokens}
      {isGM}
      {myUid}
      {players}
      {rolls}
      {conventions}
      {initiativeDie}
      {initiativeMode}
      profileTemplate={template}
      {profiles}
      {encounterTemplate}
    />
  {/if}
</div>

<style>
  .encounter-board {
    position: absolute;
    inset: 0;
    padding: 1rem;
    /* The whole board is interactive, so it indents wholesale rather than
       letting docked quick sheets bury its first cards. */
    padding-left: calc(1rem + var(--sheet-gutter-left, 0px));
    padding-right: calc(1rem + var(--sheet-gutter-right, 0px));
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
  /* A staged side/actor is dimmed with a large READY over it — the roll is
     loaded but deliberately not shown until everyone resolves at once. */
  .cast-section.staged-ready > :global(*:not(.ready-overlay)),
  .card.staged-ready > :global(*:not(.ready-badge)) {
    opacity: 0.35;
  }
  .ready-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--accent);
    pointer-events: none;
    z-index: 2;
  }
  .ready-badge {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--accent);
    pointer-events: none;
    z-index: 2;
  }
  .add-init {
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
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
  /* Drop feedback: the box lights up for a card, and shows an insertion edge
     for a whole group being reordered above it. */
  .cast-section.card-dropzone {
    border-color: var(--accent);
  }
  .cast-section.group-dropzone {
    box-shadow: inset 0 3px 0 var(--accent);
  }
  .cast-section h3.draggable {
    cursor: grab;
  }
  .cast-section h3 .rename {
    flex: 1;
    min-width: 0;
    max-width: 16rem;
    font: inherit;
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--bg-inset);
    color: inherit;
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
  /* The card under the pointer fades while its ghost follows the cursor, and
     the gap it would land in is marked by an accent edge. */
  .card.dragging {
    opacity: 0.35;
  }
  .card.drop-before {
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .card.drop-after {
    box-shadow: inset -3px 0 0 var(--accent);
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
