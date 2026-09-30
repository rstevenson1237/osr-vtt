import { beforeAll, describe, expect, it } from 'vitest';
import type { Encounter } from '../../types.js';
import type { CampaignStore } from '../campaign-store.js';
import { waitFor, createTestRoom, type ContractContext } from './helpers.js';

/** `EncounterStore` domain: the combat tracker. (SPEC-057 §5, DEC-117). */
export function defineEncounterContract(ctx: ContractContext): void {
  let clientA: CampaignStore;

  beforeAll(() => {
    clientA = ctx.clientA();
  });

  describe('combat tracker (encounter)', () => {
    it('starts null and reflects a written encounter doc', async () => {
      const roomId = await createTestRoom(clientA);
      const initial = await waitFor<Encounter | null>(
        (cb) => clientA.subscribeEncounter(roomId, cb),
        () => true,
      );
      expect(initial).toBeNull();

      await clientA.writeEncounter(roomId, {
        mode: 'side',
        round: 2,
        order: [{ refType: 'side', refId: 'group-1', acted: false }],
        currentIndex: 0,
      });
      const encounter = await waitFor<Encounter | null>(
        (cb) => clientA.subscribeEncounter(roomId, cb),
        (e) => e?.round === 2,
      );
      expect(encounter?.order).toHaveLength(1);
    });
  });
}
