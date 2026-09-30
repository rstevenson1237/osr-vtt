import { beforeAll, describe, expect, it } from 'vitest';
import type {
  Drawing,
  GameMap,
  Group,
  HexLine,
  HexSymbol,
  HexTile,
  MapBackground,
  MapRoom,
  MapSymbol,
  ProfileInstance,
  Room,
  Token,
} from '../../types.js';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_HEX_GRID_CONFIG,
  STARTER_MAP_REF,
  mapGridKind,
} from '../../types.js';
import type {
  StoredVectorWall,
  VectorDoor,
  VectorFloorRegion,
  VectorMapDraft,
} from '../campaign-store.js';
import type { CampaignStore } from '../campaign-store.js';
import { waitFor, createTestRoom, activeMapId, type ContractContext } from './helpers.js';

/** `MapStore` domain: maps, tokens, groups, symbols, vector geometry and drawings. (SPEC-057 §5, DEC-117). */
export function defineMapContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;
  const { seedLegacyMapBackground } = ctx;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
  });

  describe('tokens', () => {
    it('creates, moves, resizes, and (un)links an owner on a token', async () => {
      const roomId = await createTestRoom(clientA);
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 1, y: 1 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      });

      await clientA.moveToken(roomId, tokenId, { x: 5, y: 7 });
      let tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === tokenId)?.pos.x === 5,
      );
      let token = tokens.find((t) => t.id === tokenId)!;
      expect(token.pos).toEqual({ x: 5, y: 7 });
      expect(token.size).toBe(1); // moving must not clobber other fields

      await clientA.resizeToken(roomId, tokenId, 3);
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === tokenId)?.size === 3,
      );
      token = tokens.find((t) => t.id === tokenId)!;
      expect(token.pos).toEqual({ x: 5, y: 7 }); // resizing must not clobber pos

      await clientA.setTokenOwner(roomId, tokenId, 'seat-1');
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === tokenId)?.ownerSeatId === 'seat-1',
      );

      await clientA.setTokenOwner(roomId, tokenId, undefined);
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === tokenId)?.ownerSeatId === undefined,
      );
      token = tokens.find((t) => t.id === tokenId)!;
      expect(token.ownerSeatId).toBeUndefined();
    });

    it('deletes a token, leaving its siblings alone', async () => {
      const roomId = await createTestRoom(clientA);
      const base = { pos: { x: 0, y: 0 }, size: 1, layer: 'tokens' as const };
      const doomed = await clientA.createToken(roomId, { ...base, imageRef: 'tokens/a.png' });
      const keeper = await clientA.createToken(roomId, { ...base, imageRef: 'tokens/b.png' });

      await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.some((t) => t.id === doomed),
      );

      await clientA.deleteToken(roomId, doomed);
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.every((t) => t.id !== doomed),
      );
      expect(tokens.some((t) => t.id === keeper)).toBe(true);
    });

    it("moveTokens batch-moves several tokens in one call, preserving each token's other fields (Master Plan v2, R8.4)", async () => {
      const roomId = await createTestRoom(clientA);
      const a = await clientA.createToken(roomId, {
        pos: { x: 1, y: 1 },
        size: 2,
        layer: 'tokens',
        imageRef: 'tokens/a.png',
        ownerSeatId: 'seat-a',
      });
      const b = await clientA.createToken(roomId, {
        pos: { x: 2, y: 2 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/b.png',
      });
      const c = await clientA.createToken(roomId, {
        pos: { x: 3, y: 3 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/c.png',
      });

      // A collapsed-group drag: every member's new position lands in one
      // batched write burst, each preserving its own offset from the anchor.
      await clientA.moveTokens(roomId, [
        { tokenId: a, pos: { x: 100, y: 200 } },
        { tokenId: b, pos: { x: 130, y: 200 } },
        { tokenId: c, pos: { x: 100, y: 260 } },
      ]);

      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) =>
          items.find((t) => t.id === a)?.pos.x === 100 &&
          items.find((t) => t.id === b)?.pos.x === 130 &&
          items.find((t) => t.id === c)?.pos.y === 260,
      );
      expect(tokens.find((t) => t.id === a)!.pos).toEqual({ x: 100, y: 200 });
      expect(tokens.find((t) => t.id === b)!.pos).toEqual({ x: 130, y: 200 });
      expect(tokens.find((t) => t.id === c)!.pos).toEqual({ x: 100, y: 260 });
      // A batched move patches only `pos` — size/owner survive untouched.
      expect(tokens.find((t) => t.id === a)!.size).toBe(2);
      expect(tokens.find((t) => t.id === a)!.ownerSeatId).toBe('seat-a');
      expect(tokens.find((t) => t.id === b)!.size).toBe(1);
    });

    it('moveTokens is a no-op for an empty update list', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 4, y: 4 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/solo.png',
      });
      await clientA.moveTokens(roomId, []);
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.some((t) => t.id === id),
      );
      expect(tokens.find((t) => t.id === id)!.pos).toEqual({ x: 4, y: 4 });
    });

    it('setTokenImage swaps art without touching position/size/owner (Master Plan v2, R7.3 — "My token")', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 9, y: 9 },
        size: 2,
        layer: 'tokens',
        imageRef: 'tokens/old.png',
        ownerSeatId: 'seat-1',
      });
      await clientA.setTokenImage(roomId, id, 'gen:disc:A:hsl(10, 65%, 45%)');
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.imageRef === 'gen:disc:A:hsl(10, 65%, 45%)',
      );
      const token = tokens.find((t) => t.id === id)!;
      expect(token.pos).toEqual({ x: 9, y: 9 });
      expect(token.size).toBe(2);
      expect(token.ownerSeatId).toBe('seat-1');
    });

    it('setTokenColor sets and clears the background disc color, leaving other fields alone (quick-sheet token split)', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 3, y: 3 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:A:hsl(10, 65%, 45%)',
        ownerSeatId: 'seat-1',
      });

      await clientA.setTokenColor(roomId, id, '#3366cc');
      let tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.color === '#3366cc',
      );
      let token = tokens.find((t) => t.id === id)!;
      expect(token.color).toBe('#3366cc');
      expect(token.imageRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
      expect(token.pos).toEqual({ x: 3, y: 3 });
      expect(token.ownerSeatId).toBe('seat-1');

      await clientA.setTokenColor(roomId, id, undefined);
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.color === undefined,
      );
      token = tokens.find((t) => t.id === id)!;
      expect(token.color).toBeUndefined();
      expect(token.imageRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
    });

    it('setTokenLetter sets and clears the letter, leaving the ref and every other field alone (SPEC-048 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 5, y: 5 },
        size: 1,
        layer: 'tokens',
        imageRef: 'https://example.com/goblin.png',
        color: '#3366cc',
      });

      await clientA.setTokenLetter(roomId, id, 'B');
      let tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.letter === 'B',
      );
      let token = tokens.find((t) => t.id === id)!;
      expect(token.letter).toBe('B');
      // The letter is its own field now — it does not rewrite the art, the
      // colour, the position or anything else (SPEC-048 §1).
      expect(token.imageRef).toBe('https://example.com/goblin.png');
      expect(token.color).toBe('#3366cc');
      expect(token.pos).toEqual({ x: 5, y: 5 });

      // Up to three glyphs, counted in Unicode code points, exactly as the
      // ref scheme it replaces counted them (`GEN_TOKEN_LABEL_CAP`).
      await clientA.setTokenLetter(roomId, id, 'AB1');
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.letter === 'AB1',
      );
      expect(tokens.find((t) => t.id === id)!.letter).toBe('AB1');

      // Clearing returns it to absence, not to an empty string — the same
      // shape `setTokenName`/`setTokenColor` use.
      await clientA.setTokenLetter(roomId, id, undefined);
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.letter === undefined,
      );
      token = tokens.find((t) => t.id === id)!;
      expect(token.letter).toBeUndefined();
      expect(token.imageRef).toBe('https://example.com/goblin.png');
    });

    it('createToken persists a letter written at creation (SPEC-048 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 6, y: 6 },
        size: 1,
        layer: 'tokens',
        letter: 'C',
        color: '#27ae60',
      });
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.letter === 'C',
      );
      const token = tokens.find((t) => t.id === id)!;
      expect(token.letter).toBe('C');
      // `imageRef` is optional since v30 and means *real art only*: a token
      // whose identity is a letter has none, and the absence survives the
      // write rather than being defaulted to a ref (SPEC-048 §1).
      expect(token.imageRef).toBeUndefined();
      expect(token.color).toBe('#27ae60');
    });

    it('migrateTokenLetters backfills letter+color from a gen:disc: ref, then clears the ref, and is idempotent (SPEC-048 §§2, 5)', async () => {
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;

      // The shape the backfill exists for: the letter living inside the ref.
      const lettered = await clientA.createToken(roomId, {
        pos: { x: 1, y: 1 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:A:hsl(10, 65%, 45%)',
      });
      // A pre-v28 lowercase ref, which renders as "a1" today and never
      // consumed a group letter — it migrates verbatim, so nothing a referee
      // is looking at changes (DEC-087 question 3).
      const legacy = await clientA.createToken(roomId, {
        pos: { x: 2, y: 2 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:a1:hsl(10, 65%, 45%)',
      });
      // Real art: no letter to find, and none is invented.
      const art = await clientA.createToken(roomId, {
        pos: { x: 3, y: 3 },
        size: 1,
        layer: 'tokens',
        imageRef: 'https://example.com/ogre.png',
      });
      // A ref alongside a colour the referee already picked — the stored
      // colour wins, because it was a deliberate write.
      const painted = await clientA.createToken(roomId, {
        pos: { x: 4, y: 4 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:D:hsl(200, 65%, 45%)',
        color: '#123456',
      });
      await clientA.setProfilePortrait(roomId, seatId, 'gen:disc:E:hsl(10, 65%, 45%)');

      await clientA.migrateTokenLetters(roomId);

      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === lettered)?.letter === 'A',
      );
      const byId = (id: string): Token => tokens.find((t) => t.id === id)!;

      expect(byId(lettered).letter).toBe('A');
      // `hsl(10, 65%, 45%)` in the `#rrggbb` the colour fields are validated
      // against, so the disc and any later colour pick can never diverge
      // (DEC-087 question 1).
      expect(byId(lettered).color).toBe('#bd4128');
      // The ref is cleared once its label and colour are fields (§5) —
      // `imageRef` present means real art only, from here on.
      expect(byId(lettered).imageRef).toBeUndefined();

      expect(byId(legacy).letter).toBe('a1');
      expect(byId(legacy).imageRef).toBeUndefined();
      expect(byId(art).letter).toBeUndefined();
      expect(byId(art).imageRef).toBe('https://example.com/ogre.png');
      expect(byId(painted).letter).toBe('D');
      expect(byId(painted).color).toBe('#123456');
      expect(byId(painted).imageRef).toBeUndefined();

      const profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.letter === 'E',
      );
      const profile = profiles.find((p) => p.actorId === seatId)!;
      expect(profile.letter).toBe('E');
      expect(profile.portraitRef).toBeUndefined();

      // Idempotent in the way that matters: a referee retypes the letter,
      // and the next room-open must not put the ref's back.
      await clientA.setTokenLetter(roomId, lettered, 'Z');
      await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === lettered)?.letter === 'Z',
      );
      await clientA.migrateTokenLetters(roomId);
      const still = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.length === 4,
      );
      expect(still.find((t) => t.id === lettered)!.letter).toBe('Z');
    });

    it('migrateRoomCollections walks every step on a never-walked room, stamps it current, and is then a no-op (SPEC-056 §6, DEC-111)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      // Absent means "never walked" — a room is stamped by the walk, not at
      // creation, so a new room's first open walks (cheaply) and stamps it.
      expect((await clientA.getRoom(roomId))?.collectionsMigratedTo).toBeUndefined();

      // One case per collection step: a pre-v23 map-doc background (the
      // v22->v23 fold, then the v26->v27 lock) and a `gen:disc:` token (v30).
      await seedLegacyMapBackground(roomId, mapId, STARTER_MAP_REF);
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 1, y: 1 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:A:hsl(10, 65%, 45%)',
      });

      await clientA.migrateRoomCollections(roomId);

      const room = await clientA.getRoom(roomId);
      expect(room?.collectionsMigratedTo).toBe(CURRENT_SCHEMA_VERSION);
      // Adoption is a no-op on a room created at v11+ — the map it already
      // has is still the active one.
      expect(room?.activeMapId).toBe(mapId);
      const folded = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 1,
      );
      expect(folded[0]).toMatchObject({ ref: STARTER_MAP_REF, locked: true });
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === tokenId)?.letter === 'A',
      );
      expect(tokens.find((t) => t.id === tokenId)?.imageRef).toBeUndefined();

      // The ledger is what makes the next open free: a second legacy
      // background seeded *behind* a current stamp is not folded, because a
      // current room walks nothing at all.
      await seedLegacyMapBackground(roomId, mapId, 'https://example.com/late.png');
      await clientA.migrateRoomCollections(roomId);
      const still = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        () => true,
      );
      expect(still).toHaveLength(1);
      expect((await clientA.getRoom(roomId))?.collectionsMigratedTo).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('migrateRoomCollections runs only the steps above the stamp (SPEC-056 §6, DEC-111)', async () => {
      // A room whose collections were walked to v27: the background steps
      // are behind it, the v30 letter step is not. `importRoom` keeps the
      // stamp a snapshot carries — only `archiveToSnapshot` stamps current.
      // Imported by clientA, which the seed helpers write as: the importer
      // becomes the referee, and `maps/**` is GM-write.
      const roomId = await clientA.importRoom({
        room: {
          name: 'Walked to v27',
          gmUid: 'someone-else',
          schemaVersion: CURRENT_SCHEMA_VERSION,
          difficultyDie: 'd6',
          dangerDie: 'd6',
          createdAt: 1700000000000,
          collectionsMigratedTo: 27,
          profileTemplate: [],
          handout: null,
          settings: { theme: 'parchment-dark' },
          activeMapId: 'map-1',
        },
        collections: {
          tokens: [
            {
              id: 'tok-1',
              pos: { x: 1, y: 1 },
              size: 1,
              layer: 'tokens',
              imageRef: 'gen:disc:B:hsl(10, 65%, 45%)',
            },
          ],
        },
        maps: [
          {
            doc: {
              id: 'map-1',
              name: 'Map 1',
              order: 0,
              createdAt: 1700000000000,
              grid: { w: 20, h: 20, cellSize: 70 },
              background: null,
              measure: { perSquare: 5, unit: 'feet' },
              gridSettings: { subdivide: false },
            },
            collections: {},
          },
        ],
        encounter: null,
        yjs: {},
      });
      await seedLegacyMapBackground(roomId, 'map-1', STARTER_MAP_REF);

      await clientA.migrateRoomCollections(roomId);

      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === 'tok-1')?.letter === 'B',
      );
      expect(tokens[0]?.imageRef).toBeUndefined();
      // The fold is at or below the stamp, so it did not run.
      const bgs = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, 'map-1', cb),
        () => true,
      );
      expect(bgs).toHaveLength(0);
      expect((await clientA.getRoom(roomId))?.collectionsMigratedTo).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('createToken persists a creature name, and setTokenName sets and clears it (SPEC-040 §3)', async () => {
      const roomId = await createTestRoom(clientA);
      const id = await clientA.createToken(roomId, {
        pos: { x: 4, y: 4 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:disc:A:hsl(10, 65%, 45%)',
        name: 'Goblin 1',
      });

      // The name a generated batch is created with survives the write —
      // `addCreature` sets it at creation, not with a follow-up patch.
      let tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.name === 'Goblin 1',
      );
      expect(tokens.find((t) => t.id === id)!.name).toBe('Goblin 1');

      await clientA.setTokenName(roomId, id, 'Goblin Sentry');
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.name === 'Goblin Sentry',
      );
      let token = tokens.find((t) => t.id === id)!;
      expect(token.name).toBe('Goblin Sentry');
      // Renaming touches nothing else — the symbol is the batch letter and
      // is independent of the name (SPEC-040 §4).
      expect(token.imageRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
      expect(token.pos).toEqual({ x: 4, y: 4 });

      // Clearing returns the token to absence, not to an empty string: the
      // display surfaces fall back to `creatureLabel` again (SPEC-040 §3).
      await clientA.setTokenName(roomId, id, undefined);
      tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === id)?.name === undefined,
      );
      token = tokens.find((t) => t.id === id)!;
      expect(token.name).toBeUndefined();
      expect(token.imageRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
    });
  });

  describe('groups', () => {
    it('creates, partially patches, and deletes a group', async () => {
      const roomId = await createTestRoom(clientA);
      const groupId = await clientA.createGroup(roomId, {
        name: 'Goblin Ambush',
        memberTokenIds: ['t1', 't2'],
        showMap: false,
        showBoard: false,
        active: false,
      });

      await clientA.updateGroup(roomId, groupId, { active: true });
      let groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => items.find((g) => g.id === groupId)?.active === true,
      );
      const group = groups.find((g) => g.id === groupId)!;
      expect(group.name).toBe('Goblin Ambush'); // partial patch preserves siblings
      expect(group.memberTokenIds).toEqual(['t1', 't2']);

      await clientA.deleteGroup(roomId, groupId);
      groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => items.every((g) => g.id !== groupId),
      );
    });

    it('round-trips `memberSeatIds` — group ownership rides the ordinary updateGroup patch', async () => {
      const roomId = await createTestRoom(clientA);
      const groupId = await clientA.createGroup(roomId, {
        name: 'The Party',
        memberTokenIds: ['t1'],
        showMap: true,
        showBoard: true,
        active: false,
      });

      // A group written before group ownership existed carries no owners at
      // all, and absence is the correct reading (no one but the referee).
      let groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => items.some((g) => g.id === groupId),
      );
      expect(groups.find((g) => g.id === groupId)?.memberSeatIds).toBeUndefined();

      await clientA.updateGroup(roomId, groupId, { memberSeatIds: ['seat-a', 'seat-b'] });
      groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => (items.find((g) => g.id === groupId)?.memberSeatIds?.length ?? 0) === 2,
      );
      const owned = groups.find((g) => g.id === groupId)!;
      expect(owned.memberSeatIds).toEqual(['seat-a', 'seat-b']);
      // The referee is never written in — GM membership is derived from
      // `Room.gmUid`, so a transfer needs no group writes at all.
      expect(owned.memberSeatIds).not.toContain(clientA.currentUid());
      expect(owned.memberTokenIds).toEqual(['t1']); // patch preserves siblings
    });

    it('subscribes in `order`, keeping un-ordered groups after the ordered ones', async () => {
      const roomId = await createTestRoom(clientA);
      const base = {
        memberTokenIds: [],
        showMap: false,
        showBoard: false,
        active: false,
      };
      // Created deliberately out of order, with one group carrying no
      // `order` at all — the shape a room written before the field existed
      // has. It must still come back (a Firestore `orderBy` would drop it).
      const last = await clientA.createGroup(roomId, { ...base, name: 'last', order: 2 });
      const legacy = await clientA.createGroup(roomId, { ...base, name: 'legacy' });
      const first = await clientA.createGroup(roomId, { ...base, name: 'first', order: 0 });

      const groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => items.length === 3,
      );
      expect(groups.map((g) => g.id)).toEqual([first, last, legacy]);
    });

    it('reorders by patching `order` alone', async () => {
      const roomId = await createTestRoom(clientA);
      const base = {
        memberTokenIds: [],
        showMap: false,
        showBoard: false,
        active: false,
      };
      const a = await clientA.createGroup(roomId, { ...base, name: 'a', order: 0 });
      const b = await clientA.createGroup(roomId, { ...base, name: 'b', order: 1 });

      await clientA.updateGroup(roomId, a, { order: 1 });
      await clientA.updateGroup(roomId, b, { order: 0 });

      const groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        (items) => items[0]?.id === b,
      );
      expect(groups.map((g) => g.id)).toEqual([b, a]);
    });
  });

  describe('symbol/label authoring (per-map, kept from the cellular tool rail — SPEC §2.2)', () => {
    it('places and removes a symbol', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const symbolId = await clientA.placeSymbol(roomId, mapId, {
        cell: { x: 2, y: 2 },
        kind: 'chest',
        rotation: 0,
      });
      await waitFor<MapSymbol[]>(
        (cb) => clientA.subscribeSymbols(roomId, mapId, cb),
        (symbols) => symbols.length === 1,
      );

      await clientA.removeSymbol(roomId, mapId, symbolId);
      await waitFor<MapSymbol[]>(
        (cb) => clientA.subscribeSymbols(roomId, mapId, cb),
        (symbols) => symbols.length === 0,
      );
    });

    it('upserts and removes a keyed map room', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.upsertMapRoom(roomId, mapId, {
        id: 'mr-1',
        key: '1',
        name: 'Entry Hall',
        bbox: { x: 0, y: 0, w: 5, h: 5 },
        labelAnchor: { x: 2, y: 2 },
        wallStyle: 'masonry',
      });
      await waitFor<MapRoom[]>(
        (cb) => clientA.subscribeMapRooms(roomId, mapId, cb),
        (rooms) => rooms.length === 1,
      );

      await clientA.removeMapRoom(roomId, mapId, 'mr-1');
      await waitFor<MapRoom[]>(
        (cb) => clientA.subscribeMapRooms(roomId, mapId, cb),
        (rooms) => rooms.length === 0,
      );
    });

    it('sets the measurement settings without disturbing the map doc or its name (Master Plan v2, R9.3)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.setMapMeasurement(roomId, mapId, { perSquare: 3, unit: 'meters' });
      const map = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.measure.unit === 'meters',
      );
      expect(map?.measure.perSquare).toBe(3);
      expect(map?.name).toBe('Map 1');
    });

    it('toggles the half-grid subdivision without disturbing other map settings (Master Plan v2, R9.6)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.setMapGridSubdivide(roomId, mapId, true);
      const map = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.gridSettings.subdivide === true,
      );
      expect(map?.gridSettings.subdivide).toBe(true);
      expect(map?.measure.unit).toBe('feet');
    });
  });

  describe('Vector Map System (WI-B — SPEC/DECISIONS in docs/VTT_Master_Plan.md Part II §2)', () => {
    const region = (id: string, x: number): VectorFloorRegion => ({
      id,
      rings: [
        [
          { x, y: 0 },
          { x: x + 4, y: 0 },
          { x: x + 4, y: 4 },
          { x, y: 4 },
        ],
      ],
      bbox: { minX: x, minY: 0, maxX: x + 4, maxY: 4 },
    });

    it('commits floor regions in a batch and observes them as the union', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.commitFloorRegions(roomId, mapId, {
        put: [region('r1', 0), region('r2', 6)],
        delete: [],
      });
      const regions = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 2,
      );
      expect(regions.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
      expect(regions.find((r) => r.id === 'r1')?.rings[0]).toHaveLength(4);
    });

    it('commitFloorRegions expresses a merge atomically: put the survivor, delete the absorbed (SPEC §5.5)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.commitFloorRegions(roomId, mapId, {
        put: [region('a', 0), region('b', 6)],
        delete: [],
      });
      await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 2,
      );
      // A bridging stroke merges a+b into one region and deletes the others.
      await clientA.commitFloorRegions(roomId, mapId, {
        put: [{ ...region('a', 0), bbox: { minX: 0, minY: 0, maxX: 10, maxY: 4 } }],
        delete: ['b'],
      });
      const merged = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 1,
      );
      expect(merged[0]?.id).toBe('a');
      expect(merged[0]?.bbox.maxX).toBe(10);
    });

    it('commits revealed fog geometry independently of the floor (SPEC §4)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.commitFloorRegions(roomId, mapId, {
        put: [region('floor-1', 0)],
        delete: [],
      });
      await clientA.commitFogRegions(roomId, mapId, {
        put: [region('revealed-1', 0), region('revealed-2', 6)],
        delete: [],
      });
      const fog = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFogRegions(roomId, mapId, cb),
        (rs) => rs.length === 2,
      );
      expect(fog.map((r) => r.id).sort()).toEqual(['revealed-1', 'revealed-2']);
      // The two collections are genuinely separate — revealing must not
      // rewrite the floor, and carving must not reveal.
      const floor = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 1,
      );
      expect(floor[0]?.id).toBe('floor-1');
    });

    it('hides revealed area again by deleting fog regions (the Hide brush)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.commitFogRegions(roomId, mapId, {
        put: [region('a', 0), region('b', 6)],
        delete: [],
      });
      await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFogRegions(roomId, mapId, cb),
        (rs) => rs.length === 2,
      );
      // A subtract stroke that wholly swallows `b` puts the survivor and
      // deletes the absorbed one, exactly like a floor merge (SPEC §5.5).
      await clientA.commitFogRegions(roomId, mapId, { put: [region('a', 0)], delete: ['b'] });
      const left = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFogRegions(roomId, mapId, cb),
        (rs) => rs.length === 1,
      );
      expect(left[0]?.id).toBe('a');
    });

    it('toggles fog on and off for one map', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      // Absent on a map that predates fog — that reads as "off".
      const before = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (ms) => ms.length > 0,
      );
      expect(before.find((m) => m.id === mapId)?.fog?.enabled ?? false).toBe(false);

      await clientA.setMapFogEnabled(roomId, mapId, true);
      const on = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (ms) => ms.find((m) => m.id === mapId)?.fog?.enabled === true,
      );
      expect(on.find((m) => m.id === mapId)?.fog?.enabled).toBe(true);

      await clientA.setMapFogEnabled(roomId, mapId, false);
      const off = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (ms) => ms.find((m) => m.id === mapId)?.fog?.enabled === false,
      );
      expect(off.find((m) => m.id === mapId)?.fog?.enabled).toBe(false);
    });

    it('sets, batch-writes, and removes wall segments carrying decoupled block flags (SPEC §3.1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const id = await clientA.setWall(roomId, mapId, {
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: false,
      });
      const one = await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (ws) => ws.length === 1,
      );
      expect(one[0]?.blocksSight).toBe(true);
      expect(one[0]?.blocksMovement).toBe(false);

      // A Wall-tool polyline drag-run lands as one batch.
      const run: StoredVectorWall[] = [
        {
          id: 'w1',
          a: { x: 0, y: 0 },
          b: { x: 1, y: 0 },
          source: 'explicit',
          blocksSight: true,
          blocksMovement: true,
        },
        {
          id: 'w2',
          a: { x: 1, y: 0 },
          b: { x: 2, y: 0 },
          source: 'explicit',
          blocksSight: true,
          blocksMovement: true,
        },
      ];
      await clientA.setWalls(roomId, mapId, run);
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (ws) => ws.length === 3,
      );

      await clientA.removeWall(roomId, mapId, id);
      await clientA.removeWalls(roomId, mapId, ['w1', 'w2']);
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (ws) => ws.length === 0,
      );
    });

    it('sets and removes an overlay door with a state and facing (SPEC §3.2)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const id = await clientA.setDoor(roomId, mapId, {
        a: { x: 2, y: 0 },
        b: { x: 3, y: 0 },
        type: 'oneWay',
        state: 'closed',
        facing: 'a',
      });
      const doors = await waitFor<VectorDoor[]>(
        (cb) => clientA.subscribeDoors(roomId, mapId, cb),
        (ds) => ds.length === 1,
      );
      expect(doors[0]?.type).toBe('oneWay');
      expect(doors[0]?.facing).toBe('a');

      // Upsert by id — flipping the door open replaces the same doc.
      await clientA.setDoor(roomId, mapId, {
        id,
        a: { x: 2, y: 0 },
        b: { x: 3, y: 0 },
        type: 'oneWay',
        state: 'open',
        facing: 'a',
      });
      const opened = await waitFor<VectorDoor[]>(
        (cb) => clientA.subscribeDoors(roomId, mapId, cb),
        (ds) => ds.length === 1 && ds[0]?.state === 'open',
      );
      expect(opened).toHaveLength(1);

      await clientA.removeDoor(roomId, mapId, id);
      await waitFor<VectorDoor[]>(
        (cb) => clientA.subscribeDoors(roomId, mapId, cb),
        (ds) => ds.length === 0,
      );
    });

    it('streams and clears an in-progress vector carve draft over the ephemeral channel (SPEC §5.5 / M7)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const uid = clientA.currentUid()!;
      const draft: VectorMapDraft = {
        uid,
        tool: 'polygon',
        mode: 'add',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 2 },
        ],
        ts: Date.now(),
      };
      clientA.publishVectorMapDraft(roomId, mapId, draft);
      const drafts = await waitFor<VectorMapDraft[]>(
        (cb) => clientA.subscribeVectorMapDraft(roomId, mapId, cb),
        (ds) => ds.length === 1,
      );
      expect(drafts[0]?.points).toHaveLength(3);
      expect(drafts[0]?.mode).toBe('add');

      clientA.clearVectorMapDraft(roomId, mapId, uid);
      await waitFor<VectorMapDraft[]>(
        (cb) => clientA.subscribeVectorMapDraft(roomId, mapId, cb),
        (ds) => ds.length === 0,
      );
    });

    it('deleteMap clears the vector floor/wall/door subcollections (REVIEW M2)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Vector Map' });
      await clientA.commitFloorRegions(roomId, mapId, { put: [region('r1', 0)], delete: [] });
      await clientA.setWall(roomId, mapId, {
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      });
      await clientA.setDoor(roomId, mapId, {
        a: { x: 2, y: 0 },
        b: { x: 3, y: 0 },
        type: 'single',
        state: 'closed',
      });
      await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 1,
      );

      await clientA.deleteMap(roomId, mapId);
      await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
        (rs) => rs.length === 0,
      );
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (ws) => ws.length === 0,
      );
      await waitFor<VectorDoor[]>(
        (cb) => clientA.subscribeDoors(roomId, mapId, cb),
        (ds) => ds.length === 0,
      );
    });

    it('round-trips the vector collections through exportRoom → importRoom (REVIEW M3)', async () => {
      const roomId = await createTestRoom(clientA, 'Vector Export');
      const mapId = await activeMapId(clientA, roomId);
      await clientA.commitFloorRegions(roomId, mapId, { put: [region('r1', 0)], delete: [] });
      await clientA.setWall(roomId, mapId, {
        id: 'wseg-1',
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'imported',
        blocksSight: true,
        blocksMovement: true,
      });
      await clientA.setDoor(roomId, mapId, {
        id: 'door-1',
        a: { x: 2, y: 0 },
        b: { x: 3, y: 0 },
        type: 'secret',
        state: 'closed',
      });
      await waitFor<VectorDoor[]>(
        (cb) => clientA.subscribeDoors(roomId, mapId, cb),
        (ds) => ds.length === 1,
      );

      const snapshot = await clientA.exportRoom(roomId);
      const importedRoomId = await clientB.importRoom(snapshot);
      const importedMapId = await activeMapId(clientB, importedRoomId);

      const regions = await waitFor<VectorFloorRegion[]>(
        (cb) => clientB.subscribeFloorRegions(importedRoomId, importedMapId, cb),
        (rs) => rs.length === 1,
      );
      expect(regions[0]?.bbox.maxX).toBe(4);
      const walls = await waitFor<StoredVectorWall[]>(
        (cb) => clientB.subscribeWalls(importedRoomId, importedMapId, cb),
        (ws) => ws.length === 1,
      );
      expect(walls[0]?.source).toBe('imported');
      const doors = await waitFor<VectorDoor[]>(
        (cb) => clientB.subscribeDoors(importedRoomId, importedMapId, cb),
        (ds) => ds.length === 1,
      );
      expect(doors[0]?.type).toBe('secret');
    });
  });

  describe('maps manager (Master Plan v2, R17.3 — multiple full map builds per session)', () => {
    it('a fresh room has exactly one map, named "Map 1", set active', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const maps = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (m) => m.length === 1,
      );
      expect(maps[0]?.id).toBe(mapId);
      expect(maps[0]?.name).toBe('Map 1');
    });

    it('createMap adds an independent map that does not disturb the active one', async () => {
      const roomId = await createTestRoom(clientA);
      const firstMapId = await activeMapId(clientA, roomId);
      const secondMapId = await clientA.createMap(roomId, { name: 'Town Square' });
      expect(secondMapId).not.toBe(firstMapId);

      const maps = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (m) => m.length === 2,
      );
      expect(maps.map((m) => m.name).sort()).toEqual(['Map 1', 'Town Square']);

      const room = await clientA.getRoom(roomId);
      expect(room?.activeMapId).toBe(firstMapId); // creating a map never switches active
    });

    it('createMap makes a square-grid map unless asked for a hex one (SPEC-030 §1)', async () => {
      // RULE-006 (amended by WI-037): a map's coordinate space follows its
      // grid kind, and `GameMap.hex` is what declares it. The default must
      // stay square — every existing caller passes only a name — and a hex
      // map must persist its `hex` config through the converter, since a
      // dropped one would silently reinterpret every axial coordinate on it
      // as square-lattice units.
      const roomId = await createTestRoom(clientA);
      const squareId = await clientA.createMap(roomId, { name: 'Dungeon Level 2' });
      const hexId = await clientA.createMap(roomId, {
        name: 'The Borderlands',
        gridKind: 'hex',
      });

      const maps = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (m) => m.length === 3,
      );
      const square = maps.find((m) => m.id === squareId);
      const hex = maps.find((m) => m.id === hexId);

      expect(square?.hex).toBeUndefined();
      expect(mapGridKind(square!)).toBe('square');
      expect(hex?.hex).toEqual(DEFAULT_HEX_GRID_CONFIG);
      expect(mapGridKind(hex!)).toBe('hex');
      // The square `grid` rides along on a hex map (one schema reads both),
      // and neither kind touches the other's data.
      expect(hex?.grid).toEqual(square?.grid);
    });

    it('setHexTerrain/setHexContents paint one hex, keyed by its own coordinate (SPEC-030 §§2–3)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      await clientA.setHexTerrain(roomId, mapId, { q: 2, r: -3 }, 'forest');
      const painted = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 1,
      );
      // The id *is* the coordinate (`axialKey`), so the two can never
      // disagree — the document is filed under the hex it paints.
      expect(painted[0]).toEqual({ id: '2,-3', hex: { q: 2, r: -3 }, terrain: 'forest' });

      // Contents is an independent write on the same document: it must not
      // take the terrain with it, in either direction.
      await clientA.setHexContents(roomId, mapId, { q: 2, r: -3 }, 'castle');
      const both = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.contents === 'castle',
      );
      expect(both[0]).toEqual({
        id: '2,-3',
        hex: { q: 2, r: -3 },
        terrain: 'forest',
        contents: 'castle',
      });

      await clientA.setHexTerrain(roomId, mapId, { q: 2, r: -3 }, 'mountains');
      const repainted = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.terrain === 'mountains',
      );
      expect(repainted[0]?.contents).toBe('castle');
    });

    it('a hex may carry contents with no terrain, and clearing the last field deletes the document (SPEC-030 §§2–3)', async () => {
      // The sparseness guarantee: an infinite plane (§1) can only be stored
      // as "the hexes somebody painted", so "erased back to blank" and "never
      // painted" have to be the same state.
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      await clientA.setHexContents(roomId, mapId, { q: 0, r: 0 }, 'cave');
      const contentsOnly = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 1,
      );
      expect(contentsOnly[0]).toEqual({ id: '0,0', hex: { q: 0, r: 0 }, contents: 'cave' });
      expect(contentsOnly[0]?.terrain).toBeUndefined();

      // Terrain added, then cleared again: the document survives on its
      // contents alone rather than being pruned with the field.
      await clientA.setHexTerrain(roomId, mapId, { q: 0, r: 0 }, 'swamp');
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.terrain === 'swamp',
      );
      await clientA.setHexTerrain(roomId, mapId, { q: 0, r: 0 }, null);
      const cleared = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.terrain === undefined,
      );
      expect(cleared[0]).toEqual({ id: '0,0', hex: { q: 0, r: 0 }, contents: 'cave' });

      // Now the last field goes, and the hex is unpainted again.
      await clientA.setHexContents(roomId, mapId, { q: 0, r: 0 }, null);
      const gone = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 0,
      );
      expect(gone).toEqual([]);

      // Clearing a hex that was never painted is a no-op, not a stub.
      await clientA.setHexTerrain(roomId, mapId, { q: 9, r: 9 }, null);
      const stillEmpty = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        () => true,
      );
      expect(stillEmpty).toEqual([]);
    });

    it('setHexNote stores a note-only hex and prunes it on clear (SPEC-030 §4)', async () => {
      // §4: "only hexes with a note attached are tracked" — which is this
      // collection's existing sparseness, not a second index. A hex nobody
      // painted but somebody wrote about is as ordinary a document as one
      // carrying terrain alone.
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      await clientA.setHexNote(roomId, mapId, { q: -4, r: 6 }, 'The road forks here.');
      const noteOnly = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 1,
      );
      expect(noteOnly[0]).toEqual({
        id: '-4,6',
        hex: { q: -4, r: 6 },
        note: 'The road forks here.',
      });

      // The three fields are independent in both directions: painting the
      // hex must not erase what was written about it, and rewriting the note
      // must not repaint it.
      await clientA.setHexTerrain(roomId, mapId, { q: -4, r: 6 }, 'hills');
      const painted = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.terrain === 'hills',
      );
      expect(painted[0]?.note).toBe('The road forks here.');

      await clientA.setHexNote(roomId, mapId, { q: -4, r: 6 }, '**Bandits** watch the fork.');
      const rewritten = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.note === '**Bandits** watch the fork.',
      );
      expect(rewritten[0]?.terrain).toBe('hills');

      // Clearing the note leaves the terrain standing…
      await clientA.setHexNote(roomId, mapId, { q: -4, r: 6 }, null);
      const unnoted = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.note === undefined,
      );
      expect(unnoted[0]).toEqual({ id: '-4,6', hex: { q: -4, r: 6 }, terrain: 'hills' });

      // …and a note is enough on its own to keep a document alive, so
      // clearing the terrain under one does not prune it.
      await clientA.setHexNote(roomId, mapId, { q: -4, r: 6 }, 'Still worth remembering.');
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.note === 'Still worth remembering.',
      );
      await clientA.setHexTerrain(roomId, mapId, { q: -4, r: 6 }, null);
      const survives = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t[0]?.terrain === undefined,
      );
      expect(survives[0]).toEqual({
        id: '-4,6',
        hex: { q: -4, r: 6 },
        note: 'Still worth remembering.',
      });

      // The note was the last field: clearing it unpaints the hex entirely.
      await clientA.setHexNote(roomId, mapId, { q: -4, r: 6 }, null);
      const gone = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 0,
      );
      expect(gone).toEqual([]);
    });

    it('painted hexes are per map and negative coordinates round-trip (SPEC-030 §§1–3)', async () => {
      // `0,0` is the map's *centre*, so both axes run negative — a key that
      // mangled the sign would file half the map under the wrong hexes.
      const roomId = await createTestRoom(clientA);
      const northId = await clientA.createMap(roomId, { name: 'North', gridKind: 'hex' });
      const southId = await clientA.createMap(roomId, { name: 'South', gridKind: 'hex' });

      await clientA.setHexTerrain(roomId, northId, { q: -12, r: 7 }, 'tundra');
      await clientA.setHexTerrain(roomId, northId, { q: 0, r: 0 }, 'plains');
      await clientA.setHexTerrain(roomId, southId, { q: -12, r: 7 }, 'desert');

      const north = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, northId, cb),
        (t) => t.length === 2,
      );
      expect([...north].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
        { id: '-12,7', hex: { q: -12, r: 7 }, terrain: 'tundra' },
        { id: '0,0', hex: { q: 0, r: 0 }, terrain: 'plains' },
      ]);

      const south = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, southId, cb),
        (t) => t.length === 1,
      );
      expect(south[0]?.terrain).toBe('desert');
    });

    it('setHexesRevealed reveals a set of hexes in one call, flag-only tiles included (SPEC-056 §9)', async () => {
      // DEC-113: revealing an empty hex creates a document carrying only the
      // flag, and a painted hex keeps everything it had.
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });
      await clientA.setHexTerrain(roomId, mapId, { q: 1, r: -1 }, 'forest');
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 1,
      );

      await clientA.setHexesRevealed(
        roomId,
        mapId,
        // A duplicate, and negative coordinates: each hex is written once,
        // under its own key.
        [
          { q: 1, r: -1 },
          { q: 0, r: 0 },
          { q: -3, r: 2 },
          { q: 0, r: 0 },
        ],
        true,
      );
      const revealed = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 3 && t.every((x) => x.revealed === true),
      );
      expect([...revealed].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
        { id: '-3,2', hex: { q: -3, r: 2 }, revealed: true },
        { id: '0,0', hex: { q: 0, r: 0 }, revealed: true },
        { id: '1,-1', hex: { q: 1, r: -1 }, terrain: 'forest', revealed: true },
      ]);

      // An empty list is a no-op, not an error.
      await clientA.setHexesRevealed(roomId, mapId, [], true);
    });

    it('hiding deletes a flag-only tile and leaves a painted one standing; the setters keep the flag (SPEC-056 §9)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });
      await clientA.setHexesRevealed(
        roomId,
        mapId,
        [
          { q: 0, r: 0 },
          { q: 2, r: 2 },
        ],
        true,
      );
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 2,
      );

      // Painting a revealed hex must not re-fog it — and clearing that paint
      // again leaves the flag keeping the document alive.
      await clientA.setHexContents(roomId, mapId, { q: 2, r: 2 }, 'cave');
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.some((x) => x.contents === 'cave'),
      );
      await clientA.setHexContents(roomId, mapId, { q: 2, r: 2 }, null);
      const flagOnly = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 2 && t.every((x) => x.contents === undefined),
      );
      expect(flagOnly.find((x) => x.id === '2,2')).toEqual({
        id: '2,2',
        hex: { q: 2, r: 2 },
        revealed: true,
      });

      // Now paint one, then hide both: the painted hex keeps its document
      // without the flag, the flag-only hex is deleted, and hiding a hex that
      // was never touched leaves no stub.
      await clientA.setHexTerrain(roomId, mapId, { q: 2, r: 2 }, 'hills');
      await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.some((x) => x.terrain === 'hills'),
      );
      await clientA.setHexesRevealed(
        roomId,
        mapId,
        [
          { q: 0, r: 0 },
          { q: 2, r: 2 },
          { q: 9, r: -9 },
        ],
        false,
      );
      const hidden = await waitFor<HexTile[]>(
        (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
        (t) => t.length === 1 && t[0]?.revealed === undefined,
      );
      expect(hidden).toEqual([{ id: '2,2', hex: { q: 2, r: 2 }, terrain: 'hills' }]);
    });

    it('placeHexSymbol stores a symbol at a HexPoint, snapped or free (SPEC-047 §2)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      // A snapped placement: Hex snap resolves to the hex the pointer is
      // inside, which is an integer *centre* — `(q + r) mod 3 === 0`.
      const castleId = await clientA.placeHexSymbol(roomId, mapId, {
        point: { q: 6, r: -3 },
        kind: 'castle',
      });
      // A free placement: SPEC-047 §4's "lands where the pointer is and stays
      // there". The store must keep the fraction, not round it onto a hex.
      await clientA.placeHexSymbol(roomId, mapId, {
        point: { q: -4.25, r: 11.5 },
        kind: 'ruins',
      });

      const placed = await waitFor<HexSymbol[]>(
        (cb) => clientA.subscribeHexSymbols(roomId, mapId, cb),
        (symbols) => symbols.length === 2,
      );
      const castle = placed.find((symbol) => symbol.id === castleId);
      expect(castle).toEqual({ id: castleId, point: { q: 6, r: -3 }, kind: 'castle' });
      const ruins = placed.find((symbol) => symbol.kind === 'ruins');
      expect(ruins?.point).toEqual({ q: -4.25, r: 11.5 });

      // Removing one deletes it rather than blanking it: "erased" and "never
      // placed" are the same state, as they are for a painted hex.
      await clientA.removeHexSymbol(roomId, mapId, castleId);
      const left = await waitFor<HexSymbol[]>(
        (cb) => clientA.subscribeHexSymbols(roomId, mapId, cb),
        (symbols) => symbols.length === 1,
      );
      expect(left[0]?.kind).toBe('ruins');
    });

    it('two symbols may share one hex — the id is opaque, not the coordinate (SPEC-047 §2)', async () => {
      // The difference from `hexTiles`, spelled out: a hex tile is keyed by
      // its coordinate and there is one per hex, but a symbol's id is minted,
      // so placing a second one in the same hex adds a document instead of
      // overwriting the first.
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      await clientA.placeHexSymbol(roomId, mapId, { point: { q: 0, r: 0 }, kind: 'castle' });
      await clientA.placeHexSymbol(roomId, mapId, { point: { q: 0, r: 0 }, kind: 'camp' });

      const both = await waitFor<HexSymbol[]>(
        (cb) => clientA.subscribeHexSymbols(roomId, mapId, cb),
        (symbols) => symbols.length === 2,
      );
      expect([...both].map((symbol) => symbol.kind).sort()).toEqual(['camp', 'castle']);
      expect(new Set(both.map((symbol) => symbol.id)).size).toBe(2);
    });

    it('addHexLine stores a road and a river with their vertices exact (SPEC-047 §§1–2)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Wilderlands', gridKind: 'hex' });

      // Corner to corner, in thirds. The two vertices below are corners two
      // adjacent hexes share, and the whole point of storing integers is that
      // they come back as the *same* values — not to within 1e-16 (SPEC-047
      // §1). Equality here is the storage half of "do these roads join?".
      const roadId = await clientA.addHexLine(roomId, mapId, {
        kind: 'road',
        points: [
          { q: 2, r: -1 },
          { q: 4, r: -2 },
          { q: 5, r: 0 },
        ],
        shade: 1,
        width: 0,
        join: 'mitre',
      });
      // The join rides the document rather than being derived from `kind`:
      // a river drawn round stays round whatever is done to it later.
      await clientA.addHexLine(roomId, mapId, {
        kind: 'river',
        points: [
          { q: -1, r: -1 },
          { q: -2.5, r: 3.75 },
        ],
        shade: 2,
        width: 2,
        join: 'round',
      });

      const drawn = await waitFor<HexLine[]>(
        (cb) => clientA.subscribeHexLines(roomId, mapId, cb),
        (lines) => lines.length === 2,
      );
      const road = drawn.find((line) => line.id === roadId);
      expect(road).toEqual({
        id: roadId,
        kind: 'road',
        points: [
          { q: 2, r: -1 },
          { q: 4, r: -2 },
          { q: 5, r: 0 },
        ],
        shade: 1,
        width: 0,
        join: 'mitre',
      });
      const river = drawn.find((line) => line.kind === 'river');
      expect(river?.join).toBe('round');
      expect(river?.points[1]).toEqual({ q: -2.5, r: 3.75 });

      await clientA.removeHexLine(roomId, mapId, roadId);
      const left = await waitFor<HexLine[]>(
        (cb) => clientA.subscribeHexLines(roomId, mapId, cb),
        (lines) => lines.length === 1,
      );
      expect(left[0]?.kind).toBe('river');
    });

    it('hex overlays are per map, and per collection (SPEC-047 §2)', async () => {
      // Two maps in one room must not see each other's overlays, and the two
      // collections must not see each other's documents — the same isolation
      // `hexTiles` has, checked here because both are new paths.
      const roomId = await createTestRoom(clientA);
      const northId = await clientA.createMap(roomId, { name: 'North', gridKind: 'hex' });
      const southId = await clientA.createMap(roomId, { name: 'South', gridKind: 'hex' });

      await clientA.placeHexSymbol(roomId, northId, { point: { q: 3, r: 0 }, kind: 'town' });
      await clientA.addHexLine(roomId, southId, {
        kind: 'river',
        points: [
          { q: 0, r: 0 },
          { q: 1, r: 1 },
        ],
        shade: 0,
        width: 1,
        join: 'round',
      });

      const northSymbols = await waitFor<HexSymbol[]>(
        (cb) => clientA.subscribeHexSymbols(roomId, northId, cb),
        (symbols) => symbols.length === 1,
      );
      expect(northSymbols[0]?.kind).toBe('town');
      const southSymbols = await waitFor<HexSymbol[]>(
        (cb) => clientA.subscribeHexSymbols(roomId, southId, cb),
        () => true,
      );
      expect(southSymbols).toEqual([]);
      const northLines = await waitFor<HexLine[]>(
        (cb) => clientA.subscribeHexLines(roomId, northId, cb),
        () => true,
      );
      expect(northLines).toEqual([]);
      const southLines = await waitFor<HexLine[]>(
        (cb) => clientA.subscribeHexLines(roomId, southId, cb),
        (lines) => lines.length === 1,
      );
      expect(southLines[0]?.kind).toBe('river');
    });

    it('renameMap updates just the name', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.renameMap(roomId, mapId, 'The Sunken Crypt');
      const map = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.name === 'The Sunken Crypt',
      );
      expect(map?.id).toBe(mapId);
    });

    it("setActiveMap switches which map is active without touching the other map's data", async () => {
      const roomId = await createTestRoom(clientA);
      const firstMapId = await activeMapId(clientA, roomId);
      const secondMapId = await clientA.createMap(roomId, { name: 'Second Map' });

      await clientA.setWall(roomId, firstMapId, {
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      });
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, firstMapId, cb),
        (walls) => walls.length === 1,
      );

      await clientA.setActiveMap(roomId, secondMapId);
      const room = await waitFor<Room | null>(
        (cb) => clientA.subscribeRoom(roomId, cb),
        (r) => r?.activeMapId === secondMapId,
      );
      expect(room?.activeMapId).toBe(secondMapId);

      // The first map's wall is still there — switching active never
      // touches another map's own subcollections.
      const firstMapWalls = await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, firstMapId, cb),
        (walls) => walls.length === 1,
      );
      expect(firstMapWalls).toHaveLength(1);
      const secondMapWalls = await new Promise<StoredVectorWall[]>((resolve) => {
        const unsub = clientA.subscribeWalls(roomId, secondMapId, (walls) => {
          unsub();
          resolve(walls);
        });
      });
      expect(secondMapWalls).toHaveLength(0);
    });

    it('deleteMap removes the map doc and its subcollections', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Disposable' });
      await clientA.setWall(roomId, mapId, {
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      });
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (walls) => walls.length === 1,
      );

      await clientA.deleteMap(roomId, mapId);
      await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m === null,
      );
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, mapId, cb),
        (walls) => walls.length === 0,
      );
    });

    it('ensureActiveMap is a no-op once activeMapId is already set', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const resolved = await clientA.ensureActiveMap(roomId);
      expect(resolved).toBe(mapId);
      const maps = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        (m) => m.length >= 1,
      );
      expect(maps).toHaveLength(1); // didn't create a second map
    });

    it('createBattleMap cuts an independent map carrying the battle marker and copies its geometry (SPEC-029 §§2, 5)', async () => {
      const roomId = await createTestRoom(clientA);
      const sourceMapId = await activeMapId(clientA, roomId);
      await clientA.setWall(roomId, sourceMapId, {
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      });
      const floorRegion: VectorFloorRegion = {
        id: 'floor-1',
        rings: [
          [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
        ],
        bbox: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
      };
      await clientA.commitFloorRegions(roomId, sourceMapId, { put: [floorRegion], delete: [] });
      await clientA.commitFogRegions(roomId, sourceMapId, {
        put: [{ ...floorRegion, id: 'fog-1' }],
        delete: [],
      });
      await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, sourceMapId, cb),
        (walls) => walls.length === 1,
      );

      const rect = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
      const battleMapId = await clientA.createBattleMap(roomId, sourceMapId, rect);
      expect(battleMapId).not.toBe(sourceMapId);

      const battleMap = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, battleMapId, cb),
        (m) => m !== null,
      );
      expect(battleMap?.battle).toEqual({ sourceMapId, rect });

      const walls = await waitFor<StoredVectorWall[]>(
        (cb) => clientA.subscribeWalls(roomId, battleMapId, cb),
        (ws) => ws.length === 1,
      );
      expect(walls[0]?.a).toEqual({ x: 0, y: 0 });
      const floor = await waitFor<VectorFloorRegion[]>(
        (cb) => clientA.subscribeFloorRegions(roomId, battleMapId, cb),
        (rs) => rs.length === 1,
      );
      expect(floor[0]?.id).toBe('floor-1');

      // Fog is deliberately not copied (SPEC-029 §2) — a battle map carries
      // none of its own.
      const fog = await new Promise<VectorFloorRegion[]>((resolve) => {
        const unsub = clientA.subscribeFogRegions(roomId, battleMapId, (rs) => {
          unsub();
          resolve(rs);
        });
      });
      expect(fog).toHaveLength(0);

      // Creating a battle map never switches active, mirroring `createMap`.
      const room = await clientA.getRoom(roomId);
      expect(room?.activeMapId).toBe(sourceMapId);
    });

    it('exitBattleMap switches active back to the source and deletes the battle map', async () => {
      const roomId = await createTestRoom(clientA);
      const sourceMapId = await activeMapId(clientA, roomId);
      const battleMapId = await clientA.createBattleMap(roomId, sourceMapId, {
        minX: 0,
        minY: 0,
        maxX: 4,
        maxY: 4,
      });
      await clientA.setActiveMap(roomId, battleMapId);
      await waitFor<Room | null>(
        (cb) => clientA.subscribeRoom(roomId, cb),
        (r) => r?.activeMapId === battleMapId,
      );

      await clientA.exitBattleMap(roomId, battleMapId);
      const room = await waitFor<Room | null>(
        (cb) => clientA.subscribeRoom(roomId, cb),
        (r) => r?.activeMapId === sourceMapId,
      );
      expect(room?.activeMapId).toBe(sourceMapId);

      await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, battleMapId, cb),
        (m) => m === null,
      );
    });

    it('exitBattleMap rejects a map with no battle marker', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await expect(clientA.exitBattleMap(roomId, mapId)).rejects.toThrow();
    });
  });

  describe('annotate overlay (drawings)', () => {
    it('writes and deletes a freehand drawing', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const drawingId = await clientA.writeDrawing(roomId, mapId, {
        layer: 'mapping',
        kind: 'freehand',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        style: { color: 'red' },
      });
      await waitFor<Drawing[]>(
        (cb) => clientA.subscribeDrawings(roomId, mapId, cb),
        (drawings) => drawings.length === 1,
      );

      await clientA.deleteDrawing(roomId, mapId, drawingId);
      await waitFor<Drawing[]>(
        (cb) => clientA.subscribeDrawings(roomId, mapId, cb),
        (drawings) => drawings.length === 0,
      );
    });
  });
}
