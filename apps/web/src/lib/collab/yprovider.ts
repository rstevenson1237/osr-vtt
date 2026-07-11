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
 */
export class YRoomProvider {
  readonly doc = new Y.Doc();
  private unsubscribe: Unsubscribe | null = null;
  private applyingRemote = false;

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
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.doc.off('update', this.handleLocalUpdate);
  }

  private handleLocalUpdate = (update: Uint8Array): void => {
    // `applyingRemote` is true only while this provider's own subscription
    // callback is applying a state that just arrived — skip re-broadcasting
    // that, so only genuinely local edits get merged back up.
    if (this.applyingRemote) return;
    void this.store.mergeYUpdate(this.roomId, this.docName, update);
  };
}
