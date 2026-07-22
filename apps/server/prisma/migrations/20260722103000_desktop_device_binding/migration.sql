-- CreateEnum
CREATE TYPE "DesktopBindingCodeStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DesktopDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "desktop_devices" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "runtime_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "DesktopDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "bound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desktop_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desktop_binding_codes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "status" "DesktopBindingCodeStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "redeemed_device_id" UUID,
    "created_by_account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desktop_binding_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "desktop_devices_token_hash_key" ON "desktop_devices"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "desktop_devices_workspace_id_runtime_id_key" ON "desktop_devices"("workspace_id", "runtime_id");

-- CreateIndex
CREATE UNIQUE INDEX "desktop_devices_workspace_id_device_id_key" ON "desktop_devices"("workspace_id", "device_id");

-- CreateIndex
CREATE INDEX "desktop_devices_workspace_id_idx" ON "desktop_devices"("workspace_id");

-- CreateIndex
CREATE INDEX "desktop_devices_status_idx" ON "desktop_devices"("status");

-- CreateIndex
CREATE INDEX "desktop_devices_last_seen_at_idx" ON "desktop_devices"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "desktop_binding_codes_code_hash_key" ON "desktop_binding_codes"("code_hash");

-- CreateIndex
CREATE INDEX "desktop_binding_codes_workspace_id_idx" ON "desktop_binding_codes"("workspace_id");

-- CreateIndex
CREATE INDEX "desktop_binding_codes_status_idx" ON "desktop_binding_codes"("status");

-- CreateIndex
CREATE INDEX "desktop_binding_codes_expires_at_idx" ON "desktop_binding_codes"("expires_at");

-- CreateIndex
CREATE INDEX "desktop_binding_codes_created_by_account_id_idx" ON "desktop_binding_codes"("created_by_account_id");

-- CreateIndex
CREATE INDEX "desktop_binding_codes_redeemed_device_id_idx" ON "desktop_binding_codes"("redeemed_device_id");

-- AddForeignKey
ALTER TABLE "desktop_devices" ADD CONSTRAINT "desktop_devices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_binding_codes" ADD CONSTRAINT "desktop_binding_codes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_binding_codes" ADD CONSTRAINT "desktop_binding_codes_redeemed_device_id_fkey" FOREIGN KEY ("redeemed_device_id") REFERENCES "desktop_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_binding_codes" ADD CONSTRAINT "desktop_binding_codes_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
