/**
 * Built-in symbol + door art catalog (dungeon-symbol SVG pack). Pure data,
 * no store/Firebase dependency — consumed by the map toolbar (palette) and
 * the vector renderer (sprite lookup), so the catalog is defined once.
 *
 * `kind`/`ref` are derived from the pack's PascalCase filenames
 * (`StairSpiralSquareDown1x1.svg` -> kind `stair-spiral-square-down`, a 1x1
 * footprint; `TableSetTwo3x1.svg` -> `table-set-two`, 3x1). Two entries
 * (`table-set-2x1`/`table-set-3x1`) keep their size suffix because the pack
 * ships both `TableSet2x1.svg` and `TableSet3x1.svg` under the same base
 * name — the suffix is the only thing disambiguating them.
 *
 * `ref` resolves through the existing `BundledAssetStore` the same way
 * `tokens/fighter.svg` does (`packages/shared/src/store/asset-store.ts`),
 * against files placed at `apps/web/public/assets/symbols/*.svg` and
 * `apps/web/public/assets/doors/*.svg`.
 */

import type { DoorType } from './types.js';

export interface CatalogEntry {
  kind: string;
  ref: string;
  cellSpan: { w: number; h: number };
}

/** Symbol kind for an unrecognized/legacy `MapSymbol.kind` (old glyph-catalog data). */
export const UNKNOWN_SYMBOL_KIND = 'unknown';

