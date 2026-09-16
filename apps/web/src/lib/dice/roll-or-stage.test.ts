import { describe, expect, it } from 'vitest';
import type { SharedRoll } from '@osr-vtt/shared';
import { initiativeCallOpen, stageTargetFor } from './roll-or-stage';

const call: SharedRoll = {
  status: 'staging',
  kind: 'initiative',
  openedBy: 'gm-uid',
  slots: {},
};

describe('initiativeCallOpen', () => {
  it('is true only for a staging initiative round', () => {
    expect(initiativeCallOpen(call)).toBe(true);
    expect(initiativeCallOpen({ ...call, status: 'resolved' })).toBe(false);
    expect(initiativeCallOpen({ ...call, kind: undefined })).toBe(false);
    expect(initiativeCallOpen(null)).toBe(false);
  });
});

describe('stageTargetFor', () => {
  it('rolls (no target) when no call is open', () => {
    expect(stageTargetFor({ sharedRoll: null, mode: 'side', refId: 'party' }, 'u1')).toBeNull();
  });

  it('rolls when the control has no actor', () => {
    expect(stageTargetFor({ sharedRoll: call, mode: 'side' }, 'u1')).toBeNull();
  });

  it('lets a player stage their own side — the SPEC-050 §1 fix', () => {
    expect(
      stageTargetFor({ sharedRoll: call, mode: 'side', refId: 'party', ownerUid: 'u1' }, 'u1'),
    ).toEqual({ slotId: 'side:party' });
  });

  it('lets any member fill a side slot, whoever owns the token they pressed', () => {
    // One slot per side: the first player to press a die fills it, and a side
    // holding two player-owned tokens still yields one number.
    expect(
      stageTargetFor({ sharedRoll: call, mode: 'side', refId: 'party', ownerUid: 'u1' }, 'u2'),
    ).toEqual({ slotId: 'side:party' });
  });

  it('keeps Individual mode owner-gated', () => {
    expect(
      stageTargetFor({ sharedRoll: call, mode: 'individual', refId: 'tok1', ownerUid: 'u1' }, 'u1'),
    ).toEqual({ slotId: 'u1:tok1' });
    expect(
      stageTargetFor({ sharedRoll: call, mode: 'individual', refId: 'tok1', ownerUid: 'u1' }, 'u2'),
    ).toBeNull();
  });
});
