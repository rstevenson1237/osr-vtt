import type { LogEntry, PlayerSeat } from '@osr-vtt/shared';
import type { IconId } from '../shell/types';

/**
 * Log entry anatomy helpers (Master Plan v2, R5.1). Author display name is
 * resolved from the room's seats (falling back to "—" for a uid no longer
 * seated), and each entry carries both a relative and an absolute timestamp.
 * Pure functions — the Log activity and the peek drawer share them so an entry
 * reads identically wherever it's rendered.
 */

/** A uid→displayName lookup built once from the seat list. */
export function nameLookup(players: PlayerSeat[]): Map<string, string> {
  return new Map(players.map((p) => [p.uid, p.displayName]));
}

/** Author display name, or "—" when the uid isn't (or is no longer) a seat. */
export function authorName(uid: string, names: Map<string, string>): string {
  return names.get(uid) ?? '—';
}

/** Compact relative time ("just now", "5m ago", "2h ago"). `now` is passed in
 * so a caller can drive re-renders off one ticking clock rather than each entry
 * reading `Date.now()` independently. */
export function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Full, locale-formatted timestamp for the entry's `title`/tooltip. */
export function absoluteTime(ts: number): string {
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/** Wall-clock HH:MM used by the compact ticker/drawer rows. */
export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Single-colour stroke icon per entry type (R5.1). The schema carries three
 * types today (`system`/`chat`/`roll`); table results are logged as `chat` and
 * blind-draw reveals as `system`, so those fold in here rather than needing a
 * schema migration. */
export function iconForType(type: LogEntry['type']): IconId {
  switch (type) {
    case 'roll':
      return 'dice';
    case 'chat':
      return 'chat';
    case 'system':
    default:
      return 'log';
  }
}
