import { describe, expect, it } from 'vitest';
import type { PingPos, Token, VectorFloorRegion } from '@osr-vtt/shared';
import {
  isAway,
  resolvePingsForRender,
  revealedAt,
  TOKEN_PX,
  tokenAtPoint,
  tokenRadiusPx,
  type FogView,
} from './token-view';

const token = (id: string, x: number, y: number, size = 1, ownerSeatId?: string) =>
  ({ id, pos: { x, y }, size, ownerSeatId }) as unknown as Token;
const ping = (id: string, x: number, y: number) => ({ id, uid: 'u', x, y, ts: 0 }) as PingPos;

describe('tokenRadiusPx', () => {
  it('is half the token diameter, scaled by size', () => {
    expect(tokenRadiusPx(token('t', 0, 0, 1))).toBe(TOKEN_PX / 2);
    expect(tokenRadiusPx(token('t', 0, 0, 2))).toBe(TOKEN_PX);
  });
});

describe('tokenAtPoint', () => {
  const tokens = [token('under', 0, 0), token('over', 10, 0)];

  it('finds the token whose disc contains the point, topmost (last) first', () => {
    expect(tokenAtPoint(tokens, { x: 5, y: 0 })?.id).toBe('over');
    expect(tokenAtPoint(tokens, { x: -20, y: 0 })?.id).toBe('under');
  });

  it('includes the rim and is null outside every disc', () => {
    expect(tokenAtPoint([token('t', 0, 0)], { x: TOKEN_PX / 2, y: 0 })?.id).toBe('t');
    expect(tokenAtPoint(tokens, { x: 200, y: 200 })).toBeNull();
  });
});

describe('isAway', () => {
  const present = new Set(['seatA']);

  it('is true only for an owned token whose seat is not present', () => {
    expect(isAway(token('t', 0, 0, 1, 'seatB'), present)).toBe(true);
    expect(isAway(token('t', 0, 0, 1, 'seatA'), present)).toBe(false);
  });

  it('never dims an unowned token', () => {
    expect(isAway(token('t', 0, 0), present)).toBe(false);
    expect(isAway(token('t', 0, 0), new Set())).toBe(false);
  });
});

describe('revealedAt', () => {
  const square = (minX: number, minY: number, maxX: number, maxY: number) =>
    ({
      id: 'f',
      bbox: { minX, minY, maxX, maxY },
      rings: [
        [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ],
      ],
    }) as unknown as VectorFloorRegion;
  const base: FogView = {
    enabled: true,
    hexGrid: null,
    hexRevealed: new Set(),
    cellSize: 50,
    fogRegions: [square(0, 0, 2, 2)],
  };

  it('reveals everything while fog is off', () => {
    expect(revealedAt({ x: 9999, y: 9999 }, { ...base, enabled: false })).toBe(true);
  });

  it('on a square map, reveals a pixel position inside a revealed region (lattice = px / cellSize)', () => {
    expect(revealedAt({ x: 50, y: 50 }, base)).toBe(true);
    expect(revealedAt({ x: 250, y: 50 }, base)).toBe(false);
  });

  it('on a hex map, reveals a degenerate grid and otherwise asks the revealed keys', () => {
    expect(revealedAt({ x: 0, y: 0 }, { ...base, hexGrid: { size: 0 } })).toBe(true);
    // The hex at the origin is axial 0,0 — fogged until its key is revealed.
    const hexView = { ...base, hexGrid: { size: 40 } };
    expect(revealedAt({ x: 0, y: 0 }, hexView)).toBe(false);
    expect(revealedAt({ x: 0, y: 0 }, { ...hexView, hexRevealed: new Set(['0,0']) })).toBe(true);
  });
});

describe('resolvePingsForRender', () => {
  it('passes a floor ping through and remembers it as a floor ping', () => {
    const targets = new Map<string, string | null>();
    const p = ping('p1', 500, 500);
    const out = resolvePingsForRender([p], targets, [token('t', 0, 0)]);
    expect(out).toEqual([p]);
    expect(out[0]).toBe(p);
    expect(targets.get('p1')).toBeNull();
  });

  it('annotates a ping aimed at a token with its ring radius', () => {
    const targets = new Map<string, string | null>();
    const out = resolvePingsForRender([ping('p1', 0, 0)], targets, [token('t', 0, 0, 2)]);
    expect(out).toEqual([{ ...ping('p1', 0, 0), tokenRingRadius: TOKEN_PX }]);
    expect(targets.get('p1')).toBe('t');
  });

  it('drops an aimed ping once its token has moved off the mark', () => {
    const targets = new Map<string, string | null>([['p1', 't']]);
    expect(resolvePingsForRender([ping('p1', 0, 0)], targets, [token('t', 30, 0)])).toEqual([]);
    expect(resolvePingsForRender([ping('p1', 0, 0)], targets, [])).toEqual([]);
  });

  it('never re-hit-tests a ping it has already resolved', () => {
    const targets = new Map<string, string | null>([['p1', null]]);
    const p = ping('p1', 0, 0);
    // A token now sits under the ping, but the ping was a floor ping on first sight.
    expect(resolvePingsForRender([p], targets, [token('t', 0, 0)])).toEqual([p]);
  });

  it('forgets targets for pings that have gone', () => {
    const targets = new Map<string, string | null>([
      ['gone', null],
      ['p1', null],
    ]);
    resolvePingsForRender([ping('p1', 0, 0)], targets, []);
    expect([...targets.keys()]).toEqual(['p1']);
  });
});
