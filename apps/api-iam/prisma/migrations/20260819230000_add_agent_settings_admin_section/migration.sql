-- The agent's tenant-wide settings, as a second Instagram admin section.
--
-- Module-scoped, unlike the linked accounts: this screen edits the agent, so a
-- tenant whose plan does not reach `ig-agent-settings` has no business seeing
-- the entry. The listing resolves entitlements through the cascade, so a plan
-- that grants `ig-ai-agent` reaches this one through it.
--
-- `visible_to_role` decides the nav entry only. The real authorisation is
-- PUT /agent/settings in the product's own API, which checks the caller's role
-- per section — the hub is not in the request path and cannot protect anything.
INSERT INTO "product_admin_sections"
    ("id", "product_id", "module_id", "key", "label", "description", "path", "visible_to_role", "display_order", "updated_at")
SELECT
    gen_random_uuid(),
    'instagram-dashboard',
    'ig-agent-settings',
    'agent-settings',
    'Agente IA',
    'Modelo, credenciales y límites del agente para toda la organización.',
    '/admin/agent-settings',
    'TenantAdmin',
    1,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "modules" WHERE "id" = 'ig-agent-settings')
  AND NOT EXISTS (
      SELECT 1 FROM "product_admin_sections"
       WHERE "product_id" = 'instagram-dashboard' AND "key" = 'agent-settings'
  );
