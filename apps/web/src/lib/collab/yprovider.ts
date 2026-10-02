import type { CampaignStore, Unsubscribe } from '@osr-vtt/shared';
import * as Y from 'yjs';

/**
 * Wires a `Y.Doc` to a room-scoped Yjs channel over `CampaignStore`'s RTDB
 * transport (Plan §7 Phase 5 — "use RTDB as the Yjs transport", concurrent
 * Notes editing). Never touches Firebase directly — only the
 * `CampaignStore` interface (`subscribeYState`/`mergeYUpdate`), same as
 * every other collaborative surface in the app.
 *
 * No stomping: local edits are merged into the shared state via
 * `mergeYUpdate` (an RTDB transaction that merges Yjs update vectors —
 * commutative and idempotent by construction), and the merged state pushed
 * back down is applied locally via `Y.applyUpdate`, which is itself
 * idempotent — reapplying content this client already has is a no-op.
 *
 * Coalescing (WI-208): a typing burst fires one Yjs `update` per keystroke, and
 * each `mergeYUpdate` is an RTDB transaction that broadcasts the whole merged
 * state to every listener. Local updates are therefore buffered and joined with
 * `Y.mergeUpdates` — which is lossless — and sent as one `mergeYUpdate` once
 * typing has been idle for `LOCAL_IDLE_MS`. A burst that never pauses is still
 * flushed every `LOCAL_MAX_WAIT_MS`, so peers see it land; `disconnect` flushes
 * whatever is pending so a closing panel never drops an edit. The RTDB path and
 * the store calls are unchanged.
 */
export const LOCAL_IDLE_MS = 150;
export const LOCAL_MAX_WAIT_MS = 1000;

export class YRoomProvider {
  readonly doc = new Y.Doc();
  private unsubscribe: Unsubscribe | null = null;
  private applyingRemote = false;
  private pending: Uint8Array[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: CampaignStore,
    private readonly roomId: string,
    private readonly docName: string,
  ) {
    this.doc.on('update', this.handleLocalUpdate);
  }

  connect(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.subscribeYState(this.roomId, this.docName, (state) => {
      if (!state) return;
      this.applyingRemote = true;
      try {
        Y.applyUpdate(this.doc, state);
      } finally {
        this.applyingRemote = false;
      }
    });
  }

  disconnect(): void {
    this.flush();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.doc.off('update', this.handleLocalUpdate);
  }

  private handleLocalUpdate = (update: Uint8Array): void => {
    // `applyingRemote` is true only while this provider's own subscription
    // callback is applying a state that just arrived — skip re-broadcasting
    // that, so only genuinely local edits get merged back up.
    if (this.applyingRemote) return;
    this.pending.push(update);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(this.flush, LOCAL_IDLE_MS);
    this.maxWaitTimer ??= setTimeout(this.flush, LOCAL_MAX_WAIT_MS);
  };

  /** Sends everything buffered as one `mergeYUpdate`. A no-op when nothing is
   * pending, so the idle and max-wait timers can both fire safely. */
  private flush = (): void => {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    this.idleTimer = null;
    this.maxWaitTimer = null;
    if (this.pending.length === 0) return;
    const update = this.pending.length === 1 ? this.pending[0]! : Y.mergeUpdates(this.pending);
    this.pending = [];
    void this.store.mergeYUpdate(this.roomId, this.docName, update);
  };
}
