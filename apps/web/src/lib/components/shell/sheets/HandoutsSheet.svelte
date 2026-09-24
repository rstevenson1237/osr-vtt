<script lang="ts">
  import HandoutPanel from '../../HandoutPanel.svelte';

  /** Handouts quick sheet (SPEC-056 §1) — the GM's saved-handout library and
   * reveal/hide controls, moved out of Session settings so a referee can
   * publish a handout without leaving whichever main view they're on.
   * Referee-only at the registry level (`QUICK_SHEETS`' `availability: 'gm'`);
   * `HandoutPanel` keeps its own `isGM` guard as the belt-and-braces check. */
  let {
    roomId,
    isGM,
    revealedRef,
  }: {
    roomId: string;
    isGM: boolean;
    revealedRef: string | null;
  } = $props();
</script>

<HandoutPanel {roomId} {isGM} {revealedRef} />
