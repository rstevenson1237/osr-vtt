import { beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { expandSharedRollSlots } from '../dice/engine.js';
import type {
  AssetRef,
  BlindDraw,
  DiceMacro,
  Drawing,
  Encounter,
  FloorChunk,
  FogChunk,
  Group,
  HandoutRecord,
  LogEntry,
  MapLight,
  MapRoom,
  MapSymbol,
  MapWall,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  RandomTable,
  Roll,
  Room,
  SharedRoll,
  SightWall,
  Token,
} from '../types.js';
import { CURRENT_SCHEMA_VERSION } from '../types.js';
import type {
  CampaignStore,
  CursorPos,
  DragFrame,
  MapDraft,
  PingPos,
  Unsubscribe,
} from './campaign-store.js';
import { LIVE_LOG_LIMIT } from './campaign-store.js';

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
 */

/** Waits for a subscription to deliver a value matching `predicate`. Works
 * whether the store notifies synchronously-ish (MemoryStore, a microtask
 * away) or over real emulator round-trips (FirebaseStore, tens of ms) — the
 * timeout is generous specifically for the latter. */
async function waitFor<T>(
  subscribe: (cb: (value: T) => void) => Unsubscribe,
  predicate: (value: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let unsub: Unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('waitFor: timed out waiting for predicate to hold'));
    }, timeoutMs);
    unsub = subscribe((value) => {
      if (predicate(value)) {
        clearTimeout(timer);
        unsub();
        resolve(value);
      }
    });
  });
}

async function createTestRoom(store: CampaignStore, name = 'Test Room'): Promise<string> {
  return store.createRoom({ name, profileTemplate: [] });
}

/**
 * @param label Identifies the implementation under test in describe blocks.
 * @param createClients Returns `count` independently-authenticated
 * `CampaignStore` handles sharing ONE underlying backend/project — the
 * in-memory analog of `count` browser tabs against one Firebase project,
 * each with its own anonymous auth session. Called once per suite; tests
 * isolate themselves by always operating on a freshly created room.
 */
