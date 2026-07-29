<script lang="ts">
  import TableRunner from '../../TableRunner.svelte';

  /** Random tables quick sheet. This used to be a panel wedged into the
   * Encounter view's referee column, which meant a referee could only roll on
   * a wandering-monster table while looking at the encounter board — the one
   * view they are *least* likely to be on when a random check comes up. As a
   * quick sheet it layers over whichever main view is on stage.
   *
   * Referee-only at the registry level (`QUICK_SHEETS`' `availability: 'gm'`),
   * so a player never sees the toggle; `TableRunner` keeps its own `isGM`
   * guard as the belt-and-braces check. */
  let {
    roomId,
    authorUid,
    isGM,
  }: {
    roomId: string;
    authorUid: string;
    isGM: boolean;
  } = $props();
</script>

<TableRunner {roomId} {isGM} {authorUid} />
