/**
 * The Pixi engine can't afford to read CSS custom properties per frame, so it
 * takes a `MapTheme` snapshot — a plain object of numeric Pixi colors — once
 * at creation and again whenever `MapEngine.setTheme()` is called (R2).
 */
export interface MapTheme {
  rock: number;
  floor: number;
  wall: number;
  door: number;
  secretDoor: number;
  /** Trapped-door hazard glyph (R11.3) — the GM-only "!" mark. */
  doorHazard: number;
  /** One-way-door arrow (R11.3) — the GM-only facing annotation. */
  doorOneWay: number;
  fog: number;
  grid: number;
  selection: number;
  ping: number;
  rulerText: number;
}

const MAP_THEME_VARS: Record<keyof MapTheme, string> = {
  rock: '--map-rock',
  floor: '--map-floor',
  wall: '--map-wall',
  door: '--map-door',
  secretDoor: '--map-secret',
  doorHazard: '--map-door-hazard',
  doorOneWay: '--map-door-oneway',
  fog: '--map-fog',
  grid: '--map-grid',
  selection: '--map-selection',
  ping: '--map-ping',
  rulerText: '--map-ruler-text',
};

/** `#rrggbb` (optionally shorthand `#rgb`) → the numeric form Pixi wants. */
export function hexToNumber(hex: string): number {
  const trimmed = hex.trim();
  const expanded =
    trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  return Number.parseInt(expanded.slice(1), 16);
}

/** Resolves the current `--map-*` custom properties (from `tokens.css`,
 * `data-theme`-scoped) into the numeric constants the Pixi engine consumes. */
export function readMapTheme(el: Element = document.documentElement): MapTheme {
  const style = getComputedStyle(el);
  const read = (varName: string): number => hexToNumber(style.getPropertyValue(varName));
  return {
    rock: read(MAP_THEME_VARS.rock),
    floor: read(MAP_THEME_VARS.floor),
    wall: read(MAP_THEME_VARS.wall),
    door: read(MAP_THEME_VARS.door),
    secretDoor: read(MAP_THEME_VARS.secretDoor),
    doorHazard: read(MAP_THEME_VARS.doorHazard),
    doorOneWay: read(MAP_THEME_VARS.doorOneWay),
    fog: read(MAP_THEME_VARS.fog),
    grid: read(MAP_THEME_VARS.grid),
    selection: read(MAP_THEME_VARS.selection),
    ping: read(MAP_THEME_VARS.ping),
    rulerText: read(MAP_THEME_VARS.rulerText),
  };
}
