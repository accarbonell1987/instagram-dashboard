#!/bin/sh
set -e

echo "=== Corehub API IAM — Docker Dev Entrypoint ==="

# Generate JWT keys for development if they don't exist
if [ ! -f /app/apps/api-iam/keys/private.pem ]; then
  echo "[api-iam] Generating JWT keys for development..."
  mkdir -p /app/apps/api-iam/keys
  npx tsx /app/apps/api-iam/src/scripts/generate-dev-keys.ts
fi

# Generate Prisma client
echo "[api-iam] Generating Prisma client..."
pnpm --filter @corehub/api-iam db:generate

# Push schema to database (non-interactive, safe for Docker)
echo "[api-iam] Pushing database schema..."
pnpm --filter @corehub/api-iam db:push

# Seed development data (idempotent, safe to run on every start)
echo "[api-iam] Seeding development data..."
pnpm --filter @corehub/api-iam db:seed || echo "[api-iam] Seed skipped (already seeded or error)"

echo "[api-iam] Starting dev server on :8080..."
exec pnpm --filter @corehub/api-iam dev
