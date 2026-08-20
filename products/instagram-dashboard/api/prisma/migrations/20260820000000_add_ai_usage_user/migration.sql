-- Who made each AI call, for the usage breakdown per member.
--
-- Nullable on purpose: rows written before this column cannot be attributed to
-- anyone, and there is no way back. Per-member figures start from here; the
-- tenant totals keep counting the whole history.
--
-- Quota accounting is untouched and stays tenant-scoped — the plan belongs to
-- the tenant, and windowing a quota per member would hand each of them the
-- whole allowance.
ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "user_id" UUID;

CREATE INDEX IF NOT EXISTS "ai_usage_logs_tenant_id_user_id_created_at_idx"
    ON "ai_usage_logs" ("tenant_id", "user_id", "created_at");
