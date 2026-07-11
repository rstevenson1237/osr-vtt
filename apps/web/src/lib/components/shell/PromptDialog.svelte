<script lang="ts">
  import Dialog from './Dialog.svelte';
  import type { PromptRequest } from '../../shell/dialogs.svelte';

  /** Renders the pending `DialogService.promptText` request as a focus-trapped
   * dialog (R1.6 / U10 — the `window.prompt` replacement). */
  let {
    request,
    onConfirm,
    onCancel,
  }: {
    request: PromptRequest;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  } = $props();

  // Re-mounted per request (guarded by `{#if dialogs.prompt}`), so seeding once
  // from `request.initial` is intentional.
  // eslint-disable-next-line svelte/valid-compile
  let value = $state(request.initial);

  function submit(e: Event): void {
    e.preventDefault();
    onConfirm(value);
  }
</script>

<Dialog title={request.title} onClose={onCancel} testid="prompt-dialog">
  <form id="prompt-form" onsubmit={submit}>
    <label>
      {request.label ?? request.title}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        data-testid="prompt-input"
        bind:value
        placeholder={request.placeholder ?? ''}
        autofocus
      />
    </label>
  </form>
  {#snippet footer()}
    <button type="button" class="ghost" onclick={onCancel}>Cancel</button>
    <button type="submit" form="prompt-form" class="primary" data-testid="prompt-confirm">
      {request.confirmLabel}
    </button>
  {/snippet}
</Dialog>

<style>
  label {
    display: block;
    font-size: 0.85rem;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.35rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
    font-weight: 600;
  }
  button.primary {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  button.ghost {
    font-weight: normal;
  }
</style>
