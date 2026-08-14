CREATE TYPE "AiPointLedgerEntryType" AS ENUM ('PURCHASE', 'GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT');

CREATE TYPE "AiPointLedgerEntryStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TYPE "OfficialModelRouteCapability" AS ENUM ('TEXT', 'REASONING', 'IMAGE', 'VIDEO');

CREATE TYPE "OfficialModelRouteStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "DesktopDeviceAiQuotaStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "ai_point_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "balance_points" INTEGER NOT NULL DEFAULT 0,
    "reserved_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_point_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_point_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "desktop_device_id" UUID,
    "route_key" TEXT,
    "type" "AiPointLedgerEntryType" NOT NULL,
    "status" "AiPointLedgerEntryStatus" NOT NULL DEFAULT 'COMPLETED',
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_point_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_model_routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "capability" "OfficialModelRouteCapability" NOT NULL,
    "status" "OfficialModelRouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "point_price" INTEGER NOT NULL DEFAULT 1,
    "provider_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "api_base_url" TEXT NOT NULL,
    "api_key_env_name" TEXT NOT NULL,
    "provider_config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_model_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "desktop_device_ai_quotas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "desktop_device_id" UUID NOT NULL,
    "monthly_limit_points" INTEGER,
    "used_points_this_month" INTEGER NOT NULL DEFAULT 0,
    "reserved_points" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "status" "DesktopDeviceAiQuotaStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desktop_device_ai_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_point_wallets_workspace_id_key" ON "ai_point_wallets"("workspace_id");
CREATE INDEX "ai_point_ledger_entries_workspace_id_created_at_idx" ON "ai_point_ledger_entries"("workspace_id", "created_at");
CREATE INDEX "ai_point_ledger_entries_desktop_device_id_created_at_idx" ON "ai_point_ledger_entries"("desktop_device_id", "created_at");
CREATE INDEX "ai_point_ledger_entries_route_key_idx" ON "ai_point_ledger_entries"("route_key");
CREATE INDEX "ai_point_ledger_entries_type_status_idx" ON "ai_point_ledger_entries"("type", "status");
CREATE UNIQUE INDEX "official_model_routes_route_key_key" ON "official_model_routes"("route_key");
CREATE INDEX "official_model_routes_capability_status_sort_order_idx" ON "official_model_routes"("capability", "status", "sort_order");
CREATE UNIQUE INDEX "desktop_device_ai_quotas_desktop_device_id_key" ON "desktop_device_ai_quotas"("desktop_device_id");
CREATE INDEX "desktop_device_ai_quotas_workspace_id_period_idx" ON "desktop_device_ai_quotas"("workspace_id", "period");
CREATE INDEX "desktop_device_ai_quotas_status_idx" ON "desktop_device_ai_quotas"("status");

ALTER TABLE "ai_point_wallets"
  ADD CONSTRAINT "ai_point_wallets_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_point_ledger_entries"
  ADD CONSTRAINT "ai_point_ledger_entries_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_point_ledger_entries"
  ADD CONSTRAINT "ai_point_ledger_entries_desktop_device_id_fkey"
  FOREIGN KEY ("desktop_device_id") REFERENCES "desktop_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "desktop_device_ai_quotas"
  ADD CONSTRAINT "desktop_device_ai_quotas_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desktop_device_ai_quotas"
  ADD CONSTRAINT "desktop_device_ai_quotas_desktop_device_id_fkey"
  FOREIGN KEY ("desktop_device_id") REFERENCES "desktop_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
