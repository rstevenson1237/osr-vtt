
/** One stored object in a room's uploads folder, as the usage readout and the
 * room-delete enumeration see it (SPEC-034 §§3–4). */
export interface RoomUpload {
  /** Storage path, which is also the asset ref — `AssetStore.resolve` takes it
   * back unchanged. */
  path: string;
  /** Object size in bytes; what the per-room usage readout sums. */
  bytes: number;
  contentType: string;
  /** The uid segment of the path — every object is attributable by construction
   * (SPEC-034 §2), with no metadata lookup needed to say who wrote it. */
  uploadedByUid: string;
  /** A fetchable URL for the object, so a listed upload can be previewed. */
  url: string;
}

/**
 * Asset-access abstraction (Plan §6). Isolated behind an interface so that
 * v1.1's `FirebaseStorageAssetStore` (requires the Blaze plan) is a drop-in
 * later, without touching any component code. Phase 0 ships `BundledAssetStore`
 * only — no uploads, no Cloud Storage, no card on file.
 *
 * Every member below `resolve` is optional for exactly that reason: their
 * presence is how a component asks "are uploads live in this build?" without
 * knowing which implementation it holds, and `BundledAssetStore` answers no by
 * simply not having them.
 */
export interface AssetStore {
  /** Resolves an asset ref (e.g. "tokens/goblin.png") to a fetchable URL. */
  resolve(ref: string): string;
  /**
   * Blaze-gated Cloud Storage upload (Plan §6, SPEC-034). Takes the room and
   * the uploading uid because the object's **path shape** is part of the
   * boundary, not a naming convention: `rooms/{roomId}/uploads/{uid}/{objectId}`
   * is what lets `firebase/storage.rules` check membership and own-uid, and
   * what lets `deleteRoom` find the objects again (SPEC-034 §§2, 4).
   *
   * Resolves to the stored **path**, which is the asset ref callers persist.
   */
  upload?(file: File, ctx: { roomId: string; uid: string }): Promise<string>;
  /** Every object stored for a room. Feeds the per-room usage readout, which is
   * friction and not a boundary (SPEC-034 §3.2). */
  listRoomUploads?(roomId: string): Promise<RoomUpload[]>;
  /** Removes one object by its path. */
  deleteUpload?(path: string): Promise<void>;
  /** Removes every object stored for a room (SPEC-034 §4). Called by the
   * room's recursive delete, not only by the UI. */
  deleteRoomUploads?(roomId: string): Promise<void>;
}

/** Longest a label ever renders, regardless of how much text is embedded in
 * the ref (Plan R18.1 — "sane render cap so the disc stays legible"). Counted
 * in Unicode code points so a single emoji glyph counts as one, not two. */
export const GEN_TOKEN_LABEL_CAP = 3;

/** A small themed palette for the "Generate default" color picker (Plan
 * R18.1) — same hue/saturation/lightness family as `genColorToken` so a
 * hand-picked swatch reads consistently with the auto-assigned defaults. */
export const GEN_TOKEN_PALETTE: readonly string[] = [
  'hsl(6, 65%, 45%)',
  'hsl(48, 65%, 45%)',
  'hsl(140, 55%, 42%)',
  'hsl(200, 65%, 45%)',
  'hsl(265, 50%, 50%)',
  'hsl(320, 55%, 48%)',
];

/** A small hex palette for the character quick-sheet's color picker (Master
 * Plan v2 addendum, quick-sheet token/color split) — same hue family as
 * `GEN_TOKEN_PALETTE` but in `#rrggbb` hex, since `Token.color`/
 * `ProfileInstance.color` are validated hex (matching `GameMap.background`'s
 * color format, and what `<input type="color">` always emits), unlike
 * `GEN_TOKEN_PALETTE`'s `hsl()` (an SVG paint value baked into a
 * `gen:disc:` ref, a different use). */
