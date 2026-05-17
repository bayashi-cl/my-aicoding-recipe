#!/usr/bin/env bash
# Claude Code WorktreeCreate hook
#
# Why a hook:
#   1. Default branch name is "worktree-<name>"; we want "<type>/<topic>" per git-workflow SKILL.
#   2. Default worktree dir is .claude/worktrees/<name>/ inside the repo, which is on the host
#      bind mount in this DevContainer. pnpm/uv use hardlinks from caches on the overlay FS,
#      so a cross-FS worktree falls back to copy. Placing worktrees under $HOME keeps them on
#      the same overlay FS as the caches.
#   3. Hook bypasses .worktreeinclude, so .env copy is re-implemented here.
#
# Input  (stdin JSON): { "name": "<type>-<topic>" }   e.g. "feat-notes-search"
# Output (stdout):     absolute worktree directory path
set -euo pipefail

INPUT=$(cat)
NAME=$(echo "$INPUT" | jq -r .name)

if [[ "$NAME" != *-* ]]; then
  echo "worktree name must be <type>-<topic> form (e.g. feat-notes-search)" >&2
  exit 1
fi

TYPE="${NAME%%-*}"
TOPIC="${NAME#*-}"
BRANCH="${TYPE}/${TOPIC}"
DIR="${HOME}/.claude-worktrees/${NAME}"

mkdir -p "$(dirname "$DIR")"
git worktree add "$DIR" -b "$BRANCH" >&2

for f in .env .env.local; do
  if [ -f "$f" ] && git check-ignore -q "$f"; then
    cp "$f" "$DIR/$f"
  fi
done

echo "$DIR"
