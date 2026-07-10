export interface AppFirebaseEnv {
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    databaseURL: string;
    appId: string;
  };
  useEmulators: boolean;
}

const DEMO_PROJECT_ID = 'osr-vtt';

/**
 * Reads the Firebase web config from `VITE_*` env vars (Plan §10.2 — the
 * human sets these once a real project exists; this config is a public
 * identifier, safe to commit/expose). Falls back to a demo config matching
 * `.firebaserc`'s project id so `pnpm dev` + `firebase emulators:start` works
 * with zero setup (Roadmap §10.3) — no real project is required for Phase 0.
 */
export function loadFirebaseEnv(): AppFirebaseEnv {
  const env = import.meta.env;
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? DEMO_PROJECT_ID;
  return {
    config: {
      apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
      projectId,
      databaseURL:
        env.VITE_FIREBASE_DATABASE_URL ?? `https://${projectId}-default-rtdb.firebaseio.com`,
      appId: env.VITE_FIREBASE_APP_ID ?? '1:0:web:demo',
    },
    // Default ON: Phase 0 has no production Firebase project wired up yet.
    // Set VITE_USE_EMULATORS=false once real config + a deploy target exist.
    useEmulators: env.VITE_USE_EMULATORS !== 'false',
  };
}
