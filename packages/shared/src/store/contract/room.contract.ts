import { beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type {
  GameMap,
  Group,
  LogEntry,
  MapBackground,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  Roll,
  RollConvention,
  Room,
  Token,
} from '../../types.js';
import { CURRENT_SCHEMA_VERSION, DEFAULT_ROLL_CONVENTIONS, STARTER_MAP_REF } from '../../types.js';
import { CHARACTER_COLOR_PALETTE } from '../asset-store.js';
import type { CampaignStore, StoredVectorWall, VectorFloorRegion } from '../campaign-store.js';
import {
  waitFor,
  createTestRoom,
  activeMapId,
  notesUpdate,
  type ContractContext,
} from './helpers.js';

/** `RoomStore` domain: rooms, seats, profiles, the log and `.vttcamp` portability. (SPEC-057 §5, DEC-117). */
export function defineRoomContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;
  const { seedLegacyMapBackground, seedUnlockedBackground } = ctx;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
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

    it('a freshly created room has an activeMapId whose map starts with no background (WI-073, R17.3)', async () => {
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
      expect(map?.background).toEqual(null);
    });

    it('addBackground places an image as its own document, transform and order write back independently, removeBackground drops it (SPEC-038 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const bgId = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/cavern.png',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        order: 0,
      });
      expect(bgId).toBeTruthy();
      const placed = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 1,
      );
      // A newly placed image is **unlocked**, and says so explicitly rather
      // than leaving the field absent (SPEC-039 §1, DEC-068): absence is
      // reserved as the pre-v27 marker the lock backfill keys off.
      expect(placed[0]).toEqual({
        id: bgId,
        ref: 'https://example.com/cavern.png',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        order: 0,
        locked: false,
      });

      // Move + resize in one settled write (RULE-003) — lattice units as
      // floats (RULE-006), so a fractional offset must survive.
      await clientA.setBackgroundTransform(roomId, mapId, bgId, { x: 2.5, y: -1, w: 20, h: 15 });
      const moved = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs[0]?.x === 2.5,
      );
      expect(moved[0]).toMatchObject({ x: 2.5, y: -1, w: 20, h: 15, order: 0 });
      expect(moved[0]?.ref).toBe('https://example.com/cavern.png');

      // Reorder is its own write and leaves the rect alone.
      await clientA.setBackgroundOrder(roomId, mapId, bgId, 3);
      const restacked = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs[0]?.order === 3,
      );
      expect(restacked[0]).toMatchObject({ x: 2.5, y: -1, w: 20, h: 15 });

      await clientA.removeBackground(roomId, mapId, bgId);
      const emptied = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 0,
      );
      expect(emptied).toEqual([]);
    });

    it('a write to a removed background resolves without effect and creates nothing (SPEC-059 §1, DEC-123)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const bgId = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/gone.png',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        order: 0,
      });
      await clientA.removeBackground(roomId, mapId, bgId);
      await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 0,
      );

      // The three patch methods all resolve, as a drag released after another
      // client removed the image would call them.
      await expect(
        clientA.setBackgroundTransform(roomId, mapId, bgId, { x: 1, y: 1, w: 2, h: 2 }),
      ).resolves.toBeUndefined();
      await expect(clientA.setBackgroundOrder(roomId, mapId, bgId, 5)).resolves.toBeUndefined();
      await expect(clientA.setBackgroundLocked(roomId, mapId, bgId, true)).resolves.toBeUndefined();

      // None of them resurrected the document. A later add is the barrier: a
      // snapshot that holds only it proves nothing earlier was created.
      const barrier = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/barrier.png',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        order: 0,
      });
      const after = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.some((b) => b.id === barrier),
      );
      expect(after.map((b) => b.id)).toEqual([barrier]);
    });

    it('a map carries several independently-placed backgrounds at once (SPEC-038 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const lower = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/floor.png',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        order: 0,
      });
      const upper = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/overlay.png',
        x: 4,
        y: 4,
        w: 6,
        h: 6,
        order: 1,
      });
      const both = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 2,
      );
      expect([...both].sort((a, b) => a.order - b.order).map((b) => b.id)).toEqual([lower, upper]);

      // Editing one leaves the other untouched — the point of a per-document
      // subcollection rather than an array field on the map doc (DEC-062).
      await clientA.setBackgroundTransform(roomId, mapId, upper, { x: 1, y: 1, w: 2, h: 2 });
      const edited = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.find((b) => b.id === upper)?.w === 2,
      );
      expect(edited.find((b) => b.id === lower)).toMatchObject({ x: 0, y: 0, w: 10, h: 10 });
    });

    it('background images and a background colour coexist (SPEC-038 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/cavern.png',
        x: 0,
        y: 0,
        w: 8,
        h: 8,
        order: 0,
      });
      await clientA.setMapBackgroundColor(roomId, mapId, '#5582CA');
      const map = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.background != null,
      );
      expect(map?.background).toEqual({ color: '#5582CA' });
      const images = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 1,
      );
      expect(images[0]?.ref).toBe('https://example.com/cavern.png');

      // Clearing the colour is not clearing the images.
      await clientA.removeMapBackground(roomId, mapId);
      const cleared = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.background === null,
      );
      expect(cleared?.background).toBeNull();
      const survivors = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 1,
      );
      expect(survivors[0]?.ref).toBe('https://example.com/cavern.png');
    });

    it('setBackgroundLocked pins a placed image and releases it again, leaving its rect alone (SPEC-039 §1, DEC-068, v27)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const bgId = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/cavern.png',
        x: 2.5,
        y: -1,
        w: 20,
        h: 15,
        order: 0,
      });

      await clientA.setBackgroundLocked(roomId, mapId, bgId, true);
      // The lock is on the document, not the viewer (SPEC-039 §1): a second
      // client must see the same one.
      const locked = await waitFor<MapBackground[]>(
        (cb) => clientB.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs[0]?.locked === true,
      );
      expect(locked[0]).toMatchObject({ locked: true, x: 2.5, y: -1, w: 20, h: 15, order: 0 });

      // Unlocking is the only override — so it has to work both ways.
      await clientA.setBackgroundLocked(roomId, mapId, bgId, false);
      const released = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs[0]?.locked === false,
      );
      expect(released[0]).toMatchObject({ locked: false, x: 2.5, y: -1, w: 20, h: 15 });
    });

    it('migrateMapBackgrounds locks every pre-v27 background, leaves stated locks alone, and is idempotent (SPEC-039 §1, DEC-069)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      // The shape the backfill exists for: a background written before
      // `locked` existed, so the field is absent rather than false.
      await seedUnlockedBackground(roomId, mapId, {
        id: 'bg-pre-v27',
        ref: 'https://example.com/floor.png',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        order: 0,
      });
      // …alongside one placed since, which already states its lock and must
      // NOT be pinned by the sweep.
      const fresh = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/overlay.png',
        x: 1,
        y: 1,
        w: 4,
        h: 3,
        order: 1,
      });

      await clientA.migrateMapBackgrounds(roomId);
      const migrated = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 2 && bgs.every((b) => typeof b.locked === 'boolean'),
      );
      expect(migrated.find((b) => b.id === 'bg-pre-v27')?.locked).toBe(true);
      expect(migrated.find((b) => b.id === fresh)?.locked).toBe(false);

      // Idempotent in the way that matters: a referee unlocks the migrated
      // image, and the next room-open must not pin it again.
      await clientA.setBackgroundLocked(roomId, mapId, 'bg-pre-v27', false);
      await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.find((b) => b.id === 'bg-pre-v27')?.locked === false,
      );
      await clientA.migrateMapBackgrounds(roomId);
      const still = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 2,
      );
      expect(still.find((b) => b.id === 'bg-pre-v27')?.locked).toBe(false);
    });

    it('migrateMapBackgrounds folds a pre-v23 map background into one full-grid document, and is idempotent (SPEC-038 §1, DEC-062)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      // Seed the legacy shape the fold exists for: an image ref on the map
      // doc itself, which no current store method can write any more.
      await seedLegacyMapBackground(roomId, mapId, STARTER_MAP_REF);

      await clientA.migrateMapBackgrounds(roomId);
      const folded = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        (bgs) => bgs.length === 1,
      );
      const map = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.background === null,
      );
      expect(map?.background).toBeNull();
      expect(folded[0]).toMatchObject({
        ref: STARTER_MAP_REF,
        x: 0,
        y: 0,
        w: map!.grid.w,
        h: map!.grid.h,
        order: 0,
        // An upgraded room must behave exactly as it did (SPEC-039 §4), and
        // this full-grid image would otherwise own every Select click on the
        // map — so the fold places it locked (DEC-069).
        locked: true,
      });

      // Idempotent: a second room-open must not fold the same map twice.
      await clientA.migrateMapBackgrounds(roomId);
      const still = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        () => true,
      );
      expect(still).toHaveLength(1);
    });

    it('setMapBackgroundColor fills the stage with a solid color, and swapping between colors is not a one-way switch', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      await clientA.setMapBackgroundColor(roomId, mapId, '#5582CA');
      const changed = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.background?.color === '#5582CA',
      );
      expect(changed?.background).toEqual({ color: '#5582CA' });

      await clientA.setMapBackgroundColor(roomId, mapId, '#101010');
      const recolored = await waitFor<GameMap | null>(
        (cb) => clientA.subscribeMap(roomId, mapId, cb),
        (m) => m?.background?.color === '#101010',
      );
      expect(recolored?.background).toEqual({ color: '#101010' });

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
        (profiles) => profiles.some((p) => p.actorId === playerUid),
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
      expect(profiles.some((p) => p.actorId === playerUid)).toBe(true);
    });

    it('removePlayer with deleteProfile also deletes the character sheet', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      await clientB.joinRoom(roomId, 'A Player');
      const playerUid = clientB.currentUid()!;
      await clientB.setProfileValue(roomId, playerUid, 'name', 'Bram');
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (profiles) => profiles.some((p) => p.actorId === playerUid),
      );

      await clientA.removePlayer(roomId, playerUid, { deleteProfile: true });
      await waitFor<PlayerSeat[]>(
        (cb) => clientA.subscribePlayers(roomId, cb),
        (seats) => seats.every((p) => p.uid !== playerUid),
      );
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (profiles) => profiles.every((p) => p.actorId !== playerUid),
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
        (seats) => seats.find((p) => p.uid === playerUid)?.currentCharacterSeatId === 'seat-other',
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

  describe('profiles', () => {
    it('setProfileValue deep-merges into `values`, leaving sibling fields alone', async () => {
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;
      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (profiles) => profiles.find((p) => p.actorId === seatId)?.values['name'] === 'Bram',
      );

      await clientA.setProfileValue(roomId, seatId, 'torches', 3);
      const profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.values['torches'] === 3,
      );
      const profile = profiles.find((p) => p.actorId === seatId)!;
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
      // A fresh room starts with the default encounter fields (Initiative
      // only, DEC-065) — replaced wholesale here.
      const seeded = await waitFor<Room | null>(
        (cb) => clientA.subscribeRoom(roomId, cb),
        (r) => r !== null,
      );
      expect(seeded?.encounterTemplate.map((f) => f.id)).toEqual(['initiative']);
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
        (items) => items.find((p) => p.actorId === seatId)?.portraitRef !== undefined,
      );
      let profile = profiles.find((p) => p.actorId === seatId)!;
      expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
      expect(profile.values['name']).toBe('Bram');

      await clientA.setProfilePortrait(roomId, seatId, undefined);
      profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.portraitRef === undefined,
      );
      profile = profiles.find((p) => p.actorId === seatId)!;
      expect(profile.portraitRef).toBeUndefined();
      expect(profile.values['name']).toBe('Bram');
    });

    it('setProfileColor sets the character color, leaving portrait/values alone (quick-sheet token split)', async () => {
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;
      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await clientA.setProfilePortrait(roomId, seatId, 'gen:disc:A:hsl(10, 65%, 45%)');

      await clientA.setProfileColor(roomId, seatId, '#3366cc');
      let profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.color === '#3366cc',
      );
      let profile = profiles.find((p) => p.actorId === seatId)!;
      expect(profile.color).toBe('#3366cc');
      expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
      expect(profile.values['name']).toBe('Bram');

      // There is no clearing overload any more (SPEC-031 §1): a second call
      // replaces the colour, it can never remove it. Repainting also leaves
      // the portrait and every sheet value exactly where they were.
      await clientA.setProfileColor(roomId, seatId, '#27ae60');
      profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.color === '#27ae60',
      );
      profile = profiles.find((p) => p.actorId === seatId)!;
      expect(profile.color).toBe('#27ae60');
      expect(profile.portraitRef).toBe('gen:disc:A:hsl(10, 65%, 45%)');
      expect(profile.values['name']).toBe('Bram');
    });

    it('joinRoom seeds a palette colour for a brand-new seat, and a re-join never repaints it (SPEC-031 §3)', async () => {
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;

      // The colour lands at join, before any quick sheet is ever opened.
      await clientA.joinRoom(roomId, 'Bram');
      const seeded = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.color !== undefined,
      );
      const assigned = seeded.find((p) => p.actorId === seatId)!.color!;
      expect(CHARACTER_COLOR_PALETTE).toContain(assigned);

      // A chosen colour survives a re-join — the seed is first-join-only and
      // additionally checks for an existing colour before writing.
      await clientA.setProfileColor(roomId, seatId, '#8e44ad');
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.color === '#8e44ad',
      );
      await clientA.joinRoom(roomId, 'Rejoined');
      const after = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId) !== undefined,
      );
      expect(after.find((p) => p.actorId === seatId)!.color).toBe('#8e44ad');
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
        (items) => items.some((p) => p.actorId === seatId),
      );
      const colored = afterColor.find((p) => p.actorId === seatId)!;
      expect(colored.color).toBe('#c0392b');
      expect(colored.values).toEqual({});

      // Same for a portrait-first seat.
      const otherSeat = 'seat-portrait-first';
      await clientA.setProfilePortrait(roomId, otherSeat, 'gen:disc:B:hsl(200, 65%, 45%)');
      const afterPortrait = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.some((p) => p.actorId === otherSeat),
      );
      const portraited = afterPortrait.find((p) => p.actorId === otherSeat)!;
      expect(portraited.portraitRef).toBe('gen:disc:B:hsl(200, 65%, 45%)');
      expect(portraited.values).toEqual({});

      // ...and the seed must not clobber values written afterwards.
      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await clientA.setProfileColor(roomId, seatId, '#27ae60');
      const settled = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === seatId)?.color === '#27ae60',
      );
      expect(settled.find((p) => p.actorId === seatId)!.values['name']).toBe('Bram');
    });

    // ---- SPEC-032 §2: the key is an actor, not a seat (schema v21) ----

    it('writes and reads a profile keyed by a token id, alongside a seat-keyed one', async () => {
      // A creature has no seat and never will, so its profile is keyed by
      // its token id. Both keys live in the same collection and neither
      // shadows the other.
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 2, y: 2 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      });

      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await clientA.setProfileValue(roomId, tokenId, 'name', 'Goblin Sentry');
      await clientA.setProfileValue(roomId, tokenId, 'hp', 4);
      await clientA.setProfilePortrait(roomId, tokenId, 'gen:disc:G:hsl(120, 40%, 35%)');

      const profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.find((p) => p.actorId === tokenId)?.values['hp'] === 4,
      );
      const creature = profiles.find((p) => p.actorId === tokenId)!;
      expect(creature.values['name']).toBe('Goblin Sentry');
      expect(creature.portraitRef).toBe('gen:disc:G:hsl(120, 40%, 35%)');
      // Nothing assigns a creature a colour, and nothing derives one for it
      // (DEC-042) — unlike a seat, whose colour is seeded at `joinRoom`.
      expect(creature.color).toBeUndefined();
      // The character's own profile is untouched by any of it.
      expect(profiles.find((p) => p.actorId === seatId)!.values['name']).toBe('Bram');
    });

    it('deleteToken takes the token-keyed profile with it, and leaves seat-keyed ones alone', async () => {
      // Without this, a creature profile outlives its only key and leaks —
      // the collection-enumeration duty M2 imposed on `deleteRoom`.
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 3, y: 3 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      });
      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await clientA.setProfileValue(roomId, tokenId, 'name', 'Goblin Sentry');
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.some((p) => p.actorId === tokenId),
      );

      await clientA.deleteToken(roomId, tokenId);
      const after = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.every((p) => p.actorId !== tokenId),
      );
      expect(after.some((p) => p.actorId === seatId)).toBe(true);
      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.every((t) => t.id !== tokenId),
      );
      expect(tokens.some((t) => t.id === tokenId)).toBe(false);
    });

    it('deleteToken on a token with no profile removes nothing else', async () => {
      // The delete is unconditional and needs no read first; a character
      // token must not cost anyone their sheet.
      const roomId = await createTestRoom(clientA);
      const seatId = clientA.currentUid()!;
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 4, y: 4 },
        size: 1,
        layer: 'tokens',
        imageRef: 'gen:letter:A',
        ownerSeatId: seatId,
      });
      await clientA.setProfileValue(roomId, seatId, 'name', 'Bram');
      await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.some((p) => p.actorId === seatId),
      );

      await clientA.deleteToken(roomId, tokenId);
      await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.every((t) => t.id !== tokenId),
      );
      const profiles = await waitFor<ProfileInstance[]>(
        (cb) => clientA.subscribeProfiles(roomId, cb),
        (items) => items.some((p) => p.actorId === seatId),
      );
      expect(profiles.find((p) => p.actorId === seatId)!.values['name']).toBe('Bram');
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
}
