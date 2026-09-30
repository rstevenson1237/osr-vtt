import { beforeAll, describe, expect, it } from 'vitest';
import { expandSharedRollSlots } from '../../dice/engine.js';
import type { BlindDraw, DiceMacro, LogEntry, RandomTable, Roll, SharedRoll } from '../../types.js';
import { LIVE_LOG_LIMIT } from '../campaign-store.js';
import type { CampaignStore } from '../campaign-store.js';
import { waitFor, createTestRoom, type ContractContext } from './helpers.js';

/** `DiceStore` domain: log + rolls, shared rolls, macros, tables and the blind drawer. (SPEC-057 §5, DEC-117). */
export function defineDiceContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
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

    it('cancels a staging round without writing a Roll (SPEC-050 §3)', async () => {
      const roomId = await createTestRoom(clientA);
      const gmUid = clientA.currentUid()!;
      await clientA.joinRoom(roomId, 'The Referee');

      await clientA.openSharedRoll(roomId, { openedBy: gmUid, kind: 'initiative' });
      await clientA.stageSharedSlot(roomId, 'side:party', {
        die: 'd6',
        modifier: 0,
        advantage: 'normal',
        ready: true,
      });
      await waitFor<SharedRoll | null>(
        (cb) => clientA.subscribeSharedRoll(roomId, cb),
        (sr) => Object.keys(sr?.slots ?? {}).length === 1,
      );

      const rollsBefore = await waitFor<Roll[]>(
        (cb) => clientA.subscribeRolls(roomId, cb),
        () => true,
      );

      await clientA.cancelSharedRoll(roomId);

      const cancelled = await waitFor<SharedRoll | null>(
        (cb) => clientA.subscribeSharedRoll(roomId, cb),
        (sr) => sr?.status === 'resolved',
      );
      expect(cancelled?.status).toBe('resolved');

      const rollsAfter = await waitFor<Roll[]>(
        (cb) => clientA.subscribeRolls(roomId, cb),
        () => true,
      );
      expect(rollsAfter).toHaveLength(rollsBefore.length);
    });

    it('cancelling with no staging round open is a no-op', async () => {
      const roomId = await createTestRoom(clientA);
      await clientA.joinRoom(roomId, 'The Referee');
      await expect(clientA.cancelSharedRoll(roomId)).resolves.toBeUndefined();
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
}
