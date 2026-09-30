import { beforeAll, describe, expect, it } from 'vitest';
import type { PlayerSeat } from '../../types.js';
import type { CursorPos, DragFrame, PingPos, PresenceEntry } from '../campaign-store.js';
import type { CampaignStore } from '../campaign-store.js';
import { waitFor, createTestRoom, type ContractContext } from './helpers.js';

/** `PresenceStore` domain: the RTDB-equivalent ephemeral channels. (SPEC-057 §5, DEC-117). */
export function definePresenceContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
  });

  describe('RTDB-equivalent ephemeral channels', () => {
    it('publishes and observes a live cursor position', async () => {
      const roomId = await createTestRoom(clientA);
      const uid = clientA.currentUid()!;
      clientA.publishCursor(roomId, { x: 12, y: 34 });
      const cursors = await waitFor<CursorPos[]>(
        (cb) => clientA.subscribeCursors(roomId, cb),
        (items) => items.some((c) => c.uid === uid && c.x === 12),
      );
      expect(cursors.find((c) => c.uid === uid)?.y).toBe(34);
    });

    it('publishes, observes, and clears an in-progress token drag', async () => {
      const roomId = await createTestRoom(clientA);
      clientA.publishDrag(roomId, 'token-1', { x: 1, y: 2 });
      await waitFor<DragFrame | null>(
        (cb) => clientA.subscribeDrag(roomId, 'token-1', cb),
        (frame) => frame?.x === 1,
      );

      clientA.clearDrag(roomId, 'token-1');
      await waitFor<DragFrame | null>(
        (cb) => clientA.subscribeDrag(roomId, 'token-1', cb),
        (frame) => frame === null,
      );
    });

    it('publishes presence that another client observes, and clears it (R26.1)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      const uid = clientA.currentUid()!;

      clientA.publishPresence(roomId, 'The Referee');
      const seen = await waitFor<PresenceEntry[]>(
        (cb) => clientB.subscribePresence(roomId, cb),
        (items) => items.some((e) => e.uid === uid),
      );
      expect(seen.find((e) => e.uid === uid)?.name).toBe('The Referee');
      expect(seen.find((e) => e.uid === uid)!.ts).toBeGreaterThan(0);

      // Clearing is what a clean unmount does; `onDisconnect` covers the
      // crash path, which no store-level test can provoke.
      clientA.clearPresence(roomId);
      await waitFor<PresenceEntry[]>(
        (cb) => clientB.subscribePresence(roomId, cb),
        (items) => !items.some((e) => e.uid === uid),
      );
    });

    it('is idempotent — publishing twice leaves one entry (R26.1)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      const uid = clientA.currentUid()!;

      clientA.publishPresence(roomId, 'The Referee');
      clientA.publishPresence(roomId, 'The Referee');
      const seen = await waitFor<PresenceEntry[]>(
        (cb) => clientA.subscribePresence(roomId, cb),
        (items) => items.some((e) => e.uid === uid),
      );
      expect(seen.filter((e) => e.uid === uid)).toHaveLength(1);
      clientA.clearPresence(roomId);
    });

    it('stamps the durable lastPresentAt on the seat doc (R26.2)', async () => {
      // The one Firestore write in an otherwise all-RTDB channel — and the
      // only thing that can answer "gone for a month", since presence itself
      // vanishes with the tab.
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      const uid = clientA.currentUid()!;

      clientA.publishPresence(roomId, 'The Referee');
      const seats = await waitFor<PlayerSeat[]>(
        (cb) => clientA.subscribePlayers(roomId, cb),
        (items) => items.some((p) => p.uid === uid && p.lastPresentAt !== undefined),
      );
      expect(seats.find((p) => p.uid === uid)!.lastPresentAt).toBeGreaterThan(0);
      clientA.clearPresence(roomId);
    });

    it('publishes a ping visible to other clients', async () => {
      const roomId = await createTestRoom(clientA);
      clientA.publishPing(roomId, { x: 7, y: 8 });
      const pings = await waitFor<PingPos[]>(
        (cb) => clientB.subscribePings(roomId, cb),
        (items) => items.length > 0,
      );
      expect(pings[0]).toMatchObject({ x: 7, y: 8 });
    });
  });
}
