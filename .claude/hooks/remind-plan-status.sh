#!/usr/bin/env bash
# PreToolUse hook 3 of 3 — status write-back.
#
# Enforces the CLAUDE.md rule "Write status back before long-running
# operations": before a full emulator suite run, a Playwright/e2e run, a build,
# a CI poll loop, or a subagent dispatch, the current work-item status must
# already be written to a durable file on disk. Context compaction can land
# mid operation; that file is the only state that survives it.
#
# Trigger surface (IN-020): matches specific long-running Bash command
# patterns, plus any Agent (subagent) dispatch. Denies — not warns — if
# the status file's mtime is older than FRESHNESS_SECONDS, per DEC-016/
# DEC-029's precedent that a warning an agent can ignore is not a guard.
#
# The status file is `.claude/status.local`, gitignored (DEC-102, superseding
# DEC-029 in part): the write-back costs no diff, and PLAN.md's own mtime is
# no longer read.
#
# Input:  the PreToolUse JSON envelope on stdin.
# Output: a permissionDecision of "deny" (exit 0), or nothing (allow).

set -uo pipefail

FRESHNESS_SECONDS=900 # 15 minutes — see DECISIONS.md DEC-029/DEC-102.

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
  exit 0
}

is_long_running_bash() {
  # One command per branch, matched against CLAUDE.md's named examples plus
  # this repo's actual script names (package.json).
  printf '%s' "$1" | grep -Eq \
    'test:all:emulators|firebase-emulators\.mjs|playwright[[:space:]]+test|pnpm[[:space:]]+(-r[[:space:]]+)?(run[[:space:]]+)?(test:e2e|build)|vite[[:space:]]+build|(^|[[:space:]])sleep[[:space:]]+[0-9]'
}

case "$tool" in
  Agent)
    project_dir=${CLAUDE_PROJECT_DIR:-.}
    ;;
  Bash)
    cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
    is_long_running_bash "$cmd" || exit 0
    project_dir=${CLAUDE_PROJECT_DIR:-.}
    ;;
  *)
    exit 0
    ;;
esac

status_file="$project_dir/.claude/status.local"

if [ ! -f "$status_file" ]; then
  deny "RULE (CLAUDE.md 'Write status back before long-running operations'): .claude/status.local does not exist yet, and this looks like a long-running operation (full emulator suite, Playwright/e2e run, build, CI poll loop, or subagent dispatch). Write the current work-item status to .claude/status.local first — e.g. 'WI-NNN step X of Y, <what's running>' — then retry."
fi

mtime=$(stat -c %Y "$status_file" 2>/dev/null || stat -f %m "$status_file" 2>/dev/null || echo 0)
now=$(date +%s)
age=$((now - mtime))

if [ "$age" -gt "$FRESHNESS_SECONDS" ]; then
  deny "RULE (CLAUDE.md 'Write status back before long-running operations'): .claude/status.local has not been touched in the last $((FRESHNESS_SECONDS / 60)) minutes, and this looks like a long-running operation (full emulator suite, Playwright/e2e run, build, CI poll loop, or subagent dispatch). Write the current work-item status to .claude/status.local first — e.g. 'WI-NNN step X of Y, <what's running>' — then retry."
fi

exit 0
