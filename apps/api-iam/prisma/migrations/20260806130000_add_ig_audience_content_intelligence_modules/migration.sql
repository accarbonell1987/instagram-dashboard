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
-- Both inserts join against the rows they reference instead of naming them
-- directly. Plans are created by seed.ts and by no migration, so on an empty
-- database `migrate deploy` runs before any plan exists — a plain VALUES insert
-- violates the foreign key and the whole boot fails. Joining makes each row a
-- no-op when its plan or product is not there yet, and seed.ts then creates the
-- same wiring for a fresh database.
INSERT INTO "modules" ("id", "name", "description", "default_url", "active", "product_id", "parent_id", "created_at", "updated_at")
SELECT v.id, v.name, v.description, v.default_url, true, p.id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('ig-audience', 'Audiencia', 'Quién te sigue — edad, género y ubicación', 'http://localhost:3010'),
    ('ig-content-intelligence', 'Inteligencia de contenido', 'Qué hace que tu contenido funcione y qué hacer diferente esta semana', 'http://localhost:3010')
) AS v(id, name, description, default_url)
JOIN "products" p ON p.id = 'instagram-dashboard'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "plan_modules" ("plan_id", "module_id")
SELECT pl.id, m.id
FROM (
  VALUES
    ('professional', 'ig-audience'),
    ('enterprise', 'ig-audience'),
    ('enterprise', 'ig-content-intelligence')
) AS v(plan_id, module_id)
JOIN "plans" pl ON pl.id = v.plan_id
JOIN "modules" m ON m.id = v.module_id
ON CONFLICT ("plan_id", "module_id") DO NOTHING;
