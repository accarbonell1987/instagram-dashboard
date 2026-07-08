#!/usr/bin/env bash
# =============================================================================
# Corehub Dev Infrastructure Setup
# =============================================================================
# Starts the development infrastructure containers (PostgreSQL, Adminer, MailDev).
# Idempotent — safe to run multiple times.
#
# Usage:
#   ./scripts/dev-infra-up.sh          # Start all infra
#   ./scripts/dev-infra-up.sh -d       # Start all infra (foreground)
#
# After running this, start the apps manually:
#   pnpm dev                            # hub + api-iam + docs (via Turborepo)
#
# Access points:
#   API IAM:       http://localhost:8080
#   Hub:           http://localhost:3001
#   Adminer (DB):  http://localhost:8081
#   MailDev (email): http://localhost:1080
#   PostgreSQL:    localhost:5432
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

DETACH="-d"
if [[ "${1:-}" == "-d" ]]; then
  DETACH=""
fi

echo "=== Corehub — Starting Dev Infrastructure ==="
echo ""

docker compose -f "$ROOT_DIR/docker-compose.dev.yml" up $DETACH postgres adminer maildev

echo ""
echo "=== Infrastructure Ready ==="
echo "  PostgreSQL:  localhost:5432"
echo "  Adminer:     http://localhost:8081"
echo "  MailDev:     http://localhost:1080"
echo ""
echo "Run the apps:  pnpm dev"
echo "Stop:          docker compose -f docker-compose.dev.yml down"
