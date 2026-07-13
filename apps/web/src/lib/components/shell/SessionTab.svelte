<script lang="ts">
  import type { PlayerSeat } from '@osr-vtt/shared';

  /** Top rail (Master Plan v2, R1.1 — Session tab). Room name, connection dot,
   * invite copy, presence chips (initial + colour, ♦ marks the referee), and a
   * GM shortcut into the Session config activity. `.vttcamp` export/import
   * moved into the Session activity's Room section (Master Plan v2, R4) — the
   * whole activity is GM-only, so export/import are now too. */
  let {
    roomName,
    roomId,
    players,
    gmUid,
    isGM,
    myRole,
    linkCopied,
    onCopyInvite,
    onOpenSession,
  }: {
    roomName: string;
    roomId: string;
    players: PlayerSeat[];
    gmUid: string;
    isGM: boolean;
    myRole: string;
    linkCopied: boolean;
    onCopyInvite: () => void;
    onOpenSession: () => void;
  } = $props();

  // Deterministic per-seat chip colour from the group palette (decorative).
  const CHIP_COLORS = [
    'var(--group-world)',
    'var(--group-play)',
    'var(--group-records)',
    'var(--accent)',
  ];
  function chipColor(uid: string, index: number): string {
    if (uid === gmUid) return 'var(--group-referee)';
    return CHIP_COLORS[index % CHIP_COLORS.length]!;
  }
  function initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }
  const shortId = $derived(roomId.length > 8 ? `${roomId.slice(0, 6)}…` : roomId);
</script>

<div class="session-tab" data-testid="session-tab">
  <span class="dot" title="Connected"></span>
  <span class="roomname" data-testid="room-name">{roomName}</span>
  <span class="pill" data-testid="room-id" title={roomId}>#/r/{shortId}</span>
  <span class="pill role" data-testid="my-role">{myRole}</span>
  <button class="pill brass" data-testid="copy-share-link" onclick={onCopyInvite}>
    {linkCopied ? 'Copied!' : 'copy invite'}
  </button>
  {#if isGM}
    <button class="pill" data-testid="session-shortcut" onclick={onOpenSession}>Session ⚙</button>
  {/if}

  <div class="presence" data-testid="presence">
    {#each players as p, i (p.uid)}
      <span
        class="chip"
        class:ref={p.uid === gmUid}
        style={`background:${chipColor(p.uid, i)}`}
        title={`${p.displayName}${p.uid === gmUid ? ' (referee)' : ''}`}
        data-testid={`presence-chip-${p.uid}`}
      >
        {initial(p.displayName)}
      </span>
    {/each}
  </div>
</div>

<style>
  .session-tab {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    height: 100%;
    padding: 0 0.6rem;
    font-size: 0.8rem;
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
    letter-spacing: 0.03em;
  }
  .pill {
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.1rem 0.5rem;
    color: var(--text-dim);
    font-size: 0.72rem;
    background: transparent;
    cursor: default;
    white-space: nowrap;
  }
  button.pill {
    cursor: pointer;
  }
  button.pill:hover {
    color: var(--text);
  }
  .pill.brass {
    color: var(--accent-text);
    border-color: var(--accent);
  }
  .presence {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    margin-left: auto;
  }
  .chip {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--bg-root);
    position: relative;
  }
  .chip.ref::after {
    content: '♦';
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--accent-text);
    font-size: 0.55rem;
  }
</style>
