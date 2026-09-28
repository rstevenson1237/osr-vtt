import { describe, expect, it } from 'vitest';
import type { HexTile } from '@osr-vtt/shared';
import {
  effectiveRevealedHexes,
  extendHexFogStroke,
  hexesToReset,
  hexesToRevealAll,
  hexFogged,
  hexFogStrokeChanges,
  revealedHexKeys,
  startHexFogStroke,
} from './hex-fog';

/** Hex fog (SPEC-056 §9, DEC-113): the Reveal / Hide hex tool's stroke and
 * the revealed set the fog layer draws from. */

function tile(q: number, r: number, extra: Partial<HexTile> = {}): HexTile {
  return { id: `${q},${r}`, hex: { q, r }, ...extra };
}

const TILES: HexTile[] = [
  tile(0, 0, { terrain: 'plains', revealed: true }),
  tile(1, 0, { revealed: true }),
  tile(2, 0, { terrain: 'forest' }),
  tile(-1, 1, { note: 'A ford.' }),
];

describe('the revealed set', () => {
  it('is every tile carrying the flag, and nothing else', () => {
    expect([...revealedHexKeys(TILES)].sort()).toEqual(['0,0', '1,0']);
  });

  it('fogs a hex only while fog is on for the map', () => {
    const revealed = revealedHexKeys(TILES);
    expect(hexFogged(true, revealed, { q: 2, r: 0 })).toBe(true);
    expect(hexFogged(true, revealed, { q: 0, r: 0 })).toBe(false);
    // Fog off: nothing is fogged, whatever the flags say — which is why
    // DEC-113 needs no backfill.
    expect(hexFogged(false, revealed, { q: 2, r: 0 })).toBe(false);
  });
});

describe('a Reveal / Hide stroke — the first hex decides it', () => {
  it('reveals when it starts on a hidden hex, hides when it starts on a revealed one', () => {
    const revealed = revealedHexKeys(TILES);
    expect(startHexFogStroke(revealed, { q: 2, r: 0 }).reveal).toBe(true);
    expect(startHexFogStroke(revealed, { q: 0, r: 0 }).reveal).toBe(false);
  });

  it('fills every hex between two pointer samples, so a fast drag leaves no gap', () => {
    const stroke = startHexFogStroke(new Set(), { q: 0, r: 0 });
    expect(extendHexFogStroke(stroke, { q: 4, r: 0 })).toBe(true);
    expect([...stroke.hexes.keys()]).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0']);
    // Staying in the same hex adds nothing and asks for no redraw.
    expect(extendHexFogStroke(stroke, { q: 4, r: 0 })).toBe(false);
    // Doubling back over crossed hexes adds nothing either.
    expect(extendHexFogStroke(stroke, { q: 2, r: 0 })).toBe(false);
  });

  it('commits only the hexes whose state actually changes', () => {
    const revealed = revealedHexKeys(TILES);
    const reveal = startHexFogStroke(revealed, { q: 2, r: 0 });
    extendHexFogStroke(reveal, { q: 0, r: 0 });
    // 1,0 and 0,0 were already revealed.
    expect(hexFogStrokeChanges(reveal, revealed)).toEqual([{ q: 2, r: 0 }]);

    const hide = startHexFogStroke(revealed, { q: 1, r: 0 });
    extendHexFogStroke(hide, { q: 3, r: 0 });
    // 2,0 and 3,0 were already hidden.
    expect(hexFogStrokeChanges(hide, revealed)).toEqual([{ q: 1, r: 0 }]);
  });

  it('previews the stroke on top of the stored flags', () => {
    const revealed = revealedHexKeys(TILES);
    const keys = (hexes: { q: number; r: number }[]) =>
      hexes.map((h) => `${h.q},${h.r}`).sort();
    expect(keys(effectiveRevealedHexes(TILES, [null]))).toEqual(['0,0', '1,0']);

    const reveal = startHexFogStroke(revealed, { q: 2, r: 0 });
    expect(keys(effectiveRevealedHexes(TILES, [reveal]))).toEqual(['0,0', '1,0', '2,0']);

    const hide = startHexFogStroke(revealed, { q: 1, r: 0 });
    expect(keys(effectiveRevealedHexes(TILES, [hide]))).toEqual(['0,0']);
    // A released stroke still in flight, then a new one on top — in order.
    expect(keys(effectiveRevealedHexes(TILES, [reveal, hide]))).toEqual(['0,0', '2,0']);
  });
});

describe('Reveal all and Reset fog on a hex map', () => {
  it('Reveal all reveals every hex the referee has put something on', () => {
    expect(hexesToRevealAll(TILES)).toEqual([
      { q: 2, r: 0 },
      { q: -1, r: 1 },
    ]);
  });

  it('Reset hides every revealed hex, flag-only ones included', () => {
    expect(hexesToReset(TILES)).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ]);
  });
});
