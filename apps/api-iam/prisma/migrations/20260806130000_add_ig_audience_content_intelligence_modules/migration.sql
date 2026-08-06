-- Add two new Instagram modules the product API will use to gate its own
-- sections: 'ig-audience' (Audiencia) and 'ig-content-intelligence'
-- (Inteligencia de contenido). Both are top-level (no parent_id) and point
-- at the same default_url as the other five IG modules — they are sections
-- of one page, not separate apps.
--
-- Plan assignment is a pricing decision already made: ig-audience is
-- available on professional AND enterprise; ig-content-intelligence is
-- enterprise-only.
--
-- Formal migration (not seed-only) because the docker entrypoint runs
-- `db:migrate:deploy`, not `db:seed` — an existing database only picks up
-- new modules through a migration. seed.ts is updated to match so a fresh
-- database ends up identical.
INSERT INTO "modules" ("id", "name", "description", "default_url", "active", "product_id", "parent_id", "created_at", "updated_at")
VALUES
  ('ig-audience', 'Audiencia', 'Quién te sigue — edad, género y ubicación', 'http://localhost:3010', true, 'instagram-dashboard', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ig-content-intelligence', 'Inteligencia de contenido', 'Qué hace que tu contenido funcione y qué hacer diferente esta semana', 'http://localhost:3010', true, 'instagram-dashboard', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "plan_modules" ("plan_id", "module_id")
VALUES
  ('professional', 'ig-audience'),
  ('enterprise', 'ig-audience'),
  ('enterprise', 'ig-content-intelligence')
ON CONFLICT ("plan_id", "module_id") DO NOTHING;
