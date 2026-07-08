-- Fix schema drift: add missing activation token columns to users
-- and align family_id type with Prisma schema (@db.VarChar(32))

-- Add activation token columns (added to schema but never migrated)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "activation_token_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "activation_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activation_token_used" BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint on activation_token_hash (mirrors @unique in schema)
CREATE UNIQUE INDEX IF NOT EXISTS "users_activation_token_hash_key"
  ON "users"("activation_token_hash");

-- Change family_id from UUID to VARCHAR(32) to match @db.VarChar(32) in schema
-- (needed so nanoid() values are accepted — nanoid produces non-UUID format strings)
ALTER TABLE "refresh_tokens"
  ALTER COLUMN "family_id" TYPE VARCHAR(32) USING "family_id"::VARCHAR;
