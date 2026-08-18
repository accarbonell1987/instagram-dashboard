-- One Instagram account per USER, and per-user ownership of what the agent
-- produces. Reverses 20260619000001_one_account_per_tenant.
--
-- A tenant has many members and each connects their own account. Chat, content
-- suggestions and carousels were scoped by tenant alone, which meant anybody in
-- the organisation could read everybody else's conversation with the agent.
--
-- ai_usage_logs deliberately stays tenant-scoped: it backs quota enforcement,
-- and the quota belongs to the plan the TENANT bought. Splitting it per user
-- would hand each member the whole allowance.

-- ── 1. Ownership columns, nullable while we backfill ────────────────────────

ALTER TABLE chat_messages        ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE suggestion_batches   ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE content_suggestions  ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE carousels            ADD COLUMN IF NOT EXISTS user_id UUID;

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
-- Until now a tenant had exactly one account, so whoever connected it owns
-- everything that tenant produced. That is the only honest attribution
-- available, and it is exact for every tenant that has an account.

UPDATE chat_messages c SET user_id = a.user_id
  FROM instagram_accounts a WHERE a.tenant_id = c.tenant_id AND c.user_id IS NULL;
UPDATE suggestion_batches s SET user_id = a.user_id
  FROM instagram_accounts a WHERE a.tenant_id = s.tenant_id AND s.user_id IS NULL;
UPDATE content_suggestions s SET user_id = a.user_id
  FROM instagram_accounts a WHERE a.tenant_id = s.tenant_id AND s.user_id IS NULL;
UPDATE carousels c SET user_id = a.user_id
  FROM instagram_accounts a WHERE a.tenant_id = c.tenant_id AND c.user_id IS NULL;

-- ── 3. Tighten ──────────────────────────────────────────────────────────────
-- Deliberately loud: a row left NULL belongs to a tenant with no Instagram
-- account at all, so nothing can say who made it. Scoping queries by user would
-- hide such a row forever, which is worse than stopping here. Inspect with
--   SELECT tenant_id, count(*) FROM chat_messages WHERE user_id IS NULL GROUP BY 1;
-- and either attribute or delete those rows, then re-run.

ALTER TABLE chat_messages       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE suggestion_batches  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE content_suggestions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE carousels           ALTER COLUMN user_id SET NOT NULL;

-- ── 4. Indexes that match how these are now read ────────────────────────────

DROP INDEX IF EXISTS chat_messages_tenant_id_session_id_created_at_idx;
CREATE INDEX IF NOT EXISTS chat_messages_tenant_id_user_id_session_id_created_at_idx
  ON chat_messages (tenant_id, user_id, session_id, created_at);

DROP INDEX IF EXISTS suggestion_batches_tenant_id_created_at_idx;
CREATE INDEX IF NOT EXISTS suggestion_batches_tenant_id_user_id_created_at_idx
  ON suggestion_batches (tenant_id, user_id, created_at);

-- ── 5. One account per user ─────────────────────────────────────────────────
-- No cleanup note needed in this direction: every existing row already has a
-- distinct (tenant_id, user_id), because the constraint being dropped allowed
-- only one row per tenant.

DROP INDEX IF EXISTS instagram_accounts_tenant_id_key;
ALTER TABLE instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_tenant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_tenant_id_user_id_key
  ON instagram_accounts (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS instagram_accounts_tenant_id_idx
  ON instagram_accounts (tenant_id);
