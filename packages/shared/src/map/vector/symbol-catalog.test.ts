import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOOR_ART_BY_TYPE,
  DOOR_ART_CATALOG,
  anchorCellFor,
  doorArtCatalogEntry,
  doorTypeForArt,
} from './symbol-catalog.js';
import { doorPasses } from './types.js';
import type { Door, DoorType } from './types.js';

describe('anchorCellFor (IN-014: honours snap mode, not a hardcoded whole cell)', () => {
  it('floors to the whole cell under full snap', () => {
    expect(anchorCellFor({ x: 2.7, y: 3.2 }, 'full')).toEqual({ x: 2, y: 3 });
  });

  it('floors to the half-cell under half snap', () => {
    expect(anchorCellFor({ x: 2.7, y: 3.2 }, 'half')).toEqual({ x: 2.5, y: 3 });
  });

  it('passes the raw point through under free snap', () => {
    expect(anchorCellFor({ x: 2.73, y: 3.21 }, 'free')).toEqual({ x: 2.73, y: 3.21 });
  });
});

describe('doorTypeForArt (SPEC §3.2 door-tool consolidation)', () => {
  it('resolves every door-art catalog kind to a valid DoorType', () => {
    const validTypes: DoorType[] = ['single', 'double', 'secret', 'trapped', 'oneWay', 'barred'];
    for (const entry of DOOR_ART_CATALOG) {
      expect(validTypes).toContain(doorTypeForArt(entry.kind));
    }
  });

  it('maps barred-looking art (gate/portcullis) to "barred" — always blocks', () => {
    expect(doorTypeForArt('door-portcullis')).toBe('barred');
    expect(doorTypeForArt('door-gate')).toBe('barred');
    const door: Door = {
      id: 'd1',
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      type: 'barred',
      state: 'open',
    };
    expect(doorPasses(door)).toBe(false); // barred always blocks, even "open"
  });

  it('defaults an unknown/plain art kind to "single" (normal toggle door)', () => {
    expect(doorTypeForArt('door')).toBe('single');
    expect(doorTypeForArt('door-archway')).toBe('single');
    expect(doorTypeForArt('nonexistent-kind')).toBe('single');
    const open: Door = {
      id: 'd2',
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      type: 'single',
      state: 'open',
    };
    const closed: Door = { ...open, state: 'closed' };
    expect(doorPasses(open)).toBe(true);
    expect(doorPasses(closed)).toBe(false);
  });

  it('round-trips through DEFAULT_DOOR_ART_BY_TYPE for every legacy DoorType', () => {
    (Object.keys(DEFAULT_DOOR_ART_BY_TYPE) as DoorType[]).forEach((type) => {
      const art = DEFAULT_DOOR_ART_BY_TYPE[type];
      expect(doorArtCatalogEntry(art)).toBeDefined();
      // Every legacy type's own default art resolves back to a type with the
      // same LoS-relevant "barred-ness" (only barred's own default art must
      // map back to barred; other types just need *a* valid, non-barred type).
      const resolved = doorTypeForArt(art);
      expect(resolved === 'barred').toBe(type === 'barred');
    });
  });
});
