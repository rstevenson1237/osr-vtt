<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, PlayerSeat, Role } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, DIALOG_KEY } from '../../context';
  import { DialogService } from '../../shell/dialogs.svelte';

  /** Players — in-session management (Master Plan v2, R4 — Session Config
   * "Players" section). Rename/role/remove/GM-transfer for every seat but the
   * GM's own row (rules already permit GM writes to any seat and the room
   * doc — see `firestore.rules.test.ts`'s GM-transfer suite). */
  let { roomId, players, gmUid }: { roomId: string; players: PlayerSeat[]; gmUid: string } =
    $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);

  const seats = $derived(players.filter((p) => p.uid !== gmUid));
  const gmSeat = $derived(players.find((p) => p.uid === gmUid) ?? null);

  /** uid of the row whose "remove" inline confirm is expanded. */
  let removing = $state<string | null>(null);
  let alsoDeleteProfile = $state(false);

  async function rename(seat: PlayerSeat): Promise<void> {
    const value = await dialogs.promptText({
      title: 'Rename player',
      label: 'Display name',
      initial: seat.displayName,
      confirmLabel: 'Rename',
    });
    const trimmed = value?.trim();
    if (!trimmed || trimmed === seat.displayName) return;
    await store.renamePlayer(roomId, seat.uid, trimmed);
  }

  async function setRole(uid: string, role: Role): Promise<void> {
    if (role === 'gm') return; // GM-ness only ever changes via transferGM
    await store.setPlayerRole(roomId, uid, role);
  }

  function startRemove(uid: string): void {
    removing = uid;
    alsoDeleteProfile = false;
  }

  function cancelRemove(): void {
    removing = null;
  }

  async function confirmRemove(uid: string): Promise<void> {
    await store.removePlayer(roomId, uid, { deleteProfile: alsoDeleteProfile });
    removing = null;
  }

  async function transfer(seat: PlayerSeat): Promise<void> {
    const first = await dialogs.confirm({
      title: 'Transfer referee?',
      message: `${seat.displayName} will become the GM. You will be demoted to a player.`,
      confirmLabel: 'Continue',
      danger: true,
    });
    if (!first) return;
    const second = await dialogs.confirm({
      title: 'Are you sure?',
      message: 'This takes effect immediately. Only the new GM can transfer it back.',
      confirmLabel: 'Transfer referee',
      danger: true,
    });
    if (!second) return;
    await store.transferGM(roomId, seat.uid);
  }
</script>

<div class="players-panel" data-testid="players-panel">
  {#if gmSeat}
    <div class="row gm-row" data-testid={`player-row-${gmSeat.uid}`}>
      <span class="name">{gmSeat.displayName}</span>
      <span class="pill">gm</span>
    </div>
  {/if}
  {#each seats as seat (seat.uid)}
    <div class="row" data-testid={`player-row-${seat.uid}`}>
      <span class="name" data-testid={`player-name-${seat.uid}`}>{seat.displayName}</span>
      <button
        class="ghost"
        data-testid={`player-rename-${seat.uid}`}
        onclick={() => rename(seat)}
      >
        Rename
      </button>
      <select
        data-testid={`player-role-${seat.uid}`}
        value={seat.role}
        onchange={(e) => void setRole(seat.uid, (e.target as HTMLSelectElement).value as Role)}
      >
        <option value="player">player</option>
        <option value="viewer">viewer</option>
      </select>
      <button
        class="ghost"
        data-testid={`player-transfer-${seat.uid}`}
        onclick={() => void transfer(seat)}
      >
        Make referee
      </button>
      {#if removing === seat.uid}
        <span class="remove-confirm" data-testid={`player-remove-confirm-${seat.uid}`}>
          <label>
            <input type="checkbox" bind:checked={alsoDeleteProfile} />
            also delete character sheet
          </label>
          <button
            class="danger"
            data-testid={`player-remove-confirm-yes-${seat.uid}`}
            onclick={() => void confirmRemove(seat.uid)}
          >
            Confirm remove
          </button>
          <button class="ghost" onclick={cancelRemove}>Cancel</button>
        </span>
      {:else}
        <button
          class="danger"
          data-testid={`player-remove-${seat.uid}`}
          onclick={() => startRemove(seat.uid)}
        >
          Remove
        </button>
      {/if}
    </div>
  {/each}
  {#if seats.length === 0}
    <p class="empty">No other players have joined yet.</p>
  {/if}
</div>

<style>
  .players-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-inset);
  }
  .gm-row {
    opacity: 0.85;
  }
  .name {
    font-weight: 600;
    margin-right: auto;
  }
  .pill {
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.1rem 0.5rem;
    font-size: 0.72rem;
    color: var(--text-dim);
  }
  select,
  button {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-panel);
    color: inherit;
    cursor: pointer;
  }
  button.ghost {
    background: transparent;
  }
  button.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
  .remove-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
  }
  .empty {
    color: var(--text-dim);
    font-size: 0.85rem;
  }
</style>
