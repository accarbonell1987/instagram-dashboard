-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('bancard', 'bank_transfer');

-- CreateEnum
CREATE TYPE "payment_settlement_kind" AS ENUM ('gateway_webhook', 'agent_review', 'manual_admin');

-- AlterEnum
ALTER TYPE "payment_status" ADD VALUE 'in_review';

-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'receipt';

-- RenameColumn (bancardProcessId -> externalRef; same UNIQUE NOT NULL VARCHAR(100) column)
ALTER TABLE "payments" RENAME COLUMN "bancard_process_id" TO "external_ref";
ALTER INDEX "payments_bancard_process_id_key" RENAME TO "payments_external_ref_key";

-- AlterTable
ALTER TABLE "payments"
  ADD COLUMN "method" "payment_method" NOT NULL DEFAULT 'bancard',
  ADD COLUMN "settlement_kind" "payment_settlement_kind",
  ADD COLUMN "settled_by" UUID,
  ADD COLUMN "settled_at" TIMESTAMP(3),
  ADD COLUMN "note" VARCHAR(500);

-- CreateTable
CREATE TABLE "payment_method_configs" (
    "method" "payment_method" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_name" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("method")
);

-- Bootstrap rows — ordering is deliberate (owner correction, tasks phase):
-- bancard stays the only enabled method until the bank-transfer initiation UI
-- ships in a later slice. Flipping bank_transfer on before then would let
-- users pick a payment method with no confirmation flow behind it.
INSERT INTO "payment_method_configs" ("method", "enabled", "display_name", "config", "updated_at")
VALUES
  ('bancard', true, 'Tarjeta (Bancard)', '{}', CURRENT_TIMESTAMP),
  ('bank_transfer', false, 'Transferencia bancaria', '{}', CURRENT_TIMESTAMP)
ON CONFLICT ("method") DO NOTHING;
