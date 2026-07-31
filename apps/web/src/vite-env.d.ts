/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
  /** App Check (R24.2) — the reCAPTCHA v3 site key from the Firebase console.
   * Unset (the default) leaves App Check OFF entirely, which is what keeps
   * emulator/e2e/zero-setup dev runs working. */
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  /** A pre-registered App Check debug token. Optional: with a site key set,
   * dev and emulator runs already ask the SDK to mint one. Never set on a
   * production build — it bypasses attestation. */
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  /** Plan §6, §10.5 — Blaze-gated Cloud Storage uploads. Stays unset (off)
   * until you've upgraded the Firebase project to Blaze and set a budget
   * alert yourself; `apps/web/src/lib/assets.ts` defaults to
   * `BundledAssetStore` otherwise. */
  readonly VITE_ENABLE_STORAGE_UPLOADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
