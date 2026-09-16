import { describe, expect, it } from 'vitest';
import {
  SIDE_SLOT_PREFIX,
  characterSlotId,
  isSideSlotId,
  sideSlotGroupId,
  sideSlotId,
  slotOwnerUid,
  slotTokenId,
} from './types.js';

/**
 * The three shared-roll slot shapes (SPEC-050 §1), and the discrimination that
 * keeps them apart: `side` is a reserved literal, never a uid, and a groupId is
 * never a tokenId.
 */
describe('shared-roll slot ids', () => {
  it('builds the three shapes', () => {
    expect(characterSlotId('u1', 'tok1')).toBe('u1:tok1');
    expect(sideSlotId('party')).toBe('side:party');
    expect(SIDE_SLOT_PREFIX).toBe('side');
  });

  it('recognises a side slot, and only a side slot', () => {
    expect(isSideSlotId('side:party')).toBe(true);
    expect(isSideSlotId('u1')).toBe(false);
    expect(isSideSlotId('u1:tok1')).toBe(false);
    // The prefix is what counts — a uid that merely ends in `side` is not one.
    expect(isSideSlotId('u1:side')).toBe(false);
  });

  it('reads a side slot’s groupId back', () => {
    expect(sideSlotGroupId('side:party')).toBe('party');
    expect(sideSlotGroupId('u1:tok1')).toBeNull();
    expect(sideSlotGroupId('side:')).toBeNull();
  });

  it('never reads `side` as a uid', () => {
    expect(slotOwnerUid('u1')).toBe('u1');
    expect(slotOwnerUid('u1:tok1')).toBe('u1');
    expect(slotOwnerUid('side:party')).toBeNull();
  });

  it('never reads a groupId as a tokenId', () => {
    expect(slotTokenId('u1:tok1')).toBe('tok1');
    expect(slotTokenId('u1')).toBeNull();
    expect(slotTokenId('side:party')).toBeNull();
  });
});
