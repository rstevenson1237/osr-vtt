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

export type QuickSheetId = 'maptools' | 'character' | 'roll' | 'room' | 'battle' | 'tables';

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
  | 'room'
  | 'tables'
  // Presentation control (SPEC-033 §5): corners pushing out to claim the
  // display, corners pulling back in to give it up.
  | 'fullscreen'
  | 'fullscreen-exit'
  // Map tool *group* icons (`map/tool-groups.ts`). A single-tool group's icon
  // doubles as its one button, so those groups need no separate tool glyph —
  // which is again true of Select since SPEC-037 merged it back into one tool,
  // taking the `vertex`/`edge`/`object` glyphs with it.
  | 'cursor'
  | 'viewfinder'
  | 'shapes'
  | 'multipoint'
  | 'stamp'
  // Individual map tools inside the groups.
  | 'hand'
  | 'eye'
  | 'ruler'
  | 'ping'
  | 'pencil'
  | 'rect'
  | 'corridor'
  | 'ngon'
  | 'brush'
  | 'wall'
  | 'path'
  | 'polygon'
  | 'label'
  | 'symbol'
  | 'door'
  // Battle map capture (SPEC-029 §1) — a crop frame, distinct from `rect`'s
  // plain outline.
  | 'crop';

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
  /** `'gm'` sheets are invisible to players — the same gate `MainViewDef`
   * already uses for the Assets view. Omitted means `'all'`: most sheets are
   * open to every seat (Shell UI Redesign §2), and only content that is
   * *referee prep* rather than shared play (the random tables) is gated. */
  availability?: 'all' | 'gm';
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
