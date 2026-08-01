-- CreateEnum
CREATE TYPE "entitlement_source" AS ENUM ('plan', 'override', 'trial', 'admin');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "product_id" TEXT;

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "product_id" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_product_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_product_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "module_id" TEXT,
    "user_id" UUID,
    "source" "entitlement_source" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_roles" (
    "id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_product_roles" (
    "user_id" UUID NOT NULL,
    "product_role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_product_roles_pkey" PRIMARY KEY ("user_id","product_role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_product_subscriptions_tenant_id_product_id_key" ON "tenant_product_subscriptions"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "entitlements_expires_at_idx" ON "entitlements"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_tenant_id_product_id_module_id_source_key" ON "entitlements"("tenant_id", "product_id", "module_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "product_roles_product_id_key_key" ON "product_roles"("product_id", "key");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_product_subscriptions" ADD CONSTRAINT "tenant_product_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_product_subscriptions" ADD CONSTRAINT "tenant_product_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_product_subscriptions" ADD CONSTRAINT "tenant_product_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_roles" ADD CONSTRAINT "product_roles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_product_roles" ADD CONSTRAINT "user_product_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_product_roles" ADD CONSTRAINT "user_product_roles_product_role_id_fkey" FOREIGN KEY ("product_role_id") REFERENCES "product_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