export const CHARACTER_COLOR_PALETTE: readonly string[] = [
  '#c0392b',
  '#d68910',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#c2185b',
];

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HSL_RE = /^hsl\(\s*(-?[\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/;

/** Builds the ring/text colors from an `hsl()` colorToken so the letterform
 * stays high-contrast (Plan R7.1) regardless of the disc's hue/lightness.
 * Any non-`hsl()` colorToken (a bare CSS color name, a hex code) falls back
 * to a fixed dark ring + light text — still renders, just without the
 * lightness-aware contrast flip. */
function discStyle(colorToken: string): { ring: string; text: string } {
  const m = HSL_RE.exec(colorToken.trim());
  if (!m) return { ring: 'rgba(0,0,0,0.45)', text: '#f6f1e6' };
  const [, h, s, l] = m as unknown as [string, string, string, string];
  const lightness = Number(l);
  const ring = `hsl(${h}, ${s}%, ${Math.max(0, lightness - 22)}%)`;
  const text = lightness > 55 ? '#1a1a1a' : '#f6f1e6';
  return { ring, text };
}

/** Converts a `gen:disc:` ref's baked paint value to the `#rrggbb` hex that
 * `Token.color`/`ProfileInstance.color` are validated against (SPEC-048 §2,
 * DEC-087 question 1), or `null` when it is not a value this can convert.
 *
 * The two formats have to agree. A ref bakes an SVG paint value — `hsl(...)`
 * for every auto-assigned default (`genColorToken`) and every
 * `GEN_TOKEN_PALETTE` swatch — while the colour *fields* are hex, the format
 * `GameMap.background` and `MapBackground` already use. The v29->v30 backfill
 * converts once, and the converted value is what both the disc and any later
 * colour pick read, so the pair can never diverge.
 *
 * A value already in hex passes through, normalised to lowercase `#rrggbb`
 * (three-digit `#rgb` expanded), because `<input type="color">` and a
 * hand-picked custom colour can both put one into a ref. Anything else — a
 * bare CSS colour name, `rgb(...)`, a gradient — returns `null`: there is no
 * honest hex for it without a rendering engine, and the caller's right move is
 * to leave the colour field absent rather than invent one. Absence is a
 * legitimate state for both fields.
 *
 * Pure, and exact at the rounding boundary the palette sits on: the same
 * token in, the same hex out, every time. */
export function genColorHex(colorToken: string): string | null {
  const token = colorToken.trim();

  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(token);
  if (hex) {
    const digits = hex[1]!;
    const full =
      digits.length === 3
        ? Array.from(digits, (d) => d + d).join('')
        : digits;
    return `#${full.toLowerCase()}`;
  }

  const m = HSL_RE.exec(token);
  if (!m) return null;
  const [, rawH, rawS, rawL] = m as unknown as [string, string, string, string];
  // Hue wraps; saturation and lightness clamp — the same reading a browser
  // gives these, so a converted swatch matches the disc it was rendered as.
  const h = ((Number(rawH) % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, Number(rawS))) / 100;
  const l = Math.min(100, Math.max(0, Number(rawL))) / 100;
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const min = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[sector]!;

  const channel = (v: number): string =>
    Math.round((v + min) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Renders a label+color pair to its SVG markup — a filled circle (themed
 * ring) with a centered high-contrast letterform (Plan R7.1). Originally the
 * body of a `gen:disc:` ref resolver; since SPEC-048 §5 it is an ordinary
 * pure function called from stored `letter`/`color` fields — a token's own,
 * or a computed default (a fresh seat's letter, an unset creature's batch
 * colour) — rather than from a parsed ref. Every surface that needs a
 * resolvable image for a letter-only token/portrait wraps this with
 * `genTokenDataUri`. */
export function renderGenTokenSvg(label: string, colorToken: string): string {
  const { ring, text } = discStyle(colorToken);
  // Unicode-aware split so a single emoji/symbol glyph counts as one glyph,
  // not the 2+ UTF-16 code units it may occupy.
  const glyphs = Array.from(label).slice(0, GEN_TOKEN_LABEL_CAP);
  const displayLabel = glyphs.join('');
  const fontSize = glyphs.length > 2 ? 18 : glyphs.length > 1 ? 24 : 30;
  const safeLabel = escapeSvgText(displayLabel);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="29" fill="${colorToken}" stroke="${ring}" stroke-width="4"/>` +
    `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Trebuchet MS', Verdana, sans-serif" font-weight="700" ` +
    `font-size="${fontSize}" fill="${text}">${safeLabel}</text></svg>`
  );
}

/** Wraps `renderGenTokenSvg`'s markup as a fetchable `data:image/svg+xml`
 * URI — what every `<img>` surface needs for a token/portrait that has no
 * real art (SPEC-048 §5: `imageRef`/`portraitRef` absent means "draw the
 * letter on the colour"). Pure: same label and color in, byte-identical URI
 * out, every time. Replaces the old `gen:disc:` ref this used to be parsed
 * out of — the ref is gone, but a caller still needs a resolvable image. */
export function genTokenDataUri(label: string, color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(renderGenTokenSvg(label, color))}`;
}

const HUE_STEP = 47; // coprime-ish with 360 so nearby hashes still spread out

function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable `hsl()` color for any seed string. */
export function genColorToken(seed: string): string {
  const hue = (hashSeed(seed) * HUE_STEP) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

/** Spreadsheet-style base-26 label for a 0-based index (0→"A", 25→"Z",
 * 26→"AA", …). Used for deterministic default-token labels: players A, B,
 * C… by seat join order; referee creature *types* a, b, c… lowercased
 * (Plan R7.1). */
export function letterLabel(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * v1 default (Plan §6, §8.11): resolves refs against the bundled starter
 * pack served from Firebase Hosting / the static build's `public/assets/`
 * directory. No network calls, no card required.
 */
export class BundledAssetStore implements AssetStore {
  constructor(private readonly baseUrl: string = '/assets/') {}

  resolve(ref: string): string {
    if (/^https?:\/\//.test(ref)) {
      // Plan §6 also allows a referee to paste an external image URL
      // (UrlRefAssetStore) — accept absolute URLs unchanged so a single
      // AssetStore can serve both without the UI needing to know which.
      return ref;
    }
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const cleanRef = ref.replace(/^\/+/, '');
    return `${base}${cleanRef}`;
  }
}
