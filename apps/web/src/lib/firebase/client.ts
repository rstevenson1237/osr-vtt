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
    });
    singleton = new FirebaseStore(client);
  }
  return singleton;
}
