import { defineConfig } from 'vite';

// Standalone POC app — NOT part of the monorepo's pnpm workspace and never
// imported by apps/ or packages/ (SPEC §9.1 boundary).
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
});
