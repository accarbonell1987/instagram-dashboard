-- CreateEnum
CREATE TYPE "entitlement_kind" AS ENUM ('grant', 'revoke');

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "kind" "entitlement_kind" NOT NULL DEFAULT 'grant';

