-- AlterTable
ALTER TABLE "products" ADD COLUMN     "default_url" TEXT;

-- Backfill: a product's defaultUrl used to be an implicit fact — every module
-- of a product happened to share one URL because the product was never
-- anything but a page's sections. Derive it explicitly from that shared URL
-- so an existing database (e.g. instagram-dashboard) keeps a working address
-- once the hub stops deriving it from modules.
UPDATE "products" AS p
SET "default_url" = sub."default_url"
FROM (
  SELECT DISTINCT ON ("product_id") "product_id", "default_url"
  FROM "modules"
  WHERE "product_id" IS NOT NULL
  ORDER BY "product_id", "id"
) AS sub
WHERE p."id" = sub."product_id"
  AND p."default_url" IS NULL;
