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
 * boundary — terrain to whichever of `HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT`
 * contrasts with its own background colour (§2), contents to black (§3) — and a
 * tint multiplies, so black art could not be tinted lighter.
 *
 * Roads and rivers (SPEC-047 §2) join at the bottom of the file on the same
 * terms: a stored line carries its kind and an *index* into the shades and
 * widths held here, never a colour and never a pixel width.
 */

import type { HexLineJoin, HexLineKind } from '../../types.js';

/** One terrain kind: the hex's background colour and the overlay drawn on it
 * (SPEC-030 §2). Both halves are art, not data — a stored hex carries `kind`. */
export interface HexTerrainEntry {
  kind: string;
  /** Human-readable name, for the WI-041 palette. */
  label: string;
  /** The whole hex's fill, `#rrggbb` — the same format `GameMap.background`
   * and `MapBackground` use, so one `hexToNumber` serves all three. */
  color: string;
  /** The overlay art, white, resolved through `AssetStore`. */
  ref: string;
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
 * The terrain kinds (SPEC-030 §2's "plains, forest, hills, mountain, swamp,
 * jungle, …"), in palette order: open ground first, then wooded, then high,
 * then wet, then the extremes.
 *
 * The colours are mid-tone on purpose. A hex is a background *and* an overlay
 * *and*, often, a black contents icon, so a fill dark enough to swallow the
 * icon or light enough to bleach the overlay makes the tile unreadable — and
 * `hexOverlayTone` can only pick the more contrasting of two tones, not invent
 * headroom that isn't there.
 */
export const HEX_TERRAIN_CATALOG: readonly HexTerrainEntry[] = [
  { kind: 'plains', label: 'Plains', color: '#d8cf94', ref: 'hex/terrain/plains.svg' },
  { kind: 'forest', label: 'Forest', color: '#3f6f42', ref: 'hex/terrain/forest.svg' },
  { kind: 'jungle', label: 'Jungle', color: '#2f6b48', ref: 'hex/terrain/jungle.svg' },
  { kind: 'hills', label: 'Hills', color: '#b9945a', ref: 'hex/terrain/hills.svg' },
  { kind: 'mountains', label: 'Mountains', color: '#8d8d92', ref: 'hex/terrain/mountains.svg' },
  { kind: 'swamp', label: 'Swamp', color: '#5f6b3f', ref: 'hex/terrain/swamp.svg' },
  { kind: 'desert', label: 'Desert', color: '#e6cf9a', ref: 'hex/terrain/desert.svg' },
  { kind: 'water', label: 'Water', color: '#4a7cb0', ref: 'hex/terrain/water.svg' },
  { kind: 'tundra', label: 'Tundra', color: '#dfe6ea', ref: 'hex/terrain/tundra.svg' },
  // WI-101: the supplied art pack (SPEC-047 §6). 'hills', 'desert' and 'water'
  // above kept their kind strings and colours — only their `ref` moved to the
  // pack's art, which is a same-kind supersession, never a rename (RULE-007).
  // These eleven are new kinds the pack has no existing name for.
  { kind: 'barren', label: 'Barren', color: '#a89a78', ref: 'hex/terrain/barren.svg' },
  { kind: 'grass', label: 'Grass', color: '#7fae52', ref: 'hex/terrain/grass.svg' },
  { kind: 'ice-floe', label: 'Ice Floe', color: '#cfe4ee', ref: 'hex/terrain/ice-floe.svg' },
  {
    kind: 'mountain-major',
    label: 'Mountains (Major)',
    color: '#75757a',
    ref: 'hex/terrain/mountain-major.svg',
  },
  {
    kind: 'mountain-minor',
    label: 'Mountains (Minor)',
    color: '#a08f74',
    ref: 'hex/terrain/mountain-minor.svg',
  },
  { kind: 'palm', label: 'Palms', color: '#c2b26a', ref: 'hex/terrain/palm.svg' },
  { kind: 'plateau', label: 'Plateau', color: '#c2a874', ref: 'hex/terrain/plateau.svg' },
  { kind: 'reed', label: 'Reeds', color: '#8ea56a', ref: 'hex/terrain/reed.svg' },
  { kind: 'scrub', label: 'Scrub', color: '#a3a069', ref: 'hex/terrain/scrub.svg' },
  {
    kind: 'tree-deciduous',
    label: 'Deciduous Trees',
    color: '#5c8a4a',
    ref: 'hex/terrain/tree-deciduous.svg',
  },
  {
    kind: 'tree-evergreen',
    label: 'Evergreen Trees',
    color: '#2e5c38',
    ref: 'hex/terrain/tree-evergreen.svg',
  },
  { kind: UNKNOWN_HEX_KIND, label: 'Unknown', color: '#9aa0a6', ref: UNKNOWN_REF },
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

/** The two tones a terrain overlay is ever drawn in (SPEC-030 §2's "contrasting
 * light/dark tone"). Not pure black and white: the overlay is texture under the
 * contents icon, and full black would compete with §3's icon while full white
 * would flare on the pale terrains. */
export const HEX_OVERLAY_DARK = '#2b2b2b';
export const HEX_OVERLAY_LIGHT = '#f2f2f2';

/**
 * Relative luminance of a `#rgb`/`#rrggbb` colour, 0 (black) to 1 (white),
 * sRGB-weighted. An unparseable colour reads as mid-grey, which makes
 * `hexOverlayTone` pick the dark tone — the safer default, since the
 * terrain fill behind it would be equally unparseable and drawn as-is.
 */
export function colorLuminance(color: string): number {
  const trimmed = color.trim();
  const hex =
    trimmed.length === 4
      ? `${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed.slice(1);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return 0.5;
  const n = Number.parseInt(hex, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Which tone a terrain's overlay is drawn in, against that terrain's own
 * background colour (SPEC-030 §2).
 *
 * A threshold rather than a per-entry stored tone, so a re-coloured terrain
 * can never be left with the tone its old colour needed. Pure and exported so
 * the rule is unit-testable without a canvas — the same treatment
 * `hexPillFontPx` gets.
 */
export function hexOverlayTone(color: string): string {
  return colorLuminance(color) >= 0.5 ? HEX_OVERLAY_DARK : HEX_OVERLAY_LIGHT;
}

/** Contents icons are black (SPEC-030 §3), on every terrain. Slightly off pure
 * black for the same reason `HEX_OVERLAY_DARK` is: it sits on painted art, not
 * on paper. */
export const HEX_CONTENTS_TONE = '#111111';

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
