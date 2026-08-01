#!/usr/bin/env bash
# PreToolUse hook 1 of 2 — protected paths.
#
# Enforces two guards from RULES.md:
#   RULE-020  docs/archive/** is immutable. Denied at write time, unconditionally.
#   RULE-017  RULES.md may only land in a commit whose message carries a
#             `RULE-AMENDMENT:` prefix. Denied at commit time.
#
# Why the split: a PreToolUse hook on Write/Edit cannot see a commit message,
# because at write time no commit exists. Each half is checked at the moment it
# is actually observable. See DECISIONS.md DEC-016.
#
# Input:  the PreToolUse JSON envelope on stdin.
# Output: a permissionDecision of "deny" (exit 0), or nothing (allow).

set -uo pipefail

payload=$(cat)
tool=$(printf '%s' "$payload" | jq -r '.tool_name // ""')

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
  exit 0
}

case "$tool" in
  Write | Edit | MultiEdit | NotebookEdit)
    path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
    [ -n "$path" ] || exit 0
    # Normalise to a repo-relative path so both absolute and relative forms match.
    rel=${path#"$(printf '%s' "$payload" | jq -r '.cwd // ""')/"}
    case "$rel" in
      docs/archive/* | */docs/archive/*)
        deny "RULE-020: docs/archive/** is immutable — it is the reconciliation reference for the documentation refactor. Correct a mistake by adding a new archive file, never by editing an existing one. If this genuinely must change, stop and raise it with the user first."
        ;;
    esac
    ;;

  Bash)
    cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
    # Only interested in commits.
    printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+([^;&|]*[[:space:]])?commit([[:space:]]|$)' || exit 0

    # What would this commit actually touch? Staged changes, plus tracked
    # modifications when -a/--all is in play.
    staged=$(git diff --cached --name-only 2>/dev/null || true)
    if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)'; then
      staged="$staged
$(git diff --name-only 2>/dev/null || true)"
    fi

    touches_rules=false
    touches_archive=false
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ "$f" = "RULES.md" ] && touches_rules=true
      case "$f" in docs/archive/*) touches_archive=true ;; esac
    done <<<"$staged"

    if [ "$touches_archive" = true ]; then
      deny "RULE-020: this commit touches docs/archive/**, which is immutable. Unstage those paths (git restore --staged docs/archive) before committing."
    fi

    if [ "$touches_rules" = true ]; then
      if ! printf '%s' "$cmd" | grep -q 'RULE-AMENDMENT:'; then
        deny "RULE-017: this commit modifies RULES.md, so its message must carry a 'RULE-AMENDMENT:' prefix, and the amendment must be a standalone commit — never bundled into a work item's implementation. Required ceremony: stop, flag the conflict to the user with reason/impact/alternatives, obtain explicit approval, amend RULES.md in its own change, and only then resume the original work."
      fi
    fi
    ;;
esac

exit 0
