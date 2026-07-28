import { characterSlotId } from '../types.js';
import type {
  EncounterMode,
  Group,
  ProfileInstance,
  ProfileTemplateField,
  Token,
} from '../types.js';

/**
 * "Call for Initiative" — the mapping between tracker rows and shared-roll
 * slots (the revamp §4).
 *
 * A Call for Initiative *is* the existing shared-roll machinery with a
 * different skin: the referee opens a staging round, each player loads a die
 * for the actors they own, and one press resolves them all simultaneously.
 * This module is the pure part — which actors are in the call, which slot id
 * each one stages under, and which of them the referee's own client has to
 * fill because no player will.
 *
 * Nothing here interprets a value: the die comes from a template field the
 * referee configured (or the session default), and the result is *routed*
 * into a row, never derived from a stat (§2.5 hard rule).
 */

/** One participant in a Call for Initiative. */
export interface InitiativeActor {
  /** The tracker row: a groupId in Side mode, a tokenId in Individual mode. */
  refId: string;
  /** The uid of the player who should stage this actor, if any. Absent means
   * nobody will — the referee's client stages it with the default die. */
  ownerUid?: string;
  /** The die expression to stage for this actor. */
  die: string;
}

/**
 * The slot id an actor stages under.
 *
 * Side mode keys by groupId, so a side's slot is the same id as its tracker
 * row. Individual mode keys an owned character by `{uid}:{tokenId}` so one
 * player can stage several characters *and* the security rule stays a uid
 * prefix check; an unowned token keys by bare tokenId, which only the referee
 * can write anyway.
 */
export function initiativeSlotId(mode: EncounterMode, actor: InitiativeActor): string {
  if (mode !== 'individual') return actor.refId;
  return actor.ownerUid ? characterSlotId(actor.ownerUid, actor.refId) : actor.refId;
}

/** The die a template + profile pair specifies for initiative, or `undefined`
 * when the referee configured none (in which case the caller falls back to the
 * session default). The first `initiative` field wins. */
export function initiativeDieFor(
  template: ProfileTemplateField[],
  values: Record<string, unknown> | undefined,
): string | undefined {
  const field = template.find((f) => f.type === 'initiative');
  if (!field) return undefined;
  // A *blank* stored value falls back to the field default, not to nothing:
  // clearing the box should return the actor to the referee's configured die
  // rather than dropping it out of the call.
  const stored = typeof values?.[field.id] === 'string' ? (values[field.id] as string).trim() : '';
  const fallback = typeof field.default === 'string' ? field.default.trim() : '';
  return stored || fallback || undefined;
}

/**
 * Every actor in a Call for Initiative, for the given mode.
 *
 * Side mode: one actor per active group. A group counts as player-owned when
 * any member token is owned by a seat other than the referee — that is the
 * "contains a token owned by someone not the referee, or unassigned" rule, and
 * it decides whether a human will stage the slot or the referee's client must.
 *
 * Individual mode: one actor per member token of an active group.
 */
export function initiativeActors(input: {
  mode: EncounterMode;
  groups: Group[];
  tokens: Token[];
  gmUid: string;
  /** Session-settings fallback die. */
  defaultDie: string;
  /** Player profile template + instances (Individual mode's die source). */
  profileTemplate?: ProfileTemplateField[];
  profiles?: ProfileInstance[];
  /** Encounter template + values (Side mode's die source). */
  encounterTemplate?: ProfileTemplateField[];
  encounterValues?: Record<string, unknown>;
}): InitiativeActor[] {
  const { mode, groups, tokens, gmUid, defaultDie } = input;
  const active = groups.filter((g) => g.active);
  const tokenById = new Map(tokens.map((t) => [t.id, t]));

  if (mode === 'individual') {
    const seen = new Set<string>();
    const actors: InitiativeActor[] = [];
    for (const group of active) {
      for (const tokenId of group.memberTokenIds) {
        if (seen.has(tokenId)) continue;
        seen.add(tokenId);
        const owner = tokenById.get(tokenId)?.ownerSeatId;
        const ownerUid = owner && owner !== gmUid ? owner : undefined;
        const die =
          initiativeDieFor(
            input.profileTemplate ?? [],
            input.profiles?.find((p) => p.seatId === owner)?.values,
          ) ?? defaultDie;
        actors.push({ refId: tokenId, ...(ownerUid ? { ownerUid } : {}), die });
      }
    }
    return actors;
  }

  const die = initiativeDieFor(input.encounterTemplate ?? [], input.encounterValues) ?? defaultDie;
  return active.map((group) => {
    const ownerUid = group.memberTokenIds
      .map((id) => tokenById.get(id)?.ownerSeatId)
      .find((seat): seat is string => !!seat && seat !== gmUid);
    return { refId: group.id, ...(ownerUid ? { ownerUid } : {}), die };
  });
}

/**
 * The actors the referee's client must stage itself: everything with no
 * assigned player. Workflow 2/3's "any active group/member without an assigned
 * player automatically loads the default initiative die" — so no row is ever
 * silently skipped at resolution.
 */
export function unassignedActors(actors: InitiativeActor[]): InitiativeActor[] {
  return actors.filter((a) => a.ownerUid === undefined);
}
