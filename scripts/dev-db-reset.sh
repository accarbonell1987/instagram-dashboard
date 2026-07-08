#!/usr/bin/env bash
# =============================================================================
# Corehub Dev DB Reset
# =============================================================================
# Pushes the latest Prisma schema to the development database and re-seeds.
# Use after schema changes (new models, migrations, seed updates).
# Requires the database to be running (run scripts/dev-infra-up.sh first).
#
# Usage:
#   ./scripts/dev-db-reset.sh
#
# What it does:
#   1. Generates the Prisma client
#   2. Pushes schema changes (safe — no data loss, uses CREATE OR ALTER)
#   3. Seeds development data (idempotent — upserts on conflict)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Corehub — DB Reset ==="
echo ""

echo "[1/3] Generating Prisma client..."
cd "$ROOT_DIR"
pnpm --filter @corehub/api-iam db:generate

echo ""
echo "[2/3] Pushing schema..."
pnpm --filter @corehub/api-iam db:push

echo ""
echo "[3/3] Seeding data..."
pnpm --filter @corehub/api-iam db:seed

echo ""
echo "=== DB Reset Complete ==="
echo "  Schema applied + seed data loaded."
echo ""
echo "If the API is running, restart it to pick up the new client:"
echo "  docker compose -f docker-compose.dev.yml restart api-iam"
echo "  (or CTRL+C and re-run 'pnpm dev' if running locally)"
