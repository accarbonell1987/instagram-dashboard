-- Seed the default product ('instagram-dashboard').
--
-- Core onboarding (submit.service.ts) creates a TenantProductSubscription whose
-- product_id FK points at DEFAULT_PRODUCT_ID, and Entitlement rows do the same.
-- Until now this row was only created by the standalone backfill-entitlements
-- script, so a fresh `migrate deploy` (production, CI, or a dev reset) left it
-- absent and onboarding failed the FK with a 500. Seeding it here guarantees the
-- row on every database; the backfill script's upsert becomes an idempotent no-op.
INSERT INTO "products" ("id", "name", "created_at", "updated_at")
VALUES ('instagram-dashboard', 'Instagram Dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
