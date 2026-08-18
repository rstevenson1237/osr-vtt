import { BundledAssetStore, LocalStore, type AssetStore, type CampaignFile } from '@osr-vtt/shared';
import { STARTER_PROFILE_TEMPLATE } from '../profile/starter-template';

/**
 * The **local** build's store touchpoint — `client.ts`'s counterpart, and the
 * only place in a local build that names a concrete `CampaignStore`
 * (RULE-001, SPEC-041 §6).
 *
 * Vite's `local` mode aliases `./lib/firebase/client` to this file
 * (`vite.config.ts`), so a local build's module graph never reaches `client.ts`,
 * `env.ts`, `FirebaseStore` or the Firebase SDK. The swap happens in the
 * resolver, before the bundler runs: there is no runtime branch to fold away,
 * which is the whole reason a local build can contain no Firebase code and no
 * project identifier at all.
 *
 * It lives in `lib/firebase/` — an odd address for a file whose point is having
 * no Firebase — because RULE-001 and SPEC-041 §6 both name that directory as
 * *the* store touchpoint, and splitting the choice across two directories would
 * make the rule harder to check, not easier.
 */

/** Which build this is (SPEC-041 §6). */
export const APP_MODE = 'local' as const;
/**
 * False: a local build has one actor, the referee, who is also the only seat
 * and is always GM (SPEC-041 §3, DEC-074). Every surface whose meaning is
 * "another person" reads this one signal.
 */
export const MULTIPLAYER = false;

/** Bundled refs only. URL refs still resolve — and still need the network, and
 * still fail visibly without it (SPEC-041 §4). Cloud Storage uploads are off,
 * as they are in every build today. */
export function getAssetStore(): AssetStore {
  return new BundledAssetStore(`${import.meta.env.BASE_URL}assets/`);
}

/**
 * Opens an existing campaign file. Resolves to the store and the room id that
 * *is* this campaign; rejects — with `VttCampFormatError` for an archive older
 * than the format supports — rather than opening something it cannot render
 * (RULE-014).
 */
export async function openLocalCampaign(
  file: CampaignFile,
): Promise<{ store: LocalStore; roomId: string }> {
  const store = new LocalStore(file);
  try {
    return { store, roomId: await store.openCampaign() };
  } catch (err) {
    store.dispose();
    throw err;
  }
}

/**
 * Creates a fresh campaign in `file`, seeded the same way `createRoom` seeds a
 * hosted room — including the starter profile template (SPEC-041 §5).
 */
export async function createLocalCampaign(
  file: CampaignFile,
  name: string,
): Promise<{ store: LocalStore; roomId: string }> {
  const store = new LocalStore(file);
  try {
    const roomId = await store.createCampaign({
      name,
      profileTemplate: STARTER_PROFILE_TEMPLATE,
    });
    return { store, roomId };
  } catch (err) {
    store.dispose();
    throw err;
  }
}

/** The root the app renders for this build (SPEC-041 §3 — features are removed
 * by not rendering them, decided here, where the store is chosen). */
export { default as AppRoot } from '../components/LocalRoot.svelte';
