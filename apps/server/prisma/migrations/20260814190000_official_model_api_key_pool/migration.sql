CREATE TYPE "OfficialModelApiKeyStatus" AS ENUM ('ACTIVE', 'DISABLED', 'COOLDOWN');

CREATE TYPE "OfficialModelApiKeyLeaseStatus" AS ENUM ('ACTIVE', 'RELEASED', 'FAILED', 'EXPIRED');

CREATE TABLE "official_model_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "api_key_secret" TEXT NOT NULL,
    "api_key_last_four" TEXT NOT NULL,
    "status" "OfficialModelApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_concurrency" INTEGER NOT NULL DEFAULT 1,
    "current_concurrency" INTEGER NOT NULL DEFAULT 0,
    "rpm_limit" INTEGER,
    "cooldown_until" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "last_error" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 1000,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_model_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_model_api_key_leases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" UUID NOT NULL,
    "route_key" TEXT NOT NULL,
    "status" "OfficialModelApiKeyLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "request_kind" TEXT,
    "provider_job_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "official_model_api_key_leases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_model_api_keys_route_key_status_sort_order_idx" ON "official_model_api_keys"("route_key", "status", "sort_order");
CREATE INDEX "official_model_api_keys_provider_id_status_idx" ON "official_model_api_keys"("provider_id", "status");
CREATE INDEX "official_model_api_key_leases_api_key_id_status_acquired_at_idx" ON "official_model_api_key_leases"("api_key_id", "status", "acquired_at");
CREATE INDEX "official_model_api_key_leases_route_key_status_acquired_at_idx" ON "official_model_api_key_leases"("route_key", "status", "acquired_at");
CREATE INDEX "official_model_api_key_leases_route_key_provider_job_id_status_idx" ON "official_model_api_key_leases"("route_key", "provider_job_id", "status");
CREATE INDEX "official_model_api_key_leases_expires_at_status_idx" ON "official_model_api_key_leases"("expires_at", "status");

ALTER TABLE "official_model_api_keys" ADD CONSTRAINT "official_model_api_keys_route_key_fkey" FOREIGN KEY ("route_key") REFERENCES "official_model_routes"("route_key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "official_model_api_key_leases" ADD CONSTRAINT "official_model_api_key_leases_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "official_model_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
