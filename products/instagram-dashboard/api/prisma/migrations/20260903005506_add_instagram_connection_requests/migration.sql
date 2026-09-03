-- CreateEnum
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('awaiting_invite', 'invite_sent', 'connected', 'failed');

-- CreateTable
CREATE TABLE "instagram_connection_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "status" "ConnectionRequestStatus" NOT NULL DEFAULT 'awaiting_invite',
    "last_error" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invite_sent_at" TIMESTAMPTZ,
    "connected_at" TIMESTAMPTZ,

    CONSTRAINT "instagram_connection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_connection_requests_status_requested_at_idx" ON "instagram_connection_requests"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_connection_requests_tenant_id_user_id_key" ON "instagram_connection_requests"("tenant_id", "user_id");

