/**
 * Hex-crawl terrain and contents catalogs (SPEC-030 §§2–3).
 *
 * Pure data, no store/Firebase dependency — consumed by the renderer (art
 * lookup) and, from WI-041, by the hex-tile quick sheet's palette. Same shape
 * as `map/vector/symbol-catalog.ts`, deliberately: SPEC-030 §2 asks for "a
 * background colour plus an SVG overlay … following the existing symbol-catalog
 * pattern rather than inventing a second art pipeline", and §3 asks for contents
 * icons "reusing the symbol catalog's authoring and rendering path".
 *
 * What is stored on a hex is the `kind` string and nothing else — never a
 * colour, never a ref. Everything a kind resolves to lives here, so re-drawing
 * the whole terrain set is a change to this file rather than a migration.
 *
 * `ref` resolves through `AssetStore` exactly as `symbols/altar.svg` does
 * (`packages/shared/src/store/asset-store.ts`), against files placed at
 * `apps/web/public/assets/hex/terrain/*.svg` and
 * `apps/web/public/assets/hex/contents/*.svg`. **The art is authored white**,
 * unlike the black dungeon-symbol pack: both overlays are tinted at the render
 * boundary — terrain to its own authored `ink` (SPEC-047 §8, WI-120), contents
 * to black (§3) — and a tint multiplies, so black art could not be tinted
 * lighter.
 *
 * Roads and rivers (SPEC-047 §2) join at the bottom of the file on the same
 * terms: a stored line carries its kind and an *index* into the shades and
 * widths held here, never a colour and never a pixel width.
 */

import type { HexLineJoin, HexLineKind } from '../../types.js';

/** One terrain kind: the hex's background colour and the overlay drawn on it
 * (SPEC-030 §2, amended SPEC-047 §8). Both halves are art, not data — a stored
 * hex carries `kind`. */
export interface HexTerrainEntry {
  kind: string;
  /** Human-readable name, for the WI-041 palette. */
  label: string;
  /** The whole hex's fill, `#rrggbb` — the same format `GameMap.background`
   * and `MapBackground` use, so one `hexToNumber` serves all three. */
  color: string;
  /** The overlay art's tint, `#rrggbb`, hand-picked to contrast with `color`
   * (DEC-089 (a)) — authored, not derived, so the pair reproduces a classic
   * hex set's look rather than a synthetic two-grey rule. `null` alongside
   * `ref: null` for a kind with no overlay (`water`). Guarded by
   * `hexTerrainContrastOk` in the catalog's own test. */
  ink: string | null;
  /** The overlay art, white, resolved through `AssetStore`. `null` for a
   * kind whose hex is a background colour only, with no overlay at all
   * (`water` — SPEC-047 §8). */
  ref: string | null;
  /** `false` for a kind an authoring surface should no longer offer — it
   * still resolves (RULE-007: alias, never rename) but a referee cannot
   * newly pick it. Omitted (defaulting true) for every ordinary kind, so
   * only the retired six carry it (SPEC-047 §8, WI-121). */
  paintable?: boolean;
}

/** One contents kind: an icon overlaid on whatever terrain the hex has
 * (SPEC-030 §3) — a castle, a town, a cave mouth. No colour of its own; §3
 * fixes it at black. */
export interface HexContentsEntry {
  kind: string;
  label: string;
  ref: string;
}

/** Terrain/contents kind for a stored value this build does not know — a hex
 * painted by a newer build, or a kind retired from the catalogs. Mirrors
 * `UNKNOWN_SYMBOL_KIND`: the tile still renders, visibly as "something is here
 * that I can't name", rather than vanishing. */
export const UNKNOWN_HEX_KIND = 'unknown';

/** Shared by both catalogs' unknown entries — one file, two kinds, which the
 * ref-keyed texture cache handles without a second request. */
const UNKNOWN_REF = 'hex/unknown.svg';

