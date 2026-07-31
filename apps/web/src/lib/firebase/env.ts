export interface AppFirebaseEnv {
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    databaseURL: string;
    appId: string;
  };
  useEmulators: boolean;
  /** App Check (R24.2) — absent until a reCAPTCHA v3 site key is configured. */
  appCheck?: {
    siteKey: string;
    debugToken?: string | true;
  };
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
  const useEmulators = env.VITE_USE_EMULATORS !== 'false';
  // App Check (R24.2) is OFF unless a site key is configured. That default is
  // load-bearing: the emulator suite, `pnpm dev` with zero setup, and every
  // Playwright run all reach a backend that has no App Check registration, and
  // initializing it there would attest against a nonexistent provider.
  //
  // When a key IS present, dev and emulator runs get the debug provider so
  // they keep working against a registered project. `import.meta.env.DEV` is
  // false in the production build, so a deployed bundle never carries it.
  const siteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  const wantsDebug = useEmulators || env.DEV;
  const debugToken = env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN ?? (wantsDebug ? true : undefined);

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
    useEmulators,
    ...(siteKey ? { appCheck: { siteKey, ...(debugToken ? { debugToken } : {}) } } : {}),
  };
}
