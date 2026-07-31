import { createFirebaseClient, FirebaseStore, type CampaignStore } from '@osr-vtt/shared';
import { loadFirebaseEnv } from './env';

/**
 * The ONLY place in `apps/web` that touches a concrete `CampaignStore`
 * implementation (Plan §1.3). Everything else — every Svelte component —
 * only ever sees the `CampaignStore` interface, obtained via Svelte context
 * (see `App.svelte`). Swapping `FirebaseStore` for another backend later
 * means changing this one function.
 */
let singleton: CampaignStore | undefined;

export function getStore(): CampaignStore {
  if (!singleton) {
    const env = loadFirebaseEnv();
    const client = createFirebaseClient({
      config: env.config,
      useEmulators: env.useEmulators,
      // App Check (R24.2). Absent unless VITE_FIREBASE_APPCHECK_SITE_KEY is
      // set, so emulator/e2e/zero-setup dev runs are unaffected; see
      // `loadFirebaseEnv` for why that default matters.
      ...(env.appCheck ? { appCheck: env.appCheck } : {}),
    });
    singleton = new FirebaseStore(client);
  }
  return singleton;
}