/**
 * The terrain kinds, in palette order: open ground, forests, swamp, hills,
 * mountains, the blasted/dead kinds, water, ice — then the six kinds an
 * authoring picker no longer offers (each now draws another kind's art
 * outright) and finally `unknown`.
 *
 * **SPEC-047 §8 (WI-120)** replaced this catalog's terrain art with the public-
 * domain Worldographer/Inkwell Ideas B&W and multicoloured-classic icon sets,
 * traced to SVG and colour-matched against two real hex-map sources
 * (`docs/completed/wi-119/palette.json`, `docs/completed/WI-119.md`). Every
 * kind string that existed before this section keeps resolving — extend and
 * alias, never rename in place (DEC-083 (i)) — so no migration is owed
 * (RULE-007). Eight kinds the pack does not cover (`plains`, `barren`,
 * `mountain-major`, `mountain-minor`, `reed`, `tree-deciduous`,
 * `tree-evergreen`, `unknown`) keep WI-101's art untouched, each carrying a
 * baked-in `ink` equal to what `hexOverlayTone` would have picked for it
 * (§8's own recommendation — a required field needs a value even where
 * nothing else changes).
 *
 * The colours are mid-tone on purpose. A hex is a background *and* an overlay
 * *and*, often, a black contents icon, so a fill dark enough to swallow the
 * icon or light enough to bleach the overlay makes the tile unreadable —
 * `catalog.test.ts` guards this with a minimum contrast ratio between `color`
 * and `ink`, and between the two blended at render alpha and the contents
 * tone (DEC-089).
 */
