<script lang="ts">
  import type { PlayerSeat } from '@osr-vtt/shared';

  /** Compact top bar for mobile / tablet mode (Master Plan v2, R1.8): room name,
   * presence count, and the invite button — nothing else. The full Session tab
   * (export/import, role pills, per-seat chips) stays desktop-only; Session
   * config remains reachable for the GM via the bottom activity bar. */
  let {
    roomName,
    players,
    linkCopied,
    onCopyInvite,
  }: {
    roomName: string;
    players: PlayerSeat[];
    linkCopied: boolean;
    onCopyInvite: () => void;
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
</style>
