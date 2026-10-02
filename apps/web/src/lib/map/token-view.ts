/**
 * Token-layer helpers lifted out of `VectorMapView` (WI-207, from WI-171 §4 item
 * 1): a token's on-map radius, ownership dimming, fog reveal, and the ping →
 * token resolution. Pure — each is a function of its arguments, with no Pixi, no
 * store and no reactivity.
 */

import {
  hexMap,
  vectorMap,
  type PingPos,
  type Token,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import { hexFogged } from './hex-fog';
import type { RenderPing } from './vector-engine';

/** A size-1 token's diameter in pixel space. */
export const TOKEN_PX = 48;

/** A token's on-map radius, pixel-space — the same circle the ring, badges and
 * (SPEC-046 §2) an aimed ping's hit-test all measure against. */
export function tokenRadiusPx(token: Token): number {
  return (TOKEN_PX * token.size) / 2;
}

/** The topmost token whose disc contains pixel-space point `p`, or `null`. Used
 * only to resolve a *received* ping's target on first sight (SPEC-046 §2) — an
 * aim click itself already knows which token it landed on, since the token's own
 * sprite is what receives the pointer event. */
export function tokenAtPoint(tokens: readonly Token[], p: { x: number; y: number }): Token | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    if (Math.hypot(p.x - token.pos.x, p.y - token.pos.y) <= tokenRadiusPx(token)) return token;
  }
  return null;
}

/** Whether this token's owner is disconnected. Unowned tokens (monsters,
 * scenery) never dim — there is no seat for them to be away from. */
export function isAway(token: Token, presentSeatIds: ReadonlySet<string>): boolean {
  return token.ownerSeatId !== undefined && !presentSeatIds.has(token.ownerSeatId);
}

/** What `revealedAt` needs to know about the map's fog. */
export interface FogView {
  /** `map.fog?.enabled ?? false`. */
  enabled: boolean;
  /** The map's hex grid on a hex crawl (SPEC-056 §9), else `null`. */
  hexGrid: { size: number } | null;
  hexRevealed: ReadonlySet<string>;
  cellSize: number;
  /** Lattice-space fog geometry — a square map's fog, which a hex map lacks. */
  fogRegions: readonly VectorFloorRegion[];
}

/** Fog also hides tokens standing in it, or a player would watch monsters slide
 * around inside a black region. Token positions are pixel-space; fog geometry is
 * lattice units. A hex crawl resolves through `pixelToAxial` — `fogRegions` is
 * lattice geometry a hex map does not have (RULE-006). */
export function revealedAt(pos: { x: number; y: number }, fog: FogView): boolean {
  if (!fog.enabled) return true;
  if (fog.hexGrid) {
    if (fog.hexGrid.size <= 0) return true;
    return !hexFogged(true, fog.hexRevealed, hexMap.pixelToAxial(pos, fog.hexGrid.size));
  }
  return vectorMap.pointInFloorUnionRegions({ x: pos.x / fog.cellSize, y: pos.y / fog.cellSize }, [
    ...fog.fogRegions,
  ]);
}

/** Ping list ready for the engine: a floor ping unchanged, a token-aimed ping
 * annotated with the ring radius to draw — or dropped entirely once its token has
 * moved off the mark it was published at. `pingTargets` is the per-ping
 * remembered target, resolved once on first sight and never re-hit-tested
 * (SPEC-046 §2): `null` is a floor ping, a token id an aimed one. It is mutated:
 * new pings are recorded, vanished ones forgotten. */
export function resolvePingsForRender(
  pings: readonly PingPos[],
  pingTargets: Map<string, string | null>,
  tokens: readonly Token[],
): RenderPing[] {
  const seen = new Set<string>();
  const resolved: RenderPing[] = [];
  for (const ping of pings) {
    seen.add(ping.id);
    if (!pingTargets.has(ping.id)) {
      pingTargets.set(ping.id, tokenAtPoint(tokens, { x: ping.x, y: ping.y })?.id ?? null);
    }
    const tokenId = pingTargets.get(ping.id) ?? null;
    if (tokenId === null) {
      resolved.push(ping);
      continue;
    }
    const token = tokens.find((t) => t.id === tokenId);
    if (!token || token.pos.x !== ping.x || token.pos.y !== ping.y) continue; // dropped
    resolved.push({ ...ping, tokenRingRadius: tokenRadiusPx(token) });
  }
  for (const id of pingTargets.keys()) {
    if (!seen.has(id)) pingTargets.delete(id);
  }
  return resolved;
}
