/** Activity Shell registry types (Master Plan v2, R1.2; restructured by the
 * "Shell UI Redesign (Quick Sheets)" handoff).
 *
 * The shell now has two independent icon registries rather than one:
 *
 * - **Main views** — a single full-screen stage at a time (Map / Encounter /
 *   Assets), selected from the top-bar tabs (desktop) or the bottom tab bar
 *   (mobile).
 * - **Quick sheets** — small docked cards layered over the stage (Map tools /
 *   Character / Roll / Room). Each toggles independently; any subset can be
 *   open at once, and exactly one may be *expanded* into a centered modal.
 *
 * Log and Session settings are neither: they open as centered modal overlays
 * from the bottom bar and top bar respectively.
 *
 * The stage and sheet components are instantiated by an explicit switch in
 * `RoomShell`, because each re-housed component takes a different prop shape
 * and an explicit switch keeps that type-safe. */

export type MainViewId = 'map' | 'encounter' | 'assets';

export type QuickSheetId = 'maptools' | 'character' | 'roll' | 'room';

/** The two centered modal overlays. */
export type OverlayId = 'log' | 'session';

/** Colour-coded clusters (R1.4), reused as the quick sheets' left-border
 * accent. `referee` no longer implies GM-only — it is a hue, not a gate. */
export type GroupId = 'world' | 'play' | 'records' | 'referee';

/** Icon names resolved by `Icon.svelte`. */
export type IconId =
  | 'map'
  | 'encounter'
  | 'dice'
  | 'characters'
  | 'log'
  | 'chat'
  | 'assets'
  | 'session'
  | 'tools'
  | 'room';

export interface MainViewDef {
  id: MainViewId;
  title: string;
  icon: IconId;
  group: GroupId;
  /** `'gm'` views are invisible to players. */
  availability: 'all' | 'gm';
}

export interface QuickSheetDef {
  id: QuickSheetId;
  title: string;
  icon: IconId;
  /** Drives the card's 3px left-border accent and the rail icon's active tint. */
  group: GroupId;
}

export const GROUP_COLOR_VAR: Record<GroupId, string> = {
  world: 'var(--group-world)',
  play: 'var(--group-play)',
  records: 'var(--group-records)',
  referee: 'var(--group-referee)',
};

export const GROUP_TITLE: Record<GroupId, string> = {
  world: 'World',
  play: 'Play',
  records: 'Records',
  referee: 'Referee',
};
