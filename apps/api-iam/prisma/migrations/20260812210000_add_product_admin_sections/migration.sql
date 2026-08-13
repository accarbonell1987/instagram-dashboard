-- Screens a product contributes to the tenant's own settings area. The hub
-- mounts them in the iframe it already uses for the product; this table only
-- says which ones exist and where they appear.
CREATE TABLE "product_admin_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" TEXT NOT NULL,
    "module_id" TEXT,
    "key" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "path" VARCHAR(200) NOT NULL,
    "visible_to_role" "user_role" NOT NULL DEFAULT 'TenantAdmin',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_admin_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_admin_sections_product_id_key_key"
    ON "product_admin_sections"("product_id", "key");

ALTER TABLE "product_admin_sections"
    ADD CONSTRAINT "product_admin_sections_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_admin_sections"
    ADD CONSTRAINT "product_admin_sections_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "modules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- The first section: Instagram's linked accounts, administered by the tenant.
-- Product-scoped (module_id NULL) — connecting an account is not something any
-- single module owns.
INSERT INTO "product_admin_sections"
    ("id", "product_id", "module_id", "key", "label", "description", "path", "visible_to_role", "display_order", "updated_at")
SELECT
    gen_random_uuid(),
    'instagram-dashboard',
    NULL,
    'linked-accounts',
    'Cuentas de Instagram',
    'Las cuentas vinculadas de tu organización y quién las tiene tomadas.',
    '/admin/linked-accounts',
    'TenantAdmin',
    0,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "products" WHERE "id" = 'instagram-dashboard');
