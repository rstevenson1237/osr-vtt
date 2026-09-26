let nextId = 0;

/**
 * The shell's single modal stack (SPEC-056 §7). A prompt, a confirm, the
 * token picker, the shortcut sheet and a dialog (all `Dialog.svelte`) and the
 * Log/Session overlays (`ShellOverlay.svelte`) each push one entry when they
 * mount and pop it on unmount — regardless of how many of them are open at
 * once (a confirm raised from inside the Session overlay, say). Only the
 * *top* entry may act on Escape or trap Tab, and only it restores focus to
 * the opener when it closes: without this, two stacked windows' own
 * `keydown` listeners both fire on one Escape press and close together.
 *
 * An expanded quick sheet is deliberately not a stack member — it closes
 * before any overlay, unaffected by whatever else is open (`RoomShell`'s
 * `onGlobalKey`).
 */
export class ModalStack {
  #entries = $state<number[]>([]);

  /** How many entries are currently open — `RoomShell` reads this alone to
   * decide whether a global shortcut is inert. */
  get depth(): number {
    return this.#entries.length;
  }

  /** Registers a new top entry and returns its id. */
  open(): number {
    const id = nextId++;
    this.#entries.push(id);
    return id;
  }

  /** Unregisters an entry, wherever it sits in the stack (closing out of
   * order is possible in principle, even though every current caller closes
   * top-down). */
  close(id: number): void {
    this.#entries = this.#entries.filter((entry) => entry !== id);
  }

  /** Whether `id` is the topmost (most-recently-opened, still-open) entry. */
  isTop(id: number): boolean {
    return this.#entries.length > 0 && this.#entries[this.#entries.length - 1] === id;
  }
}
