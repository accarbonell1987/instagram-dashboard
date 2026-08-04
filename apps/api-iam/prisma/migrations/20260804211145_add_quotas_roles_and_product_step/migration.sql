-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('deepseek_tokens', 'fal_images', 'chat_sessions');

-- CreateEnum
CREATE TYPE "quota_period" AS ENUM ('month', 'day', 'unlimited');

-- AlterEnum
ALTER TYPE "draft_step" ADD VALUE 'product';

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "parent_id" TEXT;

-- AlterTable
ALTER TABLE "onboarding_drafts" ADD COLUMN     "product_id" TEXT,
ALTER COLUMN "current_step" SET DEFAULT 'product';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "trial_duration_days" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "trial_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "plan_quotas" (
    "id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "resource_type" "resource_type" NOT NULL,
    "limit" INTEGER NOT NULL,
    "period" "quota_period" NOT NULL DEFAULT 'month',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_module_access" (
    "product_role_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_module_access_pkey" PRIMARY KEY ("product_role_id","module_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_quotas_plan_id_resource_type_key" ON "plan_quotas"("plan_id", "resource_type");

-- AddForeignKey
ALTER TABLE "plan_quotas" ADD CONSTRAINT "plan_quotas_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_module_access" ADD CONSTRAINT "role_module_access_product_role_id_fkey" FOREIGN KEY ("product_role_id") REFERENCES "product_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_module_access" ADD CONSTRAINT "role_module_access_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
