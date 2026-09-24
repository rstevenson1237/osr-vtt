#!/usr/bin/env node
// SPEC-055 §2 — a bundle-size budget for each build's main entry chunk. The
// entry is found the same way a browser does: the `<script type="module">`
// `index.html` points at, not a filename guess — Vite's content hash changes
// on every build. Exits non-zero and prints one line per violation, wired
// into CI's `static` job (`.github/workflows/ci.yml`) alongside the local
// build's Firebase-strip check.
//
// Budgets are raw (uncompressed) bytes of the built file, not gzip — no extra
// dependency to compute it, and it is what actually varies with what ships in
// the chunk. Set from the measured size right after SPEC-055 §1 landed, plus
// 10% (SPEC-055 §2); raising it is a one-line change that must be named in
// the pull request that needs it.

import { readFileSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

// Measured immediately after SPEC-055 §1 (dice renderer + hex art lazy-load)
// and §3 (e2e readouts stripped from the built markup) landed: hosted
// 1,474,593 bytes, local 712,335 bytes. Budgets are those figures + 10%.
const BUILDS = [
  { name: 'hosted (pnpm build)', dir: 'apps/web/dist', budget: 1_622_100 },
  { name: 'local (pnpm build:local)', dir: 'apps/web/dist-local', budget: 783_600 },
];

const violations = [];

for (const { name, dir, budget } of BUILDS) {
  const indexPath = `${ROOT}${dir}/index.html`;
  let html;
  try {
    html = readFileSync(indexPath, 'utf8');
  } catch {
    violations.push(`${name}: ${dir}/index.html not found — build it before this check`);
    continue;
  }
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  if (!match) {
    violations.push(`${name}: no <script type="module"> entry found in ${dir}/index.html`);
    continue;
  }
  const entryRelPath = match[1].replace(/^\//, '');
  const entryPath = `${ROOT}${dir}/${entryRelPath}`;
  let size;
  try {
    size = statSync(entryPath).size;
  } catch {
    violations.push(`${name}: entry chunk ${entryRelPath} not found on disk`);
    continue;
  }
  if (size > budget) {
    violations.push(
      `${name}: main entry chunk ${entryRelPath} is ${size} bytes, over the ${budget}-byte budget ` +
        `(SPEC-055 §2) by ${size - budget} bytes`,
    );
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(v);
  console.error(`\ncheck-bundle-size: ${violations.length} violation${violations.length === 1 ? '' : 's'}`);
  process.exit(1);
}
