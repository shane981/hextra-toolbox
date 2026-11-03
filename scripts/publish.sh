#!/usr/bin/env bash
# Publish a new weekly toolbox talk and deploy the site.
#   scripts/publish.sh path/to/2026-10-13.json     # validate + add + bump cache + build + deploy
#   scripts/publish.sh --redeploy                  # rebuild and deploy what's there
#   scripts/publish.sh --help
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Load deploy.env, but let variables already set in the environment win.
if [[ -f "$ROOT/deploy.env" ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -z "${!key+x}" ]] && export "$key=$value"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$ROOT/deploy.env")
fi
command -v node >/dev/null || { echo "✗ node is required (v18+)"; exit 1; }
exec node "$ROOT/scripts/publish.mjs" "$@"
