-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "SuggestionCategory" AS ENUM ('caption', 'format', 'posting_time', 'hook', 'hashtags', 'content_idea');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'used', 'dismissed');

-- CreateEnum
CREATE TYPE "SuggestionOutcome" AS ENUM ('exceeded', 'met', 'below');

-- CreateEnum
CREATE TYPE "CarouselStatus" AS ENUM ('pending', 'generating_script', 'generating_images', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "SlideStatus" AS ENUM ('pending', 'generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "SlideRole" AS ENUM ('hook', 'development', 'cta', 'default');

-- CreateEnum
CREATE TYPE "AiOperation" AS ENUM ('chat', 'script', 'suggestion', 'image_gen');

-- CreateTable
CREATE TABLE "instagram_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ig_user_id" VARCHAR(50) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "display_name" VARCHAR(200),
    "profile_picture_url" TEXT,
    "followers_count" INTEGER,
    "media_count" INTEGER,
    "account_type" VARCHAR(20) NOT NULL,
    "facebook_page_id" VARCHAR(50),
    "access_token_hash" VARCHAR(64) NOT NULL,
    "token_encrypted" TEXT,
    "token_expires_at" TIMESTAMPTZ NOT NULL,
    "sync_status" VARCHAR(20) NOT NULL DEFAULT 'idle',
    "last_sync_at" TIMESTAMPTZ,
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent_config" JSONB,
    "fal_api_key_encrypted" TEXT,
    "llm_api_key_encrypted" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_media" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "ig_media_id" VARCHAR(50) NOT NULL,
    "media_type" VARCHAR(20) NOT NULL,
    "media_product_type" VARCHAR(20),
    "permalink" VARCHAR(500),
    "caption" TEXT,
    "thumbnail_url" TEXT,
    "posted_at" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_media_metrics" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "total_interactions" INTEGER NOT NULL DEFAULT 0,
    "video_views" INTEGER,
    "avg_watch_time" DOUBLE PRECISION,
    "video_view_total_time" DOUBLE PRECISION,

    CONSTRAINT "instagram_media_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_account_insights" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "profile_views" INTEGER NOT NULL DEFAULT 0,
    "follower_count" INTEGER,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "instagram_account_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_sync_logs" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL,
    "media_synced" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "instagram_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "suggestion_id" UUID,
    "topic" TEXT NOT NULL,
    "status" "CarouselStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "caption" TEXT,
    "carousel_type" VARCHAR(20) NOT NULL DEFAULT 'ai_gen',
    "publish_status" VARCHAR(20) NOT NULL DEFAULT 'unpublished',
    "published_at" TIMESTAMPTZ,
    "ig_media_id" VARCHAR(100),
    "ig_permalink" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carousels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_slides" (
    "id" UUID NOT NULL,
    "carousel_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "role" "SlideRole" NOT NULL DEFAULT 'default',
    "text" TEXT NOT NULL,
    "visual_prompt" TEXT NOT NULL,
    "image_url" TEXT,
    "uploaded_image_url" TEXT,
    "image_mode" VARCHAR(20) NOT NULL DEFAULT 'ai_gen',
    "status" "SlideStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carousel_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_suggestions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "batch_id" UUID,
    "category" "SuggestionCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "linked_media_id" UUID,
    "linked_at" TIMESTAMPTZ,
    "outcome" "SuggestionOutcome",
    "measured_at" TIMESTAMPTZ,
    "baseline_json" JSONB,
    "metrics_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "operation" "AiOperation" NOT NULL,
    "model" VARCHAR(50),
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "image_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_accounts_tenant_id_idx" ON "instagram_accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_accounts_tenant_id_user_id_key" ON "instagram_accounts"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "instagram_media_account_id_posted_at_idx" ON "instagram_media"("account_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_media_account_id_ig_media_id_key" ON "instagram_media"("account_id", "ig_media_id");

-- CreateIndex
CREATE INDEX "instagram_media_metrics_media_id_synced_at_idx" ON "instagram_media_metrics"("media_id", "synced_at");

-- CreateIndex
CREATE INDEX "instagram_account_insights_account_id_synced_at_idx" ON "instagram_account_insights"("account_id", "synced_at");

-- CreateIndex
CREATE INDEX "instagram_sync_logs_account_id_started_at_idx" ON "instagram_sync_logs"("account_id", "started_at");

-- CreateIndex
CREATE INDEX "chat_messages_tenant_id_user_id_session_id_created_at_idx" ON "chat_messages"("tenant_id", "user_id", "session_id", "created_at");

-- CreateIndex
CREATE INDEX "suggestion_batches_tenant_id_user_id_created_at_idx" ON "suggestion_batches"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "carousels_tenant_id_user_id_created_at_idx" ON "carousels"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "carousel_slides_carousel_id_idx" ON "carousel_slides"("carousel_id");

-- CreateIndex
CREATE UNIQUE INDEX "carousel_slides_carousel_id_order_key" ON "carousel_slides"("carousel_id", "order");

-- CreateIndex
CREATE INDEX "content_suggestions_tenant_id_status_created_at_idx" ON "content_suggestions"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_created_at_idx" ON "ai_usage_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_operation_created_at_idx" ON "ai_usage_logs"("tenant_id", "operation", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_user_id_created_at_idx" ON "ai_usage_logs"("tenant_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "instagram_media" ADD CONSTRAINT "instagram_media_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_media_metrics" ADD CONSTRAINT "instagram_media_metrics_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "instagram_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_account_insights" ADD CONSTRAINT "instagram_account_insights_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_sync_logs" ADD CONSTRAINT "instagram_sync_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousels" ADD CONSTRAINT "carousels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_slides" ADD CONSTRAINT "carousel_slides_carousel_id_fkey" FOREIGN KEY ("carousel_id") REFERENCES "carousels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "suggestion_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_suggestions" ADD CONSTRAINT "content_suggestions_linked_media_id_fkey" FOREIGN KEY ("linked_media_id") REFERENCES "instagram_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

