import type { MapRoom } from '@osr-vtt/shared';

/**
 * Pure `MapRoom` (Label/Key tool) helpers — split out of the deleted
 * cellular `map/tools.ts` at the WI-D pure-rollout cutover
 * (`docs/VectorMapSystem_Decisions.md`, D1/D2). `MapRoom`/`MapSymbol` are kept,
 * non-cellular symbol/label authoring data (SPEC §2.2); `RoomsPanel.svelte`
 * is their manager UI and needs these independent of the deleted cellular
 * carve/wall/fog op model.
 */

/** A reversible unit of Rooms-manager history. */
export type MapRoomOp =
  | { kind: 'mapRoom'; id: string; from: MapRoom | null; to: MapRoom | null }
  /** A renumber/reorder that rewrites several map rooms' keys at once (Master
   * Plan v2, R13.3 / WI-20) — every changed room is an upsert (`to` always
   * non-null), replaying as one history step. */
  | { kind: 'mapRoomBatch'; changes: { id: string; from: MapRoom; to: MapRoom }[] };

export function invertOp(op: MapRoomOp): MapRoomOp {
  switch (op.kind) {
    case 'mapRoom':
      return { kind: 'mapRoom', id: op.id, from: op.to, to: op.from };
    case 'mapRoomBatch':
      return {
        kind: 'mapRoomBatch',
        changes: op.changes.map((c) => ({ id: c.id, from: c.to, to: c.from })),
      };
  }
}

export function isNoopOp(op: MapRoomOp): boolean {
  if (op.kind === 'mapRoomBatch') return op.changes.length === 0;
  return false;
}

/** Next auto-incrementing map-room key given existing keys (Spec §3 "Label /
 * Key... auto-incrementing key (1, 2, 3, 2a…)"). Only produces the plain
 * numeric series — sub-lettering (2a) is a manual rename, not automated. */
export function nextMapRoomKey(existingKeys: readonly string[]): string {
  const numeric = existingKeys
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n));
  const max = numeric.length ? Math.max(...numeric) : 0;
  return String(max + 1);
}

/** The cell count shown per room in the Rooms manager. A `MapRoom` persists a
 * flood-filled region only as its bounding `bbox` (the exact cell set isn't
 * stored), so the manager reports the bbox area. */
export function mapRoomCellCount(room: Pick<MapRoom, 'bbox'>): number {
  return Math.max(0, room.bbox.w) * Math.max(0, room.bbox.h);
}

/** Orders map rooms for the manager list. Plain-numeric keys sort numerically
 * (so `10` follows `9`, not `1`); a sub-lettered key (`2a`) sorts just after
 * its numeric stem; anything non-numeric falls back to a locale compare. */
export function compareMapRoomKeys(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum && na !== nb) return na - nb;
  if (aNum && bNum) return a.localeCompare(b); // same stem: "2" before "2a"
  if (aNum !== bNum) return aNum ? -1 : 1; // numeric keys ahead of pure text
  return a.localeCompare(b);
}

/** Rooms sorted for display in the manager (by key; stable ties by name). */
export function sortMapRoomsByKey(rooms: readonly MapRoom[]): MapRoom[] {
  return [...rooms].sort((a, b) => compareMapRoomKeys(a.key, b.key) || a.name.localeCompare(b.name));
}

/** True when `key` is free to assign to `exceptId` — i.e. no *other* room
 * already holds it. Blank keys are never valid. */
export function isMapRoomKeyUnique(
  key: string,
  rooms: readonly MapRoom[],
  exceptId: string,
): boolean {
  if (!key.trim()) return false;
  return !rooms.some((r) => r.id !== exceptId && r.key === key);
}

/** Given rooms in a desired display order, reassign the sequential numeric
 * keys `"1".."n"` following that order and return only the rooms whose key
 * actually changes, as `mapRoomBatch` change entries. Keys stay globally
 * unique by construction (`1..n`), so a reorder can never collide. */
export function renumberMapRoomsByOrder(
  ordered: readonly MapRoom[],
): { id: string; from: MapRoom; to: MapRoom }[] {
  const changes: { id: string; from: MapRoom; to: MapRoom }[] = [];
  ordered.forEach((room, i) => {
    const key = String(i + 1);
    if (room.key !== key) changes.push({ id: room.id, from: room, to: { ...room, key } });
  });
  return changes;
}
