/** Activity Shell registry types (Master Plan v2, R1.2).
 *
 * These describe the *metadata* the rails need — icons, group colours,
 * availability, whether an activity has a flyout mini-card. The actual stage
 * and mini-card components are instantiated by an explicit switch in
 * `StageHost`/`ActivitiesRail`, because each re-housed component takes a
 * different prop shape and an explicit switch keeps that type-safe. */

export type ActivityId =
  | 'map'
  | 'encounter'
  | 'dice'
  | 'characters'
  | 'assets'
  | 'log'
  | 'session';

/** Colour-coded clusters on the Activities rail (R1.4). `referee` renders
 * only for the GM. */
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
  | 'session';

export interface ActivityDef {
  id: ActivityId;
  title: string;
  icon: IconId;
  group: GroupId;
  /** `'gm'` activities are invisible to players (referee group). */
  availability: 'all' | 'gm';
  /** When true the rail icon opens a docked flyout mini-card; otherwise the
   * icon switches the stage directly (R1.2 `miniCard?`). */
  hasMiniCard: boolean;
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