export const HEX_TERRAIN_CATALOG: readonly HexTerrainEntry[] = [
  // ---- Open ground ----
  {
    kind: 'plains',
    label: 'Plains',
    color: '#d8cf94',
    ink: '#2b2b2b',
    ref: 'hex/terrain/plains.svg',
  },
  {
    kind: 'grassland',
    label: 'Grassland',
    color: '#9ecd70',
    ink: '#243616',
    ref: 'hex/terrain/grassland.svg',
  },
  {
    kind: 'barren',
    label: 'Barren',
    color: '#a89a78',
    ink: '#2b2b2b',
    ref: 'hex/terrain/barren.svg',
  },

  // ---- Forests (SPEC-047 §8: forest-green / evergreen / jungle-olive families) ----
  {
    kind: 'forest',
    label: 'Forest',
    color: '#5fbc5c',
    ink: '#1e2c17',
    ref: 'hex/terrain/forest.svg',
  },
  {
    kind: 'forest-heavy',
    label: 'Heavy Forest',
    color: '#4bb847',
    ink: '#162310',
    ref: 'hex/terrain/forest-heavy.svg',
  },
  {
    kind: 'forest-mixed',
    label: 'Mixed Forest',
    color: '#77b96a',
    ink: '#232c16',
    ref: 'hex/terrain/forest-mixed.svg',
  },
  {
    kind: 'forest-mixed-heavy',
    label: 'Heavy Mixed Forest',
    color: '#5fb04f',
    ink: '#1b2310',
    ref: 'hex/terrain/forest-mixed-heavy.svg',
  },
  {
    kind: 'forest-mixed-hills',
    label: 'Mixed Forest Hills',
    color: '#93c68b',
    ink: '#303018',
    ref: 'hex/terrain/forest-mixed-hills.svg',
  },
  {
    kind: 'forest-mixed-mountain',
    label: 'Mixed Forest Mountain',
    color: '#88b983',
    ink: '#35291d',
    ref: 'hex/terrain/forest-mixed-mountain.svg',
  },
  {
    kind: 'forest-mixed-mountains',
    label: 'Mixed Forest Mountains',
    color: '#6ead67',
    ink: '#2f2418',
    ref: 'hex/terrain/forest-mixed-mountains.svg',
  },
  {
    kind: 'forested-hills',
    label: 'Forested Hills',
    color: '#83c37f',
    ink: '#2f2d18',
    ref: 'hex/terrain/forested-hills.svg',
  },
  {
    kind: 'forested-mountain',
    label: 'Forested Mountain',
    color: '#95bd93',
    ink: '#372b1f',
    ref: 'hex/terrain/forested-mountain.svg',
  },
  {
    kind: 'forested-mountains',
    label: 'Forested Mountains',
    color: '#7db27b',
    ink: '#32261b',
    ref: 'hex/terrain/forested-mountains.svg',
  },
  {
    kind: 'evergreen',
    label: 'Evergreen',
    color: '#55af9d',
    ink: '#122b28',
    ref: 'hex/terrain/evergreen.svg',
  },
  {
    kind: 'evergreen-heavy',
    label: 'Heavy Evergreen',
    color: '#53b29f',
    ink: '#0c221f',
    ref: 'hex/terrain/evergreen-heavy.svg',
  },
  {
    kind: 'evergreen-hills',
    label: 'Evergreen Hills',
    color: '#6bb3a1',
    ink: '#142e29',
    ref: 'hex/terrain/evergreen-hills.svg',
  },
  {
    kind: 'evergreen-mountain',
    label: 'Evergreen Mountain',
    color: '#90bbb5',
    ink: '#372b20',
    ref: 'hex/terrain/evergreen-mountain.svg',
  },
  {
    kind: 'evergreen-mountains',
    label: 'Evergreen Mountains',
    color: '#77aca5',
    ink: '#31261c',
    ref: 'hex/terrain/evergreen-mountains.svg',
  },
  {
    kind: 'jungle',
    label: 'Jungle',
    color: '#8ab536',
    ink: '#242b0d',
    ref: 'hex/terrain/jungle.svg',
  },
  {
    kind: 'jungle-heavy',
    label: 'Heavy Jungle',
    color: '#85af31',
    ink: '#1a2009',
    ref: 'hex/terrain/jungle-heavy.svg',
  },
  {
    kind: 'jungle-hills',
    label: 'Jungle Hills',
    color: '#96bb3e',
    ink: '#282e0f',
    ref: 'hex/terrain/jungle-hills.svg',
  },
  {
    kind: 'jungle-mountain',
    label: 'Jungle Mountain',
    color: '#9bb663',
    ink: '#34291d',
    ref: 'hex/terrain/jungle-mountain.svg',
  },
  {
    kind: 'jungle-mountains',
    label: 'Jungle Mountains',
    color: '#8ba94c',
    ink: '#2e2419',
    ref: 'hex/terrain/jungle-mountains.svg',
  },
  {
    kind: 'tree-deciduous',
    label: 'Deciduous Trees',
    color: '#5c8a4a',
    ink: '#f2f2f2',
    ref: 'hex/terrain/tree-deciduous.svg',
  },
  {
    kind: 'tree-evergreen',
    label: 'Evergreen Trees',
    color: '#2e5c38',
    ink: '#f2f2f2',
    ref: 'hex/terrain/tree-evergreen.svg',
  },

  // ---- Swamp ----
  { kind: 'marsh', label: 'Marsh', color: '#98c3ad', ink: '#1d3525', ref: 'hex/terrain/marsh.svg' },
  { kind: 'swamp', label: 'Swamp', color: '#7ab8a1', ink: '#183024', ref: 'hex/terrain/swamp.svg' },
  { kind: 'reed', label: 'Reeds', color: '#8ea56a', ink: '#2b2b2b', ref: 'hex/terrain/reed.svg' },

  // ---- Hills (SPEC-047 §8: hills-gold family) ----
  { kind: 'hills', label: 'Hills', color: '#d3b769', ink: '#3b2816', ref: 'hex/terrain/hills.svg' },
  {
    kind: 'desert',
    label: 'Desert',
    color: '#e0ce85',
    ink: '#422d15',
    ref: 'hex/terrain/desert.svg',
  },
  { kind: 'dunes', label: 'Sand Dunes', color: '#d9c278', ink: '#3d2914', ref: 'hex/terrain/dunes.svg' },
  {
    kind: 'desert-rocky',
    label: 'Rocky Desert',
    color: '#c0955d',
    ink: '#362216',
    ref: 'hex/terrain/desert-rocky.svg',
  },
  { kind: 'cactus', label: 'Cactus', color: '#bebe74', ink: '#283319', ref: 'hex/terrain/cactus.svg' },
  {
    kind: 'cactus-heavy',
    label: 'Heavy Cactus',
    color: '#b0b04f',
    ink: '#212a13',
    ref: 'hex/terrain/cactus-heavy.svg',
  },
  {
    kind: 'cultivatedfarmland',
    label: 'Cultivated Farmland',
    color: '#d6d185',
    ink: '#403417',
    ref: 'hex/terrain/cultivatedfarmland.svg',
  },

  // ---- Mountains (SPEC-047 §8: mountain-brown family) ----
  {
    kind: 'mountains',
    label: 'Mountains',
    color: '#c69a53',
    ink: '#392314',
    ref: 'hex/terrain/mountains.svg',
  },
  {
    kind: 'mountain',
    label: 'Mountain',
    color: '#c79c57',
    ink: '#392314',
    ref: 'hex/terrain/mountain.svg',
  },
  {
    kind: 'mountain-snow',
    label: 'Snow-capped Mountain',
    color: '#c2aa8e',
    ink: '#212c3b',
    ref: 'hex/terrain/mountain-snow.svg',
  },
  {
    kind: 'mountains-snow',
    label: 'Snow-capped Mountains',
    color: '#bba081',
    ink: '#1d2734',
    ref: 'hex/terrain/mountains-snow.svg',
  },
  {
    kind: 'mountain-major',
    label: 'Mountains (Major)',
    color: '#75757a',
    ink: '#f2f2f2',
    ref: 'hex/terrain/mountain-major.svg',
  },
  {
    kind: 'mountain-minor',
    label: 'Mountains (Minor)',
    color: '#a08f74',
    ink: '#2b2b2b',
    ref: 'hex/terrain/mountain-minor.svg',
  },
  // `volcano` stays in both this catalog and `HEX_CONTENTS_CATALOG`,
  // deliberately unrenamed (SPEC-047 §8): the terrain reading is "volcanic
  // country", the contents reading is "that volcano, and it is interesting",
  // and a hex may carry both.
  {
    kind: 'volcano',
    label: 'Volcano',
    color: '#c8966a',
    ink: '#411210',
    ref: 'hex/terrain/volcano.svg',
  },
  {
    kind: 'volcano-dormant',
    label: 'Dormant Volcano',
    color: '#c2a78e',
    ink: '#362821',
    ref: 'hex/terrain/volcano-dormant.svg',
  },

  // ---- Dead / blasted ground (SPEC-047 §8: dead-grey family) ----
  {
    kind: 'badlands',
    label: 'Badlands',
    color: '#a49a94',
    ink: '#2a2522',
    ref: 'hex/terrain/badlands.svg',
  },
  {
    kind: 'brokenlands',
    label: 'Brokenlands',
    color: '#9a928d',
    ink: '#272321',
    ref: 'hex/terrain/brokenlands.svg',
  },
  {
    kind: 'deadforest',
    label: 'Dead Forest',
    color: '#b3aba2',
    ink: '#312a25',
    ref: 'hex/terrain/deadforest.svg',
  },

  // ---- Water ----
  {
    kind: 'reefs',
    label: 'Reefs',
    color: '#8cc9de',
    ink: '#153647',
    ref: 'hex/terrain/reefs.svg',
  },
  // Not a gap (SPEC-047 §8): Worldographer draws Ocean/Sea as a background
  // colour with no icon, and this project's own three-shades study
  // (`docs/completed/wi-119/palette.json`) picked the middle one. `ink`/`ref`
  // are `null` together — there is no overlay to tint or resolve.
  { kind: 'water', label: 'Water', color: '#64b1d8', ink: null, ref: null },

  // ---- Ice ----
  {
    kind: 'snowfields',
    label: 'Snowfields',
    color: '#d9e3e8',
    ink: '#1e3448',
    ref: 'hex/terrain/snowfields.svg',
  },

  // ---- Aliases: kept for RULE-007, retired from a new-authoring picker ----
  // (SPEC-047 §8 — each now draws identical art to the kind named in its
  // comment, per WI-119 §10; DEC-083 (i)'s "extend and alias, never rename"
  // read as "unpaintable", not "gone".)
  {
    kind: 'grass',
    label: 'Grass',
    color: '#7fae52',
    ink: '#243616',
    ref: 'hex/terrain/grassland.svg', // = grassland
    paintable: false,
  },
  {
    kind: 'ice-floe',
    label: 'Ice Floe',
    color: '#cfe4ee',
    ink: '#1e3448',
    ref: 'hex/terrain/snowfields.svg', // = snowfields
    paintable: false,
  },
  {
    kind: 'palm',
    label: 'Palms',
    color: '#c2b26a',
    ink: '#242b0d',
    ref: 'hex/terrain/jungle.svg', // = jungle (the traced glyph is itself a palm silhouette)
    paintable: false,
  },
  {
    kind: 'plateau',
    label: 'Plateau',
    color: '#c2a874',
    ink: '#3b2816',
    ref: 'hex/terrain/hills.svg', // = hills (nearest available shape)
    paintable: false,
  },
  {
    kind: 'scrub',
    label: 'Scrub',
    color: '#a3a069',
    ink: '#283319',
    ref: 'hex/terrain/cactus.svg', // = cactus
    paintable: false,
  },
  {
    kind: 'tundra',
    label: 'Tundra',
    color: '#dfe6ea',
    ink: '#1e3448',
    ref: 'hex/terrain/snowfields.svg', // = snowfields
    paintable: false,
  },

  { kind: UNKNOWN_HEX_KIND, label: 'Unknown', color: '#9aa0a6', ink: '#2b2b2b', ref: UNKNOWN_REF },
];