export const SYMBOL_CATALOG: readonly CatalogEntry[] = [
  { kind: 'altar', ref: 'symbols/altar.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'arrow', ref: 'symbols/arrow.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'bed', ref: 'symbols/bed.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'bed-double', ref: 'symbols/bed-double.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'bench', ref: 'symbols/bench.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'bookcase', ref: 'symbols/bookcase.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'cage', ref: 'symbols/cage.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'cask', ref: 'symbols/cask.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'chair', ref: 'symbols/chair.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'chest', ref: 'symbols/chest.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'circle', ref: 'symbols/circle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'circle-dotted', ref: 'symbols/circle-dotted.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'circle-filled', ref: 'symbols/circle-filled.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'coffin-closed', ref: 'symbols/coffin-closed.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'coffin-open', ref: 'symbols/coffin-open.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'cross', ref: 'symbols/cross.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'curtain', ref: 'symbols/curtain.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'curtain-corner', ref: 'symbols/curtain-corner.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'danger', ref: 'symbols/danger.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'fire', ref: 'symbols/fire.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'fire-camp', ref: 'symbols/fire-camp.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'fireplace', ref: 'symbols/fireplace.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'fountain', ref: 'symbols/fountain.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'grave', ref: 'symbols/grave.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'illusion', ref: 'symbols/illusion.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'key', ref: 'symbols/key.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'ladder-down', ref: 'symbols/ladder-down.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'ladder-up', ref: 'symbols/ladder-up.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'light', ref: 'symbols/light.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'loot', ref: 'symbols/loot.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'lounge', ref: 'symbols/lounge.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'pit-circle', ref: 'symbols/pit-circle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'pit-closed-circle', ref: 'symbols/pit-closed-circle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'pit-closed-square', ref: 'symbols/pit-closed-square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'pit-square', ref: 'symbols/pit-square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'railing', ref: 'symbols/railing.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'railing-corner', ref: 'symbols/railing-corner.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'railing-curve', ref: 'symbols/railing-curve.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'railing-half', ref: 'symbols/railing-half.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'square', ref: 'symbols/square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'square-dotted', ref: 'symbols/square-dotted.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'square-filled', ref: 'symbols/square-filled.svg', cellSpan: { w: 1, h: 1 } },
  {
    kind: 'stair-spiral-circle-big',
    ref: 'symbols/stair-spiral-circle-big.svg',
    cellSpan: { w: 2, h: 2 },
  },
  {
    kind: 'stair-spiral-circle-down',
    ref: 'symbols/stair-spiral-circle-down.svg',
    cellSpan: { w: 1, h: 1 },
  },
  {
    kind: 'stair-spiral-circle-up',
    ref: 'symbols/stair-spiral-circle-up.svg',
    cellSpan: { w: 1, h: 1 },
  },
  {
    kind: 'stair-spiral-square-big',
    ref: 'symbols/stair-spiral-square-big.svg',
    cellSpan: { w: 2, h: 2 },
  },
  {
    kind: 'stair-spiral-square-down',
    ref: 'symbols/stair-spiral-square-down.svg',
    cellSpan: { w: 1, h: 1 },
  },
  {
    kind: 'stair-spiral-square-up',
    ref: 'symbols/stair-spiral-square-up.svg',
    cellSpan: { w: 1, h: 1 },
  },
  { kind: 'stairs-01', ref: 'symbols/stairs-01.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'statue', ref: 'symbols/statue.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'statue-small', ref: 'symbols/statue-small.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'stool', ref: 'symbols/stool.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'table-long', ref: 'symbols/table-long.svg', cellSpan: { w: 2, h: 1 } },
  { kind: 'table-rectangle', ref: 'symbols/table-rectangle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'table-round', ref: 'symbols/table-round.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'table-set-2x1', ref: 'symbols/table-set-2x1.svg', cellSpan: { w: 2, h: 1 } },
  { kind: 'table-set-3x1', ref: 'symbols/table-set-3x1.svg', cellSpan: { w: 3, h: 1 } },
  { kind: 'table-set-circle', ref: 'symbols/table-set-circle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'table-set-rect', ref: 'symbols/table-set-rect.svg', cellSpan: { w: 2, h: 1 } },
  { kind: 'table-set-square', ref: 'symbols/table-set-square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'table-set-two', ref: 'symbols/table-set-two.svg', cellSpan: { w: 3, h: 1 } },
  { kind: 'table-square', ref: 'symbols/table-square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'throne', ref: 'symbols/throne.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'trap', ref: 'symbols/trap.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'trapdoor-cieling', ref: 'symbols/trapdoor-cieling.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'trapdoor-floor', ref: 'symbols/trapdoor-floor.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'trapdoor-secret', ref: 'symbols/trapdoor-secret.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'triangle-arrowhead', ref: 'symbols/triangle-arrowhead.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'trigger', ref: 'symbols/trigger.svg', cellSpan: { w: 1, h: 1 } },
  { kind: UNKNOWN_SYMBOL_KIND, ref: 'symbols/unknown.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'well-circle', ref: 'symbols/well-circle.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'well-square', ref: 'symbols/well-square.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'window', ref: 'symbols/window.svg', cellSpan: { w: 1, h: 1 } },
];

export const DOOR_ART_CATALOG: readonly CatalogEntry[] = [
  { kind: 'door', ref: 'doors/door.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-archway', ref: 'doors/door-archway.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-concealed', ref: 'doors/door-concealed.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-double', ref: 'doors/door-double.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-false', ref: 'doors/door-false.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-gate', ref: 'doors/door-gate.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-locked', ref: 'doors/door-locked.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-magic', ref: 'doors/door-magic.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-portcullis', ref: 'doors/door-portcullis.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-revolve-1-way', ref: 'doors/door-revolve-1-way.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-revolving', ref: 'doors/door-revolving.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-secret', ref: 'doors/door-secret.svg', cellSpan: { w: 1, h: 1 } },
  { kind: 'door-slides', ref: 'doors/door-slides.svg', cellSpan: { w: 1, h: 1 } },
];

const SYMBOL_BY_KIND = new Map(SYMBOL_CATALOG.map((e) => [e.kind, e]));
const DOOR_ART_BY_KIND = new Map(DOOR_ART_CATALOG.map((e) => [e.kind, e]));

export function symbolCatalogEntry(kind: string): CatalogEntry {
  return SYMBOL_BY_KIND.get(kind) ?? SYMBOL_BY_KIND.get(UNKNOWN_SYMBOL_KIND)!;
}

export function doorArtCatalogEntry(kind: string): CatalogEntry | undefined {
  return DOOR_ART_BY_KIND.get(kind);
}

/**
 * Default door-art kind for each legacy `DoorType` (used when a `Door` has
 * no explicit `art`). `type` keeps driving LoS/secret-visibility semantics;
 * this only picks a default look for it.
 */
export const DEFAULT_DOOR_ART_BY_TYPE: Record<DoorType, string> = {
  single: 'door',
  double: 'door-double',
  secret: 'door-secret',
  trapped: 'door-locked',
  oneWay: 'door-revolve-1-way',
  barred: 'door-portcullis',
};

/**
 * The inverse of `DEFAULT_DOOR_ART_BY_TYPE` (SPEC §3.2 door-tool
 * consolidation): the map toolbar's door tool now offers a single art
 * selection instead of a separate type + art pair, so `type` — the only
 * field with real LoS behavior via `doorPasses` (`types.ts`, "barred always
 * blocks") — is derived from the chosen art at placement time instead of
 * being its own control. Art kinds that visually read as a barred gate
 * (`door-portcullis`, `door-gate`) map to `barred`; the handful of other
 * legacy-type art pieces map back to their type; every other art kind (a
 * plain look with no special semantics) defaults to `single`. */
const DOOR_TYPE_BY_ART: Record<string, DoorType> = {
  'door-portcullis': 'barred',
  'door-gate': 'barred',
  'door-secret': 'secret',
  'door-concealed': 'secret',
  'door-false': 'secret',
  'door-locked': 'trapped',
  'door-revolve-1-way': 'oneWay',
  'door-double': 'double',
};

/** The `DoorType` a chosen door-art kind should store (SPEC §3.2), so
 * line-of-sight ("barred" always blocks, via `doorPasses`) keeps working now
 * that art is the door tool's only selection. Unknown/plain art kinds fall
 * back to `single` (a normal open/closed toggle door, no special LoS). */
export function doorTypeForArt(art: string): DoorType {
  return DOOR_TYPE_BY_ART[art] ?? 'single';
}

/**
 * The anchor cell a symbol/door-adjacent placement should use: the cell
 * containing the raw (unsnapped) pointer position, top-left of the
 * footprint (`cellSpan` extends right/down from it). `Math.floor`, not
 * `Math.round` — the placed footprint must always contain the clicked
 * point, unlike vertex-snapping used by the draw tools.
 */
export function anchorCellFor(raw: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.floor(raw.x), y: Math.floor(raw.y) };
}
