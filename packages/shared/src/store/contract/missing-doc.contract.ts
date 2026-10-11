import { beforeAll, describe, expect, it } from 'vitest';
import type {
  BlindDraw,
  GameMap,
  Group,
  HandoutRecord,
  MapBackground,
  PlayerSeat,
  Token,
} from '../../types.js';
import type { CampaignStore } from '../campaign-store.js';
import { activeMapId, createTestRoom, waitFor, type ContractContext } from './helpers.js';

/**
 * Updates to a missing document (SPEC-061, DEC-127). Every single-document
 * partial-update method resolves without effect when its document is gone, in
 * every store, and never creates it; `moveTokens` skips missing tokens;
 * `transferGM` rejects all-or-nothing. The realistic case is two referees
 * racing: one deletes a token while the other is still dragging it.
 *
 * Each test creates the document, removes it, calls the method, and checks both
 * that the call resolved and that the document stayed absent.
 */
export function defineMissingDocContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
  });

  describe('updates to a missing document (SPEC-061)', () => {
    it('token updates resolve and never recreate the token (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      const tokenId = await clientA.createToken(roomId, {
        pos: { x: 1, y: 1 },
        size: 1,
        layer: 'tokens',
      });
      await clientA.deleteToken(roomId, tokenId);

      await clientA.moveToken(roomId, tokenId, { x: 4, y: 4 });
      await clientA.resizeToken(roomId, tokenId, 2);
      await clientA.setTokenImage(roomId, tokenId, 'tokens/ghost.png');
      await clientA.setTokenColor(roomId, tokenId, '#ff0000');
      await clientA.setTokenName(roomId, tokenId, 'Ghost');
      await clientA.setTokenLetter(roomId, tokenId, 'G');
      await clientA.setTokenOwner(roomId, tokenId, 'seat-1');
      await clientA.setTokenColor(roomId, tokenId, undefined);
      await clientA.setTokenOwner(roomId, tokenId, undefined);

      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        () => true,
      );
      expect(tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it('moveTokens moves the tokens that exist and skips the rest (§2)', async () => {
      const roomId = await createTestRoom(clientA);
      const make = (x: number) =>
        clientA.createToken(roomId, { pos: { x, y: 0 }, size: 1, layer: 'tokens' });
      const [keep1, gone, keep2] = [await make(1), await make(2), await make(3)];
      await clientA.deleteToken(roomId, gone!);

      await clientA.moveTokens(roomId, [
        { tokenId: keep1!, pos: { x: 10, y: 10 } },
        { tokenId: gone!, pos: { x: 11, y: 11 } },
        { tokenId: keep2!, pos: { x: 12, y: 12 } },
      ]);

      const tokens = await waitFor<Token[]>(
        (cb) => clientA.subscribeTokens(roomId, cb),
        (items) => items.find((t) => t.id === keep2)?.pos.x === 12,
      );
      expect(tokens.find((t) => t.id === keep1)?.pos).toEqual({ x: 10, y: 10 });
      expect(tokens.find((t) => t.id === gone)).toBeUndefined();
    });

    it('map updates resolve and never recreate the map (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await clientA.createMap(roomId, { name: 'Doomed' });
      await clientA.deleteMap(roomId, mapId);

      await clientA.renameMap(roomId, mapId, 'Renamed');
      await clientA.setMapBackgroundColor(roomId, mapId, '#123456');
      await clientA.removeMapBackground(roomId, mapId);
      await clientA.setMapGridDimensions(roomId, mapId, { w: 10, h: 10, cellSize: 50 });
      await clientA.setMapMeasurement(roomId, mapId, { perSquare: 5, unit: 'feet' });
      await clientA.setMapGridSubdivide(roomId, mapId, true);
      await clientA.setMapFogEnabled(roomId, mapId, true);

      const maps = await waitFor<GameMap[]>(
        (cb) => clientA.subscribeMaps(roomId, cb),
        () => true,
      );
      expect(maps.find((m) => m.id === mapId)).toBeUndefined();
    });

    it('background patches resolve and never recreate the background (§1, SPEC-059 §1)', async () => {
      const roomId = await createTestRoom(clientA);
      const mapId = await activeMapId(clientA, roomId);
      const bgId = await clientA.addBackground(roomId, mapId, {
        ref: 'https://example.com/cavern.png',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        order: 0,
      });
      await clientA.removeBackground(roomId, mapId, bgId);

      await clientA.setBackgroundTransform(roomId, mapId, bgId, { x: 1, y: 1, w: 5, h: 5 });
      await clientA.setBackgroundOrder(roomId, mapId, bgId, 3);
      await clientA.setBackgroundLocked(roomId, mapId, bgId, true);

      const bgs = await waitFor<MapBackground[]>(
        (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
        () => true,
      );
      expect(bgs.find((b) => b.id === bgId)).toBeUndefined();
    });

    it('player-seat updates resolve and never recreate the seat (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      await clientB.joinRoom(roomId, 'A Player');
      const uid = clientB.currentUid()!;
      await clientA.removePlayer(roomId, uid);

      await clientA.renamePlayer(roomId, uid, 'Renamed');
      await clientA.setPlayerRole(roomId, uid, 'viewer');
      await clientA.setCurrentCharacter(roomId, uid, 'seat-1');
      await clientA.setCurrentCharacter(roomId, uid, undefined);

      const seats = await waitFor<PlayerSeat[]>(
        (cb) => clientA.subscribePlayers(roomId, cb),
        () => true,
      );
      expect(seats.find((s) => s.uid === uid)).toBeUndefined();
    });

    it('updateGroup resolves and never recreates the group (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      const groupId = await clientA.createGroup(roomId, {
        name: 'Doomed',
        memberTokenIds: [],
        showMap: false,
        showBoard: false,
        active: false,
      });
      await clientA.deleteGroup(roomId, groupId);

      await clientA.updateGroup(roomId, groupId, { active: true });

      const groups = await waitFor<Group[]>(
        (cb) => clientA.subscribeGroups(roomId, cb),
        () => true,
      );
      expect(groups.find((g) => g.id === groupId)).toBeUndefined();
    });

    it('revealHandout resolves for a deleted library entry and creates none (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      const handoutId = await clientA.saveHandout(roomId, {
        ts: Date.now(),
        title: 'Gone',
        ref: 'maps/gone.svg',
      });
      const library = await waitFor<HandoutRecord[]>(
        (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
        (items) => items.length === 1,
      );
      const handout = library[0] as HandoutRecord & { id: string };
      await clientA.deleteHandout(roomId, handoutId);

      await clientA.revealHandout(roomId, handout);

      const after = await waitFor<HandoutRecord[]>(
        (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
        () => true,
      );
      expect(after.find((h) => h.id === handoutId)).toBeUndefined();
    });

    it('revealBlindDraw resolves for a draw that was never written and creates none (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.revealBlindDraw(roomId, {
        id: 'never-written',
        kind: 'blindDraw',
        ts: Date.now(),
        authorUid: clientA.currentUid()!,
        title: 'Ghost draw',
        text: 'nothing',
        revealed: false,
      });

      const draws = await waitFor<BlindDraw[]>(
        (cb) => clientA.subscribeBlindDraws(roomId, cb),
        () => true,
      );
      expect(draws.find((d) => d.id === 'never-written')).toBeUndefined();
    });

    it('room-doc updates resolve once the room is gone and never recreate it (§1)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.deleteRoom(roomId);

      await clientA.renameRoom(roomId, 'Renamed');
      await clientA.setTheme(roomId, 'dark');
      await clientA.setInitiativeConfig(roomId, { initiativeMode: 'side', initiativeDie: 'd6' });
      await clientA.setRollConventions(roomId, []);
      await clientA.setDefaultPlayerGroup(roomId, 'none');
      await clientA.setActiveMap(roomId, 'some-map');
      await clientA.updateProfileTemplate(roomId, []);
      await clientA.updateEncounterTemplate(roomId, []);
      await clientA.hideHandout(roomId);

      expect(await clientA.getRoom(roomId)).toBeNull();
    });

    it('transferGM rejects and changes nothing when the target seat is missing (§3)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      const gmUid = clientA.currentUid()!;

      // clientB never joined, so there is no seat to promote.
      await expect(
        clientA.transferGM(roomId, clientB.currentUid() ?? 'no-such-seat'),
      ).rejects.toThrow();

      expect((await clientA.getRoom(roomId))?.gmUid).toBe(gmUid);
      const seats = await waitFor<PlayerSeat[]>(
        (cb) => clientA.subscribePlayers(roomId, cb),
        () => true,
      );
      expect(seats.find((s) => s.uid === gmUid)?.role).toBe('gm');
    });

    it('transferGM rejects when the room is missing (§3)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.deleteRoom(roomId);

      await expect(clientA.transferGM(roomId, 'someone')).rejects.toThrow();
      expect(await clientA.getRoom(roomId)).toBeNull();
    });
  });
}