/**
 * The contents kinds (SPEC-030 §3's "castle, town, fort, cave, danger, temple,
 * …"), in palette order: settlements by descending size, then fortification,
 * then the things a party finds rather than builds.
 */
export const HEX_CONTENTS_CATALOG: readonly HexContentsEntry[] = [
  { kind: 'castle', label: 'Castle', ref: 'hex/contents/castle.svg' },
  { kind: 'town', label: 'Town', ref: 'hex/contents/town.svg' },
  { kind: 'village', label: 'Village', ref: 'hex/contents/village.svg' },
  { kind: 'fort', label: 'Fort', ref: 'hex/contents/fort.svg' },
  { kind: 'tower', label: 'Tower', ref: 'hex/contents/tower.svg' },
  { kind: 'temple', label: 'Temple', ref: 'hex/contents/temple.svg' },
  { kind: 'ruins', label: 'Ruins', ref: 'hex/contents/ruins.svg' },
  { kind: 'cave', label: 'Cave', ref: 'hex/contents/cave.svg' },
  { kind: 'camp', label: 'Camp', ref: 'hex/contents/camp.svg' },
  { kind: 'danger', label: 'Danger', ref: 'hex/contents/danger.svg' },
  // WI-101: the supplied art pack (SPEC-047 §6). 'camp', 'castle', 'cave',
  // 'fort', 'temple', 'town' and 'village' above kept their kind strings —
  // only their `ref` moved to the pack's art (a same-kind supersession, never
  // a rename: RULE-007). These sixteen are new kinds the pack has no existing
  // name for.
  { kind: 'capitol', label: 'Capitol', ref: 'hex/contents/capitol.svg' },
  { kind: 'cave-filled', label: 'Large Cave', ref: 'hex/contents/cave-filled.svg' },
  { kind: 'city', label: 'City', ref: 'hex/contents/city.svg' },
  {
    kind: 'cloud-stronghold',
    label: 'Cloud Stronghold',
    ref: 'hex/contents/cloud-stronghold.svg',
  },
  { kind: 'hamlet-thorpe', label: 'Hamlet/Thorpe', ref: 'hex/contents/hamlet-thorpe.svg' },
  { kind: 'lighthouse', label: 'Lighthouse', ref: 'hex/contents/lighthouse.svg' },
  { kind: 'mine', label: 'Mine', ref: 'hex/contents/mine.svg' },
  {
    kind: 'mountain-stronghold',
    label: 'Mountain Stronghold',
    ref: 'hex/contents/mountain-stronghold.svg',
  },
  { kind: 'palace', label: 'Palace', ref: 'hex/contents/palace.svg' },
  { kind: 'ruin', label: 'Ruin', ref: 'hex/contents/ruin.svg' },
  { kind: 'rock-shelter', label: 'Rock Shelter', ref: 'hex/contents/rock-shelter.svg' },
  { kind: 'shire', label: 'Shire', ref: 'hex/contents/shire.svg' },
  { kind: 'shrine', label: 'Shrine', ref: 'hex/contents/shrine.svg' },
  { kind: 'tower-keep', label: 'Tower Keep', ref: 'hex/contents/tower-keep.svg' },
  { kind: 'tree-fortress', label: 'Tree Fortress', ref: 'hex/contents/tree-fortress.svg' },
  { kind: 'volcano', label: 'Volcano', ref: 'hex/contents/volcano.svg' },
  { kind: UNKNOWN_HEX_KIND, label: 'Unknown', ref: UNKNOWN_REF },
];

