#!/usr/bin/env node
/**
 * Runs the Firebase CLI's emulator commands with any HTTP(S) proxy
 * configuration stripped from the child environment.
 *
 * Why: `firebase-tools` attaches a proxy dispatcher to *every* request it makes
 * whenever `HTTPS_PROXY`/`HTTP_PROXY` is set, and never consults `NO_PROXY`
 * (see `lib/apiv2.js` — `proxyURIFromEnv()` feeds an unconditional
 * `new ProxyAgent(...)`). That includes the CLI's own calls to the emulators it
 * just started on 127.0.0.1. Behind a proxy that only allows an allowlist of
 * external hosts, the loopback rules upload is refused and the CLI reports the
 * proxy's refusal body as a rules syntax error:
 *
 *     firebase/database.rules.json:Unable to parse JSON:
 *       SyntaxError: Unexpected token 'd', "denied by "... is not valid JSON
 *
 * — which is doubly misleading, because the rules file is valid.
 *
 * Nothing in an emulator run needs the proxy: the emulators, the Vite dev
 * server and the browser all talk over loopback, and the emulator jars are
 * downloaded once by `firebase setup:emulators:*` (or on first run) and cached.
 * Unsetting these variables for the child is therefore a no-op on machines with
 * no proxy configured, and the difference between "works" and "cannot start" on
 * machines that have one.
 *
 * Usage: node scripts/firebase-emulators.mjs <emulator-subcommand> [args…]
 *   e.g. node scripts/firebase-emulators.mjs start
 *        node scripts/firebase-emulators.mjs exec --project osr-vtt "pnpm test:e2e"
 */
import { spawn } from 'node:child_process';

const PROXY_VARS = [
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'npm_config_proxy',
  'npm_config_http_proxy',
  'npm_config_https_proxy',
  'GLOBAL_AGENT_HTTP_PROXY',
  'GLOBAL_AGENT_HTTPS_PROXY',
];

const env = { ...process.env };
for (const name of PROXY_VARS) delete env[name];

const child = spawn('firebase', ['emulators:' + process.argv[2], ...process.argv.slice(3)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

child.on('error', (err) => {
  console.error(`Failed to run the Firebase CLI: ${err.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
