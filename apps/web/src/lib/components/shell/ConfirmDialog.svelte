<script lang="ts">
  import Dialog from './Dialog.svelte';
  import type { ConfirmRequest } from '../../shell/dialogs.svelte';

  /** Renders the pending `DialogService.confirm` request (Master Plan v2, R4
   * — remove player / transfer referee). The `window.confirm` replacement,
   * same focus-trapped primitive as `PromptDialog`. */
  let {
    request,
    onConfirm,
    onCancel,
  }: {
    request: ConfirmRequest;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Dialog title={request.title} onClose={onCancel} testid="confirm-dialog">
  <p class="message">{request.message}</p>
  {#snippet footer()}
    <button type="button" class="ghost" onclick={onCancel} data-testid="confirm-dialog-cancel">
      Cancel
    </button>
    <button
      type="button"
      class:danger={request.danger}
      class:primary={!request.danger}
      onclick={onConfirm}
      data-testid="confirm-dialog-confirm"
    >
      {request.confirmLabel}
    </button>
  {/snippet}
</Dialog>

<style>
  .message {
    margin: 0;
    font-size: 0.9rem;
    white-space: pre-line;
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
  button.danger {
    background: var(--failure);
    color: var(--bg-root);
    border-color: var(--failure);
  }
  button.ghost {
    font-weight: normal;
  }
</style>
