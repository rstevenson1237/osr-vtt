/**
 * Bundle the sandbox into a single self-contained HTML *fragment* (style is
 * injected at runtime by app.ts; this file is just #app + one inline <script>)
 * so it can be published as a claude.ai Artifact — no external hosts, all JS
 * inlined, which the Artifact CSP requires. polygon-clipping is pure JS so it
 * bundles cleanly with no WASM.
 */
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  write: false,
});

const js = result.outputFiles[0].text;
const html = `<div id="app"></div>
<noscript>This POC requires JavaScript.</noscript>
<script>${js}</script>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', html);
console.log(`wrote dist/artifact.html (${(html.length / 1024).toFixed(1)} KiB)`);
