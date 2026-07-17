#!/bin/bash
# Stop hook: if this turn left uncommitted code changes that aren't yet
# reflected in CHANGELOG.md, block the stop and tell Claude to run the
# "qa" subagent (.claude/agents/qa.md) to document them first.
#
# Change detection is diff-content-based (not just file-list-based) and
# excludes CHANGELOG.md itself, so writing the changelog entry doesn't
# retrigger this hook on the next Stop event.

cd "$(dirname "$0")/../.." || exit 0

SIGNAL=$(
  git diff -- . ':!CHANGELOG.md' ':!.claude' 2>/dev/null
  git diff --cached -- . ':!CHANGELOG.md' ':!.claude' 2>/dev/null
  git status --porcelain --untracked-files=all -- . ':!CHANGELOG.md' ':!.claude' 2>/dev/null
)

if [ -z "$SIGNAL" ]; then
  exit 0
fi

mkdir -p .claude
STATE_FILE=".claude/.qa-last-signal"
LAST=""
[ -f "$STATE_FILE" ] && LAST=$(cat "$STATE_FILE")

if [ "$SIGNAL" == "$LAST" ]; then
  exit 0
fi

printf '%s' "$SIGNAL" > "$STATE_FILE"

echo '{"decision":"block","reason":"Uncommitted code changes from this turn are not yet reflected in CHANGELOG.md. Use the Agent tool with subagent_type \"qa\" to document them in CHANGELOG.md, then stop again."}'