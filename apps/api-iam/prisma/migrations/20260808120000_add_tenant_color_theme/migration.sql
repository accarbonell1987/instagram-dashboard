-- Visual style chosen by the tenant and applied to all of its users.
-- Nullable: existing tenants keep the platform default until an admin picks one.
ALTER TABLE "tenants" ADD COLUMN "color_theme" VARCHAR(40);
