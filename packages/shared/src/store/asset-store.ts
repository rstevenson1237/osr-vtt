import type { FirebaseStorage } from 'firebase/storage';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

/**
 * Asset-access abstraction (Plan §6). Isolated behind an interface so that
 * v1.1's `FirebaseStorageAssetStore` (requires the Blaze plan) is a drop-in
 * later, without touching any component code. Phase 0 ships `BundledAssetStore`
 * only — no uploads, no Cloud Storage, no card on file.
 */
export interface AssetStore {
  /** Resolves an asset ref (e.g. "tokens/goblin.png") to a fetchable URL. */
  resolve(ref: string): string;
  /** Not implemented until v1.1 (Plan §6) — Blaze-gated Cloud Storage upload. */
  upload?(file: File): Promise<string>;
}

/**
 * Generated default tokens (Master Plan v2, R7.1): a `gen:disc:{label}:
 * {colorToken}` ref is a self-describing "recipe", not a lookup key — every
 * `AssetStore.resolve()` renders it to the same SVG data URI without a
 * network round trip, so it works as the fallback everywhere a token/portrait
 * ref is missing (a fresh seat, a creature dropped with no art picked). The
 * label is the visible glyph; `colorToken` is any valid SVG paint value
 * (callers use `hsl(...)`, see `genColorToken` below) baked into the ref
 * itself so rendering stays a pure function of the ref string alone.
 */
const GEN_TOKEN_PREFIX = 'gen:disc:';
const GEN_TOKEN_RE = /^gen:disc:([^:]+):(.+)$/;

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

/** Renders a `gen:disc:` ref to its SVG markup — a filled circle (themed
 * ring) with a centered high-contrast letterform (Plan R7.1). Exported
 * standalone so it (and its determinism) can be unit-tested without going
 * through a concrete `AssetStore`. */
export function renderGenTokenSvg(label: string, colorToken: string): string {
  const { ring, text } = discStyle(colorToken);
  const fontSize = label.length > 1 ? 24 : 30;
  const safeLabel = escapeSvgText(label);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="29" fill="${colorToken}" stroke="${ring}" stroke-width="4"/>` +
    `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Trebuchet MS', Verdana, sans-serif" font-weight="700" ` +
    `font-size="${fontSize}" fill="${text}">${safeLabel}</text></svg>`
  );
}

/** Resolves a `gen:disc:{label}:{colorToken}` ref to a `data:image/svg+xml`
 * URI, or `null` if `ref` isn't in the `gen:` scheme (the caller falls
 * through to its normal resolution). Pure function of `ref` alone — same ref
 * in, byte-identical SVG out, every time (Plan R7.1's determinism). */
export function resolveGenTokenRef(ref: string): string | null {
  const m = GEN_TOKEN_RE.exec(ref);
  if (!m) return null;
  const [, label, colorToken] = m as unknown as [string, string, string];
  const svg = renderGenTokenSvg(label, colorToken);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Builds a `gen:disc:` ref from a label and a color seed — the one place a
 * caller needs to reach for a default token/portrait ref. `colorSeed` is
 * hashed into a stable hue (same seed ⇒ same color always, no state to
 * sync), following the same pattern shared-roll seat tinting already uses
 * (`apps/web/src/lib/dice/seat-color.ts`) so a player's token and their dice
 * read as "the same color" at the table. */
export function buildGenTokenRef(label: string, colorSeed: string): string {
  return `${GEN_TOKEN_PREFIX}${label}:${genColorToken(colorSeed)}`;
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
    const gen = resolveGenTokenRef(ref);
    if (gen) return gen;
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

/**
 * v1.1 (Plan §6, §10.5) — Blaze-gated Cloud Storage uploads. Implements the
 * same `AssetStore` interface so it's a drop-in swap for `BundledAssetStore`
 * later; nothing in `apps/web` constructs this today (see `lib/assets.ts`) —
 * it stays **disabled** until you upgrade the Firebase project to Blaze and
 * explicitly opt in.
 *
 * `resolve()` must stay synchronous (the `AssetStore` interface contract),
 * but Cloud Storage download URLs are only obtainable async. This class
 * resolves refs it has itself uploaded in the current session from an
 * in-memory cache; a persisted uploader-ref registry (so uploaded refs
 * resolve across reloads/other clients) is a v1.1 UI concern, out of scope
 * for "leave it behind the interface but disabled."
 */
export class FirebaseStorageAssetStore implements AssetStore {
  private readonly cache = new Map<string, string>();

  constructor(private readonly storage: FirebaseStorage) {}

  resolve(ref: string): string {
    const gen = resolveGenTokenRef(ref);
    if (gen) return gen;
    if (/^https?:\/\//.test(ref)) return ref;
    return this.cache.get(ref) ?? ref;
  }

  async upload(file: File): Promise<string> {
    const path = `uploads/${Date.now()}-${file.name}`;
    const fileRef = storageRef(this.storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    this.cache.set(path, url);
    return path;
  }
}
