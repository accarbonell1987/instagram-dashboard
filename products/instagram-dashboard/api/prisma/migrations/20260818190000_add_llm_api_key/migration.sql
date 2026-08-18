-- Per-account LLM credentials, mirroring fal_api_key_encrypted.
--
-- The model used to be a property of the deployment: one API key and one model
-- in the environment, shared by every tenant. Nullable on purpose — an account
-- that configures nothing keeps falling back to the environment, which is what
-- every existing tenant is doing right now.
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS llm_api_key_encrypted TEXT;
