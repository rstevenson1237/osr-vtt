import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { type Database, connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export interface EmulatorPorts {
  auth: number;
  firestore: number;
  database: number;
}

export const DEFAULT_EMULATOR_PORTS: EmulatorPorts = {
  auth: 9099,
  firestore: 8080,
  database: 9000,
};

export interface FirebaseClientOptions {
  config: FirebaseOptions;
  /** Connect to the local Firebase Emulator Suite instead of a live project. */
  useEmulators?: boolean;
  emulatorHost?: string;
  emulatorPorts?: EmulatorPorts;
  /** Distinct Firebase App name — mainly for tests that spin up several
   * independent clients in the same process. */
  appName?: string;
  /** App Check attestation (R24.2). Omit to leave App Check off entirely —
   * which is the correct state until a site key exists in the console, and the
   * state every test/emulator run stays in unless it opts in. */
  appCheck?: AppCheckOptions;
}

/**
 * App Check configuration (R24.2). Attests that requests come from our actual
 * app; enforcement on Firestore and RTDB is free and does NOT require Blaze,
 * which is what makes it the highest-leverage anti-abuse lever available
 * without Cloud Functions. R24.1 handles attribution (who created this room);
 * this handles volume (was that even our app asking).
 */
export interface AppCheckOptions {
  /** reCAPTCHA v3 site key from the Firebase console. */
  siteKey: string;
  /**
   * Debug token for local development and the emulator suite. `true` asks the
   * SDK to mint one and log it (paste it into the console's allowlist to use a
   * real backend from a dev machine); a string uses a pre-registered token.
   *
   * ⚠️ Never set this on a production build — a debug token bypasses
   * attestation, which is the entire point of App Check.
   */
  debugToken?: string | true;
  /** Refresh App Check tokens in the background. Default true. */
  isTokenAutoRefreshEnabled?: boolean;
}

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  rtdb: Database;
}

// Guards against "emulator already connected" errors that the Firebase SDK
// throws if connect*Emulator is called twice on the same instance (e.g. Vite
// HMR re-running module init).
const connectedApps = new Set<string>();
const appCheckedApps = new Set<string>();

/** Builds the one set of Firebase SDK handles the whole app shares. Nothing
 * outside `store/firebase-store.ts` should ever import from `firebase/*`
 * directly (Plan §1.3). */
export function createFirebaseClient(options: FirebaseClientOptions): FirebaseClient {
  const appName = options.appName ?? '[DEFAULT]';
  const existing = getApps().find((a) => a.name === appName);
  const app =
    existing ?? initializeApp(options.config, appName === '[DEFAULT]' ? undefined : appName);

  // App Check must be initialized on the app BEFORE any Firestore/RTDB handle
  // starts issuing requests, so it goes first (R24.2). Guarded per app name
  // for the same reason the emulator connect calls are: Vite HMR re-runs this
  // module, and `initializeAppCheck` throws on a second call for one app.
  if (options.appCheck && !appCheckedApps.has(appName)) {
    const { siteKey, debugToken, isTokenAutoRefreshEnabled = true } = options.appCheck;
    if (debugToken !== undefined) {
      // The SDK reads this off the global before `initializeAppCheck` runs;
      // there is no options-object equivalent.
      (
        globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled,
    });
    appCheckedApps.add(appName);
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  if (options.useEmulators && !connectedApps.has(appName)) {
    const host = options.emulatorHost ?? '127.0.0.1';
    const ports = options.emulatorPorts ?? DEFAULT_EMULATOR_PORTS;
    connectAuthEmulator(auth, `http://${host}:${ports.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, ports.firestore);
    connectDatabaseEmulator(rtdb, host, ports.database);
    connectedApps.add(appName);
  }

  return { app, auth, db, rtdb };
}
