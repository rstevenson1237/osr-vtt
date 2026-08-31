<script lang="ts">
  import { getContext } from 'svelte';
  import type {
    Encounter,
    Group,
    PlayerSeat,
    ProfileTemplateField,
    RollConvention,
    Token,
  } from '@osr-vtt/shared';
  import { SESSION_MODE_KEY, type SessionMode } from '../../context';
  import AccountControls from '../AccountControls.svelte';
  import Icon from './Icon.svelte';
  import PresentationToggle from './PresentationToggle.svelte';
  import TensionBar from '../TensionBar.svelte';
  import TurnStrip from '../TurnStrip.svelte';

  /** Top rail (Master Plan v2, R1.1 — Session tab). Room name, connection dot,
   * invite copy, presence chips (initial + colour, ♦ marks the referee), and a
   * GM shortcut into Session settings — now a gear button opening the settings
   * *modal* rather than a full-stage activity (Shell UI Redesign). It also
   * hosts the encounter turn tracker ("Round N · X is up"), which used to
   * float over the map stage — shared initiative state belongs in the top
   * status bar, visible on every stage. It likewise hosts the encounter
   * status strip (Difficulty / Danger / clock, plus any pinned encounter
   * profile fields), which used to sit at the top of the Encounter Board.
   * The referee edits those values in place here — tension gets adjusted
   * constantly mid-play — while players only read them; the fields' *shape*
   * (labels, types, order, what's pinned) stays behind Session settings. The main-view tabs moved the other
   * way, into the side rail. `.vttcamp` export/import stay in the Session
   * settings' Room section (Master Plan v2, R4) — GM-only. */
  let {
    roomName,
    roomId,
    players,
    gmUid,
    isGM,
    myRole,
    linkCopied,
    encounter,
    encounterTemplate,
    groups,
    tokens,
    myUid = '',
    conventions = [],
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
    encounter: Encounter | null;
    encounterTemplate: ProfileTemplateField[];
    groups: Group[];
    tokens: Token[];
    myUid?: string;
    conventions?: RollConvention[];
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
  // The room id, the invite, the account affordance and the presence chips all
  // mean "somebody else could be here" and are absent from a local build
  // (SPEC-041 §3).
  const { multiplayer } = getContext<SessionMode>(SESSION_MODE_KEY);
</script>

<div class="session-tab" data-testid="session-tab">
  <span class="dot" title="Connected"></span>
  <span class="roomname" data-testid="room-name">{roomName}</span>
  {#if multiplayer}
    <span class="pill" data-testid="room-id" title={roomId}>#/r/{shortId}</span>
  {/if}
  <span class="pill role" data-testid="my-role">{myRole}</span>

  <TurnStrip {encounter} {groups} {tokens} />

  {#if multiplayer}
    <button class="pill brass" data-testid="copy-share-link" onclick={onCopyInvite}>
      {linkCopied ? 'Copied!' : 'copy invite'}
    </button>
  {/if}
  {#if isGM}
    <button
      class="gear"
      data-testid="session-shortcut"
      title="Session settings"
      aria-label="Session settings"
      onclick={onOpenSession}
    >
      <Icon name="session" size={16} />
    </button>
  {/if}

  <!-- Full-screen: presentation only, so it sits with the other frame-level
  controls and is available to every seat, not just the referee (SPEC-033 §5). -->
  <PresentationToggle size={16} />

  <!-- Optional "Save your identity" affordance (Master Plan v2, R6.1) — subtle,
  never a login wall; players may stay anonymous forever. -->
  {#if multiplayer}
    <AccountControls placement="room" />
  {/if}

  <TensionBar
    {roomId}
    {encounter}
    {isGM}
    {myUid}
    {conventions}
    variant="rail"
    encounterFields={encounterTemplate}
  />

  {#if multiplayer}
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
  {/if}
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
  @media (hover: hover) {
    button.pill:hover {
      color: var(--text);
    }
  }
  .pill.brass {
    color: var(--accent-text);
    border-color: var(--accent);
  }
  .gear {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text);
    cursor: pointer;
    padding: 0;
  }
  @media (hover: hover) {
    .gear:hover {
      border-color: var(--accent);
    }
  }
  .gear:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
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
