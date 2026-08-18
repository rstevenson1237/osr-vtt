import {
  BundledAssetStore,
  FirebaseStorageAssetStore,
  createFirebaseClient,
  FirebaseStore,
  type AssetStore,
  type CampaignStore,
  type FirebaseClient,
} from '@osr-vtt/shared';
import { loadFirebaseEnv } from './env';

/**
 * The ONLY place in `apps/web` that touches a concrete `CampaignStore`
 * implementation (Plan §1.3, RULE-001) — for the **hosted** build. Everything
 * else — every Svelte component — only ever sees the `CampaignStore` interface,
 * obtained via Svelte context (see `App.svelte`). Swapping `FirebaseStore` for
 * another backend later means changing this one function.
 *
 * A **local** build never loads this module at all. `client.local.ts` is its
 * counterpart — same exported surface, no Firebase — and the Vite `local` mode
 * aliases `./lib/firebase/client` to it (SPEC-041 §6, `vite.config.ts`). That
 * swap is a resolver decision made before the bundler runs, not a runtime
 * branch, which is what lets a local build contain no Firebase code and no
 * project identifier at all: nothing in its module graph reaches this file,
 * `env.ts`, or the SDK.
 */

/** Which build this is (SPEC-041 §6). */
export const APP_MODE = 'hosted' as const;
/**
 * Whether another person can be at this table. True here, false in a local
 * build — the single signal every surface in SPEC-041 §3's removed list is
 * gated on, decided here beside the store rather than negotiated per feature.
 */
export const MULTIPLAYER = true;

let singleton: CampaignStore | undefined;
let assetSingleton: AssetStore | undefined;
let clientSingleton: FirebaseClient | undefined;

function getClient(): FirebaseClient {
  if (!clientSingleton) {
    const env = loadFirebaseEnv();
    clientSingleton = createFirebaseClient({
      config: env.config,
      useEmulators: env.useEmulators,
      // App Check (R24.2). Absent unless VITE_FIREBASE_APPCHECK_SITE_KEY is
      // set, so emulator/e2e/zero-setup dev runs are unaffected; see
      // `loadFirebaseEnv` for why that default matters.
      ...(env.appCheck ? { appCheck: env.appCheck } : {}),
      // Cloud Storage (SPEC-034). Off unless VITE_ENABLE_STORAGE_UPLOADS=true,
      // which is what keeps a Spark-tier build from ever reaching for a bucket
      // that does not exist. When it IS on, the same handle serves both the
      // upload path (`lib/assets.ts`) and `deleteRoom`'s object sweep, so a
      // room's uploads cannot outlive the room (SPEC-034 §4).
      storageUploads: env.storageUploads,
    });
  }
  return clientSingleton;
}

export function getStore(): CampaignStore {
  if (!singleton) singleton = new FirebaseStore(getClient());
  return singleton;
}

/**
 * v1 default (Plan §6, §8.11): BundledAssetStore only — resolves refs against
 * the static bundle's `assets/` directory (or a pasted absolute URL,
 * unchanged). No uploads, no Cloud Storage, no card on file.
 *
 * `FirebaseStorageAssetStore` (Plan §7 Phase 5, §10.5, SPEC-034) exists behind
 * the same `AssetStore` interface but stays **disabled** — Cloud Storage
 * requires the Blaze plan (a card on file), which this project does not assume.
 * Flip it on only after the `[HUMAN]` console work in
 * `docs/runbooks/blaze-billing.md`, by setting `VITE_ENABLE_STORAGE_UPLOADS=true`.
 *
 * The decision is `getUploadStorage()`'s to report, not a second reading of the
 * env var: the same flag also decides whether `deleteRoom` sweeps the bucket,
 * and two independent readings of it could disagree — leaving a build that
 * uploads objects nothing ever deletes.
 */
export function getAssetStore(): AssetStore {
  if (!assetSingleton) {
    const storage = getUploadStorage();
    assetSingleton = storage
      ? new FirebaseStorageAssetStore(storage)
      : new BundledAssetStore(`${import.meta.env.BASE_URL}assets/`);
  }
  return assetSingleton;
}

/**
 * The Cloud Storage handle, or `undefined` on a build without uploads.
 * Deliberately not exported as a `getStorage()` call of its own: the app must
 * have exactly one Firebase app and one emulator wiring, and that lives in
 * `createFirebaseClient`.
 */
export function getUploadStorage(): FirebaseClient['storage'] {
  return getClient().storage;
}

/** The root the app renders for this build (SPEC-041 §3 — features are removed
 * by not rendering them, decided here, where the store is chosen). */
export { default as AppRoot } from '../components/HostedRoot.svelte';
