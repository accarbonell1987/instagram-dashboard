-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;
