#!/usr/bin/env bash
# .github/labels.yml をソースに、リポジトリのラベルを冪等に揃える。
# `gh auth login` 済みであることを前提とする。
#
# 使い方:
#   bash scripts/seed-labels.sh                  # 現在のリモートに対して実行
#   GH_REPO=owner/repo bash scripts/seed-labels.sh

set -euo pipefail

cd "$(dirname "$0")/.."

LABELS_FILE=".github/labels.yml"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI が見つからない。mise install 済みか確認してください。" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo 'error: gh が未認証。`gh auth login` を先に実行してください。' >&2
  exit 1
fi

# YAML パース: 各レコードを TAB 区切り (name<TAB>color<TAB>description) で出力。
parse_labels() {
  awk '
    function strip(s) {
      sub(/^[^:]*: *"?/, "", s)
      sub(/"? *$/, "", s)
      return s
    }
    function emit() {
      if (name != "") printf "%s\t%s\t%s\n", name, color, desc
      name=""; color=""; desc=""
    }
    /^- name:/        { emit(); name = strip($0) }
    /^  color:/       { color = strip($0) }
    /^  description:/ { desc = strip($0) }
    END { emit() }
  ' "$LABELS_FILE"
}

created=0
while IFS=$'\t' read -r name color desc; do
  [ -z "$name" ] && continue
  if gh label create "$name" --color "$color" --description "$desc" --force >/dev/null 2>&1; then
    echo "  ✓ $name"
    created=$((created + 1))
  else
    echo "  ✗ $name  (gh label create が失敗)" >&2
    exit 1
  fi
done < <(parse_labels)

echo "==> done: $created label(s) ensured"
