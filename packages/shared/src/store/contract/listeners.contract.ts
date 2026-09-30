import { beforeAll, describe, expect, it } from 'vitest';
import type {
  AccountInfo,
  AssetRef,
  BlindDraw,
  DiceMacro,
  Drawing,
  Encounter,
  GameMap,
  Group,
  HandoutRecord,
  HexLine,
  HexSymbol,
  HexTile,
  LogEntry,
  MapBackground,
  MapRoom,
  MapSymbol,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  RandomTable,
  Roll,
  Room,
  SharedRoll,
  Token,
} from '../../types.js';
import type {
  CampaignStore,
  CursorPos,
  DragFrame,
  PingPos,
  PresenceEntry,
  StoredVectorWall,
  VectorDoor,
  VectorFloorRegion,
  VectorMapDraft,
} from '../campaign-store.js';
import {
  waitFor,
  createTestRoom,
  activeMapId,
  subscribeAndWaitForFirst,
  pinArrayListener,
  pinSingleListener,
  notesUpdate,
  type ContractContext,
} from './helpers.js';

/** Cross-domain: WI-183 pins the listener guarantees of every `subscribeX`, so it belongs to no one domain. (SPEC-057 §5, DEC-117). */
export function defineListenersContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;
  const { label } = ctx;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
  });

  describe('WI-183 — listener guarantees pinned across every subscribeX (SPEC-056 §5.1)', () => {
    /** `subscribeHexTiles`/`HexSymbols`/`HexLines` are only ever called
     * against a hex-grid map (RULE-006) — the map a room seeds by default
     * is square, so these need their own. */
    async function hexMapId(store: CampaignStore, roomId: string): Promise<string> {
      return store.createMap(roomId, { name: 'Hex Map', gridKind: 'hex' });
    }

    const floorRegion = (id: string, x: number): VectorFloorRegion => ({
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

    describe('array collections — room-scoped', () => {
      it('subscribeMyRooms', async () => {
        let n = 0;
        await pinArrayListener<MyRoomEntry>(
          (cb) => clientA.subscribeMyRooms(cb),
          async () => {
            n += 1;
            await createTestRoom(clientA, `WI-183 MyRooms ${n}`);
          },
          'unknown',
        );
      });

      it('subscribePlayers', async () => {
        const roomId = await createTestRoom(clientA);
        let joined = false;
        await pinArrayListener<PlayerSeat>(
          (cb) => clientA.subscribePlayers(roomId, cb),
          async () => {
            // The growth-checked (first) call is clientA joining its own
            // room: same client writes and subscribes, so this doesn't ride
            // on cross-client propagation to the backend and back down —
            // that latency is real and belongs to `clientB.joinRoom` below,
            // used only for the unsubscribe check's confirming write, which
            // isn't asserted against a deadline.
            if (!joined) {
              joined = true;
              await clientA.joinRoom(roomId, 'The Referee');
            } else {
              await clientB.joinRoom(roomId, 'A Player');
            }
          },
        );
      });

      it('subscribeTokens', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<Token>(
          (cb) => clientA.subscribeTokens(roomId, cb),
          () =>
            clientA.createToken(roomId, {
              pos: { x: 0, y: 0 },
              size: 1,
              layer: 'tokens',
              imageRef: 'gen:letter:A',
            }),
        );
      });

      it('subscribeGroups', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<Group>(
          (cb) => clientA.subscribeGroups(roomId, cb),
          () =>
            clientA.createGroup(roomId, {
              name: 'G',
              memberTokenIds: [],
              showMap: false,
              showBoard: false,
              active: false,
            }),
        );
      });

      it('subscribeProfiles', async () => {
        const roomId = await createTestRoom(clientA);
        let n = 0;
        await pinArrayListener<ProfileInstance>(
          (cb) => clientA.subscribeProfiles(roomId, cb),
          async () => {
            n += 1;
            await clientA.setProfileValue(roomId, `actor-${n}`, 'name', `Actor ${n}`);
          },
        );
      });

      it('subscribeLog', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await pinArrayListener<LogEntry>(
          (cb) => clientA.subscribeLog(roomId, cb),
          () =>
            clientA.writeLog(roomId, { ts: Date.now(), authorUid: uid, type: 'chat', text: 'x' }),
        );
      });

      it('subscribeRolls', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        const roll = (seed: string) => ({
          ts: Date.now(),
          authorUid: uid,
          seed,
          dice: [{ die: 'd6' as const, sides: 6, kept: 1 }],
          modifier: 0,
          advantage: 'normal' as const,
          mode: 'summed' as const,
          total: 1,
        });
        let n = 0;
        await pinArrayListener<Roll>(
          (cb) => clientA.subscribeRolls(roomId, cb),
          () => {
            n += 1;
            return clientA.writeRoll(roomId, roll(`seed-${n}`));
          },
        );
      });

      it('subscribeMacros', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await pinArrayListener<DiceMacro>(
          (cb) => clientA.subscribeMacros(roomId, cb),
          () =>
            clientA.saveMacro(roomId, {
              ownerUid: uid,
              name: 'Fireball',
              dice: ['d6'],
              modifier: 0,
              mode: 'summed',
              advantage: 'normal',
            }),
        );
      });

      it('subscribeTables', async () => {
        const roomId = await createTestRoom(clientA);
        let n = 0;
        await pinArrayListener<RandomTable>(
          (cb) => clientA.subscribeTables(roomId, cb),
          () => {
            n += 1;
            return clientA.upsertTable(roomId, {
              id: `table-${n}`,
              name: 'Wandering Monsters',
              rows: ['a goblin'],
            });
          },
        );
      });

      it('subscribeBlindDraws (GM caller)', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await pinArrayListener<BlindDraw>(
          (cb) => clientA.subscribeBlindDraws(roomId, cb),
          () =>
            clientA.writeBlindDraw(roomId, {
              kind: 'blindDraw',
              ts: Date.now(),
              authorUid: uid,
              title: 'Check',
              text: 'A result',
              revealed: false,
            }),
        );
      });

      it('subscribeHandoutLibrary (GM caller)', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<HandoutRecord>(
          (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
          () =>
            clientA.saveHandout(roomId, { ts: Date.now(), title: 'A Handout', ref: 'maps/x.svg' }),
        );
      });

      it('subscribeAssetRefs', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await pinArrayListener<AssetRef>(
          (cb) => clientA.subscribeAssetRefs(roomId, cb),
          () =>
            clientA.saveAssetRef(roomId, {
              ref: 'https://example.com/art.png',
              label: 'Art',
              addedBy: uid,
              ts: Date.now(),
            }),
        );
      });

      it('subscribeCursors', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<CursorPos>(
          (cb) => clientA.subscribeCursors(roomId, cb),
          async () => {
            clientA.publishCursor(roomId, { x: 1, y: 2 });
          },
        );
      });

      it('subscribePings', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<PingPos>(
          (cb) => clientA.subscribePings(roomId, cb),
          async () => {
            clientA.publishPing(roomId, { x: 1, y: 2 });
          },
        );
      });

      it('subscribePresence', async () => {
        const roomId = await createTestRoom(clientA);
        await pinArrayListener<PresenceEntry>(
          (cb) => clientA.subscribePresence(roomId, cb),
          async () => {
            clientA.publishPresence(roomId, 'The Referee');
          },
        );
        clientA.clearPresence(roomId);
      });
    });

    describe('array collections — map-scoped', () => {
      it('subscribeBackgrounds', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        let n = 0;
        await pinArrayListener<MapBackground>(
          (cb) => clientA.subscribeBackgrounds(roomId, mapId, cb),
          () => {
            n += 1;
            return clientA.addBackground(roomId, mapId, {
              ref: `https://example.com/bg-${n}.png`,
              x: 0,
              y: 0,
              w: 10,
              h: 10,
              order: n,
            });
          },
        );
      });

      it('subscribeSymbols', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await pinArrayListener<MapSymbol>(
          (cb) => clientA.subscribeSymbols(roomId, mapId, cb),
          () =>
            clientA.placeSymbol(roomId, mapId, {
              cell: { x: 2, y: 2 },
              kind: 'chest',
              rotation: 0,
            }),
        );
      });

      it('subscribeMapRooms', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        let n = 0;
        await pinArrayListener<MapRoom>(
          (cb) => clientA.subscribeMapRooms(roomId, mapId, cb),
          () => {
            n += 1;
            return clientA.upsertMapRoom(roomId, mapId, {
              id: `mr-${n}`,
              key: String(n),
              name: `Room ${n}`,
              bbox: { x: 0, y: 0, w: 5, h: 5 },
              labelAnchor: { x: 2, y: 2 },
              wallStyle: 'masonry',
            });
          },
        );
      });

      it('subscribeFloorRegions', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        let n = 0;
        await pinArrayListener<VectorFloorRegion>(
          (cb) => clientA.subscribeFloorRegions(roomId, mapId, cb),
          () => {
            n += 1;
            return clientA.commitFloorRegions(roomId, mapId, {
              put: [floorRegion(`fr-${n}`, n * 10)],
              delete: [],
            });
          },
        );
      });

      it('subscribeFogRegions', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        let n = 0;
        await pinArrayListener<VectorFloorRegion>(
          (cb) => clientA.subscribeFogRegions(roomId, mapId, cb),
          () => {
            n += 1;
            return clientA.commitFogRegions(roomId, mapId, {
              put: [floorRegion(`fog-${n}`, n * 10)],
              delete: [],
            });
          },
        );
      });

      it('subscribeWalls', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await pinArrayListener<StoredVectorWall>(
          (cb) => clientA.subscribeWalls(roomId, mapId, cb),
          () =>
            clientA.setWall(roomId, mapId, {
              a: { x: 0, y: 0 },
              b: { x: 4, y: 0 },
              source: 'explicit',
              blocksSight: true,
              blocksMovement: false,
            }),
        );
      });

      it('subscribeDoors', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await pinArrayListener<VectorDoor>(
          (cb) => clientA.subscribeDoors(roomId, mapId, cb),
          () =>
            clientA.setDoor(roomId, mapId, {
              a: { x: 2, y: 0 },
              b: { x: 3, y: 0 },
              type: 'single',
              state: 'closed',
            }),
        );
      });

      it('subscribeVectorMapDraft', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        const uid = clientA.currentUid()!;
        await pinArrayListener<VectorMapDraft>(
          (cb) => clientA.subscribeVectorMapDraft(roomId, mapId, cb),
          async () => {
            clientA.publishVectorMapDraft(roomId, mapId, {
              uid,
              tool: 'polygon',
              mode: 'add',
              points: [
                { x: 0, y: 0 },
                { x: 2, y: 0 },
                { x: 1, y: 2 },
              ],
              ts: Date.now(),
            });
          },
        );
      });

      it('subscribeDrawings', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await pinArrayListener<Drawing>(
          (cb) => clientA.subscribeDrawings(roomId, mapId, cb),
          () =>
            clientA.writeDrawing(roomId, mapId, {
              layer: 'mapping',
              kind: 'freehand',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              style: { color: 'red' },
            }),
        );
      });
    });

    describe('array collections — hex-grid maps only (RULE-006)', () => {
      it('subscribeHexTiles', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await hexMapId(clientA, roomId);

        // Fires once with the current (empty) contents — nothing has been
        // painted yet, so there is no write for this read to lag behind.
        const before = await subscribeAndWaitForFirst<HexTile[]>((cb) =>
          clientA.subscribeHexTiles(roomId, mapId, cb),
        );
        expect(before.calls).toHaveLength(1);
        expect(before.first).toHaveLength(0);
        before.unsubscribe();

        await clientA.setHexTerrain(roomId, mapId, { q: 1, r: 0 }, 'forest');

        // `setHexTerrain` writes through a transaction (`patchHexTile`),
        // which — unlike the plain `setDoc`/`updateDoc` every other
        // collection in this suite is written with — does not apply
        // optimistically to the local cache. A freshly-attached listener on
        // the SAME client can genuinely take a second callback to catch up
        // with a transaction's result, where every other `subscribeX`
        // pinned here settles on the first. Pinned as today's actual
        // behavior (SPEC-056 §5.1's "pins today's documented behavior"
        // clause) rather than the stricter single-call shape `pinArrayListener`
        // holds everything else to — logged as a new intake item (IN-215).
        let calls = 0;
        const unsub = clientA.subscribeHexTiles(roomId, mapId, () => {
          calls += 1;
        });
        await waitFor<HexTile[]>(
          (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
          (tiles) => tiles.length > 0,
        );
        const callsAtUnsub = calls;
        unsub();

        await clientA.setHexTerrain(roomId, mapId, { q: 2, r: 0 }, 'mountains');
        await waitFor<HexTile[]>(
          (cb) => clientA.subscribeHexTiles(roomId, mapId, cb),
          (tiles) => tiles.length > 1,
        );
        expect(calls).toBe(callsAtUnsub);
      });

      it('subscribeHexSymbols', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await hexMapId(clientA, roomId);
        await pinArrayListener<HexSymbol>(
          (cb) => clientA.subscribeHexSymbols(roomId, mapId, cb),
          () => clientA.placeHexSymbol(roomId, mapId, { point: { q: 0, r: 0 }, kind: 'castle' }),
        );
      });

      it('subscribeHexLines', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await hexMapId(clientA, roomId);
        await pinArrayListener<HexLine>(
          (cb) => clientA.subscribeHexLines(roomId, mapId, cb),
          () =>
            clientA.addHexLine(roomId, mapId, {
              kind: 'road',
              points: [
                { q: 0, r: 0 },
                { q: 1, r: 0 },
              ],
              shade: 1,
              width: 0,
              join: 'round',
            }),
        );
      });
    });

    describe('single-value docs', () => {
      it('subscribeConnection — fires once, true against a running backend (unsubscribe not re-tested: no safe way to force a connectivity change on a shared client mid-suite)', async () => {
        const { calls, first, unsubscribe } = await subscribeAndWaitForFirst<boolean>((cb) =>
          clientA.subscribeConnection(cb),
        );
        expect(calls).toHaveLength(1);
        expect(first).toBe(true);
        unsubscribe();
      });

      it('subscribeAuth — fires once with the current account (unsubscribe not re-tested: no safe way to force an auth change on a shared client mid-suite)', async () => {
        const { calls, first, unsubscribe } = await subscribeAndWaitForFirst<AccountInfo | null>(
          (cb) => clientA.subscribeAuth(cb),
        );
        expect(calls).toHaveLength(1);
        expect(first?.uid).toBe(clientA.currentUid());
        unsubscribe();
      });

      it('subscribeRoom', async () => {
        const roomId = await createTestRoom(clientA);
        await pinSingleListener<Room | null>(
          (cb) => clientA.subscribeRoom(roomId, cb),
          (r) => r?.id === roomId,
          () => clientA.updateProfileTemplate(roomId, [{ id: 'hp', label: 'HP', type: 'counter' }]),
          (r) => (r?.profileTemplate.length ?? 0) > 0,
        );
      });

      it('subscribeMap', async () => {
        const roomId = await createTestRoom(clientA);
        const mapId = await activeMapId(clientA, roomId);
        await pinSingleListener<GameMap | null>(
          (cb) => clientA.subscribeMap(roomId, mapId, cb),
          (m) => m?.id === mapId,
          () => clientA.setMapFogEnabled(roomId, mapId, true),
          (m) => m?.fog?.enabled === true,
        );
      });

      it('subscribeEncounter', async () => {
        const roomId = await createTestRoom(clientA);
        await pinSingleListener<Encounter | null>(
          (cb) => clientA.subscribeEncounter(roomId, cb),
          (e) => e === null,
          () =>
            clientA.writeEncounter(roomId, {
              mode: 'side',
              round: 1,
              order: [],
              currentIndex: 0,
            }),
          (e) => e !== null,
        );
      });

      it('subscribeSharedRoll', async () => {
        const roomId = await createTestRoom(clientA);
        const uid = clientA.currentUid()!;
        await pinSingleListener<SharedRoll | null>(
          (cb) => clientA.subscribeSharedRoll(roomId, cb),
          (sr) => sr === null,
          () => clientA.openSharedRoll(roomId, { openedBy: uid }),
          (sr) => sr !== null,
        );
      });

      it('subscribeYState', async () => {
        const roomId = await createTestRoom(clientA);
        await pinSingleListener<Uint8Array | null>(
          (cb) => clientA.subscribeYState(roomId, 'wi183-notes', cb),
          (state) => state === null,
          () => clientA.mergeYUpdate(roomId, 'wi183-notes', notesUpdate('x')),
          (state) => state !== null,
        );
      });

      it('subscribeDrag', async () => {
        const roomId = await createTestRoom(clientA);
        await pinSingleListener<DragFrame | null>(
          (cb) => clientA.subscribeDrag(roomId, 'wi183-token', cb),
          (frame) => frame === null,
          async () => {
            clientA.publishDrag(roomId, 'wi183-token', { x: 1, y: 2 });
          },
          (frame) => frame !== null,
        );
      });
    });

    describe('ordering pinned where the interface documents one', () => {
      it('subscribeMyRooms delivers newest-visited first', async () => {
        const older = await createTestRoom(clientA, 'WI-183 order older');
        // `lastSeenAt` is a plain `Date.now()` stamp — back-to-back creates
        // can land in the same millisecond, which makes the ordering this
        // pins genuinely undefined between them. A short real gap is
        // cheaper and more honest than mocking the clock for one test.
        await new Promise((resolve) => setTimeout(resolve, 5));
        const newer = await createTestRoom(clientA, 'WI-183 order newer');
        const mine = await waitFor<MyRoomEntry[]>(
          (cb) => clientA.subscribeMyRooms(cb),
          (rooms) => rooms.some((r) => r.roomId === newer),
        );
        const olderIdx = mine.findIndex((r) => r.roomId === older);
        const newerIdx = mine.findIndex((r) => r.roomId === newer);
        expect(newerIdx).toBeGreaterThanOrEqual(0);
        expect(newerIdx).toBeLessThan(olderIdx);
      });

      // subscribeLog's oldest-first, LIVE_LOG_LIMIT-capped ordering is
      // already pinned by "caps the live subscription at LIVE_LOG_LIMIT
      // and pages older entries across the boundary" above (§ log +
      // rolls) — nothing to add here beyond the fires-once/unsubscribe
      // guarantees already covered in "array collections — room-scoped".
    });

    // Every other room read is `signedIn()`, not membership-gated
    // (RULE-012) — `subscribeBlindDraws`/`subscribeHandoutLibrary` are the
    // *only* two `subscribeX` methods any store can ever deny, via the
    // `gmPrivate` Security Rules boundary (RULE-004). MemoryStore/LocalStore
    // implement no access control at the store layer at all (this file's
    // own header comment: re-testing that here "would test nothing" for a
    // bare in-memory store) — only FirebaseStore's rules can produce the
    // denial this guarantee is about, so it is pinned there alone.
    //
    // Today, a denied listener neither errors nor resolves to `[]`: with no
    // error callback wired through `onSnapshot` (`firebase-store.ts` calls
    // it with a success callback only), a permission-denied query simply
    // never invokes its callback. That falls short of "reaches the error
    // path" — logged as a new intake item (IN-215) rather than widened here,
    // since wiring an error channel through these two `subscribeX` methods
    // is an interface change RULE-015 does not license from this item.
    describe('permission-denied reaches the error path, not an empty snapshot (item 4)', () => {
      const test = label.startsWith('FirebaseStore') ? it : it.skip;

      test('subscribeBlindDraws never resolves a denied (non-GM) caller to an empty array', async () => {
        const roomId = await createTestRoom(clientA);
        await clientB.joinRoom(roomId, 'A Player');
        const calls: BlindDraw[][] = [];
        const unsub = clientB.subscribeBlindDraws(roomId, (draws) => calls.push(draws));

        await clientA.writeBlindDraw(roomId, {
          kind: 'blindDraw',
          ts: Date.now(),
          authorUid: clientA.currentUid()!,
          title: 'Check',
          text: 'A result',
          revealed: false,
        });
        // The GM's own subscription over the same data is the witness that
        // the write landed and would have reached a permitted listener.
        await waitFor<BlindDraw[]>(
          (cb) => clientA.subscribeBlindDraws(roomId, cb),
          (draws) => draws.length === 1,
        );
        expect(calls).toHaveLength(0);
        unsub();
      });

      test('subscribeHandoutLibrary never resolves a denied (non-GM) caller to an empty array', async () => {
        const roomId = await createTestRoom(clientA);
        await clientB.joinRoom(roomId, 'A Player');
        const calls: HandoutRecord[][] = [];
        const unsub = clientB.subscribeHandoutLibrary(roomId, (handouts) => calls.push(handouts));

        await clientA.saveHandout(roomId, {
          ts: Date.now(),
          title: 'A Handout',
          ref: 'maps/x.svg',
        });
        await waitFor<HandoutRecord[]>(
          (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
          (handouts) => handouts.length === 1,
        );
        expect(calls).toHaveLength(0);
        unsub();
      });
    });
  });
}
