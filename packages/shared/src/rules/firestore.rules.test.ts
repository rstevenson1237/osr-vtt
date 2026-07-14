import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Security Rules tests (Plan §3, §9). Runs against the Firestore emulator —
 * invoke via `pnpm test:rules`, which must run inside
 * `firebase emulators:exec` (see root package.json `test:all:emulators`).
 *
 * The one rule that MUST have a test (Plan §8 acceptance): a player context
 * cannot read a `gmPrivate` doc.
 */

const RULES_PATH = fileURLToPath(new URL('../../../../firebase/firestore.rules', import.meta.url));

const GM_UID = 'gm-uid';
const PLAYER_UID = 'player-uid';
const OTHER_PLAYER_UID = 'other-player-uid';
const ROOM_ID = 'room-1';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'osr-vtt-rules-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed baseline room state with rules disabled — this is fixture setup,
  // not the thing under test.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`rooms/${ROOM_ID}`).set({
      name: 'Test Room',
      gmUid: GM_UID,
      schemaVersion: 1,
      difficultyDie: 'd6',
      dangerDie: 'd6',
      createdAt: Date.now(),
      profileTemplate: [],
    });
    await db.doc(`rooms/${ROOM_ID}/players/${GM_UID}`).set({
      displayName: 'GM',
      seatId: GM_UID,
      role: 'gm',
    });
    await db.doc(`rooms/${ROOM_ID}/players/${PLAYER_UID}`).set({
      displayName: 'Player One',
      seatId: PLAYER_UID,
      role: 'player',
    });
    await db.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'fog of war state' });
  });
});

describe('gmPrivate — the one hard boundary (Plan §3)', () => {
  it('denies a player context read on a gmPrivate doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
  });

  it('denies a player context write on a gmPrivate doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'tampered' }),
    );
  });

  it('denies an unauthenticated context read on a gmPrivate doc', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(anonDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
  });

  it('allows the GM to read and write their own gmPrivate doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'updated fog' }),
    );
  });
});

describe('room-level access', () => {
  it('lets any authenticated member read the room doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}`).get());
  });

  it('denies a player updating room-level fields (e.g. profileTemplate)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}`).update({ profileTemplate: [] }));
  });

  it('allows the GM to update room-level fields', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}`).update({ dangerDie: 'd8' }));
  });
});

describe('GM transfer (Master Plan v2, R4 — "transfer referee")', () => {
  it('moves the gmPrivate boundary from the old GM to the new one', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();

    // The acting (old) GM performs the whole transfer in one batch — writing
    // the new gmUid plus both seats' role flips — exactly as
    // `CampaignStore.transferGM` does. Security Rules evaluate every write in
    // a batch against the state as of the start of the batch, so `isGM` still
    // sees the *old* gmUid for all three writes even though one of them
    // changes it (a real, non-batched sequence of the same three writes would
    // fail the third write once the first has committed).
    const batch = gmDb.batch();
    batch.update(gmDb.doc(`rooms/${ROOM_ID}`), { gmUid: PLAYER_UID });
    batch.update(gmDb.doc(`rooms/${ROOM_ID}/players/${GM_UID}`), { role: 'player' });
    batch.update(gmDb.doc(`rooms/${ROOM_ID}/players/${PLAYER_UID}`), { role: 'gm' });
    await assertSucceeds(batch.commit());

    // The old GM immediately loses the gmPrivate boundary...
    await assertFails(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
    await assertFails(
      gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'tampered' }),
    );
    // ...and can no longer edit room-level fields.
    await assertFails(gmDb.doc(`rooms/${ROOM_ID}`).update({ dangerDie: 'd10' }));

    // The new GM gains the gmPrivate boundary and room-level write access.
    const newGmDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(newGmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
    await assertSucceeds(
      newGmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'new fog' }),
    );
    await assertSucceeds(newGmDb.doc(`rooms/${ROOM_ID}`).update({ dangerDie: 'd10' }));
  });
});

describe('profiles — owning seat or GM only (Plan §2.5)', () => {
  it('lets a player write their own profile instance', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/profiles/${PLAYER_UID}`).set({ values: { name: 'Bram' } }),
    );
  });

  it("denies a player writing another player's profile instance", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb
        .doc(`rooms/${ROOM_ID}/profiles/${OTHER_PLAYER_UID}`)
        .set({ values: { name: 'Hijacked' } }),
    );
  });
});

