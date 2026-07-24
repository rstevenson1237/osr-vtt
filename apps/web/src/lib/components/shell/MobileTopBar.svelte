<script lang="ts">
  import type { PlayerSeat } from '@osr-vtt/shared';
  import Icon from './Icon.svelte';

  /** Compact top bar for mobile / tablet mode (Master Plan v2, R1.8): room name,
   * presence count, the invite button, and — since the Shell UI Redesign moved
   * Session settings out of the activity list and into a modal — the GM's gear.
   * The full Session tab (export/import, role pills, per-seat chips) stays
   * desktop-only. */
  let {
    roomName,
    players,
    linkCopied,
    isGM = false,
    onCopyInvite,
    onOpenSession,
  }: {
    roomName: string;
    players: PlayerSeat[];
    linkCopied: boolean;
    isGM?: boolean;
    onCopyInvite: () => void;
    onOpenSession: () => void;
  } = $props();
</script>

<div class="mtop" data-testid="mobile-top-bar">
  <span class="dot" title="Connected"></span>
  <span class="roomname" data-testid="room-name">{roomName}</span>
  <span class="presence" data-testid="presence-count" title="Players present">
    {players.length} ⏺
  </span>
  <button class="invite" data-testid="copy-share-link" onclick={onCopyInvite}>
    {linkCopied ? 'Copied!' : 'invite'}
  </button>
  {#if isGM}
    <button
      class="gear"
      data-testid="mobile-activity-session"
      title="Session settings"
      aria-label="Session settings"
      onclick={onOpenSession}
    >
      <Icon name="session" size={14} />
    </button>
  {/if}
</div>

<style>
  .mtop {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 100%;
    padding: 0 0.7rem;
    box-sizing: border-box;
    font-size: 0.82rem;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    flex: 0 0 auto;
  }
  .roomname {
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .presence {
    margin-left: auto;
    flex: 0 0 auto;
    color: var(--text-dim);
    font-size: 0.72rem;
    letter-spacing: 0.03em;
  }
  .invite {
    flex: 0 0 auto;
    border: 1px solid var(--accent);
    border-radius: 5px;
    padding: 0.2rem 0.6rem;
    color: var(--accent-text);
    background: transparent;
    font-size: 0.72rem;
    cursor: pointer;
  }
  .gear {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text);
    cursor: pointer;
    padding: 0;
  }
</style>
