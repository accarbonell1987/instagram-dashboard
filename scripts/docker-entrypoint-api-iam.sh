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

# Apply migrations (non-interactive). This used to be `db:push`, which syncs the
# schema straight to the database and skips the migration history — the dev
# database ended up with tables no migration created, so a `migrate deploy` in
# CI or production built a different database than dev. Applying migrations here
# means a schema change without a migration fails loudly, right where it starts.
echo "[api-iam] Applying database migrations..."
pnpm --filter @corehub/api-iam db:migrate:deploy

# Seed development data (idempotent, safe to run on every start)
echo "[api-iam] Seeding development data..."
pnpm --filter @corehub/api-iam db:seed || echo "[api-iam] Seed skipped (already seeded or error)"

echo "[api-iam] Starting dev server on :8080..."
exec pnpm --filter @corehub/api-iam dev
