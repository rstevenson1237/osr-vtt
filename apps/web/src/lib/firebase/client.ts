import {
  createFirebaseClient,
  FirebaseStore,
  type CampaignStore,
  type FirebaseClient,
} from '@osr-vtt/shared';
import { loadFirebaseEnv } from './env';

/**
 * The ONLY place in `apps/web` that touches a concrete `CampaignStore`
 * implementation (Plan §1.3). Everything else — every Svelte component —
 * only ever sees the `CampaignStore` interface, obtained via Svelte context
 * (see `App.svelte`). Swapping `FirebaseStore` for another backend later
 * means changing this one function.
 */
let singleton: CampaignStore | undefined;
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
 * The Cloud Storage handle, or `undefined` on a build without uploads — the
 * one thing `lib/assets.ts` needs from here to decide which `AssetStore` to
 * construct. Deliberately not exported as a `getStorage()` call of its own:
 * the app must have exactly one Firebase app and one emulator wiring, and that
 * lives in `createFirebaseClient`.
 */
export function getUploadStorage(): FirebaseClient['storage'] {
  return getClient().storage;
}
