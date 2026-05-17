#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> mise trust"
mise trust --yes

echo "==> mise install"
mise install

echo "==> mise list"
mise list

echo "==> tool versions"
uv --version
pnpm --version
node --version
claude --version
gh --version | head -1

echo "==> Note: Node is on PATH via mise (for claude-code etc.)."
echo "    Project Node (apps/web) は別途 pnpm devEngines.runtime で固定する方針。"

if [ ! -f .devcontainer/.env ]; then
  cp .devcontainer/.env.example .devcontainer/.env
  echo "==> created .devcontainer/.env from .env.example"
fi

echo "==> gh auth status"
if gh auth status >/dev/null 2>&1; then
  gh auth status 2>&1 | sed 's/^/    /'
else
  cat <<'EOF'
    Not logged in to GitHub.
    Issue / PR を扱う前に、ホスト側または当コンテナ内で `gh auth login` を実行してください。
    トークンは AI 側では扱いません（人間が認証を実施する方針）。
EOF
fi

cat <<'EOF'

Dev Container setup complete.

Next steps:
  - DB (db service) is already running via docker-compose (workspace depends_on db).
  - Run the API:          uv run --package mar-api uvicorn mar_api.main:app --reload
  - Smoke test:           curl localhost:8000/healthz
EOF
