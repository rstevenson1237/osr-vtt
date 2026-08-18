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
  import Icon from './Icon.svelte';
  import PresentationToggle from './PresentationToggle.svelte';
  import TurnStrip from '../TurnStrip.svelte';
  import TensionBar from '../TensionBar.svelte';

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
    roomId = '',
    myUid = '',
    encounter = null,
    encounterTemplate = [],
    groups = [],
    tokens = [],
    conventions = [],
    onCopyInvite,
    onOpenSession,
  }: {
    roomName: string;
    players: PlayerSeat[];
    linkCopied: boolean;
    isGM?: boolean;
    roomId?: string;
    myUid?: string;
    encounter?: Encounter | null;
    encounterTemplate?: ProfileTemplateField[];
    groups?: Group[];
    tokens?: Token[];
    conventions?: RollConvention[];
    onCopyInvite: () => void;
    onOpenSession: () => void;
  } = $props();

  // Both the head count and the invite mean "somebody else could be here"
  // (SPEC-041 §3).
  const { multiplayer } = getContext<SessionMode>(SESSION_MODE_KEY);
</script>

<div class="mtop" data-testid="mobile-top-bar">
  <span class="dot" title="Connected"></span>
  <span class="roomname" data-testid="room-name">{roomName}</span>
  {#if multiplayer}
    <span class="presence" data-testid="presence-count" title="Players present">
      {players.length} ⏺
    </span>
    <button class="invite" data-testid="copy-share-link" onclick={onCopyInvite}>
      {linkCopied ? 'Copied!' : 'invite'}
    </button>
  {/if}
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
  <!-- Same control as the desktop bar (SPEC-033 §5): full-screen toggles the
  whole app frame, and hides itself where the app already owns the display
  (an installed standalone launch) or cannot claim it (an iPhone browser). -->
  <PresentationToggle size={14} />
</div>

<!-- Round / whose turn / pinned tension fields. `VTT_Master_Plan.md` Part II §1 puts
these "on every stage", but mobile carried neither: on a phone they existed
only inside the Encounter view. -->
<div class="mstate">
  <TurnStrip {encounter} {groups} {tokens} />
  <TensionBar
    {roomId}
    {encounter}
    {isGM}
    {myUid}
    {conventions}
    variant="rail"
    encounterFields={encounterTemplate}
  />
</div>

<style>
  .mstate {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.7rem 0.25rem;
    overflow-x: auto;
    font-size: 0.75rem;
  }
  .mstate:empty {
    display: none;
  }
  .mtop {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* min-height, not height:100% — the shell's top row is now auto-sized so
       the state strip below can claim its own line. */
    min-height: 40px;
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
