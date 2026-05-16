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

echo "==> Note: Node is on PATH via mise (for claude-code etc.)."
echo "    Project Node (apps/web) は別途 pnpm devEngines.runtime で固定する方針。"

if [ ! -f .devcontainer/.env ]; then
  cp .devcontainer/.env.example .devcontainer/.env
  echo "==> created .devcontainer/.env from .env.example"
fi

cat <<'EOF'

Dev Container setup complete.

Next steps:
  - Start the database:   docker compose up -d db
  - Initialize Node side: (M2) pnpm init etc.
  - Initialize Python:    (M2) cd apps/api && uv init
EOF
