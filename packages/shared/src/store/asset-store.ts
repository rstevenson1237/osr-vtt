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
