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
  /** DEC-104 — the git tag a release was built from, stamped by
   * `vite.config.ts`'s `define`. Always set: 'dev' outside the release
   * workflow, never `undefined`. */
  readonly VITE_APP_VERSION: string;
  /** SPEC-055 §3 — gates the hidden e2e/introspection readouts (mirrors of
   * Pixi-canvas state Playwright reads as DOM). Stamped by `vite.config.ts`'s
   * `define`, from the build `mode`: `true` in `vite`'s dev server and under
   * vitest, `false` in `pnpm build` and `pnpm build:local` — never read from
   * an `.env` file. */
  readonly VITE_E2E_READOUTS: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
