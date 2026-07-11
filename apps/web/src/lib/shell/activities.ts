import type { ActivityDef, ActivityId, GroupId } from './types';

/** The seven registered v2 activities (Master Plan v2, R1.2), in rail order,
 * clustered by group. Existing panels are re-housed into these — nothing is
 * rewritten here (WI-2). Full specs for Assets (R7), Log/chat (R5) and Session
 * config forms (R4) land in later WIs; here they re-house what exists today. */
export const ACTIVITIES: ActivityDef[] = [
  { id: 'map', title: 'Map', icon: 'map', group: 'world', availability: 'all', hasMiniCard: false },
  { id: 'assets', title: 'Assets', icon: 'assets', group: 'world', availability: 'all', hasMiniCard: false },
  { id: 'encounter', title: 'Encounter', icon: 'encounter', group: 'play', availability: 'all', hasMiniCard: false },
  { id: 'dice', title: 'Dice', icon: 'dice', group: 'play', availability: 'all', hasMiniCard: true },
  { id: 'log', title: 'Log', icon: 'log', group: 'records', availability: 'all', hasMiniCard: false },
  { id: 'characters', title: 'Characters', icon: 'characters', group: 'records', availability: 'all', hasMiniCard: true },
  { id: 'session', title: 'Session', icon: 'session', group: 'referee', availability: 'gm', hasMiniCard: false },
];

/** Rail order of the groups. */
export const GROUP_ORDER: GroupId[] = ['world', 'play', 'records', 'referee'];

export function activitiesFor(isGM: boolean): ActivityDef[] {
  return ACTIVITIES.filter((a) => a.availability === 'all' || isGM);
}

export function activityById(id: ActivityId): ActivityDef {
  const found = ACTIVITIES.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown activity: ${id}`);
  return found;
}

/** `1`–`7` keyboard shortcuts map to visible activities in rail order (R1.7).
 * The digit indexes into the *GM-or-player* visible list so players never hit
 * a gap where the referee activity would be. */
export function activityForDigit(digit: number, isGM: boolean): ActivityId | null {
  const visible = activitiesFor(isGM);
  const idx = digit - 1;
  return idx >= 0 && idx < visible.length ? visible[idx]!.id : null;
}
