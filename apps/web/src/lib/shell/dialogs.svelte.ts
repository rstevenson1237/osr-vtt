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

/** A yes/no confirmation (Master Plan v2, R4 — remove player / transfer
 * referee). `danger` styles the confirm button for destructive/irreversible
 * actions (removing a seat, giving up the referee role). */
export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

export class DialogService {
  prompt = $state<PromptRequest | null>(null);
  confirmRequest = $state<ConfirmRequest | null>(null);

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

  /** Resolves `true`/`false` — the confirm/cancel choice. Callers that need a
   * "double-confirm" (Master Plan v2, R4 — GM transfer) just `await` this
   * twice with different messages. */
  confirm(opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmRequest = {
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      };
    });
  }

  resolveConfirm(value: boolean): void {
    const req = this.confirmRequest;
    this.confirmRequest = null;
    req?.resolve(value);
  }
}