describe('shared table state — any authenticated room member (trust model)', () => {
  it('lets a room member create a token', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/tokens/token-1`).set({
        pos: { x: 0, y: 0 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      }),
    );
  });

  it('denies a non-member (no players/{uid} doc) from writing a token', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc(`rooms/${ROOM_ID}/tokens/token-2`).set({
        pos: { x: 0, y: 0 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      }),
    );
  });

  it('lets a room member save an asset ref (Assets activity "By URL", Master Plan v2, R7.2)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/assetRefs/ref-1`).set({
        ref: 'https://example.com/goblin.png',
        addedBy: PLAYER_UID,
        ts: Date.now(),
      }),
    );
  });

  it('denies a non-member from writing an asset ref', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc(`rooms/${ROOM_ID}/assetRefs/ref-2`).set({
        ref: 'https://example.com/goblin.png',
        addedBy: 'stranger-uid',
        ts: Date.now(),
      }),
    );
  });
});

describe('cellular map model — trust model, same as tokens (Map Tooling Spec §7)', () => {
  it('lets a room member carve (write a floor chunk)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/floorChunks/0_0`).set({ bits: new Array(8).fill(0) }),
    );
  });

  it('denies a non-member from writing a floor chunk', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc(`rooms/${ROOM_ID}/floorChunks/0_0`).set({ bits: new Array(8).fill(0) }),
    );
  });

  it('lets a room member place an explicit wall/door', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/walls/0,0,N`).set({
        x: 0,
        y: 0,
        side: 'N',
        door: { state: 'closed', secret: false },
      }),
    );
  });

  it('lets a room member place a symbol and key a map room', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb
        .doc(`rooms/${ROOM_ID}/symbols/sym-1`)
        .set({ cell: { x: 1, y: 1 }, kind: 'chest', rotation: 0 }),
    );
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/mapRooms/mr-1`).set({
        key: '1',
        name: 'Entry Hall',
        bbox: { x: 0, y: 0, w: 5, h: 5 },
        labelAnchor: { x: 2, y: 2 },
        wallStyle: 'masonry',
      }),
    );
  });

  it('lets a room member reveal a fog chunk (manual FoW eraser)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/fogChunks/0_0`).set({ bits: new Array(8).fill(0) }),
    );
  });
});

describe('groups roster — GM-only writes (Encounter Screen Spec §3, §8)', () => {
  it('lets the GM create a group', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/groups/group-1`).set({
        name: 'Goblin Ambush',
        memberTokenIds: [],
        showMap: false,
        showBoard: false,
        active: false,
      }),
    );
  });

  it('denies a player writing a group', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/groups/group-2`).set({
        name: 'Party',
        memberTokenIds: [],
        showMap: true,
        showBoard: true,
        active: true,
      }),
    );
  });

  it('lets any signed-in member read a group', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`rooms/${ROOM_ID}/groups/group-1`)
        .set({ name: 'Party', memberTokenIds: [], showMap: true, showBoard: true, active: true });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}/groups/group-1`).get());
  });
});

describe('combat tracker — GM-writable, all-readable (Encounter Screen Spec §10)', () => {
  it('lets the GM write the encounter doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/encounter/current`).set({
        mode: 'side',
        round: 1,
        order: [],
        currentIndex: 0,
      }),
    );
  });

  it('denies a player writing the encounter doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/encounter/current`).set({
        mode: 'side',
        round: 1,
        order: [],
        currentIndex: 0,
      }),
    );
  });

  it('lets any signed-in member read the encounter doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`rooms/${ROOM_ID}/encounter/current`)
        .set({ mode: 'side', round: 1, order: [], currentIndex: 0 });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}/encounter/current`).get());
  });
});

describe('dice macros — owning player or GM only (Plan §7 Phase 3, same pattern as profiles)', () => {
  it('lets a player save their own macro', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/macros/macro-1`).set({
        ownerUid: PLAYER_UID,
        name: 'Fireball',
        dice: ['d6', 'd6'],
        modifier: 0,
        mode: 'summed',
        advantage: 'normal',
      }),
    );
  });

  it("denies a player creating a macro with someone else's ownerUid", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/macros/macro-2`).set({
        ownerUid: OTHER_PLAYER_UID,
        name: 'Hijacked',
        dice: ['d6'],
        modifier: 0,
        mode: 'separate',
        advantage: 'normal',
      }),
    );
  });

  it("denies a player updating another player's macro", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`rooms/${ROOM_ID}/macros/macro-3`).set({
        ownerUid: OTHER_PLAYER_UID,
        name: 'Not Yours',
        dice: ['d6'],
        modifier: 0,
        mode: 'separate',
        advantage: 'normal',
      });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}/macros/macro-3`).update({ name: 'Stolen' }));
  });

  it('lets the GM update or delete any macro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`rooms/${ROOM_ID}/macros/macro-4`).set({
        ownerUid: PLAYER_UID,
        name: 'Player Macro',
        dice: ['d20'],
        modifier: 0,
        mode: 'separate',
        advantage: 'normal',
      });
    });
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/macros/macro-4`).update({ name: 'GM Renamed' }),
    );
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/macros/macro-4`).delete());
  });

  it("lets the GM create a macro under another player's ownerUid — needed for .vttcamp import fidelity (Plan §5, §7 Phase 5)", async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/macros/macro-imported`).set({
        ownerUid: OTHER_PLAYER_UID,
        name: 'Restored from export',
        dice: ['d6'],
        modifier: 0,
        mode: 'separate',
        advantage: 'normal',
      }),
    );
  });

  it('lets any signed-in member read a macro', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`rooms/${ROOM_ID}/macros/macro-5`).set({
        ownerUid: GM_UID,
        name: 'Readable',
        dice: ['d6'],
        modifier: 0,
        mode: 'separate',
        advantage: 'normal',
      });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}/macros/macro-5`).get());
  });
});