const TERRAIN_BY_KIND = new Map(HEX_TERRAIN_CATALOG.map((entry) => [entry.kind, entry]));
const CONTENTS_BY_KIND = new Map(HEX_CONTENTS_CATALOG.map((entry) => [entry.kind, entry]));

/** The terrain a stored `kind` resolves to, falling back to `unknown` rather
 * than throwing — a hex written by a newer build must still draw. */
export function hexTerrainEntry(kind: string): HexTerrainEntry {
  return TERRAIN_BY_KIND.get(kind) ?? TERRAIN_BY_KIND.get(UNKNOWN_HEX_KIND)!;
}

/** As `hexTerrainEntry`, for contents. */
export function hexContentsEntry(kind: string): HexContentsEntry {
  return CONTENTS_BY_KIND.get(kind) ?? CONTENTS_BY_KIND.get(UNKNOWN_HEX_KIND)!;
}

/** Is this a kind this build actually knows, or the `unknown` fallback? Lets a
 * caller tell "the referee painted unknown terrain" from "this build cannot
 * name what the referee painted". */
export function isKnownHexTerrain(kind: string): boolean {
  return TERRAIN_BY_KIND.has(kind) && kind !== UNKNOWN_HEX_KIND;
}

/** As `isKnownHexTerrain`, for contents. */
export function isKnownHexContents(kind: string): boolean {
  return CONTENTS_BY_KIND.has(kind) && kind !== UNKNOWN_HEX_KIND;
}

