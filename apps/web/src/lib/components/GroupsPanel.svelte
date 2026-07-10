<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, Group, Token } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { tokenLabel } from '../encounter/labels';

  /**
   * GM-only Groups roster (Encounter Screen Spec §3, §8). Membership
   * (`memberTokenIds`) is the single source of truth for both surfaces —
   * `[Map]`/`[Board]` decide where a group's tokens render, `[Active]`
   * decides whether the group is in the shared initiative pool.
   */
  let { roomId, groups, tokens }: { roomId: string; groups: Group[]; tokens: Token[] } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let newGroupName = $state('');
  let newGroupMembers = $state<Set<string>>(new Set());

  function toggleNewMember(tokenId: string): void {
    const next = new Set(newGroupMembers);
    if (next.has(tokenId)) next.delete(tokenId);
    else next.add(tokenId);
    newGroupMembers = next;
  }

  async function createGroup(): Promise<void> {
    const name = newGroupName.trim();
    if (!name) return;
    await store.createGroup(roomId, {
      name,
      memberTokenIds: [...newGroupMembers],
      showMap: false,
      showBoard: false,
      active: false,
    });
    newGroupName = '';
    newGroupMembers = new Set();
  }

  function toggleMember(group: Group, tokenId: string): void {
    const has = group.memberTokenIds.includes(tokenId);
    const memberTokenIds = has
      ? group.memberTokenIds.filter((id) => id !== tokenId)
      : [...group.memberTokenIds, tokenId];
    void store.updateGroup(roomId, group.id, { memberTokenIds });
  }

  function toggleFlag(group: Group, flag: 'showMap' | 'showBoard' | 'active'): void {
    void store.updateGroup(roomId, group.id, { [flag]: !group[flag] });
  }

  function removeGroup(groupId: string): void {
    void store.deleteGroup(roomId, groupId);
  }
</script>

<div class="groups-panel" data-testid="groups-panel">
  <h2>Groups</h2>

  <div class="create-group">
    <input data-testid="new-group-name" placeholder="Group name" bind:value={newGroupName} />
    {#if tokens.length > 0}
      <div class="member-picker">
        {#each tokens as token (token.id)}
          <label class="member-check">
            <input
              type="checkbox"
              data-testid={`new-group-member-${token.id}`}
              checked={newGroupMembers.has(token.id)}
              onchange={() => toggleNewMember(token.id)}
            />
            {tokenLabel(token, token.id)}
          </label>
        {/each}
      </div>
    {/if}
    <button
      data-testid="create-group-submit"
      onclick={() => void createGroup()}
      disabled={!newGroupName.trim()}
    >
      Add group
    </button>
  </div>

  <ul class="group-list">
    {#each groups as group (group.id)}
      <li class="group-row" data-testid={`group-row-${group.id}`}>
        <div class="group-header">
          <span class="group-name">{group.name}</span>
          <span class="member-count">{group.memberTokenIds.length} member(s)</span>
          <button
            data-testid={`group-delete-${group.id}`}
            class="delete"
            onclick={() => removeGroup(group.id)}>✕</button
          >
        </div>
        <div class="toggles">
          <button
            data-testid={`group-toggle-map-${group.id}`}
            class:active={group.showMap}
            onclick={() => toggleFlag(group, 'showMap')}>Map</button
          >
          <button
            data-testid={`group-toggle-board-${group.id}`}
            class:active={group.showBoard}
            onclick={() => toggleFlag(group, 'showBoard')}>Board</button
          >
          <button
            data-testid={`group-toggle-active-${group.id}`}
            class:active={group.active}
            onclick={() => toggleFlag(group, 'active')}>Active</button
          >
        </div>
        {#if tokens.length > 0}
          <div class="member-picker">
            {#each tokens as token (token.id)}
              <label class="member-check">
                <input
                  type="checkbox"
                  data-testid={`group-member-${group.id}-${token.id}`}
                  checked={group.memberTokenIds.includes(token.id)}
                  onchange={() => toggleMember(group, token.id)}
                />
                {tokenLabel(token, token.id)}
              </label>
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .groups-panel {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .groups-panel h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .create-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-bottom: 0.6rem;
    margin-bottom: 0.6rem;
    border-bottom: 1px solid #3a3226;
  }
  input:not([type]) {
    box-sizing: border-box;
    padding: 0.4rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
  }
  .member-picker {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 6rem;
    overflow-y: auto;
    font-size: 0.8rem;
  }
  .member-check {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  button {
    margin-top: 0;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .group-row {
    border: 1px solid #3a3226;
    border-radius: 6px;
    padding: 0.5rem;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }
  .group-name {
    font-weight: 600;
    flex: 1;
  }
  .member-count {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .delete {
    padding: 0.1rem 0.4rem;
  }
  .toggles {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.35rem;
  }
  .toggles button.active {
    background: #a6763f;
    color: #14110d;
    font-weight: 600;
    border-color: #a6763f;
  }
</style>
