#!/bin/sh
set -e

echo "=== Corehub Instagram Analytics API — Docker Dev Entrypoint ==="

# Generate Prisma client
echo "[instagram-api] Generating Prisma client..."
pnpm --filter @corehub/api-instagram-analytics db:generate

# Push schema to its own database (non-interactive, safe for Docker)
echo "[instagram-api] Pushing database schema..."
pnpm --filter @corehub/api-instagram-analytics db:push

# The dev script tees to ./logs/dev.log (cwd = the package dir); ensure it exists.
mkdir -p /app/products/instagram-dashboard/api/logs

echo "[instagram-api] Starting dev server on :3003..."
exec pnpm --filter @corehub/api-instagram-analytics dev
