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