export function defineCampaignStoreContract(
  label: string,
  createClients: (count: number) => Promise<CampaignStore[]> | CampaignStore[],
): void {
  describe(`CampaignStore contract — ${label}`, () => {
    let clientA: CampaignStore;
    let clientB: CampaignStore;

    beforeAll(async () => {
      const clients = await createClients(2);
      clientA = clients[0]!;
      clientB = clients[1]!;
    });

    describe('rooms + players', () => {
      it('creates a room with the creator as gmUid, readable via getRoom and subscribeRoom', async () => {
        const roomId = await createTestRoom(clientA, 'Dragon Lair');
        const uid = clientA.currentUid();

        const fetched = await clientA.getRoom(roomId);
        expect(fetched?.name).toBe('Dragon Lair');
        expect(fetched?.gmUid).toBe(uid);
        expect(fetched?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

        const observed = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (room) => room?.name === 'Dragon Lair',
        );
        expect(observed?.gmUid).toBe(uid);
      });

      it('resolves getRoom to null for a room that was never created', async () => {
        await expect(clientA.getRoom('never-created-room')).resolves.toBeNull();
      });

      it('assigns the creator the gm role and a second joiner the player role', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');

        const players = await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) => seats.length >= 2,
        );
        const gmUid = clientA.currentUid();
        const playerUid = clientB.currentUid();
        expect(players.find((p) => p.uid === gmUid)?.role).toBe('gm');
        expect(players.find((p) => p.uid === playerUid)?.role).toBe('player');
      });

      it('renameRoom updates the name without disturbing other room fields (Master Plan v2, R4)', async () => {
        const roomId = await createTestRoom(clientA, 'The Sunless Vault');
        await clientA.renameRoom(roomId, 'The Sunlit Vault');
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.name === 'The Sunlit Vault',
        );
        expect(room?.gmUid).toBe(clientA.currentUid());
      });

      it('setTheme updates settings.theme without disturbing sibling settings (Master Plan v2, R4)', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.setMeasurement(roomId, { perSquare: 3, unit: 'meters' });
        await clientA.setTheme(roomId, 'keyed-blue');
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.theme === 'keyed-blue',
        );
        expect(room?.settings.measure.unit).toBe('meters');
      });

      it('setGridDimensions updates grid w/h/cellSize (Master Plan v2, R4)', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.setGridDimensions(roomId, { w: 96, h: 48, cellSize: 50 });
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.grid.w === 96,
        );
        expect(room?.grid).toEqual({ w: 96, h: 48, cellSize: 50 });
      });

      it('setTensionDefaults updates difficulty/danger die defaults (Master Plan v2, R4)', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.setTensionDefaults(roomId, { difficultyDie: 'd8', dangerDie: 'd10' });
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.difficultyDie === 'd8',
        );
        expect(room?.dangerDie).toBe('d10');
      });
    });

    describe('My Rooms index (Master Plan v2, R6.2)', () => {
      it('records a room in My Rooms on create (role gm), and removeMyRoom drops it', async () => {
        const roomId = await createTestRoom(clientA, 'Indexed Room');
        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.some((r) => r.roomId === roomId),
        );
        const entry = mine.find((r) => r.roomId === roomId)!;
        expect(entry.name).toBe('Indexed Room');
        expect(entry.role).toBe('gm');

        await clientA.removeMyRoom(roomId);
        await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.every((r) => r.roomId !== roomId),
        );
      });

      it('recordRoomVisit upserts the name/role for the room-open path', async () => {
        const roomId = await createTestRoom(clientA, 'Visited Room');
        await clientA.recordRoomVisit(roomId, { name: 'Renamed On Open', role: 'player' });
        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.find((r) => r.roomId === roomId)?.name === 'Renamed On Open',
        );
        expect(mine.find((r) => r.roomId === roomId)?.role).toBe('player');
      });

      it("a joiner gets the room in their OWN My Rooms as a player", async () => {
        const roomId = await createTestRoom(clientA, 'Joinable Room');
        await clientB.joinRoom(roomId, 'A Player');
        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientB.subscribeMyRooms(cb),
          (rooms) => rooms.some((r) => r.roomId === roomId),
        );
        expect(mine.find((r) => r.roomId === roomId)?.role).toBe('player');
      });
    });

    describe('room deletion (Master Plan v2, R6.3)', () => {
      it('recursively clears every subcollection, the room doc, and getRoom goes null', async () => {
        const roomId = await createTestRoom(clientA, 'Doomed Room');
        const uid = clientA.currentUid()!;
        await clientA.createToken(roomId, {
          pos: { x: 1, y: 1 },
          size: 1,
          layer: 'tokens',
          imageRef: 'tokens/x.png',
        });
        await clientA.createGroup(roomId, {
          name: 'G',
          memberTokenIds: [],
          showMap: false,
          showBoard: false,
          active: false,
        });
        await clientA.commitFloorChunks(roomId, [{ id: '0_0', bits: [1, 0, 0, 0, 0, 0, 0, 0] }]);
        await clientA.writeLog(roomId, { ts: 1, authorUid: uid, type: 'chat', text: 'doomed' });
        await waitFor<Token[]>(
          (cb) => clientA.subscribeTokens(roomId, cb),
          (t) => t.length === 1,
        );

        await clientA.deleteRoom(roomId);

        expect(await clientA.getRoom(roomId)).toBeNull();
        await waitFor<Token[]>((cb) => clientA.subscribeTokens(roomId, cb), (t) => t.length === 0);
        await waitFor<Group[]>((cb) => clientA.subscribeGroups(roomId, cb), (g) => g.length === 0);
        await waitFor<FloorChunk[]>(
          (cb) => clientA.subscribeFloorChunks(roomId, cb),
          (c) => c.length === 0,
        );
        await waitFor<LogEntry[]>((cb) => clientA.subscribeLog(roomId, cb), (l) => l.length === 0);
      });
    });

    describe('prune old entries (Master Plan v2, R6.4)', () => {
      it('deletes log + rolls older than the cutoff, keeping newer ones, and reports counts', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        const roll = (ts: number, seed: string) => ({
          ts,
          authorUid: uid,
          seed,
          dice: [{ die: 'd6', sides: 6, kept: 1 }],
          modifier: 0,
          advantage: 'normal' as const,
          mode: 'summed' as const,
          total: 1,
        });
        await clientA.writeLog(roomId, { ts: 100, authorUid: uid, type: 'chat', text: 'old' });
        await clientA.writeLog(roomId, { ts: 500, authorUid: uid, type: 'chat', text: 'new' });
        await clientA.writeRoll(roomId, roll(100, 'old-roll'));
        await clientA.writeRoll(roomId, roll(500, 'new-roll'));
        await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (l) => l.length === 2,
        );

        const removed = await clientA.pruneEntriesBefore(roomId, 300);
        expect(removed).toEqual({ log: 1, rolls: 1 });

        const log = await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (l) => l.length === 1,
        );
        expect(log[0]!.text).toBe('new');
        const rolls = await waitFor<Roll[]>(
          (cb) => clientA.subscribeRolls(roomId, cb),
          (r) => r.length === 1,
        );
        expect(rolls[0]!.seed).toBe('new-roll');
      });
    });

    describe('player management (Master Plan v2, R4 — Session Config "Players" section)', () => {
      it('renamePlayer and setPlayerRole update a seat without disturbing its other fields', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const playerUid = clientB.currentUid()!;

        await clientA.renamePlayer(roomId, playerUid, 'Bram the Bold');
        let players = await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) => seats.find((p) => p.uid === playerUid)?.displayName === 'Bram the Bold',
        );
        expect(players.find((p) => p.uid === playerUid)?.role).toBe('player');

        await clientA.setPlayerRole(roomId, playerUid, 'viewer');
        players = await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) => seats.find((p) => p.uid === playerUid)?.role === 'viewer',
        );
        expect(players.find((p) => p.uid === playerUid)?.displayName).toBe('Bram the Bold');
      });

      it('removePlayer deletes the seat but keeps the profile by default', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const playerUid = clientB.currentUid()!;
        await clientB.setProfileValue(roomId, playerUid, 'name', 'Bram');
        await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (profiles) => profiles.some((p) => p.seatId === playerUid),
        );

        await clientA.removePlayer(roomId, playerUid);
        await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) => seats.every((p) => p.uid !== playerUid),
        );
        const profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          () => true,
        );
        expect(profiles.some((p) => p.seatId === playerUid)).toBe(true);
      });

      it('removePlayer with deleteProfile also deletes the character sheet', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const playerUid = clientB.currentUid()!;
        await clientB.setProfileValue(roomId, playerUid, 'name', 'Bram');
        await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (profiles) => profiles.some((p) => p.seatId === playerUid),
        );

        await clientA.removePlayer(roomId, playerUid, { deleteProfile: true });
        await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) => seats.every((p) => p.uid !== playerUid),
        );
        await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (profiles) => profiles.every((p) => p.seatId !== playerUid),
        );
      });

      it('transferGM writes the new gmUid and swaps the gm/player seat roles', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const oldGmUid = clientA.currentUid()!;
        const newGmUid = clientB.currentUid()!;

        await clientA.transferGM(roomId, newGmUid);

        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.gmUid === newGmUid,
        );
        expect(room?.gmUid).toBe(newGmUid);

        const players = await waitFor<PlayerSeat[]>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          (seats) =>
            seats.find((p) => p.uid === newGmUid)?.role === 'gm' &&
            seats.find((p) => p.uid === oldGmUid)?.role === 'player',
        );
        expect(players.find((p) => p.uid === oldGmUid)?.role).toBe('player');
        expect(players.find((p) => p.uid === newGmUid)?.role).toBe('gm');
      });
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

      it('moveTokens batch-moves several tokens in one call, preserving each token\'s other fields (Master Plan v2, R8.4)', async () => {
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

    describe('cellular map model', () => {
      it('commits floor + fog chunks and resets fog', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.commitFloorChunks(roomId, [{ id: '0_0', bits: [1, 0, 0, 0, 0, 0, 0, 0] }]);
        await waitFor<FloorChunk[]>(
          (cb) => clientA.subscribeFloorChunks(roomId, cb),
          (chunks) => chunks.length === 1,
        );

        await clientA.commitFogChunks(roomId, [{ id: '0_0', bits: [1, 0, 0, 0, 0, 0, 0, 0] }]);
        await waitFor<FogChunk[]>(
          (cb) => clientA.subscribeFogChunks(roomId, cb),
          (chunks) => chunks.length === 1,
        );

        await clientA.resetFog(roomId);
        await waitFor<FogChunk[]>(
          (cb) => clientA.subscribeFogChunks(roomId, cb),
          (chunks) => chunks.length === 0,
        );
      });

      it('sets and removes a wall/door without disturbing the room doc', async () => {
        const roomId = await createTestRoom(clientA);
        const wall: Omit<MapWall, 'id'> = {
          x: 0,
          y: 0,
          side: 'N',
          door: { state: 'closed', secret: false },
        };
        const wallId = await clientA.setWall(roomId, wall);
        await waitFor<MapWall[]>(
          (cb) => clientA.subscribeWalls(roomId, cb),
          (walls) => walls.length === 1,
        );

        await clientA.removeWall(roomId, wallId);
        await waitFor<MapWall[]>(
          (cb) => clientA.subscribeWalls(roomId, cb),
          (walls) => walls.length === 0,
        );
      });

      it('places and removes a symbol', async () => {
        const roomId = await createTestRoom(clientA);
        const symbolId = await clientA.placeSymbol(roomId, {
          cell: { x: 2, y: 2 },
          kind: 'chest',
          rotation: 0,
        });
        await waitFor<MapSymbol[]>(
          (cb) => clientA.subscribeSymbols(roomId, cb),
          (symbols) => symbols.length === 1,
        );

        await clientA.removeSymbol(roomId, symbolId);
        await waitFor<MapSymbol[]>(
          (cb) => clientA.subscribeSymbols(roomId, cb),
          (symbols) => symbols.length === 0,
        );
      });

      it('upserts and removes a keyed map room', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.upsertMapRoom(roomId, {
          id: 'mr-1',
          key: '1',
          name: 'Entry Hall',
          bbox: { x: 0, y: 0, w: 5, h: 5 },
          labelAnchor: { x: 2, y: 2 },
          wallStyle: 'masonry',
        });
        await waitFor<MapRoom[]>(
          (cb) => clientA.subscribeMapRooms(roomId, cb),
          (rooms) => rooms.length === 1,
        );

        await clientA.removeMapRoom(roomId, 'mr-1');
        await waitFor<MapRoom[]>(
          (cb) => clientA.subscribeMapRooms(roomId, cb),
          (rooms) => rooms.length === 0,
        );
      });

      it('sets the fog mode without disturbing other room fields', async () => {
        const roomId = await createTestRoom(clientA, 'Fog Room');
        await clientA.setFogMode(roomId, 'dynamic');
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.fog.mode === 'dynamic',
        );
        expect(room?.name).toBe('Fog Room');
      });

      it('batch-sets and batch-removes a wall drag-run in one call each (Master Plan v2, R9.2)', async () => {
        const roomId = await createTestRoom(clientA);
        const run: MapWall[] = [
          { id: '1,1,N', x: 1, y: 1, side: 'N' },
          { id: '2,1,N', x: 2, y: 1, side: 'N' },
          { id: '3,1,N', x: 3, y: 1, side: 'N' },
        ];
        await clientA.setWalls(roomId, run);
        await waitFor<MapWall[]>(
          (cb) => clientA.subscribeWalls(roomId, cb),
          (walls) => walls.length === 3,
        );

        await clientA.removeWalls(
          roomId,
          run.map((w) => w.id),
        );
        await waitFor<MapWall[]>(
          (cb) => clientA.subscribeWalls(roomId, cb),
          (walls) => walls.length === 0,
        );
      });

      it('adds and removes a diagonal vector wall carrying visible/style (Master Plan v2, R9.2)', async () => {
        const roomId = await createTestRoom(clientA);
        const id = await clientA.addSightWall(roomId, {
          ax: 0,
          ay: 0,
          bx: 70,
          by: 70,
          visible: true,
          style: 'natural',
        });
        const walls = await waitFor<SightWall[]>(
          (cb) => clientA.subscribeSightWalls(roomId, cb),
          (items) => items.length === 1,
        );
        expect(walls[0]?.visible).toBe(true);
        expect(walls[0]?.style).toBe('natural');

        await clientA.removeSightWall(roomId, id);
        await waitFor<SightWall[]>(
          (cb) => clientA.subscribeSightWalls(roomId, cb),
          (items) => items.length === 0,
        );
      });

      it('sets the measurement settings without disturbing the room doc or theme (Master Plan v2, R9.3)', async () => {
        const roomId = await createTestRoom(clientA, 'Measured Room');
        await clientA.setMeasurement(roomId, { perSquare: 3, unit: 'meters' });
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.measure.unit === 'meters',
        );
        expect(room?.settings.measure.perSquare).toBe(3);
        expect(room?.settings.theme).toBe('parchment-dark');
        expect(room?.name).toBe('Measured Room');
      });

      it('toggles the half-grid subdivision without disturbing other settings (Master Plan v2, R9.6)', async () => {
        const roomId = await createTestRoom(clientA, 'Subdivided Room');
        await clientA.setGridSubdivide(roomId, true);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.grid.subdivide === true,
        );
        expect(room?.settings.grid.subdivide).toBe(true);
        expect(room?.settings.theme).toBe('parchment-dark');
        expect(room?.settings.measure.unit).toBe('feet');
      });
    });

    describe('imported vision geometry (.uvtt)', () => {
      it('a fresh import supersedes the previous one rather than accumulating', async () => {
        const roomId = await createTestRoom(clientA);
        const wallA: Omit<SightWall, 'id'> = { ax: 0, ay: 0, bx: 10, by: 0 };
        await clientA.importUvtt(roomId, { walls: [wallA], lights: [{ x: 5, y: 5, range: 100 }] });
        await waitFor<SightWall[]>(
          (cb) => clientA.subscribeSightWalls(roomId, cb),
          (walls) => walls.length === 1,
        );

        const wallB: Omit<SightWall, 'id'> = { ax: 1, ay: 1, bx: 20, by: 1 };
        await clientA.importUvtt(roomId, { walls: [wallB], lights: [] });
        const walls = await waitFor<SightWall[]>(
          (cb) => clientA.subscribeSightWalls(roomId, cb),
          (items) => items.length === 1 && items[0]?.ax === 1,
        );
        expect(walls).toHaveLength(1);
        const lights = await waitFor<MapLight[]>(
          (cb) => clientA.subscribeLights(roomId, cb),
          (items) => items.length === 0,
        );
        expect(lights).toHaveLength(0);
      });
    });

    describe('annotate overlay (drawings)', () => {
      it('writes and deletes a freehand drawing', async () => {
        const roomId = await createTestRoom(clientA);
        const drawingId = await clientA.writeDrawing(roomId, {
          layer: 'mapping',
          kind: 'freehand',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          style: { color: 'red' },
        });
        await waitFor<Drawing[]>(
          (cb) => clientA.subscribeDrawings(roomId, cb),
          (drawings) => drawings.length === 1,
        );

        await clientA.deleteDrawing(roomId, drawingId);
        await waitFor<Drawing[]>(
          (cb) => clientA.subscribeDrawings(roomId, cb),
          (drawings) => drawings.length === 0,
        );
      });
    });

    describe('profiles', () => {
      it('setProfileValue deep-merges into `values`, leaving sibling fields alone', async () => {
        const roomId = await createTestRoom(clientA);
        const seatId = clientA.currentUid()!;
        await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
        await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (profiles) => profiles.find((p) => p.seatId === seatId)?.values['name'] === 'Bram',
        );

        await clientA.setProfileValue(roomId, seatId, 'torches', 3);
        const profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.values['torches'] === 3,
        );
        const profile = profiles.find((p) => p.seatId === seatId)!;
        expect(profile.values['name']).toBe('Bram'); // untouched by the second write
      });

      it('updateProfileTemplate updates the room-level template', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.updateProfileTemplate(roomId, [{ id: 'hp', label: 'HP', type: 'counter' }]);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => (r?.profileTemplate.length ?? 0) > 0,
        );
        expect(room?.profileTemplate[0]?.id).toBe('hp');
      });

      it('setProfilePortrait sets and clears the portrait ref, leaving `values` alone ("My token", Master Plan v2, R7.3)', async () => {
        const roomId = await createTestRoom(clientA);
        const seatId = clientA.currentUid()!;
        await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
        await clientA.setProfilePortrait(roomId, seatId, 'gen:disc:A:hsl(10, 65%, 45%)');
        let profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.portraitRef !== undefined,
        );
        let profile = profiles.find((p) => p.seatId === seatId)!;
        expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
        expect(profile.values['name']).toBe('Bram');

        await clientA.setProfilePortrait(roomId, seatId, undefined);
        profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.portraitRef === undefined,
        );
        profile = profiles.find((p) => p.seatId === seatId)!;
        expect(profile.portraitRef).toBeUndefined();
        expect(profile.values['name']).toBe('Bram');
      });
    });

    describe('log + rolls', () => {
      it('delivers log entries ordered by timestamp regardless of write order', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await clientA.writeLog(roomId, { ts: 200, authorUid: uid, type: 'chat', text: 'second' });
        await clientA.writeLog(roomId, { ts: 100, authorUid: uid, type: 'chat', text: 'first' });

        const entries = await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (items) => items.length === 2,
        );
        expect(entries.map((e) => e.text)).toEqual(['first', 'second']);
      });

      it('caps the live subscription at LIVE_LOG_LIMIT and pages older entries across the boundary', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;

        // A handful more than the live cap, so paging must cross the boundary
        // (Gate 7 — "'load older' pages correctly across the 200 boundary").
        const overflow = 5;
        const total = LIVE_LOG_LIMIT + overflow;
        // Contiguous ascending `ts` (1..total) so the boundary is unambiguous.
        await Promise.all(
          Array.from({ length: total }, (_, i) =>
            clientA.writeLog(roomId, {
              ts: i + 1,
              authorUid: uid,
              type: 'chat',
              text: `entry ${i + 1}`,
            }),
          ),
        );

        // The live subscription delivers only the newest LIVE_LOG_LIMIT,
        // oldest-first — so ts runs (overflow+1)..total.
        const live = await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (items) => items.length === LIVE_LOG_LIMIT,
        );
        expect(live[0]!.ts).toBe(overflow + 1);
        expect(live[live.length - 1]!.ts).toBe(total);

        // Paging back from the oldest loaded ts returns the entries that fell
        // off the live edge, oldest-first, and stops exactly at the boundary.
        const older = await clientA.listLogBefore(roomId, live[0]!.ts, LIVE_LOG_LIMIT);
        expect(older.map((e) => e.ts)).toEqual(Array.from({ length: overflow }, (_, i) => i + 1));

        // Paging past the very first entry yields nothing (clean history end).
        const none = await clientA.listLogBefore(roomId, older[0]!.ts, LIVE_LOG_LIMIT);
        expect(none).toEqual([]);
      });

      it('listLogBefore returns at most `limit` entries, the newest of the older-than set', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await Promise.all(
          [10, 20, 30, 40, 50].map((ts) =>
            clientA.writeLog(roomId, { ts, authorUid: uid, type: 'chat', text: `t${ts}` }),
          ),
        );
        await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (items) => items.length === 5,
        );

        // Older than 50, at most 2 → the two immediately below (30, 40),
        // oldest-first.
        const page = await clientA.listLogBefore(roomId, 50, 2);
        expect(page.map((e) => e.ts)).toEqual([30, 40]);
      });

      it('delivers rolls ordered by timestamp', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        const rollBody = (ts: number, seed: string) => ({
          ts,
          authorUid: uid,
          seed,
          dice: [{ die: 'd6', sides: 6, kept: 4 }],
          modifier: 0,
          advantage: 'normal' as const,
          mode: 'summed' as const,
          total: 4,
        });
        await clientA.writeRoll(roomId, rollBody(200, 'later'));
        await clientA.writeRoll(roomId, rollBody(100, 'earlier'));

        const rolls = await waitFor<Roll[]>(
          (cb) => clientA.subscribeRolls(roomId, cb),
          (items) => items.length === 2,
        );
        expect(rolls.map((r) => r.seed)).toEqual(['earlier', 'later']);
      });
    });

    describe('shared rolls (Master Plan v2, R3.6)', () => {
      it('opens, own-slot stages, cleanly skips an unready seat, and resolves deterministic parts', async () => {
        const roomId = await createTestRoom(clientA);
        const gmUid = clientA.currentUid()!;
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const playerUid = clientB.currentUid()!;

        const initial = await waitFor<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          () => true,
        );
        expect(initial).toBeNull();

        await clientA.openSharedRoll(roomId, { openedBy: gmUid, label: 'Initiative' });
        let sharedRoll = await waitFor<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          (sr) => sr?.status === 'staging',
        );
        expect(sharedRoll?.label).toBe('Initiative');
        expect(sharedRoll?.openedBy).toBe(gmUid);
        expect(sharedRoll?.slots ?? {}).toEqual({});

        // Player B stages and readies their own slot.
        await clientB.stageSharedSlot(roomId, playerUid, {
          die: 'd20',
          modifier: 2,
          advantage: 'normal',
          ready: true,
        });
        // A third seat stages but never flips ready — must be cleanly
        // skipped, not rolled with a placeholder (Gate 4b).
        await clientA.stageSharedSlot(roomId, 'never-ready-seat', {
          die: 'd6',
          modifier: 0,
          advantage: 'normal',
          ready: false,
        });

        sharedRoll = await waitFor<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          (sr) => Object.keys(sr?.slots ?? {}).length === 2,
        );
        expect(sharedRoll?.slots[playerUid]?.ready).toBe(true);
        expect(sharedRoll?.slots['never-ready-seat']?.ready).toBe(false);

        const roll = await clientA.resolveSharedRoll(roomId, gmUid);
        expect(roll.label).toBe('Initiative');
        expect(roll.parts).toHaveLength(1);
        expect(roll.parts?.[0]?.seatId).toBe(playerUid);
        expect(roll.parts?.[0]?.modifier).toBe(2);

        const resolved = await waitFor<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          (sr) => sr?.status === 'resolved',
        );
        expect(resolved).not.toBeNull();

        const rolls = await waitFor<Roll[]>(
          (cb) => clientA.subscribeRolls(roomId, cb),
          (items) => items.some((r) => r.id === roll.id),
        );
        expect(rolls.find((r) => r.id === roll.id)?.parts).toHaveLength(1);
      });

      it('re-deriving a resolved parts roll from its own seed (as a fresh client would) matches exactly', async () => {
        const roomId = await createTestRoom(clientA);
        const gmUid = clientA.currentUid()!;
        const slots = {
          'seat-x': { die: 'd8', modifier: 1, advantage: 'normal' as const, ready: true },
          'seat-y': { die: 'd12', modifier: -1, advantage: 'advantage' as const, ready: true },
        };

        await clientA.openSharedRoll(roomId, { openedBy: gmUid });
        await clientA.stageSharedSlot(roomId, 'seat-x', slots['seat-x']);
        await clientA.stageSharedSlot(roomId, 'seat-y', slots['seat-y']);
        await waitFor<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          (sr) => Object.keys(sr?.slots ?? {}).length === 2,
        );

        const roll = await clientA.resolveSharedRoll(roomId, gmUid);

        // A third client never touches the store's expansion at all — it
        // only ever sees the written `Roll` doc's `seed` plus the slots it
        // watched staged live, and recomputes independently.
        const rederived = expandSharedRollSlots(roll.seed, slots);
        expect(roll.parts).toEqual(rederived);
      });
    });

    describe('dice macros', () => {
      it('saves and deletes a macro', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        const macroId = await clientA.saveMacro(roomId, {
          ownerUid: uid,
          name: 'Fireball',
          dice: ['d6', 'd6'],
          modifier: 0,
          mode: 'summed',
          advantage: 'normal',
        });
        await waitFor<DiceMacro[]>(
          (cb) => clientA.subscribeMacros(roomId, cb),
          (macros) => macros.length === 1,
        );

        await clientA.deleteMacro(roomId, macroId);
        await waitFor<DiceMacro[]>(
          (cb) => clientA.subscribeMacros(roomId, cb),
          (macros) => macros.length === 0,
        );
      });
    });

    describe('random tables', () => {
      it('upserts and deletes a table', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.upsertTable(roomId, {
          id: 'wandering',
          name: 'Wandering Monsters',
          rows: ['a goblin', 'a rat swarm'],
        });
        await waitFor<RandomTable[]>(
          (cb) => clientA.subscribeTables(roomId, cb),
          (tables) => tables.length === 1,
        );

        await clientA.deleteTable(roomId, 'wandering');
        await waitFor<RandomTable[]>(
          (cb) => clientA.subscribeTables(roomId, cb),
          (tables) => tables.length === 0,
        );
      });
    });

    describe('Assets activity — saved URL refs (Master Plan v2, R7.2)', () => {
      it('saves and deletes an asset ref, and a second client sees it too (reusable across clients)', async () => {
        const roomId = await createTestRoom(clientA);
        await clientB.joinRoom(roomId, 'Bram');
        const refId = await clientA.saveAssetRef(roomId, {
          ref: 'https://example.com/goblin.png',
          label: 'Goblin art',
          addedBy: clientA.currentUid()!,
          ts: Date.now(),
        });

        const seenByB = await waitFor<AssetRef[]>(
          (cb) => clientB.subscribeAssetRefs(roomId, cb),
          (items) => items.length === 1,
        );
        expect(seenByB[0]?.ref).toBe('https://example.com/goblin.png');
        expect(seenByB[0]?.label).toBe('Goblin art');

        await clientA.deleteAssetRef(roomId, refId);
        await waitFor<AssetRef[]>(
          (cb) => clientA.subscribeAssetRefs(roomId, cb),
          (items) => items.length === 0,
        );
      });
    });

    describe('Blind Drawer', () => {
      it('stays out of the log until revealed, then copies text in and flips revealed', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        const drawId = await clientA.writeBlindDraw(roomId, {
          kind: 'blindDraw',
          ts: Date.now(),
          authorUid: uid,
          title: 'Wandering check',
          text: 'A bugbear ambush',
          revealed: false,
        });

        const draws = await waitFor<BlindDraw[]>(
          (cb) => clientA.subscribeBlindDraws(roomId, cb),
          (items) => items.length === 1,
        );
        expect(draws[0]?.revealed).toBe(false);

        const logBefore = await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          () => true,
        );
        expect(logBefore).toHaveLength(0);

        const draw = draws[0] as BlindDraw & { id: string };
        await clientA.revealBlindDraw(roomId, { ...draw, id: drawId });

        await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (entries) => entries.some((e) => e.text.includes('A bugbear ambush')),
        );
        await waitFor<BlindDraw[]>(
          (cb) => clientA.subscribeBlindDraws(roomId, cb),
          (items) => items.find((d) => d.id === drawId)?.revealed === true,
        );
      });
    });

    describe('handouts', () => {
      it('saves unrevealed, reveals onto the room pointer, then hides again', async () => {
        const roomId = await createTestRoom(clientA);
        const handoutId = await clientA.saveHandout(roomId, {
          ts: Date.now(),
          title: 'The Vault Door',
          ref: 'maps/vault.svg',
        });

        const library = await waitFor<HandoutRecord[]>(
          (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
          (items) => items.length === 1,
        );
        expect(library[0]?.revealed).toBe(false);
        expect(library[0]?.kind).toBe('handout');

        const handout = library[0] as HandoutRecord & { id: string };
        await clientA.revealHandout(roomId, { ...handout, id: handoutId });

        const revealedRoom = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (room) => room?.handout?.ref === 'maps/vault.svg',
        );
        expect(revealedRoom?.handout?.title).toBe('The Vault Door');
        await waitFor<HandoutRecord[]>(
          (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
          (items) => items.find((h) => h.id === handoutId)?.revealed === true,
        );

        await clientA.hideHandout(roomId);
        await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (room) => room?.handout === null,
        );
      });
    });

    describe('.vttcamp portability', () => {
      it('round-trips a room through export -> import with a fresh id and the importer as gmUid', async () => {
        const roomId = await createTestRoom(clientA, 'Original Room');
        await clientA.createToken(roomId, {
          pos: { x: 1, y: 2 },
          size: 1,
          layer: 'tokens',
          imageRef: 'tokens/goblin.png',
        });
        await clientA.createGroup(roomId, {
          name: 'Party',
          memberTokenIds: [],
          showMap: true,
          showBoard: true,
          active: true,
        });
        const uid = clientA.currentUid()!;
        await clientA.writeLog(roomId, {
          ts: 1,
          authorUid: uid,
          type: 'chat',
          text: 'hello table',
        });
        await clientA.mergeYUpdate(roomId, 'notes', notesUpdate('Room 1: trapped'));

        const snapshot = await clientA.exportRoom(roomId);
        expect(snapshot.collections['tokens']).toHaveLength(1);
        expect(snapshot.collections['groups']).toHaveLength(1);
        expect(snapshot.yjs['notes']).toBeTruthy();

        const importedRoomId = await clientB.importRoom(snapshot);
        expect(importedRoomId).not.toBe(roomId);

        const importedRoom = await clientB.getRoom(importedRoomId);
        expect(importedRoom?.name).toBe('Original Room');
        expect(importedRoom?.gmUid).toBe(clientB.currentUid()); // forced to the importer

        const tokens = await waitFor<Token[]>(
          (cb) => clientB.subscribeTokens(importedRoomId, cb),
          (items) => items.length === 1,
        );
        expect(tokens[0]?.imageRef).toBe('tokens/goblin.png');

        const groups = await waitFor<Group[]>(
          (cb) => clientB.subscribeGroups(importedRoomId, cb),
          (items) => items.length === 1,
        );
        expect(groups[0]?.name).toBe('Party');

        const notesState = await clientB.getYState(importedRoomId, 'notes');
        expect(notesState).not.toBeNull();
        const doc = new Y.Doc();
        Y.applyUpdate(doc, notesState!);
        expect(doc.getText('notes').toString()).toBe('Room 1: trapped');
      });

      it('upgrades an older schema room doc on import (Gate 5)', async () => {
        const roomId = await createTestRoom(clientA, 'Legacy Room');
        const snapshot = await clientA.exportRoom(roomId);
        // Roll the exported room doc back to a pre-migration (v1) shape —
        // simulates an export made before `grid`/`fog`/`handout` existed.
        const legacyRoom = { ...snapshot.room, schemaVersion: 1 };
        delete (legacyRoom as Record<string, unknown>)['grid'];
        delete (legacyRoom as Record<string, unknown>)['fog'];
        delete (legacyRoom as Record<string, unknown>)['handout'];

        const importedRoomId = await clientB.importRoom({ ...snapshot, room: legacyRoom });
        const migrated = await clientB.getRoom(importedRoomId);
        expect(migrated?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(migrated?.grid).toBeDefined();
        expect(migrated?.fog.mode).toBe('emergent');
        expect(migrated?.handout).toBeNull();
      });
    });

    describe('Yjs transport (concurrent Notes)', () => {
      it('merges concurrent updates from independent clients with no stomp', async () => {
        const roomId = await createTestRoom(clientA);
        const base = new Y.Doc();
        base.getText('notes').insert(0, 'Room 3: ');
        await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(base));

        const baseState = await waitFor<Uint8Array | null>(
          (cb) => clientB.subscribeYState(roomId, 'notes', cb),
          (state) => state !== null,
        );
        const docA = new Y.Doc();
        Y.applyUpdate(docA, baseState!);
        docA.getText('notes').insert(8, 'trapped');

        const docB = new Y.Doc();
        Y.applyUpdate(docB, baseState!);
        docB.getText('notes').insert(8, 'empty, ');

        await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docA));
        await clientB.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docB));

        const converged = await waitFor<Uint8Array | null>(
          (cb) => clientA.subscribeYState(roomId, 'notes', cb),
          (state) => {
            if (!state) return false;
            const doc = new Y.Doc();
            Y.applyUpdate(doc, state);
            const text = doc.getText('notes').toString();
            return text.includes('trapped') && text.includes('empty');
          },
        );
        const doc = new Y.Doc();
        Y.applyUpdate(doc, converged!);
        // Two concurrent inserts at the same position resolve by clientID,
        // not content, so which one lands first isn't fixed (see the same
        // caveat in yjs-merge.test.ts) — assert no data loss, not an exact
        // concatenation order.
        const text = doc.getText('notes').toString();
        expect(text).toContain('Room 3: ');
        expect(text).toContain('trapped');
        expect(text).toContain('empty, ');
      });
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

      it('publishes a ping visible to other clients', async () => {
        const roomId = await createTestRoom(clientA);
        clientA.publishPing(roomId, { x: 7, y: 8 });
        const pings = await waitFor<PingPos[]>(
          (cb) => clientB.subscribePings(roomId, cb),
          (items) => items.length > 0,
        );
        expect(pings[0]).toMatchObject({ x: 7, y: 8 });
      });

      it('publishes, observes, and clears an in-progress map draft (carve/fill preview)', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        clientA.publishMapDraft(roomId, {
          uid,
          tool: 'carve',
          cells: [{ x: 0, y: 0 }],
          ts: Date.now(),
        });
        await waitFor<MapDraft[]>(
          (cb) => clientA.subscribeMapDraft(roomId, cb),
          (drafts) => drafts.length === 1,
        );

        clientA.clearMapDraft(roomId, uid);
        await waitFor<MapDraft[]>(
          (cb) => clientA.subscribeMapDraft(roomId, cb),
          (drafts) => drafts.length === 0,
        );
      });
    });
  });
}

function notesUpdate(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText('notes').insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}
