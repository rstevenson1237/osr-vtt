<script lang="ts">
  import type { PlayerSeat, ProfileInstance, ProfileTemplateField, Token } from '@osr-vtt/shared';
  import Popover from './Popover.svelte';
  import CharacterDock from '../CharacterDock.svelte';
  import { GROUP_COLOR_VAR } from '../../shell/types';

  /** Characters quick-sheet flyout (Master Plan v2, R1.2). Re-houses the
   * existing `CharacterDock` (own seat by default) with an "Open full view"
   * shortcut. Only opens when Characters is not the active stage, so the dock
   * never mounts twice (no duplicate `character-dock` testid). */
  let {
    template,
    profile,
    seatId,
    roomId,
    players,
    tokens,
    readOnly,
    canSetOwnToken,
    showBack,
    style,
    onClose,
    onOpenFull,
    onBackToMine,
  }: {
    template: ProfileTemplateField[];
    profile: ProfileInstance | undefined;
    seatId: string;
    roomId: string;
    players: PlayerSeat[];
    tokens: Token[];
    readOnly: boolean;
    canSetOwnToken: boolean;
    showBack: boolean;
    style?: string;
    onClose: () => void;
    onOpenFull: () => void;
    onBackToMine: () => void;
  } = $props();
</script>

<Popover
  title="Characters — quick sheet"
  groupColor={GROUP_COLOR_VAR.records}
  {style}
  {onClose}
  testid="characters-minicard"
>
  {#if showBack}
    <button class="backlink" data-testid="dock-back-to-mine" onclick={onBackToMine}>
      ← Back to my sheet
    </button>
  {/if}
  <div class="scroll">
    <CharacterDock {template} {profile} {seatId} {roomId} {players} {tokens} {readOnly} {canSetOwnToken} />
  </div>
  <button class="fulllink" data-testid="characters-open-full" onclick={onOpenFull}>
    Open full view →
  </button>
</Popover>

<style>
  .scroll {
    max-height: 55vh;
    overflow-y: auto;
  }
  .backlink,
  .fulllink {
    display: block;
    background: transparent;
    border: none;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 0.78rem;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
  }
  .backlink {
    margin-bottom: 0.4rem;
  }
  .fulllink {
    margin-top: 0.5rem;
  }
</style>
