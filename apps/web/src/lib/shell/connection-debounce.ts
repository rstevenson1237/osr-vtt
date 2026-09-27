/**
 * Turns a raw connectivity reading (`CampaignStore.subscribeConnection`) into
 * a debounced "disconnected" signal (SPEC-058 §2, DEC-121): the room locks
 * only once the client has reported disconnected **continuously** for
 * `delayMs` (default 2000) — long enough to ride out an `.info/connected`
 * blip and the brief `false` every page load starts in — and unlocks on the
 * very first `true`, immediately.
 *
 * A plain class rather than a `.svelte.ts` rune store: it has no rendering
 * concerns of its own, which is what keeps its timing testable with a fake
 * clock (`connection-debounce.test.ts`) without pulling Svelte's runtime in.
 * The caller (`RoomShell`) holds the `disconnected` value itself, in its own
 * `$state`, and passes `onChange` to write to it.
 */
export class ConnectionDebounce {
  #disconnected = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onChange: (disconnected: boolean) => void,
    private readonly delayMs = 2000,
  ) {}

  get disconnected(): boolean {
    return this.#disconnected;
  }

  /** Feed the latest raw reading from `subscribeConnection`. */
  report(connected: boolean): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (connected) {
      if (this.#disconnected) {
        this.#disconnected = false;
        this.onChange(false);
      }
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (this.#disconnected) return;
      this.#disconnected = true;
      this.onChange(true);
    }, this.delayMs);
  }

  /** Stops a pending lock timer — call from `onDestroy`. */
  dispose(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}
