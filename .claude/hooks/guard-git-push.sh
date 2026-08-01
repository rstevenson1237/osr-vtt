#!/usr/bin/env bash
# PreToolUse hook 2 of 2 — push safety.
#
# Blocks:
#   * git push --force / -f / --force-with-lease (any form)
#   * any git push whose destination is the default branch (main)
#
# `main` is also branch-protected server-side; this stops the attempt earlier and
# with a clearer message. See DECISIONS.md DEC-016.
#
# Input:  the PreToolUse JSON envelope on stdin.
# Output: a permissionDecision of "deny" (exit 0), or nothing (allow).

set -uo pipefail

DEFAULT_BRANCH="main"

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')
[ "$tool" = "Bash" ] || exit 0

cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+([^;&|]*[[:space:]])?push([[:space:]]|$)' || exit 0

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
  exit 0
}

# --- force push, in any spelling -------------------------------------------
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(--force(-with-lease)?(=[^[:space:]]*)?|-[a-zA-Z]*f[a-zA-Z]*)([[:space:]]|$)'; then
  deny "Force push is blocked. It rewrites history that other clones and open PRs depend on. If a branch genuinely needs rewriting, stop and confirm with the user first, then have them run it."
fi

# --- pushing to the default branch -----------------------------------------
# Explicit destination: `git push origin main`, `git push origin HEAD:main`,
# `git push origin some-branch:main`, `git push origin +main`, etc.
if printf '%s' "$cmd" | grep -Eq "(^|[[:space:]])\+?([^[:space:]:]+:)?${DEFAULT_BRANCH}([[:space:]]|\$)"; then
  deny "Blocked: this push targets '${DEFAULT_BRANCH}', the protected default branch. All work lands via a pull request from a feature branch. Push to your work-item branch instead and open a PR (workflow step 8)."
fi

# Implicit destination: a bare `git push` (no refspec) while HEAD is on main.
if ! printf '%s' "$cmd" | grep -Eq 'push[[:space:]]+[^[:space:]-][^[:space:]]*[[:space:]]+[^[:space:]-]'; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ "$branch" = "$DEFAULT_BRANCH" ]; then
    deny "Blocked: HEAD is on '${DEFAULT_BRANCH}' and this bare 'git push' would push to it. Create a work-item branch first (git checkout -b claude/wi-NNN-...) and open a PR."
  fi
fi

exit 0