describe('Blind Drawer — hidden in gmPrivate until revealed (Plan §7 Phase 4, §3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`rooms/${ROOM_ID}/gmPrivate/draw-1`).set({
        kind: 'blindDraw',
        ts: Date.now(),
        authorUid: GM_UID,
        title: 'Wandering monster check',
        text: 'A bugbear ambush',
        revealed: false,
      });
    });
  });

  it("denies a player reading a blind-draw result before it's revealed", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/draw-1`).get());
  });

  it('denies a player even listing the gmPrivate collection', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.collection(`rooms/${ROOM_ID}/gmPrivate`).get());
  });

  it('lets the GM read and write their own blind-draw doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/draw-1`).get());
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/draw-1`).update({ revealed: true }));
  });
});

describe('Handout library — hidden in gmPrivate until revealed (Plan §7 Phase 5, §3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`rooms/${ROOM_ID}/gmPrivate/handout-1`).set({
        kind: 'handout',
        ts: Date.now(),
        title: 'The Vault Door',
        ref: 'maps/starter-room.svg',
        revealed: false,
      });
    });
  });

  it("denies a player reading a handout's library entry before it's revealed", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/handout-1`).get());
  });

  it('denies a player even listing the gmPrivate collection (so the library stays hidden)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.collection(`rooms/${ROOM_ID}/gmPrivate`).get());
  });

  it('lets the GM read, reveal, and delete their own handout entry', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/handout-1`).get());
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/handout-1`).update({ revealed: true }),
    );
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/handout-1`).delete());
  });

  it("denies a player updating the room's revealed-handout pointer", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb
        .doc(`rooms/${ROOM_ID}`)
        .update({ handout: { ref: 'maps/starter-room.svg', title: 'Hijacked' } }),
    );
  });

  it('lets the GM reveal a handout by updating the room-level pointer, then any member can read it', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb
        .doc(`rooms/${ROOM_ID}`)
        .update({ handout: { ref: 'maps/starter-room.svg', title: 'The Vault Door' } }),
    );

    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    const room = await playerDb.doc(`rooms/${ROOM_ID}`).get();
    await assertSucceeds(Promise.resolve(room));
    expect(room.data()?.['handout']).toEqual({
      ref: 'maps/starter-room.svg',
      title: 'The Vault Door',
    });
  });

  it('lets the GM hide a revealed handout by clearing the pointer back to null', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await gmDb.doc(`rooms/${ROOM_ID}`).update({ handout: { ref: 'maps/starter-room.svg' } });
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}`).update({ handout: null }));
  });
});

