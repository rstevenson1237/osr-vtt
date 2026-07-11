<script lang="ts">
  /** Assets activity placeholder. Registered in the shell now (R1.2) so its
   * rail slot and navigation exist; the real asset library, `gen:` default
   * tokens, and URL/upload flows are R7/WI-9. */
</script>

<div class="assets-activity" data-testid="assets-activity">
  <div class="placeholder">
    <h1>Assets</h1>
    <p>The asset library — bundled packs, generated default tokens, and URL imports — arrives in WI-9.</p>
  </div>
</div>

<style>
  .assets-activity {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
  }
  .placeholder {
    max-width: 40ch;
    text-align: center;
    color: var(--text-dim);
  }
  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--text);
  }
</style>
