import {
  initiativeSlotId,
  publishRoll,
  slotOwnerUid,
  type CampaignStore,
  type EncounterMode,
  type RollConvention,
  type SharedRoll,
} from '@osr-vtt/shared';

/**
 * The one rule every quick-die control follows (the revamp §6).
 *
 * - **No initiative call open** ⇒ roll immediately, through the shared
 *   `publishRoll` pipeline. This is the fix for "roll buttons that don't
 *   roll": these controls used to call `diceTray.stage()`, which silently
 *   loaded the tray — invisible on mobile, or with the Roll sheet closed.
 * - **A Call for Initiative is open** ⇒ *stage* this actor's slot and mark it
 *   ready instead. That is Workflow 2's "the first die roll a player triggers
 *   is registered as that group's initiative roll, and is not displayed", and
 *   Workflow 3's per-character version.
 *
 * The staged die is whatever the control offered; the referee's configured
 * initiative die is only the *default* the tracker pre-stages for actors with
 * no player to press anything.
 */
export interface InitiativeCallContext {
  sharedRoll: SharedRoll | null;
  mode: EncounterMode;
  /** The tracker row this control belongs to: a groupId in Side mode, a
   * tokenId in Individual mode. Absent for a control with no actor (the plain
   * Roll-sheet die buttons), which therefore always rolls. */
  refId?: string;
  /** The uid that owns that actor, if any. */
  ownerUid?: string;
}

/** Is a Call for Initiative open and still taking dice? */
export function initiativeCallOpen(sharedRoll: SharedRoll | null): boolean {
  return sharedRoll?.kind === 'initiative' && sharedRoll.status === 'staging';
}

/**
 * The slot this control would stage into, or `null` if it should just roll.
 *
 * Returns `null` when no call is open, when the control has no actor, or when
 * the actor's slot is already staged *by someone else* — a player pressing a
 * die for a character they don't own shouldn't overwrite the owner's staged
 * roll.
 */
export function stageTargetFor(
  ctx: InitiativeCallContext,
  myUid: string,
): { slotId: string } | null {
  if (!initiativeCallOpen(ctx.sharedRoll) || !ctx.refId) return null;
  const slotId = initiativeSlotId(ctx.mode, {
    refId: ctx.refId,
    ...(ctx.ownerUid ? { ownerUid: ctx.ownerUid } : {}),
    die: '',
  });
  // Only the slot's own uid (or the referee, whose writes the rules allow
  // anywhere) may fill it.
  const owner = slotOwnerUid(slotId);
  if (owner !== myUid && ctx.ownerUid !== undefined && ctx.ownerUid !== myUid) return null;
  return { slotId };
}

/**
 * Roll now, or stage into an open initiative call. Returns what it did, so a
 * caller can show READY rather than waiting for a result that isn't coming.
 */
export async function rollOrStage(
  store: CampaignStore,
  roomId: string,
  myUid: string,
  die: string,
  ctx: InitiativeCallContext,
  conventions: RollConvention[] | undefined,
  label?: string,
): Promise<'rolled' | 'staged' | 'noop'> {
  if (!myUid) return 'noop';
  const target = stageTargetFor(ctx, myUid);
  if (target) {
    await store.stageSharedSlot(roomId, target.slotId, {
      die,
      modifier: 0,
      advantage: 'normal',
      ready: true,
    });
    return 'staged';
  }
  const roll = await publishRoll(
    store,
    roomId,
    myUid,
    { exprs: [die], mode: 'separate', ...(label ? { label } : {}) },
    conventions,
  );
  return roll ? 'rolled' : 'noop';
}
