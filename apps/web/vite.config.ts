import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Static build target (Plan §2.4): the Vite build output is a plain
// static bundle deployable to Firebase Hosting OR GitHub Pages from the same
// output. Hash routing (see src/lib/routes.ts) means no server-side rewrite
// rules are required, and `base` can be overridden per-target via the
// VITE_BASE_PATH env var (set to "/<repo>/" for a GitHub Pages deploy).
//
// `--mode local-build` builds the **local** app instead (SPEC-041 §6): the store
// touchpoint `src/lib/firebase/client.ts` is aliased to its Firebase-free
// counterpart `client.local.ts`, so the whole Firebase branch — the SDK, the
// `VITE_FIREBASE_*` env reader, `FirebaseStore`, the hosted lobby and room
// routing — is simply not in the module graph. That is a resolver decision
// taken before the bundler runs, not a runtime flag the bundler has to prove
// dead: "if the selection is dynamic, the SDK ships whether or not it runs"
// (SPEC-042 §3). Run it with `pnpm build:local`.
//
// The mode is `local-build` rather than plain `local` because Vite reserves
// that one: it collides with the `.env.*.local` postfix and is refused outright.
const localClient = fileURLToPath(new URL('./src/lib/firebase/client.local.ts', import.meta.url));

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [svelte()],
  resolve: {
    alias:
      mode === 'local-build'
        ? [
            // Matches the whole specifier, so the replacement is the absolute
            // path rather than a splice into a relative one. Only `App.svelte`
            // imports the touchpoint; the local root reaches `client.local`
            // directly, which resolves to the same module either way.
            { find: /^.*\/firebase\/client$/, replacement: localClient },
          ]
        : [],
  },
  build: {
    outDir: mode === 'local-build' ? 'dist-local' : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
}));
