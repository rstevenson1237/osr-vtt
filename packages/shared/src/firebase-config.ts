import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
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

/** Builds the one set of Firebase SDK handles the whole app shares. Nothing
 * outside `store/firebase-store.ts` should ever import from `firebase/*`
 * directly (Plan §1.3). */
export function createFirebaseClient(options: FirebaseClientOptions): FirebaseClient {
  const appName = options.appName ?? '[DEFAULT]';
  const existing = getApps().find((a) => a.name === appName);
  const app =
    existing ?? initializeApp(options.config, appName === '[DEFAULT]' ? undefined : appName);

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
