#!/usr/bin/env node
// SPEC-042 §3 — the local bundle must contain no Firebase code and no identifier
// belonging to this project, in any built file, sourcemaps included. Run it after
// `pnpm build:local`; wired into CI's `static` job (`.github/workflows/ci.yml`).
// Exits non-zero and prints one line per offending file.
//
// Two kinds of check, both over every file under `apps/web/dist-local` (or the
// directory given as argv[2]):
//
//   1. SDK markers — the words no Firebase-free bundle has a reason to contain.
//   2. Project identifiers — the *real* values, read from `.firebaserc` and
//      `apps/web/.env.production`, so a leaked key or project id is caught even if
//      it is not spelled with one of the marker words above.
//
// The bare project id `osr-vtt` is also the GitHub repository's name, and the app's
// "report an issue" link legitimately carries it (`github.com/<owner>/osr-vtt`). The
// id is therefore matched as a token that is not part of a path or a longer name —
// `osr-vtt.firebaseapp.com`, `"osr-vtt"` and `osr-vtt-default-rtdb` all hit; the
// issue-tracker URL does not.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const dir = process.argv[2] ?? join(ROOT, 'apps/web/dist-local');

const MARKERS = [/firebase/i, /firestore/i, /firebaseio/i, /appspot/i, /identitytoolkit/i];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readProjectIdentifiers() {
  const ids = [];
  try {
    const rc = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8'));
    ids.push(...Object.values(rc.projects ?? {}));
  } catch {
    // no .firebaserc — nothing to read from it
  }
  try {
    const env = readFileSync(join(ROOT, 'apps/web/.env.production'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^VITE_FIREBASE_[A-Z_]+=(.+)$/);
      if (m) ids.push(m[1].trim());
    }
  } catch {
    // no .env.production — nothing to read from it
  }
  return [...new Set(ids.filter((v) => v.length >= 6))];
}

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const patterns = [
  ...MARKERS.map((re) => ({ label: `marker ${re}`, re })),
  ...readProjectIdentifiers().map((id) => ({
    label: 'project identifier',
    // Not preceded or followed by a path/name character: see the header note.
    re: new RegExp(`(?<![\\w/.-])${escapeRegExp(id)}(?![\\w/])`),
  })),
];

let files;
try {
  files = [...walk(dir)];
} catch {
  console.error(`check-local-strip: ${dir} not found — run \`pnpm build:local\` first`);
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const text = readFileSync(file, 'latin1');
  for (const { label, re } of patterns) {
    if (re.test(text)) violations.push(`${file.replace(ROOT, '')}: ${label}`);
  }
}

if (violations.length > 0) {
  console.error('Local build contains Firebase code or a project identifier (SPEC-042 §3):');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Strip check passed: ${files.length} files in ${dir.replace(ROOT, '')}`);
