-- The quota resource was named after a vendor. An account can now point the
-- agent at OpenAI, Groq, OpenRouter or a model on its own hardware, so a
-- resource called `deepseek_tokens` describes something it no longer measures —
-- and it is the name that appears on a plan.
--
-- ALTER TYPE ... RENAME VALUE rewrites the label in place: existing plan_quotas
-- rows stay valid and nothing needs backfilling. It is not transactional with
-- other DDL on some versions, so it stands alone in this migration.
ALTER TYPE "resource_type" RENAME VALUE 'deepseek_tokens' TO 'llm_tokens';
