-- Executed inside $transaction by migration-runner.ts.
-- __SCHEMA__ is replaced by the validated schema name (e.g. tenant_acme).
-- Search path is already set by withTenant() before execution.

CREATE TABLE IF NOT EXISTS __SCHEMA__.tenant_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO __SCHEMA__.tenant_settings (key, value) VALUES
  ('schema_version', '"001"'::jsonb)
ON CONFLICT (key) DO NOTHING;
