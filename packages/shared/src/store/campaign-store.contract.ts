import { beforeAll, describe } from 'vitest';
import type { MapBackground } from '../types.js';
import type { CampaignStore } from './campaign-store.js';
import { defineCollabContract } from './contract/collab.contract.js';
import { defineDiceContract } from './contract/dice.contract.js';
import { defineEncounterContract } from './contract/encounter.contract.js';
import { defineListenersContract } from './contract/listeners.contract.js';
import { defineMapContract } from './contract/map.contract.js';
import { definePresenceContract } from './contract/presence.contract.js';
import { defineRoomContract } from './contract/room.contract.js';
import type { ContractContext } from './contract/helpers.js';

/**
 * The Phase 6 abstraction proof (Plan §7 Phase 6, Roadmap Gate 6): one suite
 * of behavioral tests, run unmodified against every `CampaignStore`
 * implementation. If `FirebaseStore` and `MemoryStore` both pass this file,
 * the `CampaignStore` interface (Plan §1.3) is genuinely swappable — no
 * component or test anywhere else needed to know which backend it's talking
 * to.
 *
 * This suite tests the *data-plumbing* contract (writes land, subscriptions
 * observe them, round-trips are faithful) — not access control. Security
 * Rules are FirebaseStore's job alone and already have their own suite
 * (`rules/firestore.rules.test.ts`); a bare in-memory store has no
 * equivalent concept, so re-testing "can a player read gmPrivate" here would
 * test nothing.
 *
 * SPEC-057 §5 / DEC-117: the suite is split by domain into
 * `contract/<domain>.contract.ts`. This file imports and runs every one of them, so
 * RULE-001 holds as written — a new store method still lands in the shared contract
 * suite and must pass against `MemoryStore`, `FirebaseStore` and `LocalStore`. A focused
 * run may target one domain's file with `-t`.
 */
/**
 * @param label Identifies the implementation under test in describe blocks.
 * @param createClients Returns `count` independently-authenticated
 * `CampaignStore` handles sharing ONE underlying backend/project — the
 * in-memory analog of `count` browser tabs against one Firebase project,
 * each with its own anonymous auth session. Called once per suite; tests
 * isolate themselves by always operating on a freshly created room.
 * @param seedLegacyMapBackground Writes a pre-v23 `background: { ref }`
 * straight onto a `maps/{mapId}` document, bypassing the store. The one thing
 * this suite cannot express through the interface itself — the field was
 * removed from it at v23 (SPEC-038 §1) — and `migrateMapBackgrounds` exists
 * precisely to rescue documents in that shape, so the contract would otherwise
 * have no way to set up the case it has to prove.
 * @param seedUnlockedBackground Writes a pre-v27 background document — one
 * carrying **no** `locked` field — straight into `maps/{mapId}/backgrounds`,
 * bypassing the store. Needed for exactly the same reason: `addBackground`
 * now always writes `locked` explicitly (SPEC-039 §1), so the shape the
 * v26->v27 backfill exists to rescue is no longer expressible through the
 * interface.
 */
export function defineCampaignStoreContract(
  label: string,
  createClients: (count: number) => Promise<CampaignStore[]> | CampaignStore[],
  seedLegacyMapBackground: (roomId: string, mapId: string, ref: string) => Promise<void>,
  seedUnlockedBackground: (
    roomId: string,
    mapId: string,
    background: Omit<MapBackground, 'locked'>,
  ) => Promise<void>,
): void {
  describe(`CampaignStore contract — ${label}`, () => {
    let clientA: CampaignStore;
    let clientB: CampaignStore;

    beforeAll(async () => {
      const clients = await createClients(2);
      clientA = clients[0]!;
      clientB = clients[1]!;
    });

    const ctx: ContractContext = {
      label,
      clientA: () => clientA,
      clientB: () => clientB,
      seedLegacyMapBackground,
      seedUnlockedBackground,
    };

    defineRoomContract(ctx);
    defineMapContract(ctx);
    defineEncounterContract(ctx);
    defineDiceContract(ctx);
    defineCollabContract(ctx);
    definePresenceContract(ctx);
    defineListenersContract(ctx);
  });
}
