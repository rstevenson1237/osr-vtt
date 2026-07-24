<script lang="ts">
  import MarkdownView from './MarkdownView.svelte';

  /** A long-form shared text field with an Edit ⇄ Preview toggle (Shell UI
   * Redesign, "Markdown editing"). Used by the party Notes panel and the
   * per-room players' notes — both are CRDT-backed, so the caller owns the
   * value and the input handler; this component only owns the toggle and the
   * two presentations.
   *
   * `textareaEl` is bindable because a CRDT-backed caller has to restore the
   * caret after a *remote* edit rewrites the DOM value out from under the
   * local user. */
  let {
    label,
    value,
    preview = $bindable(true),
    placeholder = '',
    minHeight = '6rem',
    testidPrefix,
    empty,
    textareaEl = $bindable(),
    oninput,
    onblur,
  }: {
    label?: string;
    value: string;
    preview?: boolean;
    placeholder?: string;
    minHeight?: string;
    testidPrefix: string;
    empty?: string;
    textareaEl?: HTMLTextAreaElement;
    oninput: (e: Event) => void;
    onblur?: () => void;
  } = $props();
</script>

<div class="md-editor">
  <div class="head">
    {#if label}<span class="label">{label}</span>{/if}
    <button
      class="toggle"
      type="button"
      data-testid={`${testidPrefix}-toggle`}
      onclick={() => (preview = !preview)}
    >
      {preview ? 'Edit' : 'Preview'}
    </button>
  </div>
  {#if preview}
    <div class="surface" style={`min-height:${minHeight}`}>
      <MarkdownView text={value} {empty} testid={`${testidPrefix}-preview`} />
    </div>
  {:else}
    <textarea
      bind:this={textareaEl}
      data-testid={`${testidPrefix}-input`}
      aria-label={label ?? 'Notes'}
      style={`min-height:${minHeight}`}
      {value}
      {placeholder}
      {oninput}
      onblur={() => onblur?.()}
    ></textarea>
  {/if}
</div>

<style>
  .md-editor {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .label {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .toggle {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--accent-text);
    cursor: pointer;
    font-size: 0.72rem;
    padding: 0.1rem 0.25rem;
    border-radius: 4px;
  }
  .toggle:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .surface {
    box-sizing: border-box;
    background: var(--bg-inset);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    resize: vertical;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
    font-size: 0.84rem;
  }
</style>
