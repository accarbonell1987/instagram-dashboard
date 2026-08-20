-- The AI consumption breakdown, as a third Instagram admin section.
--
-- Module-scoped to `ig-ai-agent` rather than to the settings heading: this
-- screen reports on the agent's spending, so a tenant that has the agent at all
-- has something to report, whether or not it may edit the model.
INSERT INTO "product_admin_sections"
    ("id", "product_id", "module_id", "key", "label", "description", "path", "visible_to_role", "display_order", "updated_at")
SELECT
    gen_random_uuid(),
    'instagram-dashboard',
    'ig-ai-agent',
    'agent-usage',
    'Consumo de IA',
    'Tokens, mensajes e imágenes que consumió el agente, en total y por miembro.',
    '/admin/agent-usage',
    'TenantAdmin',
    2,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "modules" WHERE "id" = 'ig-ai-agent')
  AND NOT EXISTS (
      SELECT 1 FROM "product_admin_sections"
       WHERE "product_id" = 'instagram-dashboard' AND "key" = 'agent-usage'
  );