describe('imported vision geometry — trust model (Plan §7 Phase 4 `.uvtt`)', () => {
  it('lets a room member import a sight wall + light, readable by all', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/sightWalls/w1`).set({ ax: 0, ay: 0, bx: 70, by: 0 }),
    );
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/lights/l1`).set({ x: 35, y: 35, range: 210 }),
    );
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/sightWalls/w1`).get());
  });

  it('denies a non-member from importing a sight wall', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc(`rooms/${ROOM_ID}/sightWalls/w2`).set({ ax: 0, ay: 0, bx: 1, by: 1 }),
    );
  });
});

describe('shared rolls — GM-only staging doc, own-slot-or-GM slots (Master Plan v2, R3.6)', () => {
  it('lets the GM create the sharedRoll/current staging doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/sharedRoll/current`).set({
        status: 'staging',
        openedBy: GM_UID,
        label: 'Initiative',
      }),
    );
  });

  it('denies a player opening (writing) the sharedRoll/current staging doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/sharedRoll/current`).set({
        status: 'staging',
        openedBy: PLAYER_UID,
      }),
    );
  });

  it('lets any signed-in member read the sharedRoll/current staging doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`rooms/${ROOM_ID}/sharedRoll/current`)
        .set({ status: 'staging', openedBy: GM_UID });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}/sharedRoll/current`).get());
  });

  describe('slots — own-uid-or-GM writes (mirrors players/{uid})', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx
          .firestore()
          .doc(`rooms/${ROOM_ID}/sharedRoll/current`)
          .set({ status: 'staging', openedBy: GM_UID });
      });
    });

    it('lets a player write their own slot (doc id === their uid)', async () => {
      const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
      await assertSucceeds(
        playerDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/${PLAYER_UID}`).set({
          die: 'd20',
          modifier: 2,
          advantage: 'normal',
          ready: true,
        }),
      );
    });

    it("denies player A writing player B's slot", async () => {
      const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
      await assertFails(
        playerDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/${OTHER_PLAYER_UID}`).set({
          die: 'd20',
          modifier: 0,
          advantage: 'normal',
          ready: true,
        }),
      );
    });

    it('lets the GM write any slot, including one keyed by an arbitrary id (a monster side)', async () => {
      const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
      await assertSucceeds(
        gmDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/monster-side`).set({
          die: '2d6',
          modifier: 0,
          advantage: 'normal',
          ready: true,
        }),
      );
      await assertSucceeds(
        gmDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/${PLAYER_UID}`).set({
          die: 'd6',
          modifier: 0,
          advantage: 'normal',
          ready: true,
        }),
      );
    });

    it('lets any signed-in member read a slot', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx
          .firestore()
          .doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/${PLAYER_UID}`)
          .set({ die: 'd6', modifier: 0, advantage: 'normal', ready: false });
      });
      const otherDb = testEnv.authenticatedContext(OTHER_PLAYER_UID).firestore();
      await assertSucceeds(
        otherDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/${PLAYER_UID}`).get(),
      );
    });

    it('denies a non-member from writing any slot', async () => {
      const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
      await assertFails(
        strangerDb.doc(`rooms/${ROOM_ID}/sharedRoll/current/slots/stranger-uid`).set({
          die: 'd6',
          modifier: 0,
          advantage: 'normal',
          ready: true,
        }),
      );
    });
  });
});

describe('random tables — GM-writable, member-readable (Plan §7 Phase 4)', () => {
  it('lets the GM upsert a table and a member read it', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/tables/t1`).set({ name: 'Wandering Monsters', rows: ['a goblin'] }),
    );
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}/tables/t1`).get());
  });

  it('denies a player writing a table', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/tables/t2`).set({ name: 'Hijack', rows: [] }),
    );
  });
});

describe('My Rooms index — owner-only (Master Plan v2, R6.2)', () => {
  it('lets a user write and read their own index entry', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`users/${PLAYER_UID}/rooms/${ROOM_ID}`).set({
        roomId: ROOM_ID,
        name: 'Test Room',
        role: 'player',
        lastSeenAt: Date.now(),
      }),
    );
    await assertSucceeds(playerDb.doc(`users/${PLAYER_UID}/rooms/${ROOM_ID}`).get());
  });

  it("denies a user writing another user's index entry", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`users/${OTHER_PLAYER_UID}/rooms/${ROOM_ID}`).set({
        roomId: ROOM_ID,
        name: 'Hijacked',
        role: 'gm',
        lastSeenAt: Date.now(),
      }),
    );
  });

  it("denies a user reading another user's index", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${OTHER_PLAYER_UID}/rooms/${ROOM_ID}`).set({
        roomId: ROOM_ID,
        name: 'Private',
        role: 'gm',
        lastSeenAt: Date.now(),
      });
    });
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`users/${OTHER_PLAYER_UID}/rooms/${ROOM_ID}`).get());
  });

  it('denies an unauthenticated context writing an index entry', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      anonDb.doc(`users/${PLAYER_UID}/rooms/${ROOM_ID}`).set({ roomId: ROOM_ID, name: 'x' }),
    );
  });
});

describe('room deletion — only the GM may delete the room doc (Master Plan v2, R6.3)', () => {
  it('lets the GM delete the room doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}`).delete());
  });

  it('denies a player deleting the room doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}`).delete());
  });

  it('denies a non-member deleting the room doc', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(strangerDb.doc(`rooms/${ROOM_ID}`).delete());
  });
});

it('sanity: seeded fixtures are present', async () => {
  const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
  const room = await gmDb.doc(`rooms/${ROOM_ID}`).get();
  expect(room.data()?.['gmUid']).toBe(GM_UID);
});
