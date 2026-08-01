import { beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { expandSharedRollSlots } from '../dice/engine.js';
import type {
  AssetRef,
  BlindDraw,
  DiceMacro,
  Drawing,
  Encounter,
  GameMap,
  Group,
  HandoutRecord,
  LogEntry,
  MapRoom,
  MapSymbol,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  RandomTable,
  Roll,
  RollConvention,
  Room,
  SharedRoll,
  Token,
} from '../types.js';
import { CURRENT_SCHEMA_VERSION, DEFAULT_ROLL_CONVENTIONS } from '../types.js';
import type {
  CampaignStore,
  CursorPos,
  DragFrame,
  PingPos,
  PresenceEntry,
  StoredVectorWall,
  Unsubscribe,
  VectorDoor,
  VectorFloorRegion,
  VectorMapDraft,
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
 * timeout is generous specifically for the latter. 30s (well inside the 60s
 * vitest testTimeout) tolerates emulator-propagation spikes under CI runner
 * load, which flaked the FirebaseStore contract tests at the old 10s. */
async function waitFor<T>(
  subscribe: (cb: (value: T) => void) => Unsubscribe,
  predicate: (value: T) => boolean,
  timeoutMs = 30_000,
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

/** A freshly created room's active `GameMap` id (Master Plan v2, R17.3) —
 * `createRoom` always seeds one inline, so this never has to wait. */
async function activeMapId(store: CampaignStore, roomId: string): Promise<string> {
  const room = await store.getRoom(roomId);
  if (!room?.activeMapId) throw new Error(`activeMapId: room ${roomId} has no active map`);
  return room.activeMapId;
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

      it('setTheme updates settings.theme without disturbing sibling room fields (Master Plan v2, R4)', async () => {
        const roomId = await createTestRoom(clientA, 'Keep My Name');
        await clientA.setTheme(roomId, 'keyed-blue');
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.theme === 'keyed-blue',
        );
        expect(room?.name).toBe('Keep My Name');
      });

      it('a freshly created room has an activeMapId whose map seeds the starter map as its background (R15/WI-19, R17.3)', async () => {
        const roomId = await createTestRoom(clientA);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r != null,
        );
        expect(room?.activeMapId).toBeTruthy();
        const map = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, room!.activeMapId!, cb),
          (m) => m != null,
        );
        expect(map?.background).toEqual({ ref: 'maps/starter-room.svg' });
      });

      it('setMapBackground points the map at an asset ref; removeMapBackground clears it to null (R15/WI-19, R17.3)', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await clientA.setMapBackground(roomId, mapId, 'https://example.com/cavern.png');
        const changed = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) =>
            !!m?.background &&
            'ref' in m.background &&
            m.background.ref === 'https://example.com/cavern.png',
        );
        expect(changed?.background).toEqual({ ref: 'https://example.com/cavern.png' });

        await clientA.removeMapBackground(roomId, mapId);
        const cleared = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => m?.background === null,
        );
        expect(cleared?.background).toBeNull();
      });

      it('setMapBackgroundColor fills the stage with a solid color instead of an image (in addition to, not instead of, image support)', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await clientA.setMapBackgroundColor(roomId, mapId, '#5582CA');
        const changed = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => !!m?.background && 'color' in m.background,
        );
        expect(changed?.background).toEqual({ color: '#5582CA' });

        // Setting an image ref afterward still works — the two are mutually
        // exclusive per map, not a one-way switch.
        await clientA.setMapBackground(roomId, mapId, 'https://example.com/cavern.png');
        const switchedBack = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => !!m?.background && 'ref' in m.background,
        );
        expect(switchedBack?.background).toEqual({ ref: 'https://example.com/cavern.png' });

        await clientA.removeMapBackground(roomId, mapId);
        const cleared = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => m?.background === null,
        );
        expect(cleared?.background).toBeNull();
      });

      it('setMapGridDimensions updates grid w/h/cellSize (Master Plan v2, R4, R17.3)', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await clientA.setMapGridDimensions(roomId, mapId, { w: 96, h: 48, cellSize: 50 });
        const map = await waitFor<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => m?.grid.w === 96,
        );
        expect(map?.grid).toEqual({ w: 96, h: 48, cellSize: 50 });
      });

      it('setInitiativeConfig updates mode + die without disturbing settings.theme', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.setTheme(roomId, 'keyed-blue');
        await clientA.setInitiativeConfig(roomId, {
          initiativeMode: 'individual',
          initiativeDie: 'd20',
        });
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.initiativeMode === 'individual',
        );
        expect(room?.settings.initiativeDie).toBe('d20');
        // The Firebase impl writes dotted paths precisely so this sibling
        // survives; the memory impl spreads. Both must agree.
        expect(room?.settings.theme).toBe('keyed-blue');
      });

      it('setDefaultPlayerGroup updates the group ownership default, leaving siblings alone', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.setTheme(roomId, 'keyed-blue');
        // A fresh room drops joiners into whatever group sorts first.
        const seeded = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r != null,
        );
        expect(seeded?.settings.defaultPlayerGroup).toBe('first');

        await clientA.setDefaultPlayerGroup(roomId, 'unassigned');
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.defaultPlayerGroup === 'unassigned',
        );
        expect(room?.settings.theme).toBe('keyed-blue');
        expect(room?.settings.initiativeDie).toBe('d6');

        // A literal groupId is just as legal as the two sentinels; a value that
        // stops resolving is `resolveDefaultGroupId`'s problem, not the store's.
        await clientA.setDefaultPlayerGroup(roomId, 'group-abc');
        const named = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.settings.defaultPlayerGroup === 'group-abc',
        );
        expect(named?.settings.defaultPlayerGroup).toBe('group-abc');
      });

      it('a freshly created room seeds the default roll conventions, scoped to d6', async () => {
        const roomId = await createTestRoom(clientA);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r != null,
        );
        expect(room?.rollConventions).toEqual(DEFAULT_ROLL_CONVENTIONS);
        // The scoping is the bug fix: the historical bands only ever described
        // a d6, but were being applied to every die size.
        expect(room?.rollConventions?.[0]?.applies).toEqual({ mode: 'separate', sides: 6 });
      });

      it('setRollConventions round-trips referee-authored bands, and [] turns classification off', async () => {
        const roomId = await createTestRoom(clientA);
        const custom: RollConvention[] = [
          {
            id: 'attack',
            label: 'Attack roll',
            applies: { mode: 'summed', sides: 20 },
            bands: [
              { min: 20, class: 'success', label: 'Critical' },
              { min: 11, max: 19, class: 'success', label: 'Hit' },
              { max: 10, class: 'failure', label: 'Miss' },
            ],
          },
        ];
        await clientA.setRollConventions(roomId, custom);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.rollConventions?.[0]?.id === 'attack',
        );
        expect(room?.rollConventions).toEqual(custom);

        await clientA.setRollConventions(roomId, []);
        const cleared = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => (r?.rollConventions?.length ?? -1) === 0,
        );
        expect(cleared?.rollConventions).toEqual([]);
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

      it('a joiner gets the room in their OWN My Rooms as a player', async () => {
        const roomId = await createTestRoom(clientA, 'Joinable Room');
        await clientB.joinRoom(roomId, 'A Player');
        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientB.subscribeMyRooms(cb),
          (rooms) => rooms.some((r) => r.roomId === roomId),
        );
        expect(mine.find((r) => r.roomId === roomId)?.role).toBe('player');
      });

      it("dismissRoomDormancy stamps the caller's own entry without touching the room (R25.2)", async () => {
        const roomId = await createTestRoom(clientA, 'Kept Room');
        await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.some((r) => r.roomId === roomId),
        );

        const until = Date.now() + 90 * 24 * 60 * 60 * 1000;
        await clientA.dismissRoomDormancy(roomId, until);

        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.find((r) => r.roomId === roomId)?.dormantDismissedUntil === until,
        );
        // The rest of the entry survives — this is a patch, not a rewrite.
        const entry = mine.find((r) => r.roomId === roomId)!;
        expect(entry.name).toBe('Kept Room');
        expect(entry.role).toBe('gm');
      });
    });

    describe('room activity clock (R25.1)', () => {
      it('a settled write stamps lastActivityAt, and a burst inside the window writes once', async () => {
        const roomId = await createTestRoom(clientA, 'Busy Room');
        const tokenId = await clientA.createToken(roomId, {
          pos: { x: 0, y: 0 },
          size: 1,
          layer: 'tokens',
          imageRef: 'gen:letter:A',
        });
        const stamped = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => (r?.lastActivityAt ?? 0) > 0,
        );
        const first = stamped!.lastActivityAt!;

        for (let i = 0; i < 5; i++) {
          await clientA.moveToken(roomId, tokenId, { x: i, y: i });
        }
        const after = await clientA.getRoom(roomId);
        expect(after?.lastActivityAt).toBe(first);
      });
    });

    describe('room deletion (Master Plan v2, R6.3)', () => {
      it('recursively clears every subcollection (session + every map), the room doc, and getRoom goes null', async () => {
        const roomId = await createTestRoom(clientA, 'Doomed Room');
        const mapId = await activeMapId(clientA, roomId);
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
        await clientA.commitFloorRegions(roomId, mapId, {
          put: [
            {
              id: 'r1',
              rings: [
                [
                  { x: 0, y: 0 },
                  { x: 4, y: 0 },
                  { x: 4, y: 4 },
                  { x: 0, y: 4 },
                ],
              ],
              bbox: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
            },
          ],
          delete: [],
        });
        await clientA.writeLog(roomId, { ts: 1, authorUid: uid, type: 'chat', text: 'doomed' });
        await waitFor<Token[]>(
          (cb) => clientA.subscribeTokens(roomId, cb),
          (t) => t.length === 1,
        );

        await clientA.deleteRoom(roomId);

        expect(await clientA.getRoom(roomId)).toBeNull();
        await waitFor<Token[]>(
          (cb) => clientA.subscribeTokens(roomId, cb),
          (t) => t.length === 0,
        );
        await waitFor<Group[]>(
          (cb) => clientA.subscribeGroups(roomId, cb),
          (g) => g.length === 0,
        );
        await waitFor<VectorFloorRegion[]>(
          (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
          (c) => c.length === 0,
        );
        await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (l) => l.length === 0,
        );
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

      it('setCurrentCharacter points a seat at another character, and clears back to its own', async () => {
        const roomId = await createTestRoom(clientA);
        await clientA.joinRoom(roomId, 'The Referee');
        await clientB.joinRoom(roomId, 'A Player');
        const playerUid = clientB.currentUid()!;

        // A fresh seat has no pointer at all — that absence reads as "my own
        // profile", so nothing needs seeding on join.
        const joined = await waitFor<PlayerSeat[]>(
          (cb) => clientB.subscribePlayers(roomId, cb),
          (seats) => seats.some((p) => p.uid === playerUid),
        );
        expect(joined.find((p) => p.uid === playerUid)?.currentCharacterSeatId).toBeUndefined();

        // The seat writes its own pointer — no referee involvement.
        await clientB.setCurrentCharacter(roomId, playerUid, 'seat-other');
        const pointed = await waitFor<PlayerSeat[]>(
          (cb) => clientB.subscribePlayers(roomId, cb),
          (seats) =>
            seats.find((p) => p.uid === playerUid)?.currentCharacterSeatId === 'seat-other',
        );
        expect(pointed.find((p) => p.uid === playerUid)?.displayName).toBe('A Player');

        await clientB.setCurrentCharacter(roomId, playerUid, undefined);
        const cleared = await waitFor<PlayerSeat[]>(
          (cb) => clientB.subscribePlayers(roomId, cb),
          (seats) => seats.find((p) => p.uid === playerUid)?.currentCharacterSeatId === undefined,
        );
        expect(cleared.find((p) => p.uid === playerUid)?.currentCharacterSeatId).toBeUndefined();
        // Clearing must remove the key, not blank the seat.
        expect(cleared.find((p) => p.uid === playerUid)?.role).toBe('player');
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

      it('updateEncounterTemplate updates the encounter template independently of the profile one', async () => {
        const roomId = await createTestRoom(clientA);
        // A fresh room starts with the default encounter fields (the former
        // hardcoded tension widgets) — replaced wholesale here.
        const seeded = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r !== null,
        );
        expect(seeded?.encounterTemplate.map((f) => f.id)).toEqual([
          'difficulty',
          'danger',
          'clock',
        ]);
        await clientA.updateProfileTemplate(roomId, [{ id: 'hp', label: 'HP', type: 'counter' }]);
        await clientA.updateEncounterTemplate(roomId, [
          { id: 'light', label: 'Light', type: 'counter', pinned: true },
        ]);
        const room = await waitFor<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.encounterTemplate[0]?.id === 'light',
        );
        expect(room?.encounterTemplate[0]?.id).toBe('light');
        expect(room?.encounterTemplate[0]?.pinned).toBe(true);
        // The two templates are separate arrays on the same doc.
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

      it('setProfileColor sets and clears the character color, leaving portrait/values alone (quick-sheet token split)', async () => {
        const roomId = await createTestRoom(clientA);
        const seatId = clientA.currentUid()!;
        await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
        await clientA.setProfilePortrait(roomId, seatId, 'gen:disc:A:hsl(10, 65%, 45%)');

        await clientA.setProfileColor(roomId, seatId, '#3366cc');
        let profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.color !== undefined,
        );
        let profile = profiles.find((p) => p.seatId === seatId)!;
        expect(profile.color).toBe('#3366cc');
        expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
        expect(profile.values['name']).toBe('Bram');

        await clientA.setProfileColor(roomId, seatId, undefined);
        profiles = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.color === undefined,
        );
        profile = profiles.find((p) => p.seatId === seatId)!;
        expect(profile.color).toBeUndefined();
        expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
        expect(profile.values['name']).toBe('Bram');
      });

      it('creates a readable profile when a color/portrait is the FIRST write for a seat', async () => {
        // Regression: picking a character color before ever filling in a sheet
        // field created a profile doc with no `values`, which
        // `ProfileInstanceSchema` requires — the converter then threw on read
        // and took down the entire `subscribeProfiles` snapshot for every
        // client in the room, so the color never appeared anywhere (dice
        // included). The tests above all wrote a value first and so never hit
        // it. Every assertion here is about a seat with NO prior profile doc.
        const roomId = await createTestRoom(clientA);
        const seatId = clientA.currentUid()!;

        await clientA.setProfileColor(roomId, seatId, '#c0392b');
        const afterColor = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.some((p) => p.seatId === seatId),
        );
        const colored = afterColor.find((p) => p.seatId === seatId)!;
        expect(colored.color).toBe('#c0392b');
        expect(colored.values).toEqual({});

        // Same for a portrait-first seat.
        const otherSeat = 'seat-portrait-first';
        await clientA.setProfilePortrait(roomId, otherSeat, 'gen:disc:B:hsl(200, 65%, 45%)');
        const afterPortrait = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.some((p) => p.seatId === otherSeat),
        );
        const portraited = afterPortrait.find((p) => p.seatId === otherSeat)!;
        expect(portraited.portraitRef).toBe('gen:disc:B:hsl(200, 65%, 45%)');
        expect(portraited.values).toEqual({});

        // ...and the seed must not clobber values written afterwards.
        await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
        await clientA.setProfileColor(roomId, seatId, '#27ae60');
        const settled = await waitFor<ProfileInstance[]>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          (items) => items.find((p) => p.seatId === seatId)?.color === '#27ae60',
        );
        expect(settled.find((p) => p.seatId === seatId)!.values['name']).toBe('Bram');
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
        // oldest-first — so ts runs (overflow+1)..total. This case fans out
        // LIVE_LOG_LIMIT+overflow (~205) parallel writes, which the Firestore
        // emulator can take well past the default 10s to fully process and
        // deliver back through the subscription on a loaded CI runner. Give
        // waitFor a generous ceiling (below the per-test timeout raised on the
        // `it` below) so this stops flaking but a genuine hang still reports
        // the clear "waitFor timed out" error rather than a bare test timeout.
        const live = await waitFor<LogEntry[]>(
          (cb) => clientA.subscribeLog(roomId, cb),
          (items) => items.length === LIVE_LOG_LIMIT,
          45_000,
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
        // Per-test ceiling raised above the default 30s testTimeout: the ~205
        // parallel writes + subscription delivery can exceed 30s on a loaded CI
        // runner (the observed flake), and this heavy boundary case is the one
        // test that needs the extra headroom.
      }, 60_000);

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

        const mapId = await activeMapId(clientA, roomId);
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

        const snapshot = await clientA.exportRoom(roomId);
        expect(snapshot.collections['tokens']).toHaveLength(1);
        expect(snapshot.collections['groups']).toHaveLength(1);
        expect(snapshot.yjs['notes']).toBeTruthy();
        expect(snapshot.maps).toHaveLength(1);
        expect(snapshot.maps[0]?.collections['walls']).toHaveLength(1);

        const importedRoomId = await clientB.importRoom(snapshot);
        expect(importedRoomId).not.toBe(roomId);

        const importedRoom = await clientB.getRoom(importedRoomId);
        expect(importedRoom?.name).toBe('Original Room');
        expect(importedRoom?.gmUid).toBe(clientB.currentUid()); // forced to the importer
        expect(importedRoom?.activeMapId).toBeTruthy();
        const importedWalls = await waitFor<StoredVectorWall[]>(
          (cb) => clientB.subscribeWalls(importedRoomId, importedRoom!.activeMapId!, cb),
          (walls) => walls.length === 1,
        );
        expect(importedWalls[0]?.a.x).toBe(0);

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

      it('upgrades an older schema room doc on import, and never leaves activeMapId unset (Gate 5, R17.3)', async () => {
        // Simulates a pre-v11 room-doc shape (predates grid/handout/
        // settings/maps — `activeMapId` doesn't exist yet) with no `maps` at
        // all. Real legacy `.vttcamp` archives never reach `importRoom` in
        // this shape — `vttcamp.ts`'s `archiveToSnapshot` already adopts their
        // flat map data into a synthetic map first (see `vttcamp.test.ts`);
        // this exercises `importRoom`'s own defensive fallback for a
        // hand-built snapshot that skips that step, which guarantees the
        // room doc still migrates and ends up with a valid (if empty)
        // `activeMapId` rather than none at all.
        const legacyRoom: Record<string, unknown> = {
          name: 'Legacy Room',
          gmUid: 'someone-else',
          schemaVersion: 1,
          difficultyDie: 'd6',
          dangerDie: 'd6',
          createdAt: 1500000000000,
          profileTemplate: [],
        };
        const importedRoomId = await clientB.importRoom({
          room: legacyRoom,
          collections: {},
          maps: [],
          encounter: null,
          yjs: {},
        });
        const migrated = await clientB.getRoom(importedRoomId);
        expect(migrated?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(migrated?.handout).toBeNull();
        expect(migrated?.activeMapId).toBeTruthy();

        const map = await waitFor<GameMap | null>(
          (cb) => clientB.subscribeMap(importedRoomId, migrated!.activeMapId!, cb),
          (m) => m !== null,
        );
        expect(map?.grid).toBeDefined();
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
  });
}

function notesUpdate(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText('notes').insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}