/** The terrain catalog an authoring surface should actually offer: every
 * kind minus `unknown` (a resolution fallback, never a pick — WI-041) and
 * minus the retired aliases (`paintable: false` — SPEC-047 §8, WI-121). The
 * exclusion lives here so a second authoring surface doesn't have to repeat
 * it, and re-appears with no per-component change if a kind is un-retired. */
export function paintableHexTerrainCatalog(): readonly HexTerrainEntry[] {
  return HEX_TERRAIN_CATALOG.filter(
    (entry) => entry.kind !== UNKNOWN_HEX_KIND && entry.paintable !== false,
  );
}

/** Contents icons are black (SPEC-030 §3), on every terrain. Slightly off pure
 * black for the same reason a terrain overlay's `ink` never touches pure
 * black: it sits on painted art, not on paper. */
export const HEX_CONTENTS_TONE = '#111111';

/** The overlay is texture, not subject: held back so a contents icon
 * (SPEC-030 §3) and the coordinate pill (§1) both stay legible over it. Also
 * exported for the contrast guard below, which checks the tone actually on
 * screen — `ink` blended into `color` at this alpha — rather than the raw
 * `ink`/`color` pair alone. */
export const HEX_TERRAIN_OVERLAY_ALPHA = 0.55;

/** The minimum contrast ratio (WCAG's formula, not its non-text 3:1 floor
 * exactly — this project runs a hair above it deliberately) a terrain's
 * `color`/`ink` pair — and that pair's on-screen blend against the contents
 * tone — must clear (DEC-089). */
export const HEX_TERRAIN_CONTRAST_MIN = 3.3;

/**
 * Relative luminance of a `#rgb`/`#rrggbb` colour, 0 (black) to 1 (white),
 * sRGB-weighted. An unparseable colour reads as mid-grey — the same fallback
 * `contrastRatio` and `blendHexColors` fall back to for the same input.
 */
export function colorLuminance(color: string): number {
  const rgb = parseHexColor(color);
  if (!rgb) return 0.5;
  return 0.2126 * (rgb.r / 255) + 0.7152 * (rgb.g / 255) + 0.0722 * (rgb.b / 255);
}

/** Parses a `#rgb`/`#rrggbb` colour into 0–255 channels, or `null` if it does
 * not parse — shared by `colorLuminance` and `blendHexColors`, so both fail
 * the same colours the same way. */
function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  const hex =
    trimmed.length === 4
      ? `${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed.slice(1);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * The WCAG contrast ratio between two `#rrggbb` colours: `(lighter + 0.05) /
 * (darker + 0.05)` over their relative luminances, always ≥ 1. Pure and
 * exported so `HEX_TERRAIN_CONTRAST_MIN` is unit-testable without a canvas.
 */
export function contrastRatio(a: string, b: string): number {
  const la = colorLuminance(a);
  const lb = colorLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * `fg` normal-alpha-composited over `bg` at `alpha` (0–1) — what a terrain's
 * `ink` overlay actually looks like once drawn at `HEX_TERRAIN_OVERLAY_ALPHA`
 * over its own `color`, which is the pair the contents icon actually has to
 * stay legible against (WI-119 §6): the raw `ink`/`color` pair alone can pass
 * a contrast check while the blended result — always closer to `color` than
 * `ink` is — does not. Unparseable input reads as mid-grey, same as
 * `colorLuminance`.
 */
export function blendHexColors(fg: string, bg: string, alpha: number): string {
  const f = parseHexColor(fg) ?? { r: 128, g: 128, b: 128 };
  const b = parseHexColor(bg) ?? { r: 128, g: 128, b: 128 };
  const mix = (fc: number, bc: number) => Math.round(fc * alpha + bc * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(f.r, b.r))}${toHex(mix(f.g, b.g))}${toHex(mix(f.b, b.b))}`;
}

