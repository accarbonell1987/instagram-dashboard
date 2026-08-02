-- Migration: one Instagram account per tenant (permanent binding)
-- Replaces: @@unique([tenantId, userId]) → @@unique([tenantId])

-- 1. Drop the old per-user constraint
ALTER TABLE instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_tenant_id_user_id_key;

-- 2. Create new per-tenant constraint (one IG account per tenant, forever)
CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_tenant_id_key
  ON instagram_accounts (tenant_id);

-- Note: if multiple accounts exist for the same tenant, this migration WILL FAIL.
-- Manual cleanup required: identify duplicate tenant_id rows and keep only one.
-- This is intentional — the business rule is ONE account per tenant.
