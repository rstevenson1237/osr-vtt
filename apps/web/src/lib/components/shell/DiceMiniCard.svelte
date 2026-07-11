<script lang="ts">
  import Popover from './Popover.svelte';
  import DiceTray from '../DiceTray.svelte';
  import { GROUP_COLOR_VAR } from '../../shell/types';

  /** Dice quick-tray flyout (Master Plan v2, R1.2). Re-houses the existing
   * `DiceTray` (all `tray-*`/`roll-button` testids preserved) in a docked
   * mini-card with an "Open full view" shortcut to the Dice stage. The tray's
   * staged state is a shared singleton, so the mini-card and stage never mount
   * simultaneously (the rail only opens this when Dice is not the active
   * stage) — no duplicate roll controls. */
  let {
    roomId,
    authorUid,
    style,
    onClose,
    onOpenFull,
  }: {
    roomId: string;
    authorUid: string;
    style?: string;
    onClose: () => void;
    onOpenFull: () => void;
  } = $props();
</script>

<Popover
  title="Dice — quick tray"
  groupColor={GROUP_COLOR_VAR.play}
  {style}
  {onClose}
  testid="dice-minicard"
>
  <div class="scroll">
    <DiceTray {roomId} {authorUid} />
  </div>
  <button class="fulllink" data-testid="dice-open-full" onclick={onOpenFull}>Open full view →</button>
</Popover>

<style>
  .scroll {
    max-height: 55vh;
    overflow-y: auto;
  }
  .fulllink {
    display: block;
    margin-top: 0.5rem;
    background: transparent;
    border: none;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 0.78rem;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
  }
</style>
