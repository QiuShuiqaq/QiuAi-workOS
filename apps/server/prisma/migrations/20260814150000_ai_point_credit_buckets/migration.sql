ALTER TYPE "PlanCode" ADD VALUE IF NOT EXISTS 'PERSONAL_MEMBER_MONTHLY';
ALTER TYPE "PlanCode" ADD VALUE IF NOT EXISTS 'PERSONAL_MEMBER_ANNUAL';

CREATE TYPE "AiPointCreditBucketSourceType" AS ENUM (
  'SUBSCRIPTION_MONTHLY',
  'PURCHASE_PERMANENT',
  'ADMIN_GRANT',
  'MIGRATED_BALANCE'
);

CREATE TYPE "AiPointCreditBucketStatus" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE "ai_point_credit_buckets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "source_type" "AiPointCreditBucketSourceType" NOT NULL,
    "subscription_id" UUID,
    "billing_order_id" UUID,
    "total_points" INTEGER NOT NULL,
    "available_points" INTEGER NOT NULL,
    "reserved_points" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "status" "AiPointCreditBucketStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_point_credit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_point_credit_buckets_workspace_id_status_expires_at_idx"
  ON "ai_point_credit_buckets"("workspace_id", "status", "expires_at");
CREATE INDEX "ai_point_credit_buckets_workspace_id_source_type_idx"
  ON "ai_point_credit_buckets"("workspace_id", "source_type");
CREATE INDEX "ai_point_credit_buckets_subscription_id_idx"
  ON "ai_point_credit_buckets"("subscription_id");
CREATE INDEX "ai_point_credit_buckets_billing_order_id_idx"
  ON "ai_point_credit_buckets"("billing_order_id");

ALTER TABLE "ai_point_credit_buckets"
  ADD CONSTRAINT "ai_point_credit_buckets_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_point_credit_buckets"
  ADD CONSTRAINT "ai_point_credit_buckets_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_point_credit_buckets"
  ADD CONSTRAINT "ai_point_credit_buckets_billing_order_id_fkey"
  FOREIGN KEY ("billing_order_id") REFERENCES "billing_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
