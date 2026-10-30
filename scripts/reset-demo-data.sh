#!/usr/bin/env bash
# Destroys the local demo databases and platform store so the English demo dataset can be
# regenerated from scratch. Requires --yes.
set -euo pipefail

if [ "${1:-}" != "--yes" ]; then
  echo "Usage: ./scripts/reset-demo-data.sh --yes"
  echo "This drops the five CompanyBrain databases and deletes apps/web/.platform-data." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_ADMIN_URL:?POSTGRES_ADMIN_URL is required}"

DB_NAMES=(platform_identity_db nano_brain_db traditional_rag_db graph_rag_db agent_gateway_db)

for db in "${DB_NAMES[@]}"; do
  echo "Dropping ${db}..."
  psql "$POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" >/dev/null
  psql "$POSTGRES_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${db}\";" >/dev/null
done

echo "Removing local demo state..."
rm -rf apps/web/.platform-data .graph-rag-workdir .traditional-rag-storage

echo "Demo databases dropped and platform data removed."
echo "Recreate them with: bun run db:init && bun run admin:create"
