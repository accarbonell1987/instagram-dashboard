-- Migration: add_user_id_to_instagram_accounts
-- Step 1: Add column nullable first
ALTER TABLE instagram_accounts ADD COLUMN user_id UUID;

-- Step 2: Backfill existing rows with sentinel UUID (no data loss)
UPDATE instagram_accounts SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE instagram_accounts ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Drop old unique constraint on (tenant_id, ig_user_id)
ALTER TABLE instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_tenant_id_ig_user_id_key;

-- Step 5: Add new unique constraint on (tenant_id, user_id)
ALTER TABLE instagram_accounts ADD CONSTRAINT instagram_accounts_tenant_id_user_id_key UNIQUE (tenant_id, user_id);