// ---- Roads and rivers (SPEC-047 §2) ----

/**
 * One line kind: the three shades it may be drawn in and the join style it
 * takes (SPEC-047 §2). Art, not data — a stored `HexLine` carries the kind and
 * an *index*, never a colour, so re-drawing the palette stays a change to this
 * file rather than a migration, exactly as it is for terrain above.
 */
export interface HexLineEntry {
  kind: HexLineKind;
  label: string;
  /** Three, in palette order: light, mid, dark. Indexed by `HexLine.shade`. */
  shades: readonly string[];
  /** The join a line drawn with this tool starts out with — mitred for a road,
   * round for a river (SPEC-047 §4). It is copied onto the document at draw
   * time and read from there afterwards, never re-derived: a river that was
   * re-coloured is still round (`HexLineJoin`). */
  join: HexLineJoin;
}

/**
 * The two line kinds (SPEC-047 §§2, 4) — three browns for a road, three blues
 * for a river.
 *
 * The browns run from a dry track to a made road, the blues from a stream to a
 * deep river; both are mid-tone for the same reason the terrain fills are, and
 * both are readable over every terrain in `HEX_TERRAIN_CATALOG` rather than
 * tuned against one.
 */
export const HEX_LINE_CATALOG: readonly HexLineEntry[] = [
  { kind: 'road', label: 'Road', shades: ['#a98a5f', '#7d5f3a', '#513c22'], join: 'mitre' },
  { kind: 'river', label: 'River', shades: ['#7fb2d4', '#3f7ea8', '#245478'], join: 'round' },
];

/**
 * The three widths, as **multiples of `hex.size`** (SPEC-047 §§2, 4) — indexed
 * by `HexLine.width`, and crossed at the render boundary like every other hex
 * measurement (RULE-006: no stored pixel, one multiplier applied once).
 *
 * A fixed option set rather than a free-form number, the same choice SPEC-028
 * made for the N-gon's sides and the band widths, and for the same reason: the
 * useful values are the ones that read at a hex's scale, and a 7.5-wide river
 * was reachable and never wanted.
 */
export const HEX_LINE_WIDTHS: readonly number[] = [0.08, 0.14, 0.22];

const LINE_BY_KIND = new Map(HEX_LINE_CATALOG.map((entry) => [entry.kind, entry]));

/** The line kind a stored `kind` resolves to. Falls back to the first entry
 * rather than throwing, for the reason `hexTerrainEntry` falls back to
 * `unknown`: a line written by a newer build must still draw. There is no
 * `unknown` line kind because there is nothing sensible to draw for one — a
 * line has to have a colour and a width to exist at all. */
export function hexLineEntry(kind: string): HexLineEntry {
  return LINE_BY_KIND.get(kind as HexLineKind) ?? HEX_LINE_CATALOG[0]!;
}

/** Is this a kind this build knows? The counterpart of `isKnownHexTerrain` —
 * lets a caller tell a real road from `hexLineEntry`'s fallback. */
export function isKnownHexLine(kind: string): boolean {
  return LINE_BY_KIND.has(kind as HexLineKind);
}

/** Clamps an index into `range`, so an out-of-range stored index draws as the
 * nearest thing this build has rather than as `undefined`. A non-integer or
 * non-finite index reads as 0. */
function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

/** The colour a stored `{ kind, shade }` resolves to (SPEC-047 §2). The
 * document never carries this string. */
export function hexLineShade(kind: string, shade: number): string {
  const shades = hexLineEntry(kind).shades;
  return shades[clampIndex(shade, shades.length)]!;
}

/** The width a stored index resolves to, as a multiple of `hex.size` —
 * multiply by the circumradius at the render boundary. */
export function hexLineWidth(width: number): number {
  return HEX_LINE_WIDTHS[clampIndex(width, HEX_LINE_WIDTHS.length)]!;
}
