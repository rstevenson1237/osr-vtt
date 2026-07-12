/** Shell-owned dialog service (Master Plan v2, R1.6 / U10). Retires
 * `window.prompt`: any component can `await dialogs.promptText(...)` and the
 * shell renders a focus-trapped `<Dialog>` bound to the pending request. */

export interface PromptRequest {
  title: string;
  label?: string;
  placeholder?: string;
  initial: string;
  confirmLabel: string;
  /** Renders a `<textarea>` instead of a single-line `<input>` — needed
   * wherever explicit `\n` newlines are meaningful (Master Plan v2, R9.5
   * multiline room labels). */
  multiline?: boolean;
  resolve: (value: string | null) => void;
}

export class DialogService {
  prompt = $state<PromptRequest | null>(null);

  /** Resolves with the entered string, or `null` if cancelled. */
  promptText(opts: {
    title: string;
    label?: string;
    placeholder?: string;
    initial?: string;
    confirmLabel?: string;
    multiline?: boolean;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      this.prompt = {
        title: opts.title,
        label: opts.label,
        placeholder: opts.placeholder,
        initial: opts.initial ?? '',
        confirmLabel: opts.confirmLabel ?? 'OK',
        multiline: opts.multiline ?? false,
        resolve,
      };
    });
  }

  confirmPrompt(value: string): void {
    const req = this.prompt;
    this.prompt = null;
    req?.resolve(value);
  }

  cancelPrompt(): void {
    const req = this.prompt;
    this.prompt = null;
    req?.resolve(null);
  }
}
