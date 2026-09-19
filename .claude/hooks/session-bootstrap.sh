#!/usr/bin/env bash
# SessionStart hook — the session bootstrap (SPEC-053 §1, DEC-106).
#
# Brings a fresh sandbox to the point where `pnpm verify:all` can run: the
# workspace dependencies, the Firebase emulator jars, and Playwright's
# pinned Chromium.
#
# Four load-bearing constraints (SPEC-053 §1): never edits a tracked file
# (`--frozen-lockfile` refuses to touch the lockfile); never runs the suite
# — what to verify and when is the session's call; best-effort, so a failed
# step prints what failed and leaves the session usable rather than blocking
# a docs-only session; idempotent, since a resumed session runs it again.
#
# Output: none. This is not a PreToolUse guard — nothing here denies a tool
# call — so it never emits a hookSpecificOutput/permissionDecision envelope.

set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$project_dir" 2>/dev/null || exit 0

log() { printf '[session-bootstrap] %s\n' "$1"; }

log "installing workspace dependencies..."
if pnpm install --frozen-lockfile; then
  log "pnpm install: ok"
else
  log "pnpm install: FAILED — pnpm verify:all will not run this session"
fi

# firebase-tools and Playwright's downloader both attach a proxy dispatcher
# to *every* request when HTTPS_PROXY/HTTP_PROXY is set (README's "Proxy
# trap", scripts/firebase-emulators.mjs) — strip it for these fetches only.
# pnpm install above is unaffected: it is not the thing README warns about.
PROXY_VARS="HTTP_PROXY http_proxy HTTPS_PROXY https_proxy ALL_PROXY all_proxy npm_config_proxy npm_config_http_proxy npm_config_https_proxy GLOBAL_AGENT_HTTP_PROXY GLOBAL_AGENT_HTTPS_PROXY"
# shellcheck disable=SC2086
unset $PROXY_VARS

log "pre-fetching the Firebase emulator jars (firestore, database, storage, ui)..."
if pnpm exec firebase setup:emulators:firestore \
  && pnpm exec firebase setup:emulators:database \
  && pnpm exec firebase setup:emulators:storage \
  && pnpm exec firebase setup:emulators:ui; then
  log "firebase emulator jars: ok"
else
  log "firebase emulator jars: FAILED — pnpm test:all:emulators will fetch on first run"
fi

# Skip the download entirely when apps/web/playwright.config.ts's own
# resolveChromiumPath() would already find something to launch — either
# Playwright's pinned build, or a fallback under PLAYWRIGHT_BROWSERS_PATH.
chromium_already_resolvable() {
  pnpm --filter @osr-vtt/web exec node -e '
    const { chromium } = require("@playwright/test");
    const { existsSync, readdirSync } = require("node:fs");
    const { join } = require("node:path");
    try {
      if (existsSync(chromium.executablePath())) process.exit(0);
    } catch {
      // executablePath() throws when nothing is installed at all.
    }
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!browsersPath || !existsSync(browsersPath)) process.exit(1);
    const candidates = [
      join(browsersPath, "chromium"),
      ...readdirSync(browsersPath)
        .filter((entry) => /^chromium-\d+$/.test(entry))
        .map((entry) => join(browsersPath, entry, "chrome-linux", "chrome")),
    ];
    process.exit(candidates.some((candidate) => existsSync(candidate)) ? 0 : 1);
  ' >/dev/null 2>&1
}

if chromium_already_resolvable; then
  log "playwright chromium: already resolvable, skipping fetch"
elif pnpm --filter @osr-vtt/web exec playwright install chromium; then
  log "playwright chromium: ok"
else
  log "playwright chromium: FAILED — pnpm test:e2e will fetch on first run"
fi

exit 0
