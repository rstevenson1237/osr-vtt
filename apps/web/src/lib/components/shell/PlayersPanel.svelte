<script lang="ts">
  import { getContext } from 'svelte';
  import {
    ABANDONED_SEAT_DAYS,
    type CampaignStore,
    type PlayerSeat,
    type Role,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, DIALOG_KEY } from '../../context';
  import { DialogService } from '../../shell/dialogs.svelte';

  /** Players — in-session management (Master Plan v2, R4 — Session Config
   * "Players" section). Rename/role/remove/GM-transfer for every seat but the
   * GM's own row (rules already permit GM writes to any seat and the room
   * doc — see `firestore.rules.test.ts`'s GM-transfer suite).
   *
   * Presence (R26.2, WI-26 Board 1) is layered on as *display only*: a dot per
   * row, a dimmed row and a relative "last seen" when disconnected. Every
   * control stays exactly where it was and stays enabled — a disconnected
   * player is still a player, and the referee may still administer their seat. */
  let {
    roomId,
    players,
    gmUid,
    presentSeatIds = new Set<string>(),
  }: {
    roomId: string;
    players: PlayerSeat[];
    gmUid: string;
    presentSeatIds?: ReadonlySet<string>;
  } = $props();

  const DAY_MS = 24 * 60 * 60 * 1000;

  /** "last seen" for a disconnected seat. Absent `lastPresentAt` ⇒ we have
   * never observed this seat (it predates the field), which is deliberately
   * not rendered as a duration — see `abandonedSeatUids`. */
  function lastSeen(seat: PlayerSeat): string {
    if (seat.lastPresentAt === undefined) return '';
    const mins = Math.round((Date.now() - seat.lastPresentAt) / 60000);
    if (mins < 1) return 'last seen just now';
    if (mins < 60) return `last seen ${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `last seen ${hours}h ago`;
    return `last seen ${Math.round(hours / 24)}d ago`;
  }

  /** Referee-only marker for a seat the R26.3 prune would offer. Never an
   * action here — it points at Maintenance, where the confirm lives. */
  function isInactive(seat: PlayerSeat): boolean {
    return (
      !presentSeatIds.has(seat.uid) &&
      seat.lastPresentAt !== undefined &&
      Date.now() - seat.lastPresentAt > ABANDONED_SEAT_DAYS * DAY_MS
    );
  }

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
    {@const gmHere = presentSeatIds.has(gmSeat.uid)}
    <div class="row gm-row" class:away={!gmHere} data-testid={`player-row-${gmSeat.uid}`}>
      <span class="name">
        <i
          class="dot"
          class:present={gmHere}
          data-testid={`player-presence-${gmSeat.uid}`}
          data-present={gmHere}
          title={gmHere ? 'connected' : 'not connected'}
        ></i>
        {gmSeat.displayName}
      </span>
      <span class="pill">gm</span>
    </div>
  {/if}
  {#each seats as seat (seat.uid)}
    {@const here = presentSeatIds.has(seat.uid)}
    <div class="row" class:away={!here} data-testid={`player-row-${seat.uid}`}>
      <span class="name" data-testid={`player-name-${seat.uid}`}>
        <i
          class="dot"
          class:present={here}
          data-testid={`player-presence-${seat.uid}`}
          data-present={here}
          title={here ? 'connected' : 'not connected'}
        ></i>
        {seat.displayName}
      </span>
      {#if !here}
        {@const seen = lastSeen(seat)}
        {#if seen}
          <span class="seen" data-testid={`player-last-seen-${seat.uid}`}>{seen}</span>
        {/if}
        {#if isInactive(seat)}
          <span class="pill warn" data-testid={`player-inactive-${seat.uid}`}>inactive</span>
        {/if}
      {/if}
      <button class="ghost" data-testid={`player-rename-${seat.uid}`} onclick={() => rename(seat)}>
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
  /* Disconnected: the row recedes, but nothing in it is disabled (R26.2 —
     disconnection is a display state with no data consequence). */
  .row.away {
    opacity: 0.55;
  }
  .name {
    font-weight: 600;
    margin-right: auto;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: 0 0 auto;
    border: 1.5px solid var(--text-dim);
  }
  .dot.present {
    background: var(--success);
    border-color: var(--success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
  }
  .seen {
    font-size: 0.72rem;
    color: var(--text-dim);
  }
  .pill.warn {
    color: var(--complication);
    border-color: var(--complication);
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
