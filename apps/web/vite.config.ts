import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Static build target (Plan §2.4): the Vite build output is a plain
// static bundle deployable to Firebase Hosting OR GitHub Pages from the same
// output. Hash routing (see src/lib/routes.ts) means no server-side rewrite
// rules are required, and `base` can be overridden per-target via the
// VITE_BASE_PATH env var (set to "/<repo>/" for a GitHub Pages deploy).
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
