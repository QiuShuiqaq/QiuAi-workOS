CREATE TABLE "auth_rate_limit_buckets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_rate_limit_buckets_rule_key_key"
  ON "auth_rate_limit_buckets"("rule_key");
CREATE INDEX "auth_rate_limit_buckets_reset_at_idx"
  ON "auth_rate_limit_buckets"("reset_at");
