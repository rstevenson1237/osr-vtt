import { describe, expect, it } from 'vitest';
import { MemoryBackend, MemoryStore } from '../store/memory-store.js';
import { DEFAULT_ROLL_CONVENTIONS, type LogEntry, type Roll } from '../types.js';
import { publishRoll } from './publish.js';

/**
 * `publishRoll` is the single pipeline every roll in the app now goes through,
 * so these pin the properties the surfaces downstream depend on: a `Roll` doc
 * with a seed (so every client re-derives and animates the same faces), a log
 * entry pointing back at it, and convention-derived classification.
 */

async function setup() {
  const store = new MemoryStore(new MemoryBackend());
  const uid = await store.ensureAuth();
  const roomId = await store.createRoom({ name: 'Keep', profileTemplate: [] });
  return { store, uid, roomId };
}

function collect<T>(subscribe: (cb: (v: T) => void) => () => void): Promise<T> {
  return new Promise((resolve) => {
    const unsub = subscribe((v) => {
      resolve(v);
      unsub();
    });
  });
}

describe('publishRoll', () => {
  it('writes a seeded Roll and a log entry that points back at it', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['d6'], mode: 'separate' },
      DEFAULT_ROLL_CONVENTIONS,
    );

    expect(roll).not.toBeNull();
    expect(roll!.seed).toBeTruthy();
    expect(roll!.dice).toHaveLength(1);

    const rolls = await collect<Roll[]>((cb) => store.subscribeRolls(roomId, cb));
    expect(rolls.map((r) => r.id)).toContain(roll!.id);

    const log = await collect<LogEntry[]>((cb) => store.subscribeLog(roomId, cb));
    const entry = log.find((e) => e.rollId === roll!.id);
    // The back-reference is what lets a log row re-render the structured
    // result instead of its baked text.
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('roll');
    expect(entry!.text).toContain('Rolled');
  });

  it('tints a single-die roll from the room conventions', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['d6'], mode: 'separate' },
      DEFAULT_ROLL_CONVENTIONS,
    );
    const log = await collect<LogEntry[]>((cb) => store.subscribeLog(roomId, cb));
    const entry = log.find((e) => e.rollId === roll!.id)!;
    const face = roll!.dice[0]!.kept;
    const expected = face >= 4 ? 'success' : face >= 2 ? 'complication' : 'failure';
    expect(entry.resultClass).toBe(expected);
  });

  it('leaves a d20 untinted, since the default convention is scoped to d6', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['d20'], mode: 'separate' },
      DEFAULT_ROLL_CONVENTIONS,
    );
    const log = await collect<LogEntry[]>((cb) => store.subscribeLog(roomId, cb));
    expect(log.find((e) => e.rollId === roll!.id)!.resultClass).toBeUndefined();
  });

  it('carries a label through to the Roll — how initiative marks itself', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['d6'], mode: 'separate', label: 'Initiative' },
      DEFAULT_ROLL_CONVENTIONS,
    );
    expect(roll!.label).toBe('Initiative');
  });

  it('totals a summed pool with its modifier', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['2d6'], modifier: 3, mode: 'summed' },
      DEFAULT_ROLL_CONVENTIONS,
    );
    const faces = roll!.dice.reduce((sum, d) => sum + d.kept, 0);
    expect(roll!.total).toBe(faces + 3);
  });

  it('is a no-op for an unparseable expression rather than an error', async () => {
    const { store, uid, roomId } = await setup();
    expect(
      await publishRoll(store, roomId, uid, { exprs: ['garbage'], mode: 'separate' }, []),
    ).toBeNull();
    const rolls = await collect<Roll[]>((cb) => store.subscribeRolls(roomId, cb));
    expect(rolls).toHaveLength(0);
  });

  it('refuses to publish without an author', async () => {
    const { store, roomId } = await setup();
    expect(
      await publishRoll(store, roomId, '', { exprs: ['d6'], mode: 'separate' }, []),
    ).toBeNull();
  });

  it('re-deriving the faces from the stored seed reproduces them exactly', async () => {
    const { store, uid, roomId } = await setup();
    const roll = await publishRoll(
      store,
      roomId,
      uid,
      { exprs: ['3d20'], mode: 'summed' },
      DEFAULT_ROLL_CONVENTIONS,
    );
    // The seed-authoritative invariant: another client re-runs the same
    // expansion from the same seed and lands on identical faces.
    const { expandDiceExprs, rollSummedPool } = await import('./engine.js');
    const rederived = rollSummedPool(roll!.seed, expandDiceExprs(['3d20']), 'normal');
    expect(rederived.map((d) => d.kept)).toEqual(roll!.dice.map((d) => d.kept));
  });
});
