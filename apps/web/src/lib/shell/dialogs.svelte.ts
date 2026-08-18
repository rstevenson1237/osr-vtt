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

/** Master Plan v2, R7.3 — Add-creature (GM) / My-token (player) both boil
 * down to "pick a ref, optionally a name + quantity + group name", so they
 * share one dialog request/component (`TokenPickerDialog.svelte`) instead of
 * two near-identical ones. `name`/`count`/`groupName` only render for
 * `mode: 'creature'` (SPEC-040 §2). */
export interface TokenPickerRequest {
  title: string;
  roomId: string;
  mode: 'creature' | 'portrait';
  confirmLabel: string;
  /** Pre-fills the Generate-default tab's character field (Plan R18.1) —
   * the same symbol the caller's own default-ref logic would use
   * (`seatLetterFor` for a seat, `nextCreatureLetters`'s first letter for a
   * creature batch), so an untouched picker still produces the caller's usual
   * auto label. */
  genDefaultLabel?: string;
  /** Seed for the Generate-default tab's pre-filled color, hashed through
   * `genColorToken` — a seat's uid. A creature has none: its batch colour is
   * seeded from the **name** typed into this very dialog (SPEC-040 §4), so
   * the preview follows the name field rather than a value the caller could
   * have known in advance. */
  genDefaultColorSeed?: string;
  resolve: (value: TokenPickerResult | null) => void;
}

export interface TokenPickerResult {
  /** A concrete ref, or `''` — the "Generate default" sentinel: the caller
   * computes a fresh `gen:disc:` ref per token itself (SPEC-040 §4's
   * per-group letter assignment needs the caller's own group/token context,
   * which this dialog doesn't have). */
  ref: string;
  count: number;
  groupName: string;
  /** What to call the creature (SPEC-040 §2) — the base name the caller
   * numbers across the batch. `''` for `mode: 'portrait'`, and for a referee
   * who left the field empty: the caller then writes no `Token.name` at all
   * and the display fallback stays live. */
  name: string;
  /** A colour the referee picked on the Generate-default tab *without*
   * touching the character field. `ref` stays the `''` sentinel in that case
   * — the batch still needs its own per-token letters — so the choice rides
   * here instead of being baked into one shared ref. `undefined` ⇒ the batch
   * colour is derived from `name` as usual. */
  genColor?: string;
}

export class DialogService {
  prompt = $state<PromptRequest | null>(null);
  confirmRequest = $state<ConfirmRequest | null>(null);
  tokenPicker = $state<TokenPickerRequest | null>(null);

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

  /** Opens the Add-creature (GM) / My-token (player) picker (Master Plan
   * v2, R7.3). Resolves with the chosen ref + count/group name, or `null`
   * if cancelled. */
  pickToken(opts: {
    title: string;
    roomId: string;
    mode: 'creature' | 'portrait';
    confirmLabel?: string;
    genDefaultLabel?: string;
    genDefaultColorSeed?: string;
  }): Promise<TokenPickerResult | null> {
    return new Promise((resolve) => {
      this.tokenPicker = {
        title: opts.title,
        roomId: opts.roomId,
        mode: opts.mode,
        confirmLabel: opts.confirmLabel ?? 'Add',
        genDefaultLabel: opts.genDefaultLabel,
        genDefaultColorSeed: opts.genDefaultColorSeed,
        resolve,
      };
    });
  }

  confirmTokenPicker(value: TokenPickerResult): void {
    const req = this.tokenPicker;
    this.tokenPicker = null;
    req?.resolve(value);
  }

  cancelTokenPicker(): void {
    const req = this.tokenPicker;
    this.tokenPicker = null;
    req?.resolve(null);
  }
}
