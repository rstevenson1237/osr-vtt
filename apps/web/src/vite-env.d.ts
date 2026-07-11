/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
  /** Plan §6, §10.5 — Blaze-gated Cloud Storage uploads. Stays unset (off)
   * until you've upgraded the Firebase project to Blaze and set a budget
   * alert yourself; `apps/web/src/lib/assets.ts` defaults to
   * `BundledAssetStore` otherwise. */
  readonly VITE_ENABLE_STORAGE_UPLOADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
