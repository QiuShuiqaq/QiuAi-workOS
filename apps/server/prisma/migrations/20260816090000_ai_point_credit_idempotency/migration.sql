ALTER TABLE "ai_point_credit_buckets"
ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "ai_point_credit_buckets_idempotency_key_key"
ON "ai_point_credit_buckets"("idempotency_key");
